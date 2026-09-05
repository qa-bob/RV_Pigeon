---
description: "Task list for Outdoorsy Scheduled Guest Messaging"
---

# Tasks: Outdoorsy Scheduled Guest Messaging

**Input**: Design documents from `/specs/001-outdoorsy-scheduled-messaging/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Included for deterministic logic (trigger-time computation, template rendering) and API
routes, per Constitution Principle VI ("Test-First for Deterministic Logic") and plan.md's Testing
section. The Outdoorsy adapter itself is exempt from automated test-first per that same principle
and is validated instead via the manual dry-run steps in quickstart.md.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P2/P3) so each can be
implemented, tested, and demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3, from spec.md — omitted for Setup, Foundational, and Polish tasks

## Path Conventions

Four packages at the repository root, per plan.md: `web/`, `api/`, `agent/`, `shared/`.

---

## Phase 1: Setup

**Purpose**: Repository/tooling initialization

- [ ] T001 Create the four-package layout (`web/`, `api/`, `agent/`, `shared/`), each with its own `package.json` and `tsconfig.json`, per plan.md Project Structure
- [ ] T002 [P] Configure a shared ESLint + Prettier config consumed by all four packages
- [ ] T003 [P] Initialize `shared/src/types/index.ts` as a placeholder export, built and consumable by `web`, `api`, and `agent`
- [ ] T004 Create `api/.env.example` and `agent/.env.example` documenting `MONGODB_URI`, `JWT_SECRET`, `AGENT_SERVICE_TOKEN` (api) / `SERVICE_TOKEN` (agent), per quickstart.md prerequisites
- [ ] T005 [P] Configure Jest (`ts-jest`) in `api/` with `tests/unit/` and `tests/integration/` folders
- [ ] T006 [P] Install and configure Playwright in `agent/` (`playwright.config.ts`, plus a codegen script used to build/debug the Outdoorsy adapter)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure every user story depends on

**⚠️ CRITICAL**: No user story work starts until this phase is complete

- [ ] T007 [P] Define shared TypeScript types (Trip, Listing, MessageTemplate, ScheduledMessage, AgentActivityLog, and the dashboard-api/agent-api request/response shapes) in `shared/src/types/`
- [ ] T008 Implement the MongoDB connection module in `api/src/db.ts`, reading `MONGODB_URI`
- [ ] T009 [P] Implement the Host model (`email`, `passwordHash`) in `api/src/models/host.ts`
- [ ] T010 [P] Implement the Listing model in `api/src/models/listing.ts`, including `guestInstructions` (5000/170-char limits) and `carGuide` (5000-char tips + FAQ array) sub-schemas per data-model.md
- [ ] T011 [P] Implement the Trip model in `api/src/models/trip.ts` with a unique `(listingId, externalTripId)` index and the `booked/active/completed/cancelled` status enum
- [ ] T012 [P] Implement the MessageTemplate model in `api/src/models/messageTemplate.ts` with the `applicability` sub-schema and 2000-char body limit
- [ ] T013 [P] Implement the ScheduledMessage model in `api/src/models/scheduledMessage.ts` with a unique `(tripId, templateId)` index
- [ ] T014 [P] Implement the AgentActivityLog model in `api/src/models/agentActivityLog.ts`
- [ ] T015 [P] Implement dashboard JWT auth middleware in `api/src/middleware/dashboardAuth.ts`
- [ ] T016 [P] Implement agent service-token auth middleware in `api/src/middleware/agentAuth.ts` (validates against `AGENT_SERVICE_TOKEN`)
- [ ] T017 Implement `POST /api/auth/login` in `api/src/routes/auth.ts` (bcrypt compare, JWT issue) — depends on T009, T015
- [ ] T018 Implement `api/scripts/seedHost.ts` (prompts for email/password, bcrypt-hashes, inserts the single Host) — depends on T009
- [ ] T019 Wire the Express app skeleton (middleware, route mounting, error handler) in `api/src/app.ts` and entrypoint `api/src/index.ts` — depends on T015, T016, T017
- [ ] T020 [P] Define the platform adapter interface (`login`, `listReservations`, `postMessage`) in `agent/src/adapter.interface.ts`
- [ ] T021 [P] Implement the local encrypted Outdoorsy credential store (Windows DPAPI-backed) in `agent/src/credential-store.ts`
- [ ] T022 [P] Scaffold the web app shell (router, layout, protected-route wrapper) in `web/src/App.tsx` and the login page in `web/src/pages/Login.tsx`
- [ ] T023 [P] Implement the dashboard-api client wrapper (attaches JWT, reads base URL from env) in `web/src/services/apiClient.ts`

**Checkpoint**: Foundation ready — user story work can begin.

---

## Phase 3: User Story 1 - Guests automatically receive the right message at the right trip moment (Priority: P1) 🎯 MVP

**Goal**: A host's active templates automatically produce and deliver messages into Outdoorsy
guest conversations for new trips, with no manual host action.

**Independent Test**: Create one template targeting "trip start" for a listing; have a real trip on
that listing reach its start time; confirm the guest receives the message in their Outdoorsy
conversation without any manual host action (quickstart.md scenarios 1–2).

### Tests for User Story 1

> Write these first; confirm they fail before implementing.

- [ ] T024 [P] [US1] Unit tests for trigger-time computation — all 4 trigger events × before/after offsets, plus the "already past when discovered" edge case — in `api/tests/unit/triggerTime.test.ts`
- [ ] T025 [P] [US1] Unit tests for template variable rendering, including the missing-variable-renders-blank case, in `api/tests/unit/renderTemplate.test.ts`
- [ ] T026 [P] [US1] Integration tests for template CRUD (2000-char body limit, listing-applicability validation) in `api/tests/integration/templates.test.ts`
- [ ] T027 [P] [US1] Integration test for `POST /agent/sync-trips` creating new Trips and generating ScheduledMessage rows from active applicable templates, in `api/tests/integration/agentSyncCreate.test.ts`
- [ ] T028 [P] [US1] Integration test for `GET /agent/due-messages` and `POST /agent/report-result` (sent path), in `api/tests/integration/agentDeliver.test.ts`

### Implementation for User Story 1

- [ ] T029 [US1] Implement the trigger-time computation service in `api/src/services/triggerTime.ts` — makes T024 pass
- [ ] T030 [US1] Implement the template-rendering service in `api/src/services/renderTemplate.ts` — makes T025 pass
- [ ] T031 [US1] Implement `GET/POST/PATCH /api/templates` routes in `api/src/routes/templates.ts` — makes T026 pass; depends on T012
- [ ] T032 [US1] Implement `GET/POST/PATCH /api/listings` routes in `api/src/routes/listings.ts`, covering `label`, `externalListingId`, `guestInstructions`, `carGuide` — depends on T010
- [ ] T033 [US1] Implement the trip-sync ingestion service (create path) in `api/src/services/tripSync.ts`: upsert new Trips by `externalTripId`, generate ScheduledMessage rows from active applicable MessageTemplates — makes T027 pass; depends on T011, T013, T029
- [ ] T034 [US1] Implement `POST /agent/sync-trips` in `api/src/routes/agent.ts`, wiring the tripSync service — depends on T033, T016
- [ ] T035 [US1] Implement `GET /agent/due-messages` in `api/src/routes/agent.ts` (status=scheduled, sendAt≤now, rendered via renderTemplate) — depends on T030
- [ ] T036 [US1] Implement `POST /agent/report-result` (sent path: set status/sentAt) in `api/src/routes/agent.ts` — makes T028 pass
- [ ] T037 [US1] Implement the Outdoorsy adapter's `login` and `listReservations` methods (Playwright) in `agent/src/adapters/outdoorsy.ts` — validate via the manual dry-run mode from quickstart.md, per Constitution Principle VI
- [ ] T038 [US1] Implement the Outdoorsy adapter's `postMessage` method in `agent/src/adapters/outdoorsy.ts`
- [ ] T039 [US1] Implement `agent/src/sync.ts` (credential-store → `adapter.listReservations` → `POST /agent/sync-trips`)
- [ ] T040 [US1] Implement `agent/src/deliver.ts` (`GET /agent/due-messages` → `adapter.postMessage` → `POST /agent/report-result`)
- [ ] T041 [US1] Implement `agent/src/index.ts` entrypoint (runs sync then deliver) for Windows Task Scheduler invocation
- [ ] T042 [US1] Build the web Templates page (list/create/edit/activate-deactivate) in `web/src/pages/Templates.tsx` and `web/src/components/TemplateEditor.tsx`

**Checkpoint**: User Story 1 is fully functional and independently testable/demoable.

---

## Phase 4: User Story 2 - Host reviews and overrides the message schedule for a trip (Priority: P2)

**Goal**: The host can see every trip's message schedule and intervene (send now / skip / skip all
remaining); trip date changes and cancellations correctly adjust pending messages.

**Independent Test**: With pending scheduled messages on a real trip, skip one and confirm it isn't
delivered while the rest remain unaffected; reschedule/cancel a trip and confirm pending messages
recompute/skip accordingly (quickstart.md scenario 3).

### Tests for User Story 2

- [ ] T043 [P] [US2] Integration test for `POST /agent/sync-trips` recomputing `sendAt` on trip date changes and skipping pending messages when a trip becomes cancelled, in `api/tests/integration/agentSyncUpdate.test.ts`
- [ ] T044 [P] [US2] Integration test for `GET /api/trips/:id/scheduled-messages` and the send-now/skip/skip-all-remaining routes, in `api/tests/integration/scheduleOverrides.test.ts`

### Implementation for User Story 2

- [ ] T045 [US2] Extend the tripSync service (`api/src/services/tripSync.ts`, from T033) with the update path: recompute `sendAt` on still-`scheduled` messages when trip dates change; set `status: skipped, skipReason: trip_cancelled` when a trip becomes cancelled — makes T043 pass
- [ ] T046 [US2] Implement `GET /api/trips` and `GET /api/trips/:id/scheduled-messages` in `api/src/routes/trips.ts`
- [ ] T047 [US2] Implement `POST /api/scheduled-messages/:id/send-now` in `api/src/routes/scheduledMessages.ts`
- [ ] T048 [US2] Implement `POST /api/scheduled-messages/:id/skip` in `api/src/routes/scheduledMessages.ts` (`status: skipped, skipReason: host_manual`)
- [ ] T049 [US2] Implement `POST /api/trips/:id/scheduled-messages/skip-all-remaining` in `api/src/routes/trips.ts` — makes T044 pass
- [ ] T050 [US2] Build the web Schedule view (per-trip message list with status + Send now/Skip/Skip all remaining actions) in `web/src/pages/Schedule.tsx`
- [ ] T051 [US2] Build the web Trips list page in `web/src/pages/Trips.tsx`

**Checkpoint**: User Stories 1 and 2 both independently functional.

---

## Phase 5: User Story 3 - Host maintains standing guest-facing vehicle information (Priority: P3)

**Goal**: A host maintains pickup/return instructions, welcome message, vehicle tips, and FAQs per
listing, visible to a guest once their trip is booked — independent of the messaging engine.

**Independent Test**: Edit one listing's instructions and FAQ list; confirm a guest on that listing
sees the update while a guest on a different listing sees that listing's own separate content
(quickstart.md scenario 4).

### Tests for User Story 3

- [ ] T052 [P] [US3] Integration test confirming Guest Instructions/Car Guide updates are scoped to one listing and do not leak to another, in `api/tests/integration/listingContentScope.test.ts`

### Implementation for User Story 3

- [ ] T053 [US3] Extend `PATCH /api/listings/:id` validation (from T032) to enforce the 5000/170/5000-char limits and FAQ array shape with clear error messages — makes T052 pass
- [ ] T054 [US3] Build the web Listing content editor (pickup/return instructions, welcome message, car guide tips, repeatable FAQ list) in `web/src/pages/ListingContent.tsx` and `web/src/components/FaqListEditor.tsx`
- [ ] T055 [US3] Build the web Listings page (select a listing to view/edit) in `web/src/pages/Listings.tsx`

**Checkpoint**: All three user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Fail-loud visibility and finishing work that spans all user stories

- [ ] T056 [P] Implement `GET /api/activity` in `api/src/routes/activity.ts` and `POST /agent/report-sync-failure` in `api/src/routes/agent.ts` (Constitution Principle V, spec FR-015/SC-006)
- [ ] T057 Wire failure reporting into `agent/src/sync.ts`, `agent/src/deliver.ts`, and `api/src/services/tripSync.ts` so every login/scrape/delivery failure writes an AgentActivityLog entry
- [ ] T058 [P] Build the web dashboard failure banner (reads `GET /api/activity`) in `web/src/components/ActivityBanner.tsx`
- [ ] T059 Write `agent/scripts/register-task.ps1` documenting/automating the Windows Task Scheduler entry for `agent/src/index.ts`
- [ ] T060 [P] Write the repository root `README.md`: 4-package structure, setup steps (linking quickstart.md), and a summary of the constitution's binding principles
- [ ] T061 Run through quickstart.md end-to-end against a real Outdoorsy test listing and record the results

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup — blocks all user stories
- **User Stories (Phase 3–5)**: all depend on Foundational; proceed in priority order (US1 → US2 → US3) since US2 extends US1's `tripSync` service and US3 extends US1's listings route — see note below
- **Polish (Phase 6)**: depends on the user stories it touches (US1 for T057)

### User Story Dependencies

- **User Story 1 (P1)**: no dependency on other stories — the MVP
- **User Story 2 (P2)**: extends US1's `tripSync` service (T033→T045) and reuses its models; still independently *testable* (its own acceptance scenarios don't require US1's templates to exist, only trips), but its code builds on US1's files rather than being fully parallel
- **User Story 3 (P3)**: extends US1's `/api/listings` route (T032→T053); independently testable and deliverable without any template ever being created

### Within Each User Story

- Tests written and failing before implementation
- Models (Foundational) → services → routes → agent wiring → web UI
- Story complete and checkpointed before moving to the next priority

### Parallel Opportunities

- All `[P]`-marked Setup tasks (T002, T003, T005, T006)
- All `[P]`-marked Foundational model/middleware tasks (T007, T009–T016, T020–T023)
- Within User Story 1: all five test tasks (T024–T028) in parallel; T037/T038 (adapter methods) can proceed alongside T029–T036 (API-side work) since they touch different packages
- Within User Story 2 and User Story 3: their respective test tasks in parallel

---

## Parallel Example: User Story 1

```bash
# Tests, launched together:
Task: "Unit tests for trigger-time computation in api/tests/unit/triggerTime.test.ts"
Task: "Unit tests for template variable rendering in api/tests/unit/renderTemplate.test.ts"
Task: "Integration tests for template CRUD in api/tests/integration/templates.test.ts"
Task: "Integration test for POST /agent/sync-trips in api/tests/integration/agentSyncCreate.test.ts"
Task: "Integration test for GET /agent/due-messages + POST /agent/report-result in api/tests/integration/agentDeliver.test.ts"

# API-side and agent-side implementation, launched together (different packages):
Task: "Implement trigger-time computation service in api/src/services/triggerTime.ts"
Task: "Implement the Outdoorsy adapter's login and listReservations methods in agent/src/adapters/outdoorsy.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational)
2. Complete Phase 3 (User Story 1)
3. **Stop and validate** using quickstart.md scenarios 1–2 against a real Outdoorsy test listing
4. This alone delivers the core value proposition: automatic, hands-off scheduled guest messages

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → validate independently → this is the MVP
3. Add User Story 2 → validate independently → adds review/override and correctness under trip changes
4. Add User Story 3 → validate independently → adds standing guest-facing content
5. Phase 6 → fail-loud visibility and operational finishing touches across all three

---

## Notes

- `[P]` tasks touch different files with no dependency on an incomplete task
- `[Story]` labels give traceability back to spec.md's prioritized user stories
- Commit after each task or logical group, per the project's normal git workflow
- Verify each failing test actually fails before implementing against it
- Stop at any checkpoint to validate a story independently before continuing
- Outdoorsy-specific automation code stays confined to `agent/src/adapters/outdoorsy.ts` per Constitution Principle II — no other file in this task list should contain Outdoorsy-specific selectors/logic
