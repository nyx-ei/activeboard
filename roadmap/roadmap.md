# ActiveBoard Roadmap

This document tracks the current implementation status of ActiveBoard by phase and GitHub issue.

## Milestones Overview

The roadmap is organized into 6 delivery phases:

1. Core Session Experience
2. Analytics & Insights
3. Notifications & Engagement
4. Monetization
5. Mobile & PWA
6. Observability & Operations

---

## Phase 1: Core Session Experience

### Session Scheduling
- [#17: Session reminders via email](https://github.com/nyx-ei/activeboard/issues/17) - Not started
- [#18: Captain launches session with share code](https://github.com/nyx-ei/activeboard/issues/18) - Implemented

### QCM Session Flow (The Heartbeat)
- [#19: Leader controls: create a question](https://github.com/nyx-ei/activeboard/issues/19) - Implemented
- [#20: Participant view: answer under timer](https://github.com/nyx-ei/activeboard/issues/20) - Implemented
- [#21: Leader reveals correct answer](https://github.com/nyx-ei/activeboard/issues/21) - Implemented
- [#22: Session flow: question loop](https://github.com/nyx-ei/activeboard/issues/22) - Implemented
- [#23: Session summary screen](https://github.com/nyx-ei/activeboard/issues/23) - Implemented

### Phase 1 Delivery Notes
- Core session flow is now functional end-to-end:
  - create group
  - invite members in app
  - join group by code
  - schedule session
  - join session by share code
  - start session
  - launch timed questions
  - submit answers
  - reveal answer distribution
  - pass captain role
  - end session
  - view session summary
- The current implementation is stable enough for product walkthroughs and structured user testing.
- Remaining Phase 1 gap: email reminders in issue `#17`.

### Additional Frontend Work Delivered
- [#50: Frontend refactor: align ActiveBoard UI with Replit reference design](https://github.com/nyx-ei/activeboard/issues/50) - Implemented
- Frontend refactor completed to align the product UI with the Replit ActiveBoard reference:
  - landing page redesigned
  - auth screens redesigned
  - dashboard reorganized
  - group, session, and summary pages visually refactored
  - profile menu moved into the header
  - bilingual UX polish improved across the app
- Final UI polish delivered on top of `#50`:
  - dashboard segmented views (`Individual` / `Group`) aligned with the final Replit direction
  - group dashboard cards now surface real schedule, weekly progress, and member performance states
  - group settings now include weekly schedule management with add/delete flows
  - billing UI refined for card association and subscription management
  - timer mode selector now supports both `per_question` and `global` session modes

---

## Phase 2: Analytics & Insights

### Heatmap & Profile Analytics
- [#24: Activity heatmap (GitHub-style)](https://github.com/nyx-ei/activeboard/issues/24) - Not started
- [#25: Accuracy by exam blueprint category](https://github.com/nyx-ei/activeboard/issues/25) - Not started
- [#26: Confidence calibration chart](https://github.com/nyx-ei/activeboard/issues/26) - Not started
- [#27: Profile statistics summary](https://github.com/nyx-ei/activeboard/issues/27) - Partially implemented
- [#28: Trend lines (improvement over time)](https://github.com/nyx-ei/activeboard/issues/28) - Not started

### Partner Discovery
- [#29: Public activity card](https://github.com/nyx-ei/activeboard/issues/29) - Not started
- [#30: Partner search/browse](https://github.com/nyx-ei/activeboard/issues/30) - Not started
- [#31: Send group invite from discovery](https://github.com/nyx-ei/activeboard/issues/31) - Not started

---

## Phase 3: Notifications & Engagement

### Notifications & Email
- [#32: In-app notification system](https://github.com/nyx-ei/activeboard/issues/32) - Not started
- [#33: Web push notifications](https://github.com/nyx-ei/activeboard/issues/33) - Not started
- [#34: Email templates (bilingual)](https://github.com/nyx-ei/activeboard/issues/34) - Not started

### Supabase Realtime Infrastructure
- [#35: Realtime channel architecture](https://github.com/nyx-ei/activeboard/issues/35) - Not started
- [#36: Timer synchronization](https://github.com/nyx-ei/activeboard/issues/36) - Not started

---

## Phase 4: Monetization

### User Segmentation Model

ActiveBoard distinguishes three user states, derived from credit card and subscription status:

| State | Credit card | Subscription | Restricted features |
| --- | --- | --- | --- |
| **Visitor** | None | N/A | Be captain · Create session · Join more than 1 group · Display/share heatmap · Be discoverable |
| **Inactive certified** | Valid | Expired / cancelled | Be captain · Create session |
| **Active certified** | Valid | Running | None - all features unlocked |

- A user becomes **certified** by associating a valid credit card via Stripe.
- A certified user becomes **active** by also holding a running subscription.
- Downgrading from active to inactive preserves heatmap access, multi-group membership, and discoverability.

### User Tier & Database Schema
- [#53: User tier model and database schema](https://github.com/nyx-ei/activeboard/issues/53) - Implemented

### Feature Flag Infrastructure
- [#54: Feature flag / switch system](https://github.com/nyx-ei/activeboard/issues/54) - Implemented

### Stripe & Subscription
- [#55: Stripe - credit card association (visitor -> certified)](https://github.com/nyx-ei/activeboard/issues/55) - Implemented
- [#56: Stripe - subscription checkout & plan management](https://github.com/nyx-ei/activeboard/issues/56) - Implemented
- [#57: Stripe webhooks - sync subscription events to user tier](https://github.com/nyx-ei/activeboard/issues/57) - Implemented

### Access Gating
- [#58: Access gating - server actions, UI conditionals, and DB enforcement](https://github.com/nyx-ei/activeboard/issues/58) - Not started

### Phase 4 Delivery Notes
- Mandatory sequencing: `#53 -> #54 -> #55 -> #56 -> #57 -> #58`.
- `#53` defines `user_tier` (`visitor | certified_inactive | certified_active`) as the single source of truth consumed by every downstream issue.
- `#54` is a user-agnostic deployment safety mechanism: flags gate code paths globally and are independent of user tier logic.
- `#55` covers the card-on-file Stripe flow only (no subscription): the outcome is a stored payment method and a tier upgrade to `certified_inactive`.
- `#56` covers subscription checkout, plan display, success return sync, and customer-portal based plan management.
- `#57` handles inbound Stripe webhook events and keeps `user_tier` in sync for subscription lifecycle changes and payment failures.
- `#58` enforces limits at server-action level, UI level, and DB level.

---

## Phase 5: Mobile & PWA

### PWA Onboarding & Mobile Experience
- [#40: PWA install prompt (smart timing)](https://github.com/nyx-ei/activeboard/issues/40) - Not started
- [#41: Mobile-optimized session UI](https://github.com/nyx-ei/activeboard/issues/41) - Partially implemented
- [#42: Offline resilience](https://github.com/nyx-ei/activeboard/issues/42) - Partially implemented

---

## Phase 6: Observability & Operations

### Logging
- [#59: Ubiquitous logging behind feature flag `canUseUbiquitousLogging`](https://github.com/nyx-ei/activeboard/issues/59) - Implemented

### Analytics & Error Tracking
- [#43: PostHog integration](https://github.com/nyx-ei/activeboard/issues/43) - Not started
- [#44: Sentry error tracking](https://github.com/nyx-ei/activeboard/issues/44) - Not started

### Admin & Moderation (Lightweight)
- [#45: Admin dashboard (founder only)](https://github.com/nyx-ei/activeboard/issues/45) - Not started
- [#46: Group health monitoring](https://github.com/nyx-ei/activeboard/issues/46) - Not started

---

## Statistics

- Total issues tracked in this roadmap: 35
- Fully implemented: 13 issues (`#18` to `#23`, `#50`, `#53`, `#54`, `#55`, `#56`, `#57`, `#59`)
- Partially implemented: 3 issues (`#27`, `#41`, `#42`)
- Work started overall: 16 issues
- Not started: 19 issues
- Current focus: ship access gating (`#58`) next
- Last updated: April 1, 2026

---

## Legend

- Implemented: shipped and testable in the application
- Partially implemented: available in a first usable form but still needs completion
- Not started: planned but not yet delivered
