# Implementation Plan: Outdoorsy Scheduled Guest Messaging

**Branch**: `001-outdoorsy-scheduled-messaging` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-outdoorsy-scheduled-messaging/spec.md`

## Summary

Give a single Outdoorsy host a way to define message templates keyed to trip milestones (booked,
start, three-quarters through, finish) and have the right guest message automatically posted into
that trip's Outdoorsy conversation, with full visibility and manual override (send now / skip /
skip all remaining) over what's pending — plus standing per-listing Guest Instructions and Car
Guide/FAQ content shown once a trip is booked.

Technical approach: a hybrid architecture. A cloud-hosted dashboard (React/TypeScript web app +
Express/TypeScript API + MongoDB Atlas, on the host's personal AWS account) owns all template,
schedule, and content management. A separate automation agent (Node.js/TypeScript + Playwright)
runs locally on the host's own PC via Windows Task Scheduler, logging into Outdoorsy to sync
reservations and post messages — keeping Outdoorsy credentials off cloud infrastructure entirely
and keeping that traffic on the host's normal residential IP (see `research.md`).

## Technical Context

**Language/Version**: TypeScript throughout (`web`, `api`, `agent`, `shared`); Node.js LTS (22.x or
newer) runtime for `api` and `agent`; React 18+ for `web`.

**Primary Dependencies**: Express (API), Mongoose or the native MongoDB driver (data access),
Playwright (Outdoorsy browser automation), `jsonwebtoken` + `bcrypt` (dashboard auth), React Router
(web navigation).

**Storage**: MongoDB, hosted on MongoDB Atlas (AWS region) — see `research.md`.

**Testing**: Jest for unit tests (trigger-time computation, template variable rendering) and API
integration tests (against a test MongoDB instance), per Constitution Principle VI. The Outdoorsy
adapter is exempted from automated test-first and is instead validated via a manual dry-run mode
(scrape/render without posting) against the real site.

**Target Platform**: `web` — any modern browser; `api` — a single small EC2 instance or one ECS
Fargate task; `agent` — the host's own Windows PC, invoked by Windows Task Scheduler (not cloud
infrastructure — Constitution Principle I).

**Project Type**: Web application (dashboard + API) plus a separate local automation agent — a
3-runtime structure, not the standard frontend/backend pair.

**Performance Goals**: Single-host, low-volume system (a handful of listings, on the order of tens
of trips/month). No high-throughput or autoscaling requirement; success is measured by delivery
timeliness (SC-002, SC-003 in spec.md), not request throughput.

**Constraints**: Outdoorsy credentials MUST never leave the local agent's machine (Constitution
Principle I); all platform-specific logic MUST live only in the agent's Outdoorsy adapter
(Principle II); guest messages MUST be delivered only into Outdoorsy's own conversation thread, no
SMS/email (Principle III); automation failures MUST be logged and surfaced, never silently retried
(Principle V).

**Scale/Scope**: One host user, starting with one vehicle listing (expected to grow to a small
number), one platform integration (Outdoorsy) for this feature — a second platform is explicitly
out of scope until Outdoorsy is proven reliable (Constitution Principle IV).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design below.*

| Principle | Status | How this plan satisfies it |
|---|---|---|
| I. Credential & Data Security | PASS | Outdoorsy credentials are read and encrypted only inside `agent` (DPAPI-backed local store, see `research.md`); never included in any `agent-api` request payload. Dashboard login is a separate hashed-password credential in MongoDB. |
| II. Platform-Agnostic Adapter Architecture | PASS | `agent/src/adapters/outdoorsy.ts` implements a shared `login`/`listReservations`/`postMessage` interface; `api` contains zero Outdoorsy-specific code — it only consumes the platform-neutral `agent-api` contract. |
| III. In-Platform Messaging as System of Record | PASS | `agent-api`'s `due-messages`/`report-result` flow only ever posts into the Outdoorsy conversation for the trip; no SMS/email dependency exists anywhere in this plan. |
| IV. Incremental, Single-Platform-First Delivery | PASS | This plan implements exactly one adapter (Outdoorsy). No generic multi-platform config UI or second adapter is included. |
| V. Fail-Loud Automation | PASS | `AgentActivityLog` (data-model.md) plus `/agent/report-result` and `/agent/report-sync-failure` (agent-api.md) ensure every failure is recorded and exposed via `GET /api/activity` for the dashboard's failure banner; no silent retry loop is introduced. |
| VI. Test-First for Deterministic Logic | PASS | Trigger-time computation and template rendering are pure, Jest-unit-testable logic in `api`; the Outdoorsy adapter uses the constitution's explicit dry-run exemption instead of automated tests. |

No violations — the Complexity Tracking table below is intentionally empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-outdoorsy-scheduled-messaging/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
│   ├── dashboard-api.md
│   └── agent-api.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by this command)
```

### Source Code (repository root)

```text
web/
├── src/
│   ├── components/       # template editor, schedule table, listing content editor, login form
│   ├── pages/             # Templates, Schedule, Trips, Listings, Login
│   ├── services/          # dashboard-api client calls
│   └── types/             # re-exports from shared/
└── tests/

api/
├── src/
│   ├── models/            # Host, Listing, Trip, MessageTemplate, ScheduledMessage, AgentActivityLog
│   ├── services/          # trigger-time computation, template rendering, trip-sync ingestion
│   ├── routes/            # dashboard-api routes (JWT auth) + agent-api routes (service-token auth)
│   └── middleware/        # dashboard JWT auth, agent service-token auth
└── tests/
    ├── unit/              # trigger-time math, template rendering
    └── integration/       # route tests against a test MongoDB instance

agent/
├── src/
│   ├── adapter.interface.ts   # login / listReservations / postMessage contract
│   ├── adapters/
│   │   └── outdoorsy.ts       # Playwright-driven Outdoorsy adapter (only platform-specific code)
│   ├── credential-store.ts    # local encrypted Outdoorsy credential handling
│   ├── sync.ts                # calls adapter.listReservations → POST /agent/sync-trips
│   ├── deliver.ts             # GET /agent/due-messages → adapter.postMessage → POST /agent/report-result
│   └── index.ts               # entry point invoked by Windows Task Scheduler
└── tests/
    └── unit/                  # non-browser helper logic only (adapter itself validated via dry-run)

shared/
└── src/
    └── types/                 # Trip, Listing, MessageTemplate, ScheduledMessage, contract types
```

**Structure Decision**: Four packages (`web`, `api`, `agent`, `shared`) rather than the standard
frontend/backend pair, because the local automation agent is a genuinely separate deployable unit
(runs on the host's Windows PC, not in the cloud) that must stay isolated from both the browser
bundle and the server process — required by Constitution Principles I and II, not a stylistic
choice.

## Constitution Check (post-design re-check)

Re-reviewed against `data-model.md`, `contracts/`, and the structure above: no new violations were
introduced by the detailed design. All six principles remain PASS as tabulated above; the
Complexity Tracking table remains empty.

## Complexity Tracking

*No entries — Constitution Check reported no violations requiring justification.*
