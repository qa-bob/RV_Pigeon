# RV_Pigeon

A scheduled guest-messaging tool for RV rental hosts. Define a message once — what it says and
when it should go out relative to a trip milestone — and it's delivered automatically into the
guest's conversation on the rental platform, without you remembering to send it. Built first for
[Outdoorsy](https://www.outdoorsy.com/), with the platform-specific parts isolated behind an
adapter interface so another platform can be added later without touching the rest of the system.

## Why

Turo has a built-in "scheduled messages" feature hosts rely on; Outdoorsy doesn't. This replicates
that experience for an Outdoorsy host, plus standing per-listing guest content (pickup/return
instructions, a car guide, FAQs).

## Architecture

Four packages, per `specs/001-outdoorsy-scheduled-messaging/plan.md`:

| Package | What it is |
|---|---|
| `web/` | React + TypeScript dashboard — templates, schedule, trips, listing content, login |
| `api/` | Node.js + Express + TypeScript REST API — auth, data, trigger-time math, template rendering |
| `agent/` | Node.js + TypeScript automation agent — runs **on your own PC**, not in the cloud, driving Outdoorsy via Playwright |
| `shared/` | TypeScript types used by all three |

**Why the agent runs locally, not in AWS**: keeps Outdoorsy login traffic on your normal
residential IP instead of a datacenter IP (lower bot-detection risk), and keeps your Outdoorsy
credentials/session off cloud infrastructure entirely. See `specs/.../research.md` for the full
reasoning, including a real live-testing finding: **Outdoorsy requires solving a CAPTCHA and an
emailed verification code at login**, so the agent never logs in fresh on its own — a human
completes that once (`npm run bootstrap-session`), and the resulting session is reused and
periodically refreshed. Data: MongoDB (Atlas). Infra: your own AWS account (S3+CloudFront for the
web app, EC2/Fargate for the API).

## Project governance

`.specify/memory/constitution.md` has the full, binding rules this project is built to. The short
version:

1. **Credential & Data Security** — Outdoorsy credentials/session never leave your PC, never reach the API or cloud infra
2. **Platform-Agnostic Adapter Architecture** — all Outdoorsy-specific code lives in `agent/src/adapters/outdoorsy.ts`
3. **In-Platform Messaging as System of Record** — messages post into Outdoorsy's own guest thread, never SMS/email
4. **Incremental, Single-Platform-First Delivery** — Outdoorsy proven out before any second platform
5. **Fail-Loud Automation** — failures are logged and surfaced, never silently retried
6. **Test-First for Deterministic Logic** — unit tests for trigger-time/template-rendering logic; the browser adapter is validated by manual dry-run instead, since it can't meaningfully be unit-tested

## Getting started

Full setup steps, prerequisites, and validation scenarios: **`specs/001-outdoorsy-scheduled-messaging/quickstart.md`**.

Short version:

```bash
npm install                    # from repo root — installs all four workspaces
npm run build:shared           # shared types, needed by the others

# api/
npm run seed:host              # creates your dashboard login
npm run seed:listing           # creates your one Outdoorsy listing record
npm run dev                    # starts the API on :4000

# web/
npm run dev                    # starts the dashboard on :5173

# agent/
npm run setup-credentials      # stores your Outdoorsy login, encrypted, local-only
npm run bootstrap-session      # you log in manually (CAPTCHA + emailed code); session gets saved
npm run dry-run                # verify without sending anything
npm run sync                   # pull real trips into the dashboard
npm run deliver                # send anything currently due
```

For unattended operation, see `agent/scripts/register-task.ps1` (Windows Task Scheduler).

## Current status

All three planned user stories are implemented and test-covered (spec: `specs/001-outdoorsy-scheduled-messaging/`):

- **US1** — automatic scheduled delivery (the core feature)
- **US2** — schedule review & manual overrides (send now / skip / skip all remaining)
- **US3** — standing per-listing Guest Instructions & Car Guide/FAQ content

The Outdoorsy adapter's login-through-reservation-detail selectors are verified against the live
site; the guest-message-thread selectors (`postMessage`) are still placeholders pending careful,
deliberate live verification — see the adapter file's own header comment before trusting it to send
a real message.
