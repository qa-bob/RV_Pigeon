# Quickstart: Validating Outdoorsy Scheduled Guest Messaging

A runnable validation guide, not an implementation guide. Assumes the `web`, `api`, `agent`, and
`shared` packages already exist per `plan.md`'s Project Structure.

## Prerequisites

- Node.js LTS installed
- A MongoDB Atlas connection string (`api/.env` → `MONGODB_URI`)
- A dashboard JWT signing secret (`api/.env` → `JWT_SECRET`)
- A shared agent service token, set identically in `api/.env` (`AGENT_SERVICE_TOKEN`) and
  `agent/.env` (`SERVICE_TOKEN`)
- The host's real Outdoorsy login, entered once via the agent's local credential-store setup step
  (never committed, never sent to the API — see `research.md`)
- One real (or test) Outdoorsy listing with at least one upcoming trip, for end-to-end validation

## Setup

```bash
# from repo root, in each of web/, api/, agent/, shared/
npm install
```

```bash
# api/
npm run seed:host   # creates the single Host record with a hashed password, prompts for email/password
npm run dev         # starts the Express API
```

```bash
# web/
npm run dev         # starts the React dashboard, log in with the seeded Host credentials
```

## Validation scenarios

Each scenario below maps to an acceptance scenario in `spec.md`.

### 1. Template creation (SC-001)

In the dashboard, create a template: trigger `trip_start`, offset `0 hours after`, body
`Hi {{guestFirstName}}, welcome!`, applicable to your test Listing. Expect this to take under 2
minutes and the template to appear in the templates list as `active`.

### 2. Automatic delivery (User Story 1)

Run the agent once manually:

```bash
# agent/
npm run sync      # calls adapter.listReservations, POSTs /agent/sync-trips
npm run deliver    # calls GET /agent/due-messages, posts each into Outdoorsy, POSTs /agent/report-result
```

Confirm: the test trip appears under `/api/trips`; a `ScheduledMessage` exists for it with
`sendAt` computed from the trip's actual start time; once `sendAt` has passed and `deliver` runs
again, the message appears in the guest's real Outdoorsy conversation thread, and its status in the
dashboard becomes `sent`.

### 3. Manual override (User Story 2)

With a pending `scheduled` message visible in the dashboard for a trip, click **Skip**. Confirm its
status becomes `skipped` and it is not delivered on the next `deliver` run. Repeat with **Send
now** on a different pending message and confirm it is delivered on the very next `deliver` run
regardless of its `sendAt`.

### 4. Standing listing content (User Story 3)

Edit the test Listing's Guest Instructions and Car Guide/FAQ in the dashboard. Confirm the values
persist (`GET /api/listings`) and are scoped to that Listing only (a second Listing's content is
unaffected).

### 5. Failure visibility (SC-006, FR-015)

Temporarily point the agent at invalid Outdoorsy credentials and run `npm run sync`. Confirm
`POST /agent/report-sync-failure` is called, and the failure appears in the dashboard's activity
feed (`GET /api/activity`) within that same run — not silently dropped.

## Reference

- Entities and validation rules: `data-model.md`
- Endpoint shapes: `contracts/dashboard-api.md`, `contracts/agent-api.md`
- Full task breakdown: `tasks.md` (produced by `/speckit-tasks`, not this document)
