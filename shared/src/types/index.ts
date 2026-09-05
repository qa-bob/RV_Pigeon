// Shared types for RV_Pigeon, used by web, api, and agent.
// Mirrors specs/001-outdoorsy-scheduled-messaging/data-model.md and contracts/.

export type TripStatus = "booked" | "active" | "completed" | "cancelled";

export type TriggerEvent =
  | "trip_booked"
  | "trip_start"
  | "trip_three_quarter"
  | "trip_finish";

export type OffsetUnit = "minutes" | "hours" | "days";
export type OffsetDirection = "before" | "after";

export type ScheduledMessageStatus = "scheduled" | "sent" | "skipped";
export type SkipReason = "host_manual" | "trip_cancelled";

export type ActivityType = "trip_sync" | "message_delivery";
export type ActivityOutcome = "success" | "failure";

export interface Faq {
  question: string;
  answer: string;
}

export interface GuestInstructions {
  pickupReturnInstructions: string;
  welcomeMessage: string;
}

export interface CarGuide {
  tips: string;
  faqs: Faq[];
}

export interface Listing {
  id: string;
  hostId: string;
  label: string;
  externalListingId: string;
  guestInstructions: GuestInstructions;
  carGuide: CarGuide;
  createdAt: string;
  updatedAt: string;
}

export interface Trip {
  id: string;
  listingId: string;
  externalTripId: string;
  guestFirstName: string;
  guestLastName: string;
  bookedAt: string;
  startAt: string;
  endAt: string;
  status: TripStatus;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateApplicability {
  allListings: boolean;
  listingIds: string[];
}

export interface MessageTemplate {
  id: string;
  hostId: string;
  name: string;
  triggerEvent: TriggerEvent;
  offsetAmount: number;
  offsetUnit: OffsetUnit;
  offsetDirection: OffsetDirection;
  body: string;
  applicability: TemplateApplicability;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledMessage {
  id: string;
  tripId: string;
  templateId: string;
  listingId: string;
  sendAt: string;
  status: ScheduledMessageStatus;
  sentAt: string | null;
  skipReason: SkipReason | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentActivityLogEntry {
  id: string;
  type: ActivityType;
  outcome: ActivityOutcome;
  detail: string;
  scheduledMessageId: string | null;
  tripId: string | null;
  occurredAt: string;
}

// --- Agent API contract shapes (specs/.../contracts/agent-api.md) ---

export interface AgentSyncTripInput {
  externalTripId: string;
  guestFirstName: string;
  guestLastName: string;
  startAt: string;
  endAt: string;
  status: TripStatus;
}

export interface AgentSyncTripsRequest {
  listingExternalId: string;
  trips: AgentSyncTripInput[];
}

export interface AgentSyncTripsResponse {
  created: number;
  updated: number;
}

export interface AgentDueMessage {
  scheduledMessageId: string;
  tripExternalId: string;
  listingExternalId: string;
  renderedBody: string;
}

export interface AgentReportResultRequest {
  scheduledMessageId: string;
  outcome: "sent" | "failed";
  detail?: string;
}

export interface AgentReportSyncFailureRequest {
  listingExternalId?: string;
  detail: string;
}

// --- Platform adapter contract (agent/src/adapter.interface.ts implements this) ---

export interface PlatformReservation {
  externalTripId: string;
  guestFirstName: string;
  guestLastName: string;
  startAt: string;
  endAt: string;
  status: TripStatus;
}
