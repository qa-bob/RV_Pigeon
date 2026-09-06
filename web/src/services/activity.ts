import type { AgentActivityLogEntry } from "@rv-pigeon/shared";
import { apiFetch } from "./apiClient";

export function listRecentFailures(sinceHours = 24): Promise<AgentActivityLogEntry[]> {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
  return apiFetch(`/api/activity?outcome=failure&since=${encodeURIComponent(since)}`);
}
