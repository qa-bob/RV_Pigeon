# Feature Specification: Outdoorsy Scheduled Guest Messaging

**Feature Branch**: `main` (no separate feature branch was created for this spec)

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "Build RV_Pigeon: a scheduled guest-messaging tool for RV rental hosts, starting with Outdoorsy. Feature model derived from the host's own Turo scheduled-messages screenshots (message templates with event+offset triggers and variable substitution; per-trip scheduled message instances with Send now/Skip/Skip all remaining overrides; static per-listing Guest Instructions and Car Guide/FAQ content). Single host user, one or more listings. No public API exists for Outdoorsy hosts, so the system reads reservations and delivers messages by acting on the host's own connected Outdoorsy account, posting into Outdoorsy's own guest messaging thread rather than SMS/email. Out of scope: any platform other than Outdoorsy, SMS/email delivery, multi-user/team access."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Guests automatically receive the right message at the right trip moment (Priority: P1)

A host defines a message once — what it says and when it should go out relative to a trip
milestone (when the trip is booked, when it starts, partway through, or when it ends) — and from
then on, every qualifying guest receives that message at the right moment without the host having
to remember to send it.

**Why this priority**: This is the entire value proposition. Without automatic, reliable delivery
at the right moment, the product provides no value over the host just messaging guests manually.

**Independent Test**: Create one template targeting "trip start" for a listing, have a real trip on
that listing reach its start time, and confirm the guest receives the configured message in their
Outdoorsy conversation thread without the host taking any manual action.

**Acceptance Scenarios**:

1. **Given** an active message template with a trigger of "1 hour after trip booked" that applies
   to a listing, **When** a new trip is booked on that listing, **Then** the system computes a send
   time for that trip (1 hour after its booking time) and later delivers the message into that
   trip's guest conversation at that time.
2. **Given** a message template's trigger is defined relative to trip start, trip finish, or the
   point three-quarters through the trip's duration, **When** a trip's exact start/finish times are
   known, **Then** the system computes the correct send time relative to those times.
3. **Given** a template's message body contains variables (e.g., guest's first name, host's first
   name, host's phone number), **When** a message is delivered for a specific trip, **Then** every
   variable is replaced with that trip's actual values before the guest sees it.
4. **Given** a host deactivates a template, **When** new trips are booked afterward, **Then** those
   new trips do not receive messages from the deactivated template, while messages already
   scheduled for existing trips from that template are unaffected.
5. **Given** a template applies only to specific listings, **When** a trip is booked on a listing
   the template does not apply to, **Then** no message from that template is scheduled for that trip.

---

### User Story 2 - Host reviews and overrides the message schedule for a trip (Priority: P2)

A host can see every message that is scheduled, already sent, or skipped for a given trip, and can
step in when needed: sending a pending message early, skipping a single one, or skipping everything
still pending for that trip.

**Why this priority**: Automatic delivery (P1) still needs a safety valve — hosts need visibility
and the ability to intervene (e.g., a trip that ended early, or a message that no longer applies)
so trust in the automation is maintained.

**Independent Test**: With one or more scheduled messages pending for a real trip, open the trip's
schedule, skip one pending message, and confirm it is not delivered at its scheduled time while
other pending messages for the same trip remain unaffected.

**Acceptance Scenarios**:

1. **Given** a trip has pending scheduled messages, **When** the host views that trip, **Then** the
   host sees each message's content/template, scheduled time, and current status (Scheduled, Sent,
   or Skipped).
2. **Given** a pending scheduled message, **When** the host chooses to send it immediately, **Then**
   it is delivered right away instead of waiting for its scheduled time.
3. **Given** a pending scheduled message, **When** the host chooses to skip it, **Then** it is never
   delivered and its status becomes Skipped.
4. **Given** a trip with multiple pending scheduled messages, **When** the host chooses to skip all
   remaining, **Then** none of that trip's still-pending messages are delivered.
5. **Given** a trip's dates change (e.g., the guest reschedules), **When** the system next becomes
   aware of the change, **Then** the send times of that trip's not-yet-sent messages are
   recalculated to match the new dates.
6. **Given** a trip is cancelled, **When** the system next becomes aware of the cancellation,
   **Then** all of that trip's remaining pending messages are skipped rather than sent.

---

### User Story 3 - Host maintains standing guest-facing vehicle information (Priority: P3)

Independent of the scheduled-message engine, a host maintains a standing set of information for
each listing — pickup/return instructions, a short welcome note, general vehicle tips, and a list
of frequently asked questions — that becomes visible to a guest as soon as their trip is booked.

**Why this priority**: This delivers real value (fewer guest questions, smoother pickups) on its
own even if a host never creates a single scheduled-message template, and can be built/validated
independently of the scheduling engine.

**Independent Test**: Edit the pickup/return instructions and FAQ list for one listing, and confirm
a guest who books that listing sees the updated content, while a guest booking a different listing
sees that listing's own separate content.

**Acceptance Scenarios**:

1. **Given** a host edits a listing's pickup/return instructions, welcome message, vehicle tips, or
   FAQ list, **When** a guest with a booked trip on that listing views their trip information,
   **Then** the guest sees the current content for that specific listing.
2. **Given** a host manages multiple listings, **When** editing this content for one listing,
   **Then** other listings' content is unaffected.

---

### Edge Cases

- What happens when a template's trigger computes a send time that has already passed by the time
  the system first learns of the trip (e.g., a trip synced late)? The message is treated as due and
  delivered at the next opportunity rather than being skipped or requiring host action.
- What happens when a message template references a variable that has no value available for a
  given trip (e.g., no host phone number on file)? The message is delivered with that variable
  rendered as blank rather than showing broken placeholder text to the guest.
- What happens when two templates compute the same send time for the same trip? Both messages are
  delivered independently; delivery of one does not block or replace the other.
- How does the system handle a trip that is cancelled after some of its scheduled messages have
  already been delivered? Already-delivered messages cannot be recalled; only the remaining pending
  messages for that trip are skipped.
- What happens when the host's connection to their rental-platform account stops working (e.g.,
  changed password, login challenge)? The host is clearly notified that reservation sync and/or
  message delivery is failing, rather than the system failing silently or repeatedly without
  surfacing it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Host MUST be able to create, edit, and deactivate message templates, each consisting
  of an internal name (not shown to guests), a trigger, and a message body.
- **FR-002**: A template's trigger MUST be expressible as one of the following trip milestones —
  trip booked, trip start, three-quarters through the trip's duration, or trip finish — combined
  with a time offset before or after that milestone.
- **FR-003**: A template's message body MUST support placeholder variables (e.g., guest's first
  name, host's first name, host's phone number) that are automatically replaced with the correct
  trip-specific values whenever a message is delivered.
- **FR-004**: Host MUST be able to restrict a template so it applies only to one or more specific
  listings the host owns, or to all of the host's listings.
- **FR-005**: System MUST automatically compute a scheduled send time for every active, applicable
  template as soon as the system becomes aware of the trip it applies to.
- **FR-006**: System MUST automatically deliver each scheduled message into that trip's guest
  conversation on the connected rental platform at its scheduled time, with no manual action
  required from the host.
- **FR-007**: System MUST NOT deliver scheduled messages through any channel other than the
  rental platform's own guest-messaging conversation for that trip (no direct SMS or email).
- **FR-008**: Host MUST be able to view, for any trip, every message scheduled, sent, or skipped for
  it, including each message's content/template, computed send time, and current status.
- **FR-009**: Host MUST be able to manually send a pending scheduled message immediately, skip an
  individual pending scheduled message, or skip all of a trip's remaining pending scheduled
  messages, at any time before its scheduled delivery.
- **FR-010**: System MUST detect new reservations and changes to existing reservations (date
  changes, cancellations) on the host's connected rental-platform account on an ongoing basis,
  without the host manually re-entering trip details.
- **FR-011**: When a trip's dates change, System MUST recompute the send times of that trip's
  not-yet-sent scheduled messages; when a trip is cancelled, System MUST skip its remaining pending
  scheduled messages rather than deliver them.
- **FR-012**: Host MUST be able to maintain, per listing, guest-facing informational content —
  pickup/return instructions, a short welcome message, general vehicle tips, and a list of
  frequently asked questions with answers — that becomes visible to a guest once their trip on that
  listing is booked.
- **FR-013**: System MUST enforce maximum lengths on message and content fields consistent with what
  the rental platform's guest-messaging surface supports (message bodies up to 2,000 characters;
  pickup/return instructions and vehicle tips up to 5,000 characters each; welcome message up to 170
  characters).
- **FR-014**: System MUST restrict all template, schedule, and listing-content management to a
  single authenticated host account; this feature supports one host account, not multiple
  team members or shared access.
- **FR-015**: If the system is unable to detect reservation changes or unable to deliver a scheduled
  message, it MUST record the failure and make it visible to the host, rather than discarding it
  silently or retrying indefinitely without notice.
- **FR-016**: When a template's message body includes a variable with no available value for a
  given trip, System MUST substitute a blank value rather than deliver literal placeholder text to
  the guest.

### Key Entities

- **Host**: The single account holder who owns one or more Listings and configures message
  templates and listing content.
- **Listing**: A vehicle the host rents out on the connected rental platform; has its own Guest
  Instructions, Car Guide/FAQ content, and set of applicable templates.
- **Trip**: A reservation of a Listing by a guest, with a start date/time, end date/time, and status
  (e.g., booked, active, completed, cancelled).
- **Message Template**: A reusable rule — trigger, offset, message body, applicable listings, and
  active/inactive state — that produces Scheduled Messages for trips it applies to.
- **Scheduled Message**: A trip-specific instance of a template with a computed send date/time and a
  status of Scheduled, Sent, or Skipped.
- **Guest Instructions**: Per-listing standing content (pickup/return instructions, welcome
  message) visible to a guest once their trip is booked.
- **Car Guide**: Per-listing standing content (general vehicle tips and a list of FAQ entries)
  visible to a guest once their trip is booked.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A host can create a new message template — trigger, offset, body, and applicable
  listings — in under 2 minutes.
- **SC-002**: At least 95% of scheduled messages are delivered into the guest's conversation within
  60 minutes of their computed send time under normal operating conditions.
- **SC-003**: New reservations, and changes to existing reservations, are reflected in the host's
  view of a trip's schedule within 60 minutes of occurring on the rental platform.
- **SC-004**: A host can fully resolve an unwanted pending message (send it immediately or skip it)
  in 2 clicks or fewer from viewing the trip.
- **SC-005**: Hosts spend at least 90% less time manually messaging guests for routine trip
  milestones (booking confirmation, pickup reminders, return reminders, review requests) compared
  to messaging every guest by hand.
- **SC-006**: 100% of reservation-sync or message-delivery failures are visible in the host's view
  within the same detection cycle in which they occur — none fail silently.

## Assumptions

- Exactly one rental-platform account (Outdoorsy) is connected per host for this feature; support
  for additional rental platforms is future scope, not part of this feature.
- Trip and reservation data reaching the host's view has some bounded delay (see SC-003) rather than
  being instantaneous; this is acceptable for this feature.
- The rental platform's own guest-messaging conversation is available as a delivery target for every
  booked trip; direct SMS/email guest delivery is explicitly out of scope for this feature.
- This feature supports a single host user account; multi-user or team access is out of scope.
- A host may own and manage more than one listing under their single connected account.
