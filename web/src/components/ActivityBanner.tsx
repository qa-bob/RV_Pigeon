import { useEffect, useState } from "react";
import type { AgentActivityLogEntry } from "@rv-pigeon/shared";
import { listRecentFailures } from "../services/activity";

const POLL_INTERVAL_MS = 60_000;

export function ActivityBanner() {
  const [failures, setFailures] = useState<AgentActivityLogEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const entries = await listRecentFailures();
        if (!cancelled) setFailures(entries);
      } catch {
        // Don't let a transient fetch failure crash the whole dashboard shell.
      }
    }
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (failures.length === 0) return null;

  const latest = failures[0];

  return (
    <div
      role="alert"
      style={{
        background: "#fee2e2",
        color: "#7f1d1d",
        padding: "0.75rem 1rem",
        borderBottom: "1px solid #fca5a5",
      }}
    >
      {failures.length} automation failure{failures.length === 1 ? "" : "s"} in the last 24 hours —
      most recent: "{latest.detail}" ({new Date(latest.occurredAt).toLocaleString()})
    </div>
  );
}
