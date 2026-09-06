// Entry point invoked by Windows Task Scheduler on a fixed interval
// (see specs/001-outdoorsy-scheduled-messaging/quickstart.md and
// research.md "Local agent scheduling mechanism"). Runs sync then deliver;
// a failure in one does not prevent the other from being attempted, since
// previously-scheduled messages should still get a chance to go out even if
// this run's reservation sync failed.
import "dotenv/config";
import { runSync } from "./sync";
import { runDeliver } from "./deliver";

// Headed is the default (see adapters/outdoorsy.ts — true headless is
// confirmed to trip Outdoorsy's Cloudflare bot-detection), but a real
// browser window popping up every scheduled run would be disruptive while
// you're using your PC. Positions it off-screen instead of hiding it via
// headless mode. Requires Task Scheduler to run this only while logged in
// (register-task.ps1 -RequireLogon) — an off-screen window still needs an
// active desktop session to render at all.
process.env.RV_PIGEON_OFFSCREEN = "true";

async function main() {
  console.log(`[${new Date().toISOString()}] Starting sync...`);
  try {
    await runSync();
  } catch (err) {
    console.error("Sync step failed (already reported to the API):", err);
  }

  console.log(`[${new Date().toISOString()}] Starting deliver...`);
  try {
    await runDeliver();
  } catch (err) {
    console.error("Deliver step failed:", err);
  }

  console.log(`[${new Date().toISOString()}] Run complete.`);
}

main();
