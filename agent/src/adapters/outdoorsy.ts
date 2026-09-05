import { createInterface } from "node:readline/promises";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import type { PlatformAdapter, PlatformSession } from "../adapter.interface";
import { loadCredentials } from "../credential-store";
import { saveSessionState, loadSessionState } from "../sessionStore";
import type { PlatformReservation } from "@rv-pigeon/shared";

// ⚠️ PARTIALLY VERIFIED SELECTORS. Everything through reservationFieldBlock
// was captured with real Playwright codegen / inspected HTML against the
// live site on 2026-09-05 and should be accurate, including the Bookings
// list card and a trip's own detail page. A trip's MESSAGE THREAD has not
// been inspected yet — tripMessageThreadUrl/messageComposer/
// messageSendButton are still placeholder guesses. Per Constitution
// Principle II, every Outdoorsy-specific detail lives only in this file.
//
// Note: neither the list card nor the detail page shows a booking-creation
// timestamp anywhere — Outdoorsy just doesn't expose one in the host UI.
// "trip booked" is therefore defined as when RV_Pigeon's own API first syncs
// the trip (see api/src/services/tripSync.ts), not something scraped here.
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

  // Bookings LIST card: each row is a `div.cursor-pointer` direct child of
  // the bookings grid, scoped here by containing a "Starts" label so this
  // doesn't accidentally match unrelated clickable elements on the page.
  reservationRow: "div.cursor-pointer",
  reservationRowAnchorText: "Starts",
  reservationGuestName: "p.text-lg.font-medium.capitalize.text-primary",
  reservationStatus: '[role="status"]',

  // Trip DETAIL page ("View booking" / clicking a row): only the Booking ID
  // and the precise start/end date+time live here, not on the list. Read by
  // matching the actual visible label text ("Booking ID", "Starts", "Ends")
  // rather than Outdoorsy's internal build-hashed CSS classes, which are far
  // more likely to change between deploys than the label wording itself.
  detailUrlPattern: /\/dashboard\/bookings\/\d+/,
  detailBookingIdLabel: "Booking ID",
  detailStartsLabel: "Starts",
  detailEndsLabel: "Ends",

  // Still a placeholder — not inspected yet.
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

/** Parses the detail page's combined "Thu, Oct 15, 2026 12:00 pm" text into an ISO string. */
function parseDetailDateTime(text: string): string {
  const parsed = new Date(text.trim());
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Could not parse date/time text "${text}"`);
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
    const rowLocator = () =>
      page
        .locator(SELECTORS.reservationRow)
        .filter({ has: page.getByText(SELECTORS.reservationRowAnchorText, { exact: true }) });

    const rowCount = await rowLocator().count();
    const reservations: PlatformReservation[] = [];

    for (let i = 0; i < rowCount; i++) {
      // Re-query fresh each pass: navigating to a trip's detail page and
      // back re-renders the list, detaching any previously-held handles.
      const row = rowLocator().nth(i);

      const guestFullName = (await row.locator(SELECTORS.reservationGuestName).first().textContent()) ?? "";
      const { firstName: guestFirstName, lastName: guestLastName } = splitGuestName(guestFullName);
      const rawStatus = (await row.locator(SELECTORS.reservationStatus).first().textContent()) ?? "";

      await row.click();
      await page.waitForURL(SELECTORS.detailUrlPattern, { timeout: 15_000 }).catch(() => {
        // If the URL doesn't change as expected, the extraction below will
        // simply come back empty and this row gets skipped — not fatal.
      });

      const detail = await page.evaluate(
        ({ bookingIdLabel, startsLabel, endsLabel }) => {
          const textOf = (el: Element | null | undefined) => el?.textContent?.trim() ?? "";
          const ownTextIs = (el: Element, label: string) => textOf(el) === label;

          function findValueAfterLabel(labelText: string): string | null {
            const candidates = Array.from(document.querySelectorAll("span"));
            const label = candidates.find((el) => ownTextIs(el, labelText));
            return label?.nextElementSibling ? textOf(label.nextElementSibling) : null;
          }

          function findDateTimeBlock(labelText: string): string | null {
            const candidates = Array.from(document.querySelectorAll("p"));
            const label = candidates.find((el) => ownTextIs(el, labelText));
            const container = label?.parentElement;
            if (!container) return null;
            const values = Array.from(container.querySelectorAll("p"))
              .slice(1)
              .map(textOf)
              .filter(Boolean);
            return values.length ? values.join(" ") : null;
          }

          return {
            bookingId: findValueAfterLabel(bookingIdLabel),
            startsText: findDateTimeBlock(startsLabel),
            endsText: findDateTimeBlock(endsLabel),
          };
        },
        {
          bookingIdLabel: SELECTORS.detailBookingIdLabel,
          startsLabel: SELECTORS.detailStartsLabel,
          endsLabel: SELECTORS.detailEndsLabel,
        },
      );

      await page.goBack();
      await page.waitForSelector(SELECTORS.reservationRow, { timeout: 15_000 }).catch(() => {});

      if (!detail.bookingId || !detail.startsText || !detail.endsText) {
        continue; // Couldn't confidently parse this row — skip rather than send bad data upstream.
      }

      reservations.push({
        externalTripId: detail.bookingId,
        guestFirstName,
        guestLastName,
        startAt: parseDetailDateTime(detail.startsText),
        endAt: parseDetailDateTime(detail.endsText),
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
