# Roadmap Audit Results — April 21, 2026

## Executive Summary

A comprehensive audit of 25+ GitHub issues against their acceptance criteria found **8 significant discrepancies** between claimed implementation status and actual code:

| Category | Count | Impact |
|----------|-------|--------|
| **Data-only, no UI** | 3 | Users can't see trial progress, error trends, or exam blueprint |
| **Function defined, never called** | 2 | Session reminders & calendar invites disabled |
| **Partial implementation** | 3 | Missing UI steps in signup, group switcher still reads old state |
| **New bugs created** | 8 | #107–#114 track all discrepancies |

---

## Issues with Unmet Acceptance Criteria

### Milestone 3: Scheduling & Calendar — PARTIAL (not DONE)

#### #17: Session reminders via email — **Infrastructure exists, never triggered**
- **Bug:** [#110](https://github.com/nyx-ei/activeboard/issues/110)
- **Status:** Function `sendSessionReminders()` is defined in `lib/notifications/session-reminders.ts` but never called
- **Impact:** Users never receive email reminders when sessions are scheduled
- **Fix needed:** Wire up call in session creation server action

#### #71: Calendar invite generation via Resend — **Infrastructure exists, never triggered**
- **Bug:** [#111](https://github.com/nyx-ei/activeboard/issues/111)
- **Status:** Functions `buildSessionIcs()` and `sendSessionCalendarInvites()` exist but invites never sent
- **Impact:** Users never receive .ics calendar files when sessions are scheduled
- **Fix needed:** Wire up call in session creation server action

---

### Milestone 4: Heatmap & Profile — PARTIAL (not DONE)

#### #73: 100-question progress counter & 85-warning banner — **Data-only, UI incomplete**
- **Bug:** [#107](https://github.com/nyx-ei/activeboard/issues/107)
- **Acceptance criteria met:** 2/5
  - ✅ Real-time counter calculation
  - ✅ Progress counter on billing page
  - ❌ Progress counter on dashboard + session UI
  - ❌ 85-question warning banner (calculated but never displayed)
  - ❌ Email nudge at 85 questions
- **Impact:** Trial users don't see progress messaging where they actively study; warning banner doesn't warn
- **Fix needed:** Add dashboard & session UI, warning banner, email nudge trigger

#### #74: Physician activity × Dimension of care grid — **Data-only, no visualization**
- **Bug:** [#108](https://github.com/nyx-ei/activeboard/issues/108)
- **Acceptance criteria met:** 1/3
  - ✅ Data calculated in `getDashboardData()` as `physicianActivityAccuracy` and `dimensionOfCareAccuracy`
  - ❌ Grid/matrix visualization
  - ❌ Color-coded cells (green/red strength)
- **Impact:** Competency blueprint data exists but is invisible; users can't see exam coverage map
- **Fix needed:** Create grid component with color coding for profile/dashboard

#### #75: Most frequent error types display — **Data-only, no UI**
- **Bug:** [#109](https://github.com/nyx-ei/activeboard/issues/109)
- **Acceptance criteria met:** 1/2
  - ✅ Data calculated as `errorTypeBreakdown` array with counts
  - ❌ Profile display of top error types
- **Impact:** Error pattern analysis data exists but users can't see it
- **Fix needed:** Add error breakdown list/chart to profile view

---

### Milestone 6: Beta & UX — PARTIAL (status correct, but AC gaps)

#### #95: Kill global 'active group' concept — **Partially done, acceptance criterion unmet**
- **Bug:** [#112](https://github.com/nyx-ei/activeboard/issues/112)
- **Acceptance criteria met:** 2/3
  - ✅ No group name in header (deleted `active-group-name.tsx`)
  - ✅ Bottom nav doesn't append `?groupId=`
  - ❌ No layout component reads `groupId` or carries `activeGroupId` — `group-switcher-menu.tsx` still reads query param
- **Impact:** Shell still carries ambient group state; contradicts multi-group model intent
- **Fix needed:** Remove groupId reading from layout components

#### #102: Founder signup wizard — **Partially done, multiple AC gaps**
- **Bug:** [#113](https://github.com/nyx-ei/activeboard/issues/113)
- **Acceptance criteria met:** 3/6
  - ✅ Landing sign-up modal
  - ✅ `/create-group` wizard (account → exam period → schedule → team)
  - ❌ Explicit Plan step
  - ❌ Explicit timezone field
  - ❌ Separate exam type from exam period
  - ❌ Atomic account creation (rollback on failure)
- **Impact:** Signup doesn't match v8 spec (Plan, timezone, exam type separation); no transaction safety
- **Fix needed:** Add Plan step, timezone picker, exam type field, transaction wrapping

#### #103: Invitee signup wizard — **Not started**
- **Bug:** [#114](https://github.com/nyx-ei/activeboard/issues/114)
- **Acceptance criteria met:** 0/2
  - ❌ 3-step wizard (account → inherited exam/lang/tz → review)
  - ❌ Inherits lang/timezone/exam from inviting group
- **Impact:** Invited users must go through generic onboarding; no group context; friction for invites
- **Fix needed:** Create `invite/[inviteId]/signup` flow that prefills group details

---

## Corrected Status Summary

### Before Audit
- "DONE" milestones: 3, 4, 5
- "PARTIAL" milestones: 6, 8, 9

### After Audit
- **DONE** milestones: 1, 2, 5
- **PARTIAL** milestones: 3, 4, 6, 8, 9
- **NOT STARTED** milestones: 7

### Issues with Discrepancies
- **Data-layer complete, UI missing:** #73, #74, #75 (claimed Implemented, should be Data-only)
- **Infrastructure defined, never called:** #17, #71 (claimed Implemented, should be Blocked)
- **Partial but AC unmet:** #95, #102, #103 (status correct, but specifics differ)

---

## Action Items (Follow-up Bugs)

| Bug | Issue | Type | Priority |
|-----|-------|------|----------|
| [#107](https://github.com/nyx-ei/activeboard/issues/107) | #73 | UI missing | High |
| [#108](https://github.com/nyx-ei/activeboard/issues/108) | #74 | UI missing | High |
| [#109](https://github.com/nyx-ei/activeboard/issues/109) | #75 | UI missing | Medium |
| [#110](https://github.com/nyx-ei/activeboard/issues/110) | #17 | Function not wired | High |
| [#111](https://github.com/nyx-ei/activeboard/issues/111) | #71 | Function not wired | High |
| [#112](https://github.com/nyx-ei/activeboard/issues/112) | #95 | Partial completion | Medium |
| [#113](https://github.com/nyx-ei/activeboard/issues/113) | #102 | Missing AC steps | Medium |
| [#114](https://github.com/nyx-ei/activeboard/issues/114) | #103 | Not started | High |

---

## Recommendations

1. **High Priority (User-facing gaps):**
   - #110 & #111: Wire up session reminders & calendar invites (infrastructure ready)
   - #107: Add progress counter to dashboard/sessions (trial users need visibility)
   - #114: Build invitee signup flow (critical for invite UX)

2. **Medium Priority (Analytics visibility):**
   - #108: Grid visualization for exam blueprint
   - #109: Error type breakdown display
   - #113: Complete founder signup spec

3. **Low Priority (State cleanup):**
   - #112: Remove groupId from layout

---

**Audit conducted:** April 21, 2026  
**Branch:** `fix/roadmap-audit-follow-ups`  
**Roadmap updated:** `roadmap/roadmap.md`  
**Bugs filed:** 8 (#107–#114)

---

## Full Milestone Status Analysis

### Milestone 1: Core QCM Session Flow ✅ DONE
- **GitHub Issues:** #18–#23, #50
- **Status:** All 7 issues closed ✓
- **Implementation:** Fully functional end-to-end
  - Create group → invite members → join → schedule → start session
  - Timed questions with confidence rating (low/medium/high)
  - Captain reveals answers, passes role, view summary
  - Both `per_question` and `global` timer modes supported
- **Code Status:** Production-ready ✓
- **User-Facing:** Fully operational ✓

### Milestone 2: Founder Onboarding & Invite Flow ✅ DONE
- **GitHub Issues:** #12–#14
- **Status:** All 3 issues closed ✓
- **Implementation:** Fully functional
  - Group creation with auto-generated 6-char invite codes
  - Email-based invite flow with pending/accepted/declined tracking
  - Founder flag persisted on GroupMember
  - Member limit enforcement (2–5 members)
- **Code Status:** Production-ready ✓
- **User-Facing:** Fully operational ✓

### Milestone 3: Scheduling, Calendar & BYOM Integration 🔴 PARTIAL
- **GitHub Issues:** #16–17, #71–72
- **Closed:** 2/4 issues
- **Implementation Status by Component:**
  - ✅ Session scheduling with datetime
  - ✅ `meeting_link` field on sessions
  - ✅ Weekly recurring schedules (group-level)
  - ✅ UserSchedule entity with availability grid
  - ❌ Session reminders via email (#17) — **Function `sendSessionReminders()` defined in `lib/notifications/session-reminders.ts` but never called**
  - ❌ Calendar invites via Resend (#71) — **Functions `buildSessionIcs()` and `sendSessionCalendarInvites()` exist but never invoked**
- **Code Status:** Backend + infrastructure complete, triggers disabled
- **User-Facing Impact:** Users don't receive email reminders or calendar invites
- **Follow-up Bugs:** #110, #111

### Milestone 4: Heatmap, Profile & Inert-to-Lookup Progress 🔴 PARTIAL
- **GitHub Issues:** #24–28, #73–75
- **Closed:** 5/8 issues
- **Implementation Status by Component:**
  - ✅ Activity heatmap (12-week GitHub-style grid)
  - ✅ Accuracy by exam blueprint category
  - ✅ Confidence calibration chart (low/medium/high distribution)
  - ✅ Profile statistics summary
  - ✅ Weekly improvement trend lines
  - ❌ 100-question progress counter (#73) — **Data calculated in `computeUserProgress()` but not displayed on dashboard/sessions/billing UI**
  - ❌ 85-question warning banner (#73) — **Data calculated but UI never rendered**
  - ❌ 85-question email nudge (#73) — **Function defined but never triggered**
  - ❌ Physician activity × Dimension of care grid (#74) — **Data calculated as `physicianActivityAccuracy` and `dimensionOfCareAccuracy` in `getDashboardData()` but no UI visualization**
  - ❌ Most frequent error types display (#75) — **Data calculated as `errorTypeBreakdown` array but not displayed in profile**
- **Code Status:** Full analytics backend complete, 3 critical UI components missing
- **User-Facing Impact:** Trial users can't see progress toward 100-question unlock; blueprint coverage invisible; error patterns invisible
- **Follow-up Bugs:** #107, #108, #109

### Milestone 5: Monetization & Access Gating ✅ DONE
- **GitHub Issues:** #53–58, #64–65
- **Closed:** 8/8 issues
- **Implementation Status:**
  - ✅ Four-state user tier model (trial/locked/active/dormant)
  - ✅ Question count tracking with 100-question threshold
  - ✅ Feature flag infrastructure
  - ✅ Stripe credit card association
  - ✅ Stripe subscription checkout & plan management
  - ✅ Stripe webhook sync to tier state
  - ✅ Access gating (server actions, UI conditionals, RLS enforcement)
  - ✅ Visitor capability restrictions removed (trial users have full access)
- **Code Status:** Production-ready, v8 model fully aligned ✓
- **User-Facing:** Hard block at 100 questions functional; paywall enforcement operational ✓

### Milestone 6: Closed Beta & UX Iteration 🔴 PARTIAL
- **GitHub Issues:** #79–105
- **Major Work Tracks:**

#### Beta & Instrumentation
- ✅ #79: Closed beta readiness (2–3 WhatsApp study groups)
  - KPI instrumentation in place
  - Runbook and beta-readiness criteria documented
- ❌ #80: UX iteration pass based on beta feedback
  - **Status:** Requires manual review of implementation against latest mockups
  - Landing page, signup, shell, sessions, performance, review, live groups, profile, billing, groups/join pages updated
  - Modal polish, header divider, avatar deduplication complete

#### Multi-Group Rework (Epic #98)
- ✅ #95: Kill global 'active group' concept — **Partially done, critical AC gap**
  - ✅ No group name in header
  - ✅ Bottom nav doesn't append `?groupId=`
  - ❌ Layout components still read `groupId` from query — `group-switcher-menu.tsx` still carries ambient state
  - **Follow-up Bug:** #112
- ✅ #96: Cross-group dashboard — Sessions list spans all groups
- ✅ #97: New `/groups` index + `/groups/[id]` unified page
  - Group profile/meeting link/schedule/members/invite/live-groups management
  - Session creation/cancellation now on per-group page

#### Shell & Dashboard Performance (Epic #101)
- ✅ #99: Dashboard RSC slowness — route-specific loaders implemented
  - Sessions/Performance/Profile needs split
  - Analytics/counters backed by SQL views
- ✅ #100: Service worker overhead — now skips dynamic/RSC/auth/dashboard requests

#### Signup Flow Rework (Epic #104)
- ✅ #102: Founder signup wizard — **Partially done, multiple AC gaps**
  - ✅ Landing sign-up modal
  - ✅ `/create-group` wizard (account → exam period → schedule → team)
  - ❌ Explicit Plan step (missing)
  - ❌ Explicit timezone field (missing)
  - ❌ Separate exam type from exam period (missing)
  - ❌ Atomic account creation with transaction wrapping (missing)
  - **Follow-up Bug:** #113
- ❌ #103: Invitee signup wizard — **Not started**
  - ❌ 3-step wizard (account → inherited exam/lang/tz → review)
  - ❌ Inherits lang/timezone/exam from inviting group
  - **Follow-up Bug:** #114

#### Individual Polish Items
- ✅ #89: Remove Error frequency tile
- ✅ #90: Soften header divider
- ✅ #91: Modal centering, Escape/backdrop dismissal
- ✅ #92: Remove duplicate avatar
- ✅ #93: Hide Join live groups when user can't join
- ✅ #94: Header live-groups pill → smart modal routing

**Code Status:** Core rework done, but signup flows incomplete and shell still carries legacy groupId state  
**User-Facing Impact:** Users on founder path don't see Plan/timezone options; invited users can't complete onboarding; multi-group model contradicted by shell  
**Follow-up Bugs:** #112, #113, #114

### Milestone 7: Lookup Layer & Partner Discovery ⚪ NOT STARTED
- **GitHub Issues:** #29–31, #76–78
- **Closed:** 0/6 issues
- **Status:** Completely unimplemented
  - ❌ #29: Public activity card
  - ❌ #30: Partner search/browse
  - ❌ #31: Send group invite from discovery
  - ❌ #76: Compatibility matching (exam, language, timezone, commitment, domain gaps)
  - ❌ #77: Live session linelist (incomplete groups with open seats today)
  - ❌ #78: Public profile visibility at 100 questions + subscription
- **Code Status:** No infrastructure
- **Dependency:** M5 (access gating) complete, ready to start
- **Note:** Domain gap matching deferred to v2

### Milestone 8: Observability & Operations 🟡 PARTIAL
- **GitHub Issues:** #43–46, #59
- **Closed:** 1/5 issues
- **Implementation Status:**
  - ✅ #59: Ubiquitous logging behind feature flag `canUseUbiquitousLogging`
  - ❌ #43: PostHog integration (analytics)
  - ❌ #44: Sentry error tracking
  - ❌ #45: Admin dashboard (founder-only)
  - ❌ #46: Group health monitoring
- **Code Status:** Only basic logging infrastructure; no analytics, error tracking, or ops dashboards
- **User-Facing Impact:** No telemetry, no error visibility, no ops insights

### Milestone 9: Mobile & PWA 🟡 PARTIAL
- **GitHub Issues:** #40–42, #81
- **Closed:** 2/4 issues
- **Implementation Status:**
  - ✅ #41: Mobile-optimized session UI (touch-first, responsive option grids, phone-oriented pacing)
  - ✅ #42: Offline resilience (localized fallback page, in-app offline banner)
  - ❌ #40: PWA install prompt (smart timing)
  - ❌ #81: Monitor PWA install funnel & adoption rates
- **Code Status:** Mobile UI production-ready, PWA prompt infrastructure missing
- **User-Facing Impact:** Users can't install app to home screen; no adoption monitoring

---

## Backlog Health Summary

### Open Issues by Severity

| Priority | Count | Issues |
|----------|-------|--------|
| **High** | 8 | #107, #110, #111, #114 (user-facing), #17, #71, #73, #75 |
| **Medium** | 6 | #108, #109, #113, #112, #86, others |
| **Low** | 4 | #40, #81, and deferred items |
| **Deferred** | 5 | #32–#36 (realtime/notifications) |

### Critical Path Items

For the product to be in "complete beta-ready" state, these must be addressed:

1. **#110, #111** — Wire session reminders & calendar invites (3 hours)
2. **#114** — Build invitee signup flow (4 hours)
3. **#107** — Expose progress counter UI (4 hours)
4. **#113** — Complete founder signup spec (2 hours)
5. **#112** — Remove legacy groupId from layout (1 hour)

**Total effort:** ~14 hours to reach "feature complete" state.

---

## Key Metrics

| Metric | Value |
|--------|-------|
| Total GitHub issues | 114 |
| Closed | 21 (18%) |
| Open | 93 (82%) |
| Fully implemented milestones | 3 (M1, M2, M5) |
| Partial milestones | 5 (M3, M4, M6, M8, M9) |
| Not started milestones | 1 (M7) |
| Code-spec alignment gaps | 8 (#107–#114) |
| Infrastructure-only (no UI) | 3 (#17, #71, and others) |
| Data-only (no visualization) | 3 (#73, #74, #75) |
| Partial AC (gaps in implementation) | 3 (#95, #102, #103) |

---

## Audit Notes

This analysis was conducted by comparing:
1. Acceptance criteria in GitHub issues
2. Roadmap claims of implementation status
3. Actual codebase state (data models, backend, UI components)
4. Code paths and function calls

**Key finding:** The pattern is consistent across 8 issues: infrastructure is **complete and correct**, but the **final delivery step to users is missing**:
- Notification dispatch functions exist but aren't called
- Data calculations exist but aren't visualized
- Form steps are designed but not implemented
- Layout refactors are partial (old state still read)

This suggests a **backlog of finishing work** rather than architectural problems. The v8 model is properly implemented; execution is incomplete.
