// The one interface every rental-platform adapter must implement.
// Per Constitution Principle II, no platform-specific logic (selectors,
// page structure, quirks) may exist anywhere outside a file implementing
// this interface (e.g., agent/src/adapters/outdoorsy.ts).
import type { PlatformReservation } from "@rv-pigeon/shared";

export interface PlatformSession {
  // Opaque to callers; each adapter defines its own session shape internally.
  readonly platform: string;
}

export interface PlatformAdapter {
  /**
   * Resume a previously-established authenticated session (see each
   * adapter's own bootstrap step) and return it for use by the other
   * methods. Takes no credentials — routine automated runs never perform a
   * fresh interactive login (that may require solving a CAPTCHA or entering
   * an emailed code, which only a human can do). If no valid session is
   * available, this should throw a clear error telling the host to re-run
   * that adapter's bootstrap step.
   */
  login(): Promise<PlatformSession>;

  /** List current reservations for the connected host account. */
  listReservations(session: PlatformSession): Promise<PlatformReservation[]>;

  /** Post a message into the platform's own guest conversation for a trip. */
  postMessage(
    session: PlatformSession,
    externalTripId: string,
    body: string,
  ): Promise<void>;

  /** Release any resources (e.g., close the browser) held by the session. */
  close(session: PlatformSession): Promise<void>;
}
