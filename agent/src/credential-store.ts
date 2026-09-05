// Local, encrypted storage for the host's Outdoorsy login. Per Constitution
// Principle I, this credential never leaves this machine and is never sent
// to the RV_Pigeon API. Only used by bootstrapSession.ts now (to save you
// retyping it during the manual login step) — routine sync/deliver runs
// authenticate via the saved session instead (see sessionStore.ts).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname } from "node:path";
import { dpapiProtect, dpapiUnprotect } from "./dpapi";

export interface OutdoorsyCredentials {
  username: string;
  password: string;
}

const DEFAULT_PATH = `${homedir()}\\.rv-pigeon\\outdoorsy-credentials.dat`;

function getCredentialPath(): string {
  return process.env.CREDENTIAL_STORE_PATH ?? DEFAULT_PATH;
}

export function credentialsExist(): boolean {
  return existsSync(getCredentialPath());
}

export function saveCredentials(creds: OutdoorsyCredentials): void {
  const json = JSON.stringify(creds);
  const protectedBase64 = dpapiProtect(json);
  const path = getCredentialPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, protectedBase64, "utf8");
}

export function loadCredentials(): OutdoorsyCredentials {
  const path = getCredentialPath();
  if (!existsSync(path)) {
    throw new Error(
      `No Outdoorsy credentials found at ${path}. Run "npm run setup-credentials" in agent/ first.`,
    );
  }
  const protectedBase64 = readFileSync(path, "utf8");
  const json = dpapiUnprotect(protectedBase64);
  return JSON.parse(json) as OutdoorsyCredentials;
}
