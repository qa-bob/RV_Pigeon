// One-time (or as-needed) local setup: prompts for the Outdoorsy login and
// stores it via credential-store.ts. Run with `npm run setup-credentials`
// in agent/. Never run this against anything other than your own machine.
import { createInterface } from "node:readline/promises";
import { saveCredentials } from "./credential-store";

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const username = (await rl.question("Outdoorsy email/username: ")).trim();
  const password = (await rl.question("Outdoorsy password: ")).trim();
  rl.close();

  if (!username || !password) {
    console.error("Both fields are required.");
    process.exit(1);
  }

  saveCredentials({ username, password });
  console.log("Outdoorsy credentials saved and encrypted locally (Windows DPAPI, CurrentUser).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
