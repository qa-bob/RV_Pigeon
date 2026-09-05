// Manual verification mode for the Outdoorsy adapter (Constitution
// Principle VI: the adapter is exempt from automated test-first and is
// validated this way instead). Logs in and lists reservations with a
// VISIBLE browser, but never calls postMessage — nothing gets sent to a
// real guest. Run with `npm run dry-run` after `npm run setup-credentials`.
import "dotenv/config";
import { loadCredentials } from "./credential-store";
import { outdoorsyAdapter } from "./adapters/outdoorsy";

process.env.RV_PIGEON_HEADLESS = "false";

async function main() {
  const credentials = loadCredentials();
  console.log("Logging into Outdoorsy...");
  const session = await outdoorsyAdapter.login(credentials);
  try {
    console.log("Login succeeded. Listing reservations...");
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
