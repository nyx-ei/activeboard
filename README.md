# ActiveBoard

> **Phone-first collaborative study platform for medical exam preparation**
>
> Schedule real-time QCM (multiple-choice) sessions with study partners, track your progress through detailed analytics, and optimize your exam readiness.

[![Vercel Deploy](https://img.shields.io/badge/Deployed%20on-Vercel-000?style=flat-square)](https://activeboard.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?style=flat-square)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

---

## 🎯 What is ActiveBoard?

ActiveBoard is a **BYOM** (Bring Your Own Meeting) study platform where medical students organize collaborative exam prep sessions. Group members take turns as "leader"—one person presents questions while others answer in real-time under a countdown timer. Everyone sees their score, confidence calibration, and category-level accuracy metrics.

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
3. **Leader launches timer** — Countdown synced across all devices
4. **Everyone answers** — Pick option (A–E) and confidence level (1–5)
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
