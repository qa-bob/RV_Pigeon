import type {
  AgentDueMessage,
  AgentReportResultRequest,
  AgentReportSyncFailureRequest,
  AgentSyncTripsRequest,
  AgentSyncTripsResponse,
} from "@rv-pigeon/shared";

function baseUrl(): string {
  return process.env.API_BASE_URL ?? "http://localhost:4000";
}

function serviceToken(): string {
  const token = process.env.SERVICE_TOKEN;
  if (!token) {
    throw new Error("SERVICE_TOKEN is not set (see agent/.env.example)");
  }
  return token;
}

async function agentFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${serviceToken()}`);

  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${path} failed with status ${res.status}: ${body}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export function syncTrips(payload: AgentSyncTripsRequest): Promise<AgentSyncTripsResponse> {
  return agentFetch("/agent/sync-trips", { method: "POST", body: JSON.stringify(payload) });
}

export function getDueMessages(): Promise<AgentDueMessage[]> {
  return agentFetch("/agent/due-messages");
}

export function reportResult(payload: AgentReportResultRequest): Promise<void> {
  return agentFetch("/agent/report-result", { method: "POST", body: JSON.stringify(payload) });
}

export function reportSyncFailure(payload: AgentReportSyncFailureRequest): Promise<void> {
  return agentFetch("/agent/report-sync-failure", { method: "POST", body: JSON.stringify(payload) });
}
