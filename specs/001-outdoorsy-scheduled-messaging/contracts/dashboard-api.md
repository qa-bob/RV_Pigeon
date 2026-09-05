# Contract: Dashboard API

Consumed by the `web` React app. Authenticated with a JWT issued at login (see Research:
Dashboard authentication). All endpoints below require a valid session token except `POST
/api/auth/login`.

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| POST | `/api/auth/login` | `{ email, password }` | `{ token }` | 401 on bad credentials |
| GET | `/api/listings` | – | `Listing[]` | |
| POST | `/api/listings` | `Listing` fields (no `_id`) | created `Listing` | |
| PATCH | `/api/listings/:id` | partial `Listing` fields (incl. `guestInstructions`, `carGuide`) | updated `Listing` | |
| GET | `/api/templates` | – | `MessageTemplate[]` | |
| POST | `/api/templates` | `MessageTemplate` fields (no `_id`) | created `MessageTemplate` | rejects body > 2000 chars |
| PATCH | `/api/templates/:id` | partial `MessageTemplate` fields | updated `MessageTemplate` | toggling `active: false` affects only future trips (FR set) |
| GET | `/api/trips` | query: `status?`, `listingId?` | `Trip[]` | |
| GET | `/api/trips/:id/scheduled-messages` | – | `ScheduledMessage[]` (with resolved template name + body preview) | |
| POST | `/api/scheduled-messages/:id/send-now` | – | updated `ScheduledMessage` | only valid while `status = scheduled`; queues immediate delivery for the agent's next poll |
| POST | `/api/scheduled-messages/:id/skip` | – | updated `ScheduledMessage` (`status: skipped`, `skipReason: host_manual`) | only valid while `status = scheduled` |
| POST | `/api/trips/:id/scheduled-messages/skip-all-remaining` | – | count skipped | skips every `scheduled` ScheduledMessage for that trip, `skipReason: host_manual` |
| GET | `/api/activity` | query: `since?`, `outcome?` | `AgentActivityLog[]` | powers the dashboard's failure banner (FR-015) |

All error responses: `{ error: string }` with an appropriate 4xx/5xx status.
