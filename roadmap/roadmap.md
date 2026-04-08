# ActiveBoard Roadmap (v5)

This document tracks the current implementation status of ActiveBoard, aligned with the v5 product design (BYOM-first, two-layer user model).

---

## v5 Product Model

### BYOM-First (Bring Your Own Meeting)

ActiveBoard is the structured study protocol layer — it does not replace the meeting. Users stay on their existing Zoom, Teams, Meet, or WhatsApp call. ActiveBoard handles what those tools cannot: the timed protocol, the scoring, and the analytics.

### User Types

- **Founder** — Creates their own account and invites 2–4 teammates directly.
- **Invited User** — Joins via an invite link sent by a Founder. No solo path exists.

Every user enters through a pre-existing social contract. The cold-start problem is eliminated by design. Founder and Invited users have identical capabilities — the distinction is only about who created the group.

### User Progression (trial → payment at 100 questions)

Every user starts with full access to the core study protocol. The first 100 questions are a free trial. At 100 questions, payment is required to continue.

| Phase | Questions | Payment | Capabilities |
| --- | --- | --- | --- |
| **Trial** | 0–84 | None required | Full features within group (captain, create session, answer). Inert layer only. |
| **Trial (warning)** | 85–99 | None required | Same features. Warning banner: "N questions remaining — complete your profile to unlock partner discovery." Nudge toward payment + profile completion. |
| **Hard block** | 100 | Not yet paid | Cannot join or start new sessions. Must subscribe to continue. |
| **Certified Active** | 100+ | Paying | Everything + Lookup layer unlocked (public profile, browse partners, form new groups). |
| **Certified Inactive** | 100+ | Stopped paying (break or exam success) | Locked out of sessions. Profile, heatmap data, and group memberships preserved for return. |

The 100-question threshold (~5–10 real sessions) serves dual purpose: it is both the trial cap and the Lookup layer unlock. By the time a user pays, their profile has enough data to be meaningful to other users in the Lookup layer.

### Layer (where you act)

| Layer | Unlock condition | Reach |
| --- | --- | --- |
| **Inert** | Day one | Study tool within existing group. No discovery, no browsing. |
| **Lookup** (name TBD) | 100 questions answered + paying | Public profile, browse compatible partners, send invites, form new groups. Live session linelist: groups with scheduled sessions that day and free seats (2–4 members) — a powerful hook for immediate practice. |

User status and layer are linked through the 100-question threshold: reaching 100 questions triggers both the payment requirement and the Lookup layer unlock.

### Monetization

Pay-per-exam-cycle with individual billing. Each member pays individually — no "group owner" billing since the leader role is transient. Pricing and trial period need validation during beta.

---

## Milestones Overview

1. Core QCM Session Flow
2. Founder Onboarding & Invite Flow
3. Scheduling, Calendar & BYOM Integration
4. Heatmap, Profile & Inert-to-Lookup Progress
5. Monetization & Access Gating
6. Closed Beta & UX Iteration
7. Lookup Layer & Partner Discovery
8. Observability & Operations
9. Mobile & PWA

---

## Milestone 1: Core QCM Session Flow — DONE

- [#18: Captain launches session with share code](https://github.com/nyx-ei/activeboard/issues/18) — Implemented
- [#19: Leader controls: create a question](https://github.com/nyx-ei/activeboard/issues/19) — Implemented
- [#20: Participant view: answer under timer](https://github.com/nyx-ei/activeboard/issues/20) — Implemented
- [#21: Leader reveals correct answer](https://github.com/nyx-ei/activeboard/issues/21) — Implemented
- [#22: Session flow: question loop](https://github.com/nyx-ei/activeboard/issues/22) — Implemented
- [#23: Session summary screen](https://github.com/nyx-ei/activeboard/issues/23) — Implemented
- [#50: Frontend refactor: align UI with reference design](https://github.com/nyx-ei/activeboard/issues/50) — Implemented

### Delivery Notes

Core session flow is functional end-to-end: create group → invite members → join group by code → schedule session → join session by share code → start session → launch timed questions → submit answers with confidence rating → reveal answer distribution → pass leader role → end session → view session summary. Both `per_question` and `global` timer modes are supported.

---

## Milestone 2: Founder Onboarding & Invite Flow — DONE

Group creation, 6-char invite codes, email invites, invite accept/decline, and member limit enforcement (3–5 members) are all implemented.

- Group creation with auto-generated invite code
- Join group by invite code
- Email-based invite flow with pending/accepted/declined tracking
- Dashboard shows pending invites

No dedicated GitHub issues were tracked for this work — it was delivered as part of the core session and frontend refactor efforts.

---

## Milestone 3: Scheduling, Calendar & BYOM Integration — PARTIAL

- Session scheduling with datetime — Implemented
- `meeting_link` field on sessions — Implemented
- Weekly recurring schedules (group-level) — Implemented
- [#17: Session reminders via email](https://github.com/nyx-ei/activeboard/issues/17) — Not started
- `NEW` Calendar invite generation via Resend (meeting link + session URL) — Not started (needs new issue)
- `NEW` UserSchedule entity: personal availability grid (day × hour bitmask per user, used for compatibility matching) — Not started (needs new issue)

---

## Milestone 4: Heatmap, Profile & Inert-to-Lookup Progress — NOT STARTED

- [#24: Activity heatmap (GitHub-style)](https://github.com/nyx-ei/activeboard/issues/24) — Not started
- [#25: Accuracy by exam blueprint category](https://github.com/nyx-ei/activeboard/issues/25) — Not started
- [#26: Confidence calibration chart](https://github.com/nyx-ei/activeboard/issues/26) — Not started (data already captured: `answers.confidence` 1–5)
- [#27: Profile statistics summary](https://github.com/nyx-ei/activeboard/issues/27) — Partially implemented
- [#28: Trend lines (improvement over time)](https://github.com/nyx-ei/activeboard/issues/28) — Not started
- `NEW` 100-question progress counter & threshold tracking ("47 / 100 questions — unlock partner discovery at 100") — Not started (needs new issue)
- `NEW` 85-question warning banner: "N questions remaining — complete your profile to unlock partner discovery" — Not started (needs new issue)

---

## Milestone 5: Monetization & Access Gating — PARTIAL

### User Tier & Database Schema
- [#53: User tier model and database schema](https://github.com/nyx-ei/activeboard/issues/53) — Implemented

### Feature Flag Infrastructure
- [#54: Feature flag / switch system](https://github.com/nyx-ei/activeboard/issues/54) — Implemented

### Stripe & Subscription
- [#55: Stripe - credit card association (visitor → certified)](https://github.com/nyx-ei/activeboard/issues/55) — Implemented
- [#56: Stripe - subscription checkout & plan management](https://github.com/nyx-ei/activeboard/issues/56) — Implemented
- [#57: Stripe webhooks - sync subscription events to user tier](https://github.com/nyx-ei/activeboard/issues/57) — Implemented

### Access Gating
- [#58: Access gating - server actions, UI conditionals, and DB enforcement](https://github.com/nyx-ei/activeboard/issues/58) — Not started

### Delivery Notes
Mandatory sequencing: `#53 → #54 → #55 → #56 → #57 → #58`. Issues #53–#57 are implemented. Remaining gap: #58 enforces the trial-to-payment gate — hard block at 100 questions without subscription, and session lockout for Certified Inactive users. The old Visitor tier is removed; during trial (0–99 questions) all users have full access.

---

## Milestone 6: Closed Beta & UX Iteration — NOT STARTED

- `NEW` Closed beta with 2–3 existing WhatsApp study groups — Not started (needs new issue)
- `NEW` UX iteration pass based on beta feedback — Not started (needs new issue)

Key metrics to track during beta: questions-per-session, return rate, mobile vs. desktop split, session completion rate.

---

## Milestone 7: Lookup Layer & Partner Discovery — NOT STARTED

- [#29: Public activity card](https://github.com/nyx-ei/activeboard/issues/29) — Not started
- [#30: Partner search/browse](https://github.com/nyx-ei/activeboard/issues/30) — Not started
- [#31: Send group invite from discovery](https://github.com/nyx-ei/activeboard/issues/31) — Not started
- `NEW` Compatibility matching: target exam (hard filter), study language (hard filter), schedule overlap (soft signal), commitment level (soft signal) — Not started (needs new issue)
- `NEW` Live session linelist: groups with scheduled sessions that day and free seats (2–4 members) — a hook for immediate practice — Not started (needs new issue)

Domain gap matching (complementary profiles) is deferred to v2.

---

## Milestone 8: Observability & Operations — PARTIAL

- [#59: Ubiquitous logging behind feature flag](https://github.com/nyx-ei/activeboard/issues/59) — Implemented
- [#43: PostHog integration](https://github.com/nyx-ei/activeboard/issues/43) — Not started
- [#44: Sentry error tracking](https://github.com/nyx-ei/activeboard/issues/44) — Not started
- [#45: Admin dashboard (founder only)](https://github.com/nyx-ei/activeboard/issues/45) — Not started
- [#46: Group health monitoring](https://github.com/nyx-ei/activeboard/issues/46) — Not started

---

## Milestone 9: Mobile & PWA — PARTIAL

The phone is the intended primary ActiveBoard device (BYOM two-device pattern: laptop for the call, phone for ActiveBoard).

- [#41: Mobile-optimized session UI](https://github.com/nyx-ei/activeboard/issues/41) — Partially implemented
- [#42: Offline resilience](https://github.com/nyx-ei/activeboard/issues/42) — Partially implemented
- [#40: PWA install prompt (smart timing)](https://github.com/nyx-ei/activeboard/issues/40) — Not started
- `NEW` Monitor PWA install funnel & adoption rates — Not started (needs new issue)

---

## Deferred

Items below are not on the active roadmap but may return later.

### Realtime & Notifications

- [#32: In-app notification system](https://github.com/nyx-ei/activeboard/issues/32) — Not started, **DEFERRED**
- [#33: Web push notifications](https://github.com/nyx-ei/activeboard/issues/33) — Not started, **DEFERRED**
- [#34: Email templates (bilingual)](https://github.com/nyx-ei/activeboard/issues/34) — Not started, **DEFERRED** (may be superseded by Resend calendar invites)
- [#35: Realtime channel architecture](https://github.com/nyx-ei/activeboard/issues/35) — Not started, **DEFERRED**
- [#36: Timer synchronization](https://github.com/nyx-ei/activeboard/issues/36) — Not started, **DEFERRED**

---

## Statistics

- Total issues on active roadmap: 30 (25 existing + ~8 `NEW` items needing GitHub issues)
- Fully implemented: 13 issues (#18–#23, #50, #53–#57, #59)
- Partially implemented: 3 issues (#27, #41, #42)
- Not started (existing issues): 9 (#17, #24–#26, #28–#31, #40, #43–#46, #58)
- New v5 items needing GitHub issues: ~8
- Deferred: 5 issues (#32–#36)
- Current focus: ship access gating (#58), then Milestone 3 completion (calendar invites, UserSchedule)
- Last updated: April 7, 2026

---

## Legend

- **Implemented** — shipped and testable in the application
- **Partially implemented** — available in a first usable form but still needs completion
- **Not started** — planned but not yet delivered
- **`NEW`** — v5 work item without a GitHub issue yet; needs fresh issue creation
- **DEFERRED** — not started and deprioritized; may return later
