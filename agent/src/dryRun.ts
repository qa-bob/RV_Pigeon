// Manual verification mode for the Outdoorsy adapter (Constitution
// Principle VI: the adapter is exempt from automated test-first and is
// validated this way instead). Resumes your saved session (run
// `npm run bootstrap-session` first) with a VISIBLE browser and lists
// reservations, but never calls postMessage — nothing gets sent to a real
// guest. Run with `npm run dry-run`.
import "dotenv/config";
import { outdoorsyAdapter } from "./adapters/outdoorsy";

process.env.RV_PIGEON_HEADLESS = "false";

async function main() {
  console.log("Resuming saved Outdoorsy session...");
  const session = await outdoorsyAdapter.login();
  try {
    console.log("Session valid. Listing reservations...");
    const reservations = await outdoorsyAdapter.listReservations(session);
    console.log(`Found ${reservations.length} reservation(s):`);
    console.table(reservations);
    console.log(
      "\nDry run complete. No messages were sent. Verify the fields above look " +
        "correct before trusting `npm run sync` / `npm run deliver` against this account.",
    );
  } finally {
    await outdoorsyAdapter.close(session);
  }
}

main().catch((err) => {
  console.error("Dry run failed:", err);
  process.exit(1);
});
