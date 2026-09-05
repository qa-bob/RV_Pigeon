# Data Model: Outdoorsy Scheduled Guest Messaging

Field types are described generically (string/number/datetime/enum/boolean/array); final schema
syntax is decided during implementation, not here.

## Host

The single account holder. Modeled as a real collection (not a singleton config) so multi-user
access remains a future, non-breaking addition rather than a rewrite.

| Field | Type | Notes |
|---|---|---|
| `_id` | id | |
| `email` | string | unique; used to log into the dashboard |
| `passwordHash` | string | bcrypt hash; never exposed via any API response |
| `createdAt` / `updatedAt` | datetime | |

## Listing

A vehicle the host rents out on Outdoorsy.

| Field | Type | Notes |
|---|---|---|
| `_id` | id | |
| `hostId` | id (→ Host) | |
| `label` | string | host-facing name, e.g. "2017 Nissan Titan XD" |
| `externalListingId` | string | Outdoorsy's own listing identifier; used to match synced trips to this Listing |
| `guestInstructions.pickupReturnInstructions` | string, ≤5000 chars | |
| `guestInstructions.welcomeMessage` | string, ≤170 chars | |
| `carGuide.tips` | string, ≤5000 chars | |
| `carGuide.faqs` | array of `{question: string, answer: string}` | repeatable |
| `createdAt` / `updatedAt` | datetime | |

## Trip

A reservation of a Listing by a guest, synced from Outdoorsy.

| Field | Type | Notes |
|---|---|---|
| `_id` | id | |
| `listingId` | id (→ Listing) | |
| `externalTripId` | string | Outdoorsy's reservation id; unique per Listing — used to upsert on sync and detect changes |
| `guestFirstName` / `guestLastName` | string | for template variable substitution |
| `bookedAt` | datetime | drives the `trip_booked` trigger |
| `startAt` / `endAt` | datetime | drive `trip_start`, `trip_three_quarter`, `trip_finish` triggers |
| `status` | enum: `booked` \| `active` \| `completed` \| `cancelled` | |
| `lastSyncedAt` | datetime | last time the agent confirmed this trip's data |
| `createdAt` / `updatedAt` | datetime | |

**Validation**: `startAt` < `endAt`. `externalTripId` unique within a Listing.

**State transitions**: `booked` → `active` → `completed`; `booked` or `active` → `cancelled`
(terminal). No transition out of `completed` or `cancelled`.

## MessageTemplate

A reusable rule that produces ScheduledMessages for the trips it applies to.

| Field | Type | Notes |
|---|---|---|
| `_id` | id | |
| `hostId` | id (→ Host) | |
| `name` | string | internal only; never shown to guests |
| `triggerEvent` | enum: `trip_booked` \| `trip_start` \| `trip_three_quarter` \| `trip_finish` | |
| `offsetAmount` | number, ≥0 | |
| `offsetUnit` | enum: `minutes` \| `hours` \| `days` | |
| `offsetDirection` | enum: `before` \| `after` | |
| `body` | string, ≤2000 chars | may contain `{{variable}}` placeholders |
| `applicability.allListings` | boolean | when true, applies to every Listing the Host owns |
| `applicability.listingIds` | array of id (→ Listing) | used only when `allListings` is false |
| `active` | boolean, default `true` | governs whether **new** trips pick up this template (existing ScheduledMessages are unaffected by later deactivation, per spec User Story 1 Scenario 4) |
| `createdAt` / `updatedAt` | datetime | |

**Validation**: `body` ≤ 2000 chars. If `applicability.allListings` is false, `listingIds` must be
non-empty.

## ScheduledMessage

A trip-specific instance of a template.

| Field | Type | Notes |
|---|---|---|
| `_id` | id | |
| `tripId` | id (→ Trip) | |
| `templateId` | id (→ MessageTemplate) | |
| `listingId` | id (→ Listing) | denormalized for convenient lookup |
| `sendAt` | datetime | computed from the template's trigger + offset against the trip's relevant timestamp |
| `status` | enum: `scheduled` \| `sent` \| `skipped` | |
| `sentAt` | datetime, nullable | set when status becomes `sent` |
| `skipReason` | enum: `host_manual` \| `trip_cancelled`, nullable | set when status becomes `skipped` |
| `createdAt` / `updatedAt` | datetime | |

**Validation**: unique on (`tripId`, `templateId`) — a given template produces at most one
ScheduledMessage per trip.

**State transitions**: `scheduled` → `sent` (terminal) or `scheduled` → `skipped` (terminal, via
either `skipReason`). No transition out of `sent` or `skipped`.

**Note on rendering**: the message body shown to the guest is rendered from the template at
delivery time (not frozen when the ScheduledMessage row is created), so it reflects the latest
trip/host data. Rendering is not stored as its own field; see the `agent-api` contract's
`due-messages` response.

## AgentActivityLog

Records every automation attempt — reservation sync and message delivery — so failures are visible
to the host rather than silent, per Constitution Principle V and spec requirement FR-015.

| Field | Type | Notes |
|---|---|---|
| `_id` | id | |
| `type` | enum: `trip_sync` \| `message_delivery` | |
| `outcome` | enum: `success` \| `failure` | |
| `detail` | string | human-readable error/summary |
| `scheduledMessageId` | id (→ ScheduledMessage), nullable | set for `message_delivery` entries |
| `tripId` | id (→ Trip), nullable | set when the event relates to a specific trip |
| `occurredAt` | datetime | |

## Relationships

```text
Host 1──N Listing
Host 1──N MessageTemplate
Listing 1──N Trip
Listing N──N MessageTemplate   (via applicability, when allListings = false)
Trip 1──N ScheduledMessage
MessageTemplate 1──N ScheduledMessage
ScheduledMessage 0──N AgentActivityLog  (message_delivery entries)
Trip 0──N AgentActivityLog             (trip_sync entries)
```
