import type { ScheduledMessage, Trip } from "@rv-pigeon/shared";
import { apiFetch } from "./apiClient";

// GET /trips/:id/scheduled-messages resolves templateId to {id, name, body}
// rather than a bare id (per contracts/dashboard-api.md), unlike the base
// ScheduledMessage shape.
export interface ScheduledMessageWithTemplate extends Omit<ScheduledMessage, "templateId"> {
  templateId: { id: string; name: string; body: string };
}

export function listTrips(): Promise<Trip[]> {
  return apiFetch("/api/trips");
}

export function listScheduledMessages(tripId: string): Promise<ScheduledMessageWithTemplate[]> {
  return apiFetch(`/api/trips/${tripId}/scheduled-messages`);
}

export function sendNow(scheduledMessageId: string): Promise<ScheduledMessage> {
  return apiFetch(`/api/scheduled-messages/${scheduledMessageId}/send-now`, { method: "POST" });
}

export function skip(scheduledMessageId: string): Promise<ScheduledMessage> {
  return apiFetch(`/api/scheduled-messages/${scheduledMessageId}/skip`, { method: "POST" });
}

export function skipAllRemaining(tripId: string): Promise<{ skipped: number }> {
  return apiFetch(`/api/trips/${tripId}/scheduled-messages/skip-all-remaining`, { method: "POST" });
}
