import "dotenv/config";
import { loadCredentials } from "./credential-store";
import { outdoorsyAdapter } from "./adapters/outdoorsy";
import { syncTrips, reportSyncFailure } from "./apiClient";

export async function runSync(): Promise<void> {
  const listingExternalId = process.env.OUTDOORSY_LISTING_ID;
  if (!listingExternalId) {
    throw new Error("OUTDOORSY_LISTING_ID is not set (see agent/.env.example)");
  }

  const credentials = loadCredentials();
  const session = await outdoorsyAdapter.login(credentials);
  try {
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
    await outdoorsyAdapter.close(session);
  }
}

if (require.main === module) {
  runSync().catch(() => process.exit(1));
}
