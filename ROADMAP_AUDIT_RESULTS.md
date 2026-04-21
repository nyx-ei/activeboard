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
