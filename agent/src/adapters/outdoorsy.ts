import { createInterface } from "node:readline/promises";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import type { PlatformAdapter, PlatformSession } from "../adapter.interface";
import { loadCredentials } from "../credential-store";
import { saveSessionState, loadSessionState } from "../sessionStore";
import type { PlatformReservation } from "@rv-pigeon/shared";

// ⚠️ PARTIALLY VERIFIED SELECTORS. The login-through-Bookings-list flow
// below was captured with real Playwright codegen / inspected HTML against
// the live site on 2026-09-05 and should be accurate. The Bookings list
// card, notably, does NOT expose a trip id or booking date anywhere in its
// HTML — Outdoorsy only shows those on a trip's own detail page (reached
// via "View booking"), which hasn't been inspected yet. reservationExternalId
// and reservationBookedAt below are therefore still placeholders, along
// with everything about a trip's message thread. Per Constitution
// Principle II, every Outdoorsy-specific detail lives only in this file.
const SELECTORS = {
  homepageUrl: "https://www.outdoorsy.com/",
  closeModalLabel: "Close Modal",
  logInButtonName: "Log in",
  emailTextboxName: "Email address Email address",
  passwordTextboxName: "Password Password Show",
  logInSubmitName: "Log in", // exact match, distinguishes from the nav button of the same name
  switchToHostingLinkName: "Switch to hosting",
  acceptCookiesText: "Accept cookies",
  // Two different real links both match a fuzzy name of "Bookings" — the
  // sidebar nav item (exact text "Bookings", filtered to ?tab=Pending) and a
  // "View all bookings" CTA. bookingsLinkName + exact:true targets only the
  // former (used just as an "are we in hosting mode" visibility check);
  // bookingsUrl navigates directly to the latter's unfiltered URL, which is
  // what we actually want for listing every reservation regardless of status.
  bookingsLinkName: "Bookings",
  bookingsUrl: "https://www.outdoorsy.com/dashboard/bookings",

  // Real, from inspected HTML (2026-09-05): each row is a `div.cursor-pointer`
  // direct child of the bookings grid, scoped here by containing a "Starts"
  // label so this doesn't accidentally match unrelated clickable elements
  // elsewhere on the page.
  reservationRow: "div.cursor-pointer",
  reservationRowAnchorText: "Starts",
  reservationGuestName: "p.text-lg.font-medium.capitalize.text-primary",
  reservationStatus: '[role="status"]',
  // Field label -> value pairs, in the fixed order Outdoorsy renders them.
  reservationFieldBlock: '[class*="max-w-"]',

  // Still placeholders — no id/date exists on the list view (see header).
  reservationExternalId: '[data-testid="reservation-id"]',
  reservationBookedAt: '[data-testid="booked-at"]',
  tripMessageThreadUrl: (externalTripId: string) =>
    `https://www.outdoorsy.com/host/reservations/${externalTripId}/messages`,
  messageComposer: '[data-testid="message-composer"]',
  messageSendButton: '[data-testid="message-send"]',
};

interface OutdoorsySession extends PlatformSession {
  platform: "outdoorsy";
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

function mapStatus(rawStatus: string): PlatformReservation["status"] {
  const normalized = rawStatus.trim().toLowerCase();
  if (normalized.includes("cancel")) return "cancelled";
  if (normalized.includes("complete") || normalized.includes("finished")) return "completed";
  if (normalized.includes("active") || normalized.includes("in progress")) return "active";
  // Real observed value (2026-09-05): "Confirmed" — falls through to "booked",
  // which is correct for a reservation that hasn't started yet.
  return "booked";
}

/** Splits "Jeff Turner" -> ("Jeff", "Turner"), "mark van horn" -> ("mark", "van horn"). */
function splitGuestName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

/**
 * Outdoorsy renders each date as plain text like "Oct 15, 2026" (no
 * machine-readable datetime attribute) and shows no time-of-day, so this
 * resolves to local midnight on that date.
 */
function parseCardDate(text: string): string {
  const parsed = new Date(text.trim());
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Could not parse date text "${text}"`);
  }
  return parsed.toISOString();
}

const DEBUG_SCREENSHOT_DIR = `${homedir()}\\.rv-pigeon\\debug-screenshots`;

/** Saves a screenshot on failure so you can see what actually happened, without needing to have been watching. */
async function captureDebugScreenshot(page: Page, label: string): Promise<string> {
  mkdirSync(DEBUG_SCREENSHOT_DIR, { recursive: true });
  const path = `${DEBUG_SCREENSHOT_DIR}\\${label}-${Date.now()}.png`;
  await page.screenshot({ path, fullPage: true }).catch(() => {
    // If even the screenshot fails (e.g., page/context already closed), don't
    // let that mask the original error.
  });
  return path;
}

/** Best-effort dismiss of a banner/modal that may or may not be present. */
async function dismissIfPresent(page: Page, locate: () => ReturnType<Page["getByLabel"]>) {
  try {
    await locate().click({ timeout: 3_000 });
  } catch {
    // Not present — fine.
  }
}

/** Ensures the page is in the hosting view (Bookings visible), not the guest view. */
async function ensureHostingView(page: Page): Promise<void> {
  const bookingsLink = page.getByRole("link", { name: SELECTORS.bookingsLinkName, exact: true });
  const alreadyHosting = await bookingsLink.isVisible().catch(() => false);
  if (alreadyHosting) return;

  await page.getByRole("link", { name: SELECTORS.switchToHostingLinkName }).click();
  await dismissIfPresent(page, () => page.getByText(SELECTORS.acceptCookiesText));
  await bookingsLink.waitFor({ timeout: 30_000 });
}

export const outdoorsyAdapter: PlatformAdapter = {
  async login(): Promise<PlatformSession> {
    const storageState = loadSessionState();
    // Resuming a session needs no human input, so this stays headless by
    // default; set RV_PIGEON_HEADLESS=false (as dry-run does) if you want to
    // watch it for debugging.
    const headless = process.env.RV_PIGEON_HEADLESS !== "false";
    const browser = await chromium.launch({ headless });
    const context = await browser.newContext({ storageState: storageState as any });
    const page = await context.newPage();

    try {
      await page.goto(SELECTORS.homepageUrl);
      const loggedIn = await page
        .getByRole("button", { name: SELECTORS.logInButtonName })
        .isHidden({ timeout: 10_000 })
        .catch(() => false);
      if (!loggedIn) {
        throw new Error("Session appears expired (a Log in button is still showing)");
      }
      await ensureHostingView(page);
    } catch (err) {
      const screenshotPath = await captureDebugScreenshot(page, "login-failed");
      await browser.close();
      throw new Error(
        "Resuming the saved Outdoorsy session failed — it has likely expired, or something " +
          `unexpected (e.g. a popup) is blocking the page. Screenshot saved to ${screenshotPath} — ` +
          `check it before assuming you need to re-run "npm run bootstrap-session". Details: ${(err as Error).message}`,
      );
    }

    const session: OutdoorsySession = { platform: "outdoorsy", browser, context, page };
    return session;
  },

  async listReservations(session: PlatformSession): Promise<PlatformReservation[]> {
    const { page } = session as OutdoorsySession;
    try {
      await page.goto(SELECTORS.bookingsUrl);
    } catch (err) {
      const screenshotPath = await captureDebugScreenshot(page, "list-reservations-failed");
      throw new Error(
        `Couldn't open Bookings (screenshot saved to ${screenshotPath}): ${(err as Error).message}`,
      );
    }
    const rows = await page
      .locator(SELECTORS.reservationRow)
      .filter({ has: page.getByText(SELECTORS.reservationRowAnchorText, { exact: true }) })
      .all();

    const reservations: PlatformReservation[] = [];

    for (const row of rows) {
      // TODO(externalTripId, bookedAt): not present anywhere in the Bookings
      // list card — only on a trip's own detail page ("View booking"), not
      // yet inspected. Every row is currently skipped below until that's
      // captured; see SELECTORS' header comment.
      const externalTripId = await row
        .locator(SELECTORS.reservationExternalId)
        .textContent()
        .catch(() => null);
      if (!externalTripId) {
        continue;
      }

      const guestFullName = (await row.locator(SELECTORS.reservationGuestName).first().textContent()) ?? "";
      const { firstName: guestFirstName, lastName: guestLastName } = splitGuestName(guestFullName);

      const rawStatus = (await row.locator(SELECTORS.reservationStatus).first().textContent()) ?? "";

      // Each labeled block is <p>Label</p><p>Value</p>, e.g. "Starts" / "Oct 15, 2026".
      const fields = await row.evaluate((rowEl, blockSelector) => {
        const map: Record<string, string> = {};
        for (const block of Array.from(rowEl.querySelectorAll(blockSelector))) {
          const ps = block.querySelectorAll("p");
          const label = ps[0]?.textContent?.trim();
          const value = ps[1]?.textContent?.trim();
          if (label) map[label] = value ?? "";
        }
        return map;
      }, SELECTORS.reservationFieldBlock);

      if (!fields.Starts || !fields.Ends) {
        continue; // Couldn't confidently parse this row — skip rather than send bad data upstream.
      }

      const startAt = parseCardDate(fields.Starts);
      const endAt = parseCardDate(fields.Ends);
      const bookedAt = await row
        .locator(SELECTORS.reservationBookedAt)
        .textContent()
        .catch(() => null);

      reservations.push({
        externalTripId,
        guestFirstName,
        guestLastName,
        bookedAt: bookedAt ? parseCardDate(bookedAt) : startAt,
        startAt,
        endAt,
        status: mapStatus(rawStatus),
      });
    }

    return reservations;
  },

  async postMessage(session: PlatformSession, externalTripId: string, body: string): Promise<void> {
    const { page } = session as OutdoorsySession;
    try {
      await page.goto(SELECTORS.tripMessageThreadUrl(externalTripId));
      await page.fill(SELECTORS.messageComposer, body);
      await page.click(SELECTORS.messageSendButton);
      await page.waitForTimeout(1000); // brief settle time for the send to register
    } catch (err) {
      const screenshotPath = await captureDebugScreenshot(page, `post-message-failed-${externalTripId}`);
      throw new Error(
        `Failed to post message for trip ${externalTripId} (screenshot saved to ${screenshotPath}): ` +
          (err as Error).message,
      );
    }
  },

  async close(session: PlatformSession): Promise<void> {
    await (session as OutdoorsySession).browser.close();
  },
};

/**
 * One-time (or as-needed) manual bootstrap: opens a VISIBLE browser and
 * attempts to auto-fill your saved email/password as a convenience — but
 * Outdoorsy's homepage can show unpredictable promotional popups that block
 * this, so it's genuinely best-effort. If it fails at any point, that's
 * fine: you finish the login yourself in the browser window, same as you'd
 * have to for the CAPTCHA and emailed verification code anyway. Once you
 * confirm you're on the Bookings page, it saves the resulting authenticated
 * session (encrypted, local-only) for routine sync/deliver runs to reuse.
 * Run via `npm run bootstrap-session`.
 */
export async function bootstrapOutdoorsySession(): Promise<void> {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(SELECTORS.homepageUrl);

  let autoFilled = false;
  try {
    const credentials = loadCredentials();
    await dismissIfPresent(page, () => page.getByLabel(SELECTORS.closeModalLabel));
    await page.getByRole("button", { name: SELECTORS.logInButtonName }).click({ timeout: 10_000 });
    await page
      .getByRole("textbox", { name: SELECTORS.emailTextboxName })
      .fill(credentials.username, { timeout: 10_000 });
    await page
      .getByRole("textbox", { name: SELECTORS.passwordTextboxName })
      .fill(credentials.password, { timeout: 10_000 });
    await page
      .getByRole("button", { name: SELECTORS.logInSubmitName, exact: true })
      .click({ timeout: 10_000 });
    autoFilled = true;
  } catch (err) {
    console.log(
      "Couldn't auto-fill the login form (probably a popup got in the way): " +
        (err as Error).message,
    );
    console.log("No problem — just do the login yourself below.");
  }

  console.log("\nOver to you in the browser window:");
  if (!autoFilled) {
    console.log("  1. Close any popups, click Log in, and enter your email/password.");
  }
  console.log("  2. Solve the CAPTCHA if one appears.");
  console.log("  3. Enter the emailed verification code if asked.");
  console.log('  4. Click "Switch to hosting" and dismiss the cookie banner if it shows.');
  console.log('  5. Make sure you can see the "Bookings" link/page.');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await rl.question("\nOnce you're on the Bookings page, press Enter here to continue...");
  rl.close();

  // Trusting your confirmation above rather than re-checking automatically —
  // you just told me you can see it, no need to risk a fresh timeout here.
  const storageState = await context.storageState();
  saveSessionState(storageState);
  await browser.close();

  console.log("Session saved and encrypted locally (Windows DPAPI, CurrentUser).");
}
