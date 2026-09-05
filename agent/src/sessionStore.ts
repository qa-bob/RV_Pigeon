// Local, encrypted storage for a resumed Outdoorsy browser session (cookies
// + localStorage from Playwright's storageState). This is what routine
// sync/deliver runs actually authenticate with — established once via
// bootstrapSession.ts, where you manually log in (solving the CAPTCHA and
// emailed verification code yourself, since neither this agent nor Claude
// will ever attempt that). A saved session is exactly as sensitive as the
// password that created it, so it's encrypted the same way (see dpapi.ts)
// and never leaves this machine, per Constitution Principle I.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname } from "node:path";
import { dpapiProtect, dpapiUnprotect } from "./dpapi";

const DEFAULT_PATH = `${homedir()}\\.rv-pigeon\\outdoorsy-session.dat`;

function getSessionPath(): string {
  return process.env.SESSION_STORE_PATH ?? DEFAULT_PATH;
}

export function sessionExists(): boolean {
  return existsSync(getSessionPath());
}

/** `storageState` is Playwright's serializable cookie/localStorage snapshot. */
export function saveSessionState(storageState: object): void {
  const protectedBase64 = dpapiProtect(JSON.stringify(storageState));
  const path = getSessionPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, protectedBase64, "utf8");
}

export function loadSessionState(): object {
  const path = getSessionPath();
  if (!existsSync(path)) {
    throw new Error(
      `No saved Outdoorsy session found at ${path}. Run "npm run bootstrap-session" in agent/ first.`,
    );
  }
  const protectedBase64 = readFileSync(path, "utf8");
  return JSON.parse(dpapiUnprotect(protectedBase64));
}
