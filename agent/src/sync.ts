import "dotenv/config";
import { outdoorsyAdapter } from "./adapters/outdoorsy";
import { syncTrips, reportSyncFailure } from "./apiClient";

export async function runSync(): Promise<void> {
  const listingExternalId = process.env.OUTDOORSY_LISTING_ID;
  if (!listingExternalId) {
    throw new Error("OUTDOORSY_LISTING_ID is not set (see agent/.env.example)");
  }

  // login() moved inside the try (it used to be outside it, which meant a
  // login/session failure skipped the catch below entirely — silently, with
  // no console output and nothing reported to the API).
  let session: Awaited<ReturnType<typeof outdoorsyAdapter.login>> | undefined;
  try {
    session = await outdoorsyAdapter.login();
    const reservations = await outdoorsyAdapter.listReservations(session);
    const { created, updated } = await syncTrips({ listingExternalId, trips: reservations });
    console.log(`Sync complete: ${created} created, ${updated} updated.`);
  } catch (err) {
    const detail = (err as Error).message;
    console.error("Sync failed:", detail);
    await reportSyncFailure({ listingExternalId, detail }).catch((reportErr) => {
      console.error("Additionally failed to report the sync failure to the API:", reportErr);
    });
    throw err;
  } finally {
    if (session) {
      await outdoorsyAdapter.close(session);
    }
  }
}

if (require.main === module) {
  runSync().catch((err) => {
    // The catch above already logs anything that happens once login()
    // starts; this covers failures before that (e.g. a missing env var),
    // which would otherwise exit with zero output at all.
    console.error("Fatal:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
