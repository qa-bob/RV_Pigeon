// Shared Windows DPAPI (CurrentUser scope) encrypt/decrypt helpers, via a
// small PowerShell call. Used by both credential-store.ts (the Outdoorsy
// login) and sessionStore.ts (the resumed browser session) so any local
// secret this agent holds is protected the same way and unreadable outside
// this Windows user account, even if the file itself is copied elsewhere.
//
// Data is passed via stdin/stdout, NOT as a command-line argument -- a
// resumed browser session can carry many KB of third-party tracker cookies
// (ad networks, analytics, etc. that the target site loads), which blew
// past the Windows command-line length limit when this used to embed the
// payload directly into the PowerShell -Command string.
import { execFileSync } from "node:child_process";

const BASE64_PATTERN = /^[A-Za-z0-9+/=]+$/;

function assertBase64(value: string): void {
  if (!BASE64_PATTERN.test(value)) {
    throw new Error("Corrupt data (not valid base64)");
  }
}

function runPowerShell(script: string, input: string): string {
  return execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    encoding: "utf8",
    input,
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

export function dpapiProtect(plaintext: string): string {
  const plainBase64 = Buffer.from(plaintext, "utf8").toString("base64");
  const script = [
    "Add-Type -AssemblyName System.Security",
    "$plainBase64 = [Console]::In.ReadToEnd()",
    "$bytes = [Convert]::FromBase64String($plainBase64)",
    "$protected = [System.Security.Cryptography.ProtectedData]::Protect(" +
      "$bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)",
    "[Convert]::ToBase64String($protected)",
  ].join("\n");
  return runPowerShell(script, plainBase64);
}

export function dpapiUnprotect(protectedBase64: string): string {
  assertBase64(protectedBase64);
  const script = [
    "Add-Type -AssemblyName System.Security",
    "$protectedBase64 = [Console]::In.ReadToEnd()",
    "$bytes = [Convert]::FromBase64String($protectedBase64)",
    "$plain = [System.Security.Cryptography.ProtectedData]::Unprotect(" +
      "$bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)",
    "[Convert]::ToBase64String($plain)",
  ].join("\n");
  const plainBase64 = runPowerShell(script, protectedBase64);
  assertBase64(plainBase64);
  return Buffer.from(plainBase64, "base64").toString("utf8");
}
