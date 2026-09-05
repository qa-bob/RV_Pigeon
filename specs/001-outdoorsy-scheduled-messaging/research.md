# Research: Outdoorsy Scheduled Guest Messaging

All items below were resolved through direct discussion with the project owner before this plan
was drafted; none carry a `NEEDS CLARIFICATION` marker into Phase 1.

## Automation execution location (cloud vs. local agent)

- **Decision**: The Outdoorsy-facing automation (login, reservation scrape, message post) runs as
  a local agent on the host's own PC, not in AWS.
- **Rationale**: Requests from well-known AWS data-center IP ranges are far more likely to trip a
  rental platform's bot-detection than traffic from the host's normal residential IP. Locking or
  challenging the host's real Outdoorsy account is a business risk, not just a bug. Running headless
  Chromium inside Lambda/Fargate is also non-trivial (custom layers/images) compared to a plain
  Node process on a desktop OS.
- **Alternatives considered**: Fully cloud-native scheduled job (Lambda/Fargate) — rejected due to
  the bot-detection and account-risk exposure above, despite being operationally simpler (no
  dependency on the host's PC being on).

## Local agent scheduling mechanism

- **Decision**: Windows Task Scheduler invokes a short-lived Node.js script on a fixed interval
  (target: every 30–60 minutes); the process exits after each run.
- **Rationale**: Avoids writing/operating a persistent Windows Service (install, crash-recovery,
  update handling). A scheduled short-lived run is naturally resilient to reboots and PC sleep — it
  simply catches up on its next scheduled invocation, which also satisfies the "due message found
  late is still delivered" edge case in the spec.
- **Alternatives considered**: A long-running background Windows Service with its own internal
  timer — rejected as unnecessary operational complexity for a single-user tool; a persistent
  process also raises the chance of a stale/leaked browser session outliving intent.

## Browser automation library

- **Decision**: Playwright (Node.js/TypeScript).
- **Rationale**: Modern auto-waiting semantics reduce flaky selectors compared to older tools,
  strong TypeScript support matches the rest of the stack, and it ships codegen/trace tooling
  useful for building and debugging the Outdoorsy adapter and its manual dry-run mode.
- **Alternatives considered**: Puppeteer (Chrome-only, less first-class TypeScript/multi-browser
  support); Selenium WebDriver (older API, heavier setup, no meaningful advantage here).

## Database hosting

- **Decision**: MongoDB Atlas (managed, AWS-hosted region), not self-managed MongoDB on EC2.
- **Rationale**: A single-operator project should not carry patching/backup/failover operational
  burden for its database. Atlas's free/shared tier is sufficient at this project's scale.
- **Alternatives considered**: Self-hosted MongoDB on an EC2 instance — rejected; adds ongoing ops
  work with no benefit at this scale. AWS DocumentDB — rejected; the project owner specified
  MongoDB specifically, and DocumentDB's Mongo-API compatibility is partial.

## API compute

- **Decision**: A single small EC2 instance or one ECS Fargate task running the Express API.
- **Rationale**: Traffic is a single dashboard user plus periodic agent sync/report calls — modest,
  steady load that doesn't need autoscaling or a serverless cold-start trade-off.
- **Alternatives considered**: AWS Lambda + API Gateway — rejected for this API; better suited to
  bursty/event-driven traffic than a small always-on Express app with a persistent DB connection
  pool. Elastic Beanstalk — viable, but adds a managed-platform layer with little benefit over a
  plain EC2/Fargate deployment at this scale.

## Dashboard authentication

- **Decision**: Built-in login — bcrypt-hashed password stored in MongoDB, JWT session for the
  single host user.
- **Rationale**: One user, accessed only by the project owner; standing up AWS Cognito (user pools,
  MFA, hosted UI) is infrastructure disproportionate to a single-user login screen. A hashed
  password in Mongo is a well-understood, low-effort baseline that can grow into multi-user later
  without a rewrite.
- **Alternatives considered**: AWS Cognito — rejected for now as excess infrastructure for this
  scale; can be introduced later without disturbing the rest of the design if multi-user support
  becomes a real need.

## Agent-to-API authentication

- **Decision**: The local agent authenticates to the cloud API using a separate long-lived service
  token (not the host's dashboard password/JWT), scoped only to the agent-facing endpoints
  (trip sync, due-messages, result reporting).
- **Rationale**: Keeps the dashboard login and the machine-to-machine credential independent per
  Constitution Principle I — compromising one does not automatically compromise the other, and the
  service token can be rotated without touching the host's own login.
- **Alternatives considered**: Reusing the dashboard JWT from a logged-in browser session in the
  agent — rejected; couples an unattended background process's access to an interactive session's
  credential lifecycle (expiry, re-login) for no benefit.

## Outdoorsy credential storage on the local machine

- **Decision**: Outdoorsy credentials are encrypted at rest on the host's PC, scoped to the
  Windows user account running the agent (e.g., Windows Data Protection API), and are read only by
  the local agent process. They are never included in any payload sent to the cloud API.
- **Rationale**: Directly required by Constitution Principle I. DPAPI-backed encryption ties the
  secret to the Windows user account without the agent needing to manage its own master key/secret
  file.
- **Alternatives considered**: Plain-text local config file — rejected, no protection if the
  machine or an on-disk backup is compromised. Storing credentials in AWS Secrets Manager — rejected
  outright; that would mean the credential leaves the local machine, which Principle I forbids
  regardless of how well the cloud copy is protected.
