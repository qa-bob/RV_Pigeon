// The one interface every rental-platform adapter must implement.
// Per Constitution Principle II, no platform-specific logic (selectors,
// page structure, quirks) may exist anywhere outside a file implementing
// this interface (e.g., agent/src/adapters/outdoorsy.ts).
import type { OutdoorsyCredentials } from "./credential-store";
import type { PlatformReservation } from "@rv-pigeon/shared";

export interface PlatformSession {
  // Opaque to callers; each adapter defines its own session shape internally.
  readonly platform: string;
}

export interface PlatformAdapter {
  /** Log into the platform, returning a session used by the other methods. */
  login(credentials: OutdoorsyCredentials): Promise<PlatformSession>;

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
