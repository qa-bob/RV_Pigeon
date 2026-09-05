// Local, encrypted storage for the host's Outdoorsy login. Per Constitution
// Principle I, this credential never leaves this machine and is never sent
// to the RV_Pigeon API. Encryption is Windows DPAPI (CurrentUser scope), via
// a small PowerShell helper, so the secret is unreadable outside this
// Windows user account even if the credential file itself is copied.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname } from "node:path";

export interface OutdoorsyCredentials {
  username: string;
  password: string;
}

const DEFAULT_PATH = `${homedir()}\\.rv-pigeon\\outdoorsy-credentials.dat`;
const BASE64_PATTERN = /^[A-Za-z0-9+/=]+$/;

function getCredentialPath(): string {
  return process.env.CREDENTIAL_STORE_PATH ?? DEFAULT_PATH;
}

function assertBase64(value: string): void {
  if (!BASE64_PATTERN.test(value)) {
    throw new Error("Corrupt credential data (not valid base64)");
  }
}

function runPowerShell(script: string): string {
  return execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    encoding: "utf8",
  }).trim();
}

function dpapiProtect(plaintext: string): string {
  const plainBase64 = Buffer.from(plaintext, "utf8").toString("base64");
  const script = [
    "Add-Type -AssemblyName System.Security",
    `$bytes = [Convert]::FromBase64String('${plainBase64}')`,
    "$protected = [System.Security.Cryptography.ProtectedData]::Protect(" +
      "$bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)",
    "[Convert]::ToBase64String($protected)",
  ].join("\n");
  return runPowerShell(script);
}

function dpapiUnprotect(protectedBase64: string): string {
  assertBase64(protectedBase64);
  const script = [
    "Add-Type -AssemblyName System.Security",
    `$bytes = [Convert]::FromBase64String('${protectedBase64}')`,
    "$plain = [System.Security.Cryptography.ProtectedData]::Unprotect(" +
      "$bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)",
    "[Convert]::ToBase64String($plain)",
  ].join("\n");
  const plainBase64 = runPowerShell(script);
  assertBase64(plainBase64);
  return Buffer.from(plainBase64, "base64").toString("utf8");
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
