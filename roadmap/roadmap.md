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

---

## Phase 2: Analytics & Insights

### Heatmap & Profile Analytics
- [#24: Activity heatmap (GitHub-style)](https://github.com/nyx-ei/activeboard/issues/24) - Not started
- [#25: Accuracy by exam blueprint category](https://github.com/nyx-ei/activeboard/issues/25) - Not started
- [#26: Confidence calibration chart](https://github.com/nyx-ei/activeboard/issues/26) - Not started
- [#27: Profile statistics summary](https://github.com/nyx-ei/activeboard/issues/27) - Not started
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

### Monetisation (Pay-per-exam-cycle)
- [#37: Subscription model definition](https://github.com/nyx-ei/activeboard/issues/37) - Not started
- [#38: Payment integration (Stripe)](https://github.com/nyx-ei/activeboard/issues/38) - Not started
- [#39: Access gating](https://github.com/nyx-ei/activeboard/issues/39) - Not started

---

## Phase 5: Mobile & PWA

### PWA Onboarding & Mobile Experience
- [#40: PWA install prompt (smart timing)](https://github.com/nyx-ei/activeboard/issues/40) - Not started
- [#41: Mobile-optimized session UI](https://github.com/nyx-ei/activeboard/issues/41) - Partially implemented
- [#42: Offline resilience](https://github.com/nyx-ei/activeboard/issues/42) - Not started

---

## Phase 6: Observability & Operations

### Analytics & Error Tracking
- [#43: PostHog integration](https://github.com/nyx-ei/activeboard/issues/43) - Not started
- [#44: Sentry error tracking](https://github.com/nyx-ei/activeboard/issues/44) - Not started

### Admin & Moderation (Lightweight)
- [#45: Admin dashboard (founder only)](https://github.com/nyx-ei/activeboard/issues/45) - Not started
- [#46: Group health monitoring](https://github.com/nyx-ei/activeboard/issues/46) - Not started

---

## Statistics

- Total issues tracked in this roadmap: 31
- Fully implemented: 7 issues (`#18` to `#23`, `#50`)
- Partially implemented: 1 issue (`#41`)
- Work started overall: 8 issues
- Not started: 23 issues
- Current focus: close the remaining Phase 1 gap, then move to analytics and realtime
- Last updated: March 30, 2026

---

## Legend

- Implemented: shipped and testable in the application
- Partially implemented: available in a first usable form but still needs completion
- Not started: planned but not yet delivered
