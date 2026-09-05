import { createInterface } from "node:readline/promises";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import type { PlatformAdapter, PlatformSession } from "../adapter.interface";
import { loadCredentials } from "../credential-store";
import { saveSessionState, loadSessionState } from "../sessionStore";
import type { PlatformReservation } from "@rv-pigeon/shared";

// ⚠️ PARTIALLY VERIFIED SELECTORS. The login-through-"Bookings" flow below
// (SELECTORS.homepageUrl through bookingsLinkName) was captured with real
// Playwright codegen against the live site on 2026-09-05 and should be
// accurate. Everything past that point (reservation rows, a trip's message
// thread) is STILL a placeholder guess — codegen only ran as far as the
// Bookings list. Before trusting listReservations/postMessage, record a
// further codegen session from the Bookings page into an individual trip's
// message thread and update those selectors too. Per Constitution
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
  bookingsLinkName: "Bookings",

  // Still placeholders — see file header.
  reservationRow: '[data-testid="reservation-row"]',
  reservationExternalId: '[data-testid="reservation-id"]',
  reservationGuestFirstName: '[data-testid="guest-first-name"]',
  reservationGuestLastName: '[data-testid="guest-last-name"]',
  reservationBookedAt: '[data-testid="booked-at"]',
  reservationStartAt: '[data-testid="trip-start"]',
  reservationEndAt: '[data-testid="trip-end"]',
  reservationStatus: '[data-testid="trip-status"]',
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
  return "booked";
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
  const bookingsLink = page.getByRole("link", { name: SELECTORS.bookingsLinkName });
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
      await browser.close();
      throw new Error(
        "Resuming the saved Outdoorsy session failed — it has likely expired. Re-run " +
          `"npm run bootstrap-session" in agent/. Details: ${(err as Error).message}`,
      );
    }

    const session: OutdoorsySession = { platform: "outdoorsy", browser, context, page };
    return session;
  },

  async listReservations(session: PlatformSession): Promise<PlatformReservation[]> {
    const { page } = session as OutdoorsySession;
    await page.getByRole("link", { name: SELECTORS.bookingsLinkName }).click();
    await page.waitForSelector(SELECTORS.reservationRow, { timeout: 30_000 }).catch(() => {
      // No reservations is a valid state, not a failure — fall through with an empty list.
    });

    const rows = await page.$$(SELECTORS.reservationRow);
    const reservations: PlatformReservation[] = [];

    for (const row of rows) {
      const externalTripId = await row
        .$eval(SELECTORS.reservationExternalId, (el) => el.textContent?.trim() ?? "")
        .catch(() => "");
      const startAt = await row
        .$eval(SELECTORS.reservationStartAt, (el) => el.getAttribute("datetime") ?? "")
        .catch(() => "");
      const endAt = await row
        .$eval(SELECTORS.reservationEndAt, (el) => el.getAttribute("datetime") ?? "")
        .catch(() => "");

      if (!externalTripId || !startAt || !endAt) {
        // Skip rows we can't confidently parse rather than sending bad data upstream.
        continue;
      }

      const guestFirstName = await row
        .$eval(SELECTORS.reservationGuestFirstName, (el) => el.textContent?.trim() ?? "")
        .catch(() => "");
      const guestLastName = await row
        .$eval(SELECTORS.reservationGuestLastName, (el) => el.textContent?.trim() ?? "")
        .catch(() => "");
      const bookedAt = await row
        .$eval(SELECTORS.reservationBookedAt, (el) => el.getAttribute("datetime") ?? "")
        .catch(() => "");
      const rawStatus = await row
        .$eval(SELECTORS.reservationStatus, (el) => el.textContent?.trim() ?? "")
        .catch(() => "");

      reservations.push({
        externalTripId,
        guestFirstName,
        guestLastName,
        bookedAt: bookedAt || startAt,
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
      throw new Error(
        `Failed to post message for trip ${externalTripId} (page layout may have changed): ` +
          (err as Error).message,
      );
    }
  },

  async close(session: PlatformSession): Promise<void> {
    await (session as OutdoorsySession).browser.close();
  },
};

/**
 * One-time (or as-needed) manual bootstrap: opens a VISIBLE browser,
 * auto-fills your saved email/password to save retyping, then pauses for
 * you to do the parts that require a human — solving the CAPTCHA, entering
 * the emailed verification code, switching to hosting, dismissing the
 * cookie banner. Once you confirm you're on the Bookings page, it saves the
 * resulting authenticated session (encrypted, local-only) for routine
 * sync/deliver runs to reuse. Run via `npm run bootstrap-session`.
 */
export async function bootstrapOutdoorsySession(): Promise<void> {
  const credentials = loadCredentials();
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(SELECTORS.homepageUrl);
  await dismissIfPresent(page, () => page.getByLabel(SELECTORS.closeModalLabel));
  await page.getByRole("button", { name: SELECTORS.logInButtonName }).click();
  await page.getByRole("textbox", { name: SELECTORS.emailTextboxName }).fill(credentials.username);
  await page
    .getByRole("textbox", { name: SELECTORS.passwordTextboxName })
    .fill(credentials.password);
  await page.getByRole("button", { name: SELECTORS.logInSubmitName, exact: true }).click();

  console.log("\nOver to you in the browser window:");
  console.log("  1. Solve the CAPTCHA if one appears.");
  console.log("  2. Enter the emailed verification code if asked.");
  console.log('  3. Click "Switch to hosting" and dismiss the cookie banner if it shows.');
  console.log('  4. Make sure you can see the "Bookings" link/page.');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await rl.question("\nOnce you're on the Bookings page, press Enter here to continue...");
  rl.close();

  await ensureHostingView(page);

  const storageState = await context.storageState();
  saveSessionState(storageState);
  await browser.close();

  console.log("Session saved and encrypted locally (Windows DPAPI, CurrentUser).");
}
