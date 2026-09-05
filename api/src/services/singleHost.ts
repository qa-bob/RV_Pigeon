import { Host } from "../models/host";
import type { HydratedDocument } from "mongoose";

/**
 * This feature supports exactly one host account (FR-014). Agent-facing
 * routes authenticate via a shared service token rather than a per-host
 * JWT, so they resolve "the host" this way instead. Throws loudly if that
 * invariant is ever violated, rather than silently picking one of many.
 */
export async function getSingleHost(): Promise<HydratedDocument<any>> {
  const hosts = await Host.find({}).limit(2);
  if (hosts.length === 0) {
    throw new Error("No host account exists yet. Run `npm run seed:host` in api/ first.");
  }
  if (hosts.length > 1) {
    throw new Error(
      "Multiple host accounts found, but this feature only supports a single host account.",
    );
  }
  return hosts[0];
}
