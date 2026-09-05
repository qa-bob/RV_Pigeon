import { chromium, Browser, Page } from "playwright";
import type { PlatformAdapter, PlatformSession } from "../adapter.interface";
import type { OutdoorsyCredentials } from "../credential-store";
import type { PlatformReservation } from "@rv-pigeon/shared";

// ⚠️ PLACEHOLDER SELECTORS. These have NOT been verified against the live
// Outdoorsy site — they're a structural best guess. Before trusting this
// adapter, run `npm run dry-run` in agent/ against your real account, and
// use `npx playwright codegen https://www.outdoorsy.com/login` (and the
// host reservations/messages pages) to capture the real selectors and
// update this block. Per Constitution Principle II, every Outdoorsy-specific
// detail (URLs, selectors, page structure) must live only in this file —
// nothing outside agent/src/adapters/outdoorsy.ts should ever need to change
// when Outdoorsy's site changes.
const SELECTORS = {
  loginUrl: "https://www.outdoorsy.com/login",
  emailInput: 'input[name="email"]',
  passwordInput: 'input[name="password"]',
  loginSubmit: 'button[type="submit"]',
  loginSuccessIndicator: '[data-testid="host-dashboard"]',
  reservationsUrl: "https://www.outdoorsy.com/host/reservations",
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
  page: Page;
}

function mapStatus(rawStatus: string): PlatformReservation["status"] {
  const normalized = rawStatus.trim().toLowerCase();
  if (normalized.includes("cancel")) return "cancelled";
  if (normalized.includes("complete") || normalized.includes("finished")) return "completed";
  if (normalized.includes("active") || normalized.includes("in progress")) return "active";
  return "booked";
}

export const outdoorsyAdapter: PlatformAdapter = {
  async login(credentials: OutdoorsyCredentials): Promise<PlatformSession> {
    // Dry-run mode (npm run dry-run) sets RV_PIGEON_HEADLESS=false so you can
    // watch the browser and visually confirm the adapter against the real site.
    const headless = process.env.RV_PIGEON_HEADLESS !== "false";
    const browser = await chromium.launch({ headless });
    const page = await browser.newPage();
    try {
      await page.goto(SELECTORS.loginUrl);
      await page.fill(SELECTORS.emailInput, credentials.username);
      await page.fill(SELECTORS.passwordInput, credentials.password);
      await page.click(SELECTORS.loginSubmit);
      await page.waitForSelector(SELECTORS.loginSuccessIndicator, { timeout: 30_000 });
    } catch (err) {
      await browser.close();
      throw new Error(
        "Outdoorsy login failed (page layout may have changed, or a CAPTCHA/2FA " +
          `challenge appeared): ${(err as Error).message}`,
      );
    }
    const session: OutdoorsySession = { platform: "outdoorsy", browser, page };
    return session;
  },

  async listReservations(session: PlatformSession): Promise<PlatformReservation[]> {
    const { page } = session as OutdoorsySession;
    await page.goto(SELECTORS.reservationsUrl);
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
