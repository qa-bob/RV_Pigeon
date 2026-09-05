// CLI entry point for the one-time (or as-needed) manual session bootstrap.
// Run with `npm run bootstrap-session` in agent/, after `npm run
// setup-credentials`. See adapters/outdoorsy.ts's bootstrapOutdoorsySession
// for what actually happens and why.
import "dotenv/config";
import { bootstrapOutdoorsySession } from "./adapters/outdoorsy";

bootstrapOutdoorsySession().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
