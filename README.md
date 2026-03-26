# ActiveBoard

> **Phone-first collaborative study platform for medical exam preparation**
>
> Exam simulator with structured review for high stakes exams. Schedule real-time QCM (multiple-choice) sessions with study partners, track your progress through detailed analytics, and optimize your exam readiness.

[![Vercel Deploy](https://img.shields.io/badge/Deployed%20on-Vercel-000?style=flat-square)](https://activeboard.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?style=flat-square)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

---

## 🎯 What is ActiveBoard?

ActiveBoard is a **BYOM** (Bring Your Own Meeting) study platform where medical students organize collaborative exam prep sessions. Group members take turns as "leader"—one person presents questions while others answer in real-time under a countdown timer. Everyone sees their and chooses areas for improvement and track their score, confidence calibration, and category-level accuracy metrics.

**Key insight:** Most med students already study in WhatsApp groups. ActiveBoard doesn't replace those groups—it plugs into them. You bring your study group. We provide the exam tools, real-time sync, and analytics.

### Why ActiveBoard?

- **Mobile-first PWA** — Designed for one-handed phone use; full offline support
- **Bilingual** (EN/FR) — International medical exams don't wait for translation
- **Real-time sync** — Timer, scores, and presence via Supabase Realtime (< 1 second drift)
- **Pay-per-cycle** — Each member pays individually for an exam prep cycle (no group subscriptions)
- **Privacy-focused** — No names on wrong answers; only leader identity shared
- **Analytics-driven** — Heatmap, accuracy by category, confidence calibration, confidence trends

---

## ✨ Core Features

### 👥 Group Management
- Create or join study groups with 3–5 members
- Shareable invite codes
- Real-time presence tracking

### 📋 QCM Session Flow
1. **Schedule** — Set date/time and meeting link (Zoom, Teams, etc.)
2. **Lobby** — Wait with groupmates; meeting link prominent
3. **Leader launches timer** — Countdown synced across all devices per question (prompt user to move to the next session)
4. **Everyone answers** — Pick option (A–E) or leave [ ] For any other letter only  and confidence radio boutton (low , medium, high)
5. **Leader reveals** — Correct answer highlighted; group distribution shown anonymously
6. **Score updates** — Your accuracy %, running tally
7. **Next question** — Repeat or end session

### 📊 Personal Analytics
- **Activity heatmap** — GitHub-style contributions (questions answered per day)
- **Accuracy by category** — Identify weak exam blueprint areas
- **Confidence calibration** — Are you overconfident? Underconfident?
- **Streaks & trends** — Weekly accuracy trend lines

### 🔍 Partner Discovery
- Browse other test takers' public cards (activity only, no session history)
- Find study partners beyond your WhatsApp circle
- Invite recruits directly to your group
# ActiveBoard — Product Specification v4.2  
Execution System for Group-Based Exam Simulation

---

## 1. Entry Point (Landing + Session Creation)

### User Actions
- Create account  
- Create session OR join session  

### Session Creation (Leader Only)

| Field | Type | Options |
|------|------|--------|
| Session name | Text | Optional |
| Number of questions | Integer | Required |
| Timer mode | Select | Per question / Full session / None |
| Time per question | Integer | Required if per-question |
| Total time | Integer | Required if full-session |

---

### Invite System

| Method | Description |
|--------|------------|
| Link invite | Shareable URL |
| Search + add | Add users directly |

---

## 2. Session Initialization

When session starts:
- All users receive:
  - Number of questions  
  - Timer configuration  
- Session state synced across all users  

---

## 3. Answer Phase (User Interface — Mobile)

### Input Per Question

| Field | Type | Constraint |
|------|------|-----------|
| Answer | MCQ (A–E) + free input | One selection only |
| Certainty level | Radio | Low / Medium / High |

---

### Rules

- One answer per question  
- One certainty level required  
- No back navigation if timer active  
- If per-question timer:
  - Auto-advance on timeout  
- If user disconnects:
  - Resume at current question  
- Unanswered questions:
  - Not counted  

---

### Submission Rule

- Session valid only after full submission  
- Partial participation = excluded from scoring  

---

## 4. Transition to Review Phase

Condition:
→ All users submit  

Then:
→ Leader (Captain) unlocks review phase  

---

## 5. Review Phase (Leader Interface)

### Per Question Layout

| Column | Description |
|--------|------------|
| Question number | Index |
| Correct answer | A–E + free input |
| Answer distribution | Count per option (A–E + free) |

---

### Distribution Logic

- Each option displays:
  - Count of users who selected it  
- Updates dynamically after submission  

---

### Tagging Inputs (Leader)

| Field | Type |
|------|------|
| Dimension of care | Dropdown |
| Activity / Vision | Dropdown |
| Error type | Dropdown |
| Comment | Text input |

---

### Error Types (Dropdown)

- Failure to identify next step  
- Misread question stem  
- Attracted to trap answer  
- Incomplete reading  
- Pattern recognition failure  
- Logical reasoning failure  
- Knowledge gap  

---

## 6. Review Phase (Participant Interface)

### Per Question View

| Element | Behavior |
|--------|---------|
| User answer | Highlighted |
| Correct answer | Displayed |
| Incorrect answer | Greyed out |
| Error selection | Required |
| Comment input | Required |

---

### Reflection Logic

Text placeholder adapts based on:

| Condition | Prompt |
|----------|-------|
| Correct + low confidence | “Why did you not trust your answer?” |
| Incorrect + high confidence | “Why were you overconfident?” |
| Incorrect + low confidence | “What knowledge or reasoning was missing?” |

---

## 7. Validation of Review

A question is validated only if:
- All participants complete tagging  
- All comments submitted  

Then:
→ Question marked as complete  
→ Progress moves forward  

---

## 8. Data Aggregation (Post-Review)

After each validated question:

Data updates for each user:

| Component | Update |
|----------|--------|
| Heatmap | +1 question attempt |
| Blueprint table | Updated (dimension × activity) |
| Error log | Error type stored |
| Comment log | Reflection stored |

---

## 9. Dashboard (User Landing Page)

### Tab Structure

| Tab | Content |
|-----|--------|
| Heatmap | Questions over time |
| Blueprint | 4×4 table (dimension × activity) |
| Errors & Comments | All tagged errors + reflections |

---

### Heatmap

- X-axis: Days (monthly scroll)  
- Y-axis: Questions completed  
- Overlay:
  - Correctness  
  - Confidence  
  - Calibration trend  

---

### Blueprint Table (4×4)

| Axis | Description |
|------|------------|
| Rows | Dimension of care |
| Columns | Activity |

Each cell:
- Tracks performance  
- Aggregates results  

---

### Error & Comment Log

- All past errors  
- All reflections  
- Filterable by type  

---

## 10. Session Completion Rules

| Rule | Effect |
|------|--------|
| Incomplete answer phase | No scoring |
| Incomplete review phase | No data update |
| Full completion | Data stored |

---

## 11. System Constraints

- Server-authoritative session state  
- No backtracking under timer  
- All inputs required before progression  
- Data only recorded for valid sessions  

---

## 12. Key Tradeoffs

### 1. Discipline vs Flexibility
- Enforced flow → higher performance  
- Reduced user freedom  

Decision:
→ enforce discipline  

---

### 2. Data Quality vs Data Quantity
- Only valid sessions counted  
- Partial data discarded  

Decision:
→ prioritize clean data  

---

### 3. Friction vs Accuracy
- Mandatory inputs increase friction  
- Improves diagnostic quality  

Decision:
→ accept friction  

---

### 4. Leader Control vs System Automation
- Leader drives review phase  
- System enforces structure  

Decision:
→ hybrid control model  

---

## 13. Failure Modes

| Risk | Cause | Mitigation |
|------|------|-----------|
| Drop-off | High friction | UX optimization |
| Incomplete sessions | Weak enforcement | Hard gating |
| Low engagement | Poor captain | Captain system |
| Data noise | Partial entries | Validity rules |

---

## 14. Bottom Line

This system is designed to:

- force decision-making under pressure  
- capture reasoning, not just answers  
- generate structured performance data  

Not designed for:

- passive learning  
- flexible workflows  
- casual usage  

---

## Final Rule

If a feature reduces discipline → reject  
If a feature increases behavioral signal → ship
---

## 🛠 Tech Stack

| Layer | Tech | Purpose |
|-------|------|---------|
| **Frontend** | Next.js 14 App Router, TypeScript, Tailwind CSS | Type-safe, mobile-first UI |
| **Realtime** | Supabase Realtime (WebSocket) | Timer sync, presence, answer streaming |
| **Backend** | Supabase PostgreSQL, RLS policies | Data, auth, authorization |
| **Auth** | Supabase Auth (email/password, Google OAuth, magic link) | Multi-method sign-in |
| **i18n** | next-intl | Bilingual routing (en/fr) |
| **Email** | Resend API | Session reminders, activity digests |
| **Payments** | Stripe | Pay-per-cycle subscriptions |
| **Analytics** | PostHog | Usage tracking, feature flags |
| **Errors** | Sentry | Exception monitoring |
| **Storage** | Supabase Storage | Avatar uploads, backups |
| **Hosting** | Vercel | Auto-deploy on main branch, preview deploys |
| **PWA** | Web Push API, service workers | "Add to home screen", offline assets |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or pnpm
- Supabase account (free tier)
- Vercel account (for deployment previews)

### 1. Clone & Install
```bash
git clone https://github.com/alexis-chifor/activeboard.git
cd activeboard
npm install
