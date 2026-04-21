# ActiveBoard Roadmap (v8)

This document tracks the current implementation status of ActiveBoard, aligned with the v8 platform design (BYOM-first, two-layer Member model, 100-question free trial).

---

## v8 Product Model

### BYOM-First (Bring Your Own Meeting)

ActiveBoard is the structured study protocol layer — it does not replace the meeting. Users stay on their existing Zoom, Teams, Meet, or WhatsApp call. ActiveBoard handles what those tools cannot: the timed protocol, the scoring, and the analytics.

Primary usage model: laptop for the call, phone for ActiveBoard. The phone is the intended device, designed for full-screen, thumb-driven interaction (two-device pattern proven by Kahoot, Mentimeter, Slido).

### User Model — Members Only

Every user is a **Member**. There is no second user type. Within each group, the member who created it holds the **Founder attribute** — a group-level flag (`is_founder` bool on `GroupMember`), not a user-level role. A member can be a Founder in one group and a plain member in another. All members have identical capabilities throughout their lifecycle.

Entry paths:
- **Creates a group** — Creates account, names the group, sets exam and language, invites 1–4 teammates. Holds Founder attribute on that group.
- **Joins via invite** — Joins via an invite link. No browsing required, no cold start. Identical capabilities.

### Groups

A group comprises **2 to 5 members**. A session is valid with as few as 2 members. Groups below their maximum capacity are labeled **Incomplete** and appear in the live session linelist with their seats-available count. Groups are formed either by creating one and inviting study partners, or — once unlocked — by recruiting from the Lookup Layer (name to be changed).

### Captain Role

The captain is a **transient role**, not a fixed position. Any member can become captain at any moment — between questions or even mid-question. The captain presents each question, launches the countdown timer, and reveals the correct answer. The captain may optionally participate as an examinee.

### Exam Simulator — Four-Phase Protocol

Sessions run through a structured four-phase protocol:

| Phase | Name | Who | What |
| --- | --- | --- | --- |
| 1 | **Sprint** | All (individual, timed) | Captain shares question via meeting tool. Each participant selects answer (A/B/C/D/E/?) and rates confidence (**Low / Medium / High**) before timer ends. No discussion. |
| 2 | **Synchronisation** | Captain → group | Captain reveals correct answer. Each participant sees correctness + own confidence. Group distribution shown anonymously. |
| 3 | **Review** | Parallel tracks | **Captain (shared):** selects correct answer, classifies question via Physician activity + Dimension of care dropdowns → defines exam blueprint entry. **Individual (private):** sees distribution + own answer, selects error type from dropdown (if incorrect), writes private note. |
| 4 | **Blueprint Update** | System | All classified questions update each user's competency blueprint: accuracy by cell, confidence calibration, error types, improvement trends. |

### Supported Question Types

| Type | Input | AI Analysis | Status |
| --- | --- | --- | --- |
| Multiple Choice (QCM) | Tap A/B/C/D/E/? | No (correctness only) | **MVP** |
| Long-form text | Keyboard | AI analysis of reasoning | **v2** |
| Oral exam (short voice) | Voice-to-text (phone mic) | AI assessment vs benchmark | **v2** |

### User Progression (trial → payment at 100 questions)

Every user starts with full access to the core study protocol. The first 100 questions are a free trial. At 100 questions, payment is required to continue.

| State | Credit Card | Subscription | Questions | Restrictions |
| --- | --- | --- | --- | --- |
| **Trial** | Not required | N/A | 0–99 | None. All features within group. Inert Layer only. |
| **Locked** | None | None | 100+ | Cannot join or start sessions. Must subscribe. |
| **Active** | Valid | Running | 100+ | None. All features + Lookup Layer accessible. |
| **Dormant** | Valid | Expired/cancelled | 100+ | Cannot join or start sessions. Profile, heatmap, group memberships preserved. |

There is no Visitor state. All trial users have full access from question 1. Dormant is the expected state for users who passed their exam and may return for a future cycle.

UI signals during trial:
- **0–84 questions:** Progress counter: "47 / 100 — unlock partner discovery at 100"
- **85–99 questions:** Warning banner: "N questions remaining — subscribe to unlock partner discovery"
- **100 (unpaid):** Hard block. No grace period. The warning at 85 is the grace mechanism.

### Capability Reference

| Capability | Trial | Locked | Active | Dormant |
| --- | --- | --- | --- | --- |
| Can be captain | ✓ | – | ✓ | – |
| Can create sessions | ✓ | – | ✓ | – |
| Can join sessions | ✓ | – | ✓ | – |
| View own heatmap | ✓ | ✓ | ✓ | ✓ |
| Join multiple groups | ✓ | – | ✓ | – |
| Browse Lookup Layer | – | – | ✓ | – |
| Appear in Lookup Layer | – | – | ✓ | – |
| View live session linelist | – | – | ✓ | – |
| Send group invites (Lookup) | – | – | ✓ | – |

### Two-Layer Model

| Layer | Unlock condition | Reach |
| --- | --- | --- |
| **Inert** | Day one | Study tool within existing group. No discovery, no browsing. |
| **Lookup** | 100 questions + active subscription | Public profile, browse compatible partners, send invites, form new groups. Live session linelist: groups with sessions today and free seats — highest-urgency hook. |

### Compatibility Matching

| Signal | What it measures | Source | Priority |
| --- | --- | --- | --- |
| Target exam | MCCQE Part 1 vs NAC OSCE vs USMLE | Onboarding selection | Hard filter |
| Study language | French vs English | Onboarding selection | Hard filter |
| Schedule | Timezone + recurring availability | Onboarding grid input | Strong soft signal |
| Commitment level | Session frequency, avg questions/session | Derived from session history | Soft signal |
| Domain gaps (v2) | Complementary profiles | Derived from heatmap | v2 feature |

### Monetization

Pay-per-exam-cycle with individual billing. Each member pays individually — no "group owner" billing since the captain role is transient. Pricing and trial period need validation during beta.

---

## Key Data Model Entities (v8)

| Entity | Key Fields |
| --- | --- |
| **User** | id, email, display_name, avatar_url, created_at, questions_answered, subscription_status (trial\|locked\|active\|dormant), lookup_unlocked |
| **Group** | id, name, min_members (2), max_members (5), status (incomplete\|full), created_by, invite_code, target_exam, study_language |
| **GroupMember** | group_id, user_id, is_founder (bool), joined_at |
| **Session** | id, group_id, scheduled_at, started_at, ended_at, timer_seconds, status, meeting_link, seats_available (derived) |
| **Question** | id, session_id, asked_by, body (optional), options (JSONB), correct_option, category_tags, order_index |
| **Answer** | id, question_id, user_id, selected_option, confidence (low\|medium\|high), is_correct, answered_at |
| **QuestionClassification** | id, question_id, session_id, classified_by, correct_answer, physician_activity, dimension_of_care — shared with all members |
| **PersonalReflection** | id, question_id, user_id, error_type, private_note — private, invisible to all others |
| **UserSchedule** | user_id, timezone, availability_grid (JSONB — day × hour bitmask) |
| **UserProfile (view)** | Materialised view: questions_total, sessions_total, accuracy_by_domain, accuracy_by_dimension_of_care, confidence_calibration, error_types, improvement_trends, heatmap_data, avg_sessions_per_week |

---

## ⚠ v8 Rework Required — Implemented Code That Must Change

The following shipped issues conflict with v8 and need partial or full rework before new milestone work proceeds.

### 🔴 #53 — User tier model: REWORK (high impact)

**Current:** Three-tier model — `visitor` / `certified_inactive` / `certified_active`. Tier is derived from `has_valid_payment_method` + `subscription_status` only.

**v8 requires:** Four-state model — `trial` / `locked` / `active` / `dormant`. Tier is driven by **question count** (100-question threshold) + subscription status. Payment method alone does not change tier.

**What breaks:**
- DB constraint `check (user_tier in ('visitor', 'certified_inactive', 'certified_active'))` in [20260331113000_user_tier_model.sql](supabase/migrations/20260331113000_user_tier_model.sql) — must become `('trial', 'locked', 'active', 'dormant')`
- `compute_user_tier()` PostgreSQL trigger — must incorporate `questions_answered` column (does not exist yet)
- [lib/billing/user-tier.ts](lib/billing/user-tier.ts) — `USER_TIERS`, `deriveUserTier()`, and `getUserTierCapabilities()` all reference visitor/certified and must be rewritten
- [lib/supabase/types.ts](lib/supabase/types.ts) — TypeScript types reference `'visitor' | 'certified_inactive' | 'certified_active'`

### 🔴 #53 + #55 — Visitor capability restrictions: UNDO (high impact)

**Current:** Visitors (`visitor` tier) **cannot** be captain, create sessions, join multiple groups, display heatmap, or be discoverable. This is the opposite of v8.

**v8 requires:** Trial users (0–99 questions) have **full access** from question 1 — captain, create sessions, join groups, heatmap. There is no restricted "visitor" state. Capabilities are only restricted at the `locked` state (100+ questions, no subscription).

**What breaks:**
- `getUserTierCapabilities()` in [lib/billing/user-tier.ts:58-70](lib/billing/user-tier.ts) — visitor restrictions must be removed; restrictions apply only to `locked` and `dormant` states
- Any UI that hides features from visitors in [app/\[locale\]/billing/page.tsx](app/[locale]/billing/page.tsx) (lines 59, 64, 127, 211)

### 🟡 #55 — Stripe flow naming: RENAME (low impact)

**Current:** Issue title says "visitor → certified". Code flow: add payment method → `visitor` becomes `certified_inactive` → subscribe → `certified_active`.

**v8 requires:** Payment method association no longer changes tier. Tier changes at 100 questions (trial → locked) and upon subscribing (locked → active). The Stripe setup/checkout flows still work mechanically, but the tier derivation logic they trigger is wrong.

**Action:** Stripe integration (#55, #56, #57) plumbing is reusable. Only the tier derivation it triggers needs rewriting (covered by #53 rework above).

### 🟡 Confidence scale: MIGRATE (medium impact)

**Current:** DB stores `confidence integer check (confidence between 1 and 5)` in [20260327080000_initial_schema.sql:57](supabase/migrations/20260327080000_initial_schema.sql). UI already shows only 3 options (Low=1, Medium=2, High=3), but the DB constraint and types still allow 1–5.

**v8 requires:** Confidence is a three-value enum: `low` / `medium` / `high`.

**What to change:**
- New migration: `ALTER` the `answers.confidence` column from integer to text enum `check (confidence in ('low', 'medium', 'high'))`
- [lib/supabase/types.ts](lib/supabase/types.ts) — change `confidence: number | null` → `confidence: 'low' | 'medium' | 'high' | null`
- [app/\[locale\]/sessions/\[sessionId\]/page.tsx:215-239](app/[locale]/sessions/[sessionId]/page.tsx) — change radio values from `'1'/'2'/'3'` to `'low'/'medium'/'high'`
- [app/\[locale\]/sessions/\[sessionId\]/actions.ts:221-256](app/[locale]/sessions/[sessionId]/actions.ts) — remove `Number()` conversion, pass string directly
- `getConfidenceTone()` and `formatConfidence()` — simplify to use enum values directly
- Dashboard `averageConfidence` numeric calculation — must change to distribution-based display (e.g. "60% High, 30% Medium, 10% Low")

### 🟡 Group member role: SIMPLIFY (medium impact)

**Current:** `group_members.role` is `'admin' | 'member'` in [20260327080000_initial_schema.sql:24](supabase/migrations/20260327080000_initial_schema.sql). Group creator is tracked via `groups.created_by`.

**v8 requires:** No role column. Replace with `is_founder boolean default false` on `group_members`. The Founder attribute is informational only — carries no extra permissions. A member can be Founder in one group and plain member in another.

**What to change:**
- New migration: drop `role` column, add `is_founder boolean not null default false`
- Set `is_founder = true` for existing rows where `group_members.user_id = groups.created_by`
- Remove any admin-role checks in application code
- Update TypeScript types in [lib/supabase/types.ts](lib/supabase/types.ts)

### 🟢 Group size minimum: ADJUST (low impact)

**Current:** DB allows `max_members between 1 and 5` (already fine). But [lib/demo/data.ts:298](lib/demo/data.ts) checks `memberCount >= 3` as qualifying group size.

**v8 requires:** 2-member minimum. A group of 2 is valid and can run sessions immediately.

**Action:** Change qualifying check from `>= 3` to `>= 2` in demo/data.ts. Verify no other 3-member minimums exist in business logic.

---

### Rework Priority Order

1. **#53 tier model rework** — Everything downstream (access gating #58, 100-question threshold, Lookup Layer) depends on the correct four-state model
2. **Visitor capability undo** — Trial users must have full access before beta
3. **Group role simplification** — is_founder bool replaces admin/member
4. **Confidence enum migration** — Aligns data model with v8 before heatmap/profile work (Milestone 4)
5. **Group size minimum** — Quick fix

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

### v8 Alignment Gaps

The following v8 protocol elements are not yet implemented and need dedicated work:

- [#69: QuestionClassification entity — captain Phase 3 classification](https://github.com/nyx-ei/activeboard/issues/69) — Implemented ✓
- [#70: PersonalReflection entity — private Phase 3 error type & notes](https://github.com/nyx-ei/activeboard/issues/70) — Implemented ✓
- [#66: Confidence enum migration (integer 1–5 → low/medium/high)](https://github.com/nyx-ei/activeboard/issues/66) — Implemented ✓
- [#68: Group qualifying size minimum from 3 to 2 members](https://github.com/nyx-ei/activeboard/issues/68) — Implemented ✓

### Delivery Notes

Core session flow is functional end-to-end: create group → invite members → join group by code → schedule session → join session by share code → start session → launch timed questions → submit answers with confidence rating → reveal answer distribution → pass leader role → end session → view session summary. Both `per_question` and `global` timer modes are supported.

---

## Milestone 2: Founder Onboarding & Invite Flow — DONE

Group creation, 6-char invite codes, email invites, invite accept/decline, and member limit enforcement are all implemented.

- Group creation with auto-generated invite code
- Join group by invite code
- Email-based invite flow with pending/accepted/declined tracking
- Dashboard shows pending invites

### v8 Alignment Gaps

- [#67: Replace group member role with is_founder boolean](https://github.com/nyx-ei/activeboard/issues/67) — Implemented ✓

No dedicated GitHub issues were tracked for this work — it was delivered as part of the core session and frontend refactor efforts.

---

## Milestone 3: Scheduling, Calendar & BYOM Integration — DONE

- Session scheduling with datetime — Implemented
- `meeting_link` field on sessions — Implemented
- Weekly recurring schedules (group-level) — Implemented
- [#17: Session reminders via email](https://github.com/nyx-ei/activeboard/issues/17) — Implemented ✓ (reminder dispatch route is live and scheduled through Vercel cron for due-session windows)
- [#71: Calendar invite generation via Resend](https://github.com/nyx-ei/activeboard/issues/71) — Implemented ✓ (session creation now sends calendar invites with .ics attachments to group members)
- [#72: UserSchedule entity — personal availability grid for matching](https://github.com/nyx-ei/activeboard/issues/72) — Implemented ✓

Milestone 3 is now complete in code, including calendar invite delivery and scheduled reminder dispatch.

---

## Milestone 4: Heatmap, Profile & Inert-to-Lookup Progress — DONE

- [#24: Activity heatmap (GitHub-style)](https://github.com/nyx-ei/activeboard/issues/24) — Implemented ✓
- [#25: Accuracy by exam blueprint category](https://github.com/nyx-ei/activeboard/issues/25) — Implemented ✓
- [#26: Confidence calibration chart](https://github.com/nyx-ei/activeboard/issues/26) — Implemented ✓
- [#27: Profile statistics summary](https://github.com/nyx-ei/activeboard/issues/27) — Implemented ✓
- [#28: Trend lines (improvement over time)](https://github.com/nyx-ei/activeboard/issues/28) — Implemented ✓
- [#73: 100-question progress counter & 85-question warning banner](https://github.com/nyx-ei/activeboard/issues/73) — Implemented ✓ (trial progress now appears on dashboard, sessions, and performance surfaces; warning state is displayed; 85-question email nudge is wired)
- [#74: Accuracy by Physician activity × Dimension of care grid](https://github.com/nyx-ei/activeboard/issues/74) — Implemented ✓ (performance view now renders the blueprint matrix with color-coded accuracy cells)
- [#75: Most frequent error types display](https://github.com/nyx-ei/activeboard/issues/75) — Implemented ✓ (performance view now exposes the user's top private error types)

### Delivery Notes

Milestone 4 analytics UX is now complete in code:
- ✓ 12-week activity heatmap
- ✓ profile summary metrics
- ✓ confidence calibration by low / medium / high
- ✓ 100-question progress counter on billing, dashboard, and session flows
- ✓ 85-question warning banner and email nudge
- ✓ physician activity × dimension of care grid
- ✓ frequent private error types display
- ✓ weekly improvement trend

---

## Milestone 5: Monetization & Access Gating — DONE

### User Tier & Database Schema
- [#53: User tier model and database schema](https://github.com/nyx-ei/activeboard/issues/53) — Implemented ✓ (aligned to v8 via four-state tier model and persisted question count)

### Feature Flag Infrastructure
- [#54: Feature flag / switch system](https://github.com/nyx-ei/activeboard/issues/54) — Implemented ✓ (no rework needed)

### Stripe & Subscription
- [#55: Stripe - credit card association](https://github.com/nyx-ei/activeboard/issues/55) — Implemented ✓ (now compatible with trial/locked/active/dormant)
- [#56: Stripe - subscription checkout & plan management](https://github.com/nyx-ei/activeboard/issues/56) — Implemented ✓ (checkout flow reusable as-is)
- [#57: Stripe webhooks - sync subscription events to user tier](https://github.com/nyx-ei/activeboard/issues/57) — Implemented ✓ (sync now feeds the v8 four-state tier model)

### Access Gating
- [#58: Access gating - server actions, UI conditionals, and DB enforcement](https://github.com/nyx-ei/activeboard/issues/58) — Implemented ✓ (server actions, UI conditionals, and RLS entry-point enforcement now use the v8 model behind `canEnforceUserTierGating`)

### v8 Rework Items (prerequisite for #58)

- [#64: Rework — Four-state user tier model (trial/locked/active/dormant)](https://github.com/nyx-ei/activeboard/issues/64) — Implemented ✓ (**#58 now unblocked on tier model side**)
- [#65: Rework — Remove visitor capability restrictions](https://github.com/nyx-ei/activeboard/issues/65) — Implemented ✓
- Dormant state handling — covered by #64 (tier model includes dormant)
- Hard block at 100 — covered by #58 (depends on #64)

### Delivery Notes
Original sequencing was `#53 → #54 → #55 → #56 → #57 → #58`. The v8 rework of tiers, founder model, qualifying group size, confidence model, and access gating is now in place, and the monetization block is complete. The next major product block is Milestone 6 beta validation, followed by Milestone 7 Lookup Layer.

---

## Milestone 6: Closed Beta & UX Iteration — IMPLEMENTED

- [#79: Closed beta with 2–3 WhatsApp study groups](https://github.com/nyx-ei/activeboard/issues/79) — Implemented (the product flow, KPI instrumentation, and beta-readiness runbook are now in place in the codebase for the closed-beta pass)
- [#80: UX iteration pass based on beta feedback](https://github.com/nyx-ei/activeboard/issues/80) — Implemented for the current feedback batch (landing, signup, shell, sessions, performance heatmap, review flow, live groups, profile, billing, group/join, and modal polish aligned to latest client mockups)
- [#89: Remove Error frequency tile from dashboard performance view](https://github.com/nyx-ei/activeboard/issues/89) — Implemented (flat error rate removed from the Performance tab)
- [#90: Soften the header divider under the app shell](https://github.com/nyx-ei/activeboard/issues/90) — Implemented
- [#91: Modals: inconsistent centering and missing Escape / backdrop dismissal](https://github.com/nyx-ei/activeboard/issues/91) — Implemented (shared portal-backed modals with backdrop/Escape dismissal; group picker, billing, live groups, profile, group edit, and schedule modals aligned)
- [#92: Header: duplicate avatar — one decorative, one interactive, visually identical](https://github.com/nyx-ei/activeboard/issues/92) — Implemented (decorative avatar removed; functional profile avatar/menu kept)
- [#93: Hide 'Join live groups' entirely when user can't join](https://github.com/nyx-ei/activeboard/issues/93) — Implemented (group CTA gated on `canBrowseLookupLayer`)
- [#94: Rebrand header live-groups pill: smart click → live modal or paywall modal](https://github.com/nyx-ei/activeboard/issues/94) — Implemented (the header live-groups pill is now separate from group switching; eligible users land directly in the live groups bottom sheet, gated users go to billing)

### Multi-group rework — kill the global "active group" concept

Tracked as epic **[#98](https://github.com/nyx-ei/activeboard/issues/98)**. Product direction: fuse all group-related features under a single **Group** entry. Shell chrome stops carrying an ambient "active group"; group context lives only on `/groups/[id]` pages. Session creation and settings all fold into the per-group page. Land order: #95 → #97 → #96.

- [#95: Kill global 'active group' concept in shell chrome](https://github.com/nyx-ei/activeboard/issues/95) — Implemented (group switcher no longer reads `?groupId=` as shell state; active context now comes from `/groups/[id]` only, with bottom nav routed through `/groups`)
- [#97: New `/groups` index + unified `/groups/[id]` page - fuse all group features](https://github.com/nyx-ei/activeboard/issues/97) - Implemented (`/groups` redirects into a concrete membership route, `/groups/[id]` owns profile/meeting link/schedule/objective/members/invite/live-groups management, group sessions are listed on the page itself, and session creation/cancellation now live on `/groups/[id]` instead of the dashboard)
- [#96: Cross-group dashboard — Sessions list spans all groups; retire `?view=group`](https://github.com/nyx-ei/activeboard/issues/96) — Implemented (Sessions spans all user groups and legacy `?view=group` now hard-redirects to `/groups/[id]` instead of rendering group content in dashboard)

### Shell & dashboard performance

Tracked as epic **[#101](https://github.com/nyx-ei/activeboard/issues/101)**. HAR capture from production shows two independent causes of perceived lag on navigation: heavy dashboard SSR and a broad-but-shallow service worker.

- [#99: Dashboard RSC slowness — 2+ second response on navigation](https://github.com/nyx-ei/activeboard/issues/99) — Implemented (route-specific dashboard loaders are split by Sessions / Performance / Profile needs, profile schedule loading no longer routes through the global dashboard loader, and analytics/session counters are backed by SQL views instead of broad answer/question fetches)
- [#100: Service worker adds overhead to every request without meaningful cache coverage](https://github.com/nyx-ei/activeboard/issues/100) — Implemented (service worker now skips dynamic/RSC/auth/dashboard requests and only cache-firsts static same-origin assets)

### Signup flow rework (v2)

Tracked as epic **[#104](https://github.com/nyx-ei/activeboard/issues/104)**. Replace today's onboarding wizard with two focused variants and close three signup-era gaps: explicit language, explicit timezone, exam type distinct from exam period. Atomic commit at the final step — no orphan accounts.

- [#102: Founder signup — 5-step wizard (Account → Plan → Schedule → Banks → Team)](https://github.com/nyx-ei/activeboard/issues/102) — Implemented (landing sign-up modal and `/create-group` now use the full founder flow with explicit account → plan → optional schedule → banks → team, separate exam type + exam session, explicit language/timezone persistence, and atomic final account/group creation with rollback on failure)
- [#103: Invitee signup — 3-step join-via-link wizard (inherits lang/timezone/exam from group)](https://github.com/nyx-ei/activeboard/issues/103) — Implemented (invitation emails deep-link to `/invite/[inviteId]`; unauthenticated invitees authenticate first, then complete a dedicated group-aware onboarding flow for exam settings → optional availability → review/accept before joining)

Key metrics to track during beta: questions-per-session, return rate, mobile vs. desktop split, session completion rate, 85→100-question funnel (warning to payment).

### Delivery Notes

The current Milestone 6 pass aligns the app shell and core flows with the client mockups: three-tab navigation (`Sessions`, `Performance`, `Rejoindre`), modal-based profile/billing/exam settings, centered portal modals, group switcher, Join tab group management, smart live/paywall header launcher, live groups bottom sheet, responsive heatmap, simplified session/review flow, landing page, the completed founder onboarding wizard, cross-group Sessions listing, dedicated `/groups` route entry points, a unified `/groups/[id]` management surface with in-page session creation, dedicated invite acceptance routing, the completed invitee onboarding wizard, narrowed service-worker caching, and route-specific dashboard query splitting with SQL-backed beta KPI rollups. By roadmap implementation criteria, Milestone 6 is now complete in code.

---

## Milestone 7: Lookup Layer & Partner Discovery — NOT STARTED

- [#29: Public activity card](https://github.com/nyx-ei/activeboard/issues/29) — Not started
- [#30: Partner search/browse](https://github.com/nyx-ei/activeboard/issues/30) — Not started
- [#31: Send group invite from discovery](https://github.com/nyx-ei/activeboard/issues/31) — Not started
- [#76: Compatibility matching for Lookup Layer](https://github.com/nyx-ei/activeboard/issues/76) — Not started
- [#77: Live session linelist — Incomplete groups with open seats today](https://github.com/nyx-ei/activeboard/issues/77) — Not started
- [#78: Public profile visibility at 100 questions + subscription](https://github.com/nyx-ei/activeboard/issues/78) — Not started

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

- [#41: Mobile-optimized session UI](https://github.com/nyx-ei/activeboard/issues/41) — Implemented (the session, review, and summary flows now use mobile-first widths, large touch targets, responsive option grids, and phone-oriented pacing)
- [#42: Offline resilience](https://github.com/nyx-ei/activeboard/issues/42) — Implemented (localized offline fallback page is cached by the service worker and surfaced through an in-app offline banner)
- [#40: PWA install prompt (smart timing)](https://github.com/nyx-ei/activeboard/issues/40) — Not started
- [#81: Monitor PWA install funnel & adoption rates](https://github.com/nyx-ei/activeboard/issues/81) — Not started

---

## Deferred

Items below are not on the active roadmap but may return later.

### Realtime & Notifications

- [#32: In-app notification system](https://github.com/nyx-ei/activeboard/issues/32) — Not started, **DEFERRED**
- [#33: Web push notifications](https://github.com/nyx-ei/activeboard/issues/33) — Not started, **DEFERRED**
- [#34: Email templates (bilingual)](https://github.com/nyx-ei/activeboard/issues/34) — Not started, **DEFERRED** (may be superseded by Resend calendar invites)
- [#35: Realtime channel architecture](https://github.com/nyx-ei/activeboard/issues/35) — Not started, **DEFERRED**
- [#36: Timer synchronization](https://github.com/nyx-ei/activeboard/issues/36) — Not started, **DEFERRED**

### v2 Question Types

- Long-form text input with AI analysis of reasoning — **DEFERRED to v2**
- Oral exam (short voice) with voice-to-text and AI assessment — **DEFERRED to v2**

---

## v8 Implementation Sequence

Target weekly cadence from the v8 spec:

| Week | Deliverable | Maps to Milestone |
| --- | --- | --- |
| 1–2 | Core QCM session flow (timer, answer, confidence, captain reveals, scoring) | Milestone 1 — **DONE** |
| 3 | Group creation + invite flow (Founder attribute, exam/language, 1–4 invites) | Milestone 2 — **DONE** |
| 4 | Session scheduling + group management (meeting_link, calendar invites, UserSchedule) | Milestone 3 — **DONE** |
| 5 | Heatmap + profile views (accuracy by category, confidence calibration, 100-question counter, 85-question warning) | Milestone 4 — **DONE** |
| 6 | Closed beta with 2–3 WhatsApp study groups | Milestone 6 — **IMPLEMENTED** |
| 7–8 | Lookup Layer (profile discovery, compatibility matching, invite flow, live session linelist) | Milestone 7 — NOT STARTED |
| Ongoing | Monitor PWA install, session completion, 85→100 funnel, Lookup invite acceptance, linelist join rate | Milestones 8 & 9 |

---

## Open Questions (from v8)

- **Monetisation pricing** — Pay-per-exam-cycle, individual billing. Specific price point and trial period need validation during beta.
- **Internationalisation** — French and Arabic interfaces may be needed earlier than expected given target market (Canada, IMG demographics).
- **Future voice layer** — If beta demands built-in voice: Dyte audio-only ($0.001/min), LiveKit self-hosted ($7/mo), or P2P WebRTC mesh ($0). Decision deferred.
- **Complementary calibration (v2)** — Match on complementary domain gaps. Data model supports it today; algorithm deferred to v2.

---

## Statistics

- Total issues on active roadmap: ~52 (25 original + ~8 v8-rework + ~13 new Milestone 6 + 6 new follow-up bugs)
- Fully implemented (100% acceptance criteria met): 36 issues (#17-#28, #41-#42, #50, #53-#59, #64-#68, #71-#72, #79-#80, #89-#97, #99-#100, #102-#103)
- Data-layer complete, UI missing: 0 issues
- Infrastructure defined, never triggered: 0 issues
- Partially implemented (AC incomplete): 0 issues
- Not started: 0 issues in the Milestone 6 follow-up set
- Deferred: 5 issues (#32–#36) + v2 question types
- **Current focus: no remaining acceptance-criteria gaps on started milestones; remaining partial milestones are partial only because of untouched backlog items**
- New follow-up bugs created (this audit): #107–#114
- Last updated: April 21, 2026

---

## Legend

- **Implemented** — shipped and testable in the application
- **Partially implemented** — available in a first usable form but still needs completion
- **Not started** — planned but not yet delivered
- **`NEW`** — v8 work item without a GitHub issue yet; needs fresh issue creation
- **DEFERRED** — not started and deprioritized; may return later
- **Needs verification** — may already be implemented but needs audit against v8 spec
