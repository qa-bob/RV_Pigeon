# Contract: Agent API

Consumed only by the local `agent` process. Authenticated with a long-lived service token distinct
from the dashboard JWT (see Research: Agent-to-API authentication, Constitution Principle I). Never
carries Outdoorsy credentials in either direction — only trip/message data.

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| POST | `/agent/sync-trips` | `{ listingExternalId, trips: [{ externalTripId, guestFirstName, guestLastName, bookedAt, startAt, endAt, status }] }` | `{ created: number, updated: number }` | Upserts Trips by `externalTripId` within the given listing. For each new/changed Trip, recomputes ScheduledMessage rows from currently-active applicable MessageTemplates (creates new rows for new trips; recalculates `sendAt` on still-`scheduled` rows if dates changed; sets `status: skipped, skipReason: trip_cancelled` on `scheduled` rows if the trip is now `cancelled`) |
| GET | `/agent/due-messages` | – | `[{ scheduledMessageId, tripExternalId, listingExternalId, renderedBody }]` | Returns every `ScheduledMessage` with `status: scheduled` and `sendAt` ≤ now, across all listings/trips. `renderedBody` is the template rendered live against current Trip/Host/Listing data (see data-model.md "Note on rendering") |
| POST | `/agent/report-result` | `{ scheduledMessageId, outcome: "sent" \| "failed", detail?: string }` | `204 No Content` | On `sent`, sets `status: sent, sentAt: now`. On `failed`, leaves `status: scheduled` (will be retried on a later poll) and records an `AgentActivityLog` entry (`type: message_delivery, outcome: failure`) |
| POST | `/agent/report-sync-failure` | `{ listingExternalId?, detail: string }` | `204 No Content` | Records an `AgentActivityLog` entry (`type: trip_sync, outcome: failure`) for failures not tied to a specific trip (e.g., login failure, CAPTCHA, page-layout change) |

All error responses: `{ error: string }` with an appropriate 4xx/5xx status.
