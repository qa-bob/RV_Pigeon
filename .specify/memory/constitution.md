<!--
Sync Impact Report
- Version change: (none) → 1.0.0
- Modified principles: n/a (initial ratification)
- Added sections:
  - Core Principles: I. Credential & Data Security, II. Platform-Agnostic Adapter
    Architecture, III. In-Platform Messaging as System of Record, IV. Incremental,
    Single-Platform-First Delivery, V. Fail-Loud Automation, VI. Test-First for
    Deterministic Logic
  - Technology & Infrastructure Constraints
  - Development Workflow
  - Governance
- Removed sections: none
- Deferred / TODO placeholders: none
-->

# RV_Pigeon Constitution

## Core Principles

### I. Credential & Data Security (NON-NEGOTIABLE)
Rental-platform login credentials (Outdoorsy first, later RVShare, RVezy, rvrentals.com)
MUST be encrypted and MUST remain local to the machine running the automation agent.
They MUST NEVER be transmitted to, or stored in, cloud infrastructure (AWS services,
MongoDB) in any form, including logs or backups. The dashboard's own single-user login
is a separate credential (hashed, stored in MongoDB) and MUST NOT be conflated with, or
used to derive, rental-platform credentials. Any new integration or feature that would
cause a rental-platform credential to leave the local agent's machine is rejected by
this constitution regardless of convenience.

### II. Platform-Agnostic Adapter Architecture
Every rental-platform integration MUST be implemented behind one common adapter
interface (`login`, `listReservations`, `postMessage`). Scheduling, template rendering,
and dashboard logic MUST contain no platform-specific branching or selectors — that
brittleness is isolated entirely inside each platform's adapter file. Adding a new
platform means adding a new adapter, not modifying shared core logic.

### III. In-Platform Messaging as System of Record
Scheduled guest messages MUST be delivered by posting into the rental platform's own
guest messaging thread (e.g., Outdoorsy's inbox), not via direct SMS or email. This
keeps a single, platform-hosted, auditable communication trail per trip that both host
and guest can reference if a rental dispute arises. Direct SMS/email delivery is
out of scope unless a future amendment explicitly changes this principle.

### IV. Incremental, Single-Platform-First Delivery
The team builds and validates one platform adapter end-to-end (Outdoorsy) against real
rentals before starting a second. Generic multi-platform abstractions MUST NOT be
built speculatively ahead of a second concrete implementation — YAGNI applies to
adapters as much as to features. A second platform adapter is only started once the
first has proven reliable across multiple real rental cycles.

### V. Fail-Loud Automation
Any automation failure — failed login, CAPTCHA/2FA challenge, changed site layout,
failed message post — MUST be logged with diagnostic detail (including a local
screenshot where feasible) and surfaced clearly in the dashboard (e.g., a visible
failure banner). Failures MUST NOT be silently retried or swallowed. A missed guest
message defeats the product's purpose, so visibility into failure takes priority over
appearing "clean."

### VI. Test-First for Deterministic Logic
All deterministic, non-browser logic (trigger-time computation, message-template
variable rendering, template validation) MUST have unit tests written before or
alongside implementation. Browser-automation adapters are exempted from automated
test-first requirements — they are validated instead via a manual dry-run mode (scrape
and render without posting) against the real target site before any change is trusted
to send live messages.

## Technology & Infrastructure Constraints

- Frontend: React + TypeScript, built as a static bundle served from S3 + CloudFront.
- API: Node.js + Express + TypeScript, deployed to a single small EC2 instance or one
  ECS Fargate task in the project owner's personal AWS account.
- Database: MongoDB, via a managed MongoDB Atlas cluster (not self-hosted on EC2) to
  minimize operational burden for a single-operator project.
- Automation agent: Node.js + TypeScript, using Playwright for browser automation,
  running locally on the project owner's PC via Windows Task Scheduler — never in
  cloud infrastructure — per Principle I.
- Scale target is a single personal user managing a small number of vehicle listings,
  not a multi-tenant SaaS product. Infrastructure choices MUST optimize for low cost
  and low operational overhead over horizontal scalability.

## Development Workflow

- Feature work flows through the Spec Kit pipeline in order: `/speckit-specify` →
  `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`, each committed to the repo
  as it's produced.
- Any change to a platform adapter MUST be exercised in dry-run mode against the real
  target site before being enabled to post live guest messages.
- This constitution is authored and amended via `/speckit-constitution` only;
  dependent templates and commands read it at runtime and are not edited directly to
  work around it.

## Governance

This constitution supersedes ad hoc practice for RV_Pigeon. Amendments are made via
`/speckit-constitution`, follow semantic versioning (MAJOR: incompatible principle
removal/redefinition; MINOR: new principle or materially expanded guidance; PATCH:
wording/clarification only), and must update the Sync Impact Report at the top of
this file. Every `/speckit-plan` and `/speckit-implement` pass should be checked
against these principles before proceeding; unresolved conflicts are escalated to the
project owner rather than silently resolved.

**Version**: 1.0.0 | **Ratified**: 2026-09-05 | **Last Amended**: 2026-09-05
