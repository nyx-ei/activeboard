import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  LockKeyhole,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import { getRankedSeriousCandidates } from '@/lib/matching/serious-candidates';
import type { RankedSeriousCandidate } from '@/lib/matching/serious-candidates';
import { getPlanNextAccess } from '@/lib/session/plan-next-access';

type LookupPageProps = {
  params: { locale: string };
  searchParams: {
    feedbackMessage?: string;
    feedbackTone?: string;
    feedbackId?: string;
    q?: string;
  };
};

export default async function LookupPage({
  params,
  searchParams,
}: LookupPageProps) {
  const locale = params.locale as AppLocale;
  const language = locale === 'fr' ? 'fr' : 'en';
  const user = await requireUser(locale);
  const [t, planNextAccess] = await Promise.all([
    getTranslations('Lookup'),
    getPlanNextAccess(user.id),
  ]);
  const query = (searchParams.q ?? '').trim();
  const canRevealContacts = planNextAccess.canInviteCandidates;
  const { candidates } = await getRankedSeriousCandidates({
    userId: user.id,
    locale: language,
    query,
  });

  return (
    <main className="flex flex-1 flex-col gap-5">
      <FeedbackBanner
        message={searchParams.feedbackMessage}
        tone={searchParams.feedbackTone}
        feedbackId={searchParams.feedbackId}
      />

      <section className="overflow-hidden rounded-[16px] border border-white/[0.055] bg-[#071f1c] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-end">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-xs font-extrabold text-brand">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {t('eyebrow')}
            </p>
            <h1 className="mt-5 max-w-[780px] text-[30px] font-semibold leading-[1.08] tracking-[-0.035em] text-white sm:text-[44px]">
              {t('title')}
            </h1>
            <p className="mt-3 max-w-[680px] text-sm font-medium leading-6 text-[#8fa7a2] sm:text-[15px]">
              {t('description')}
            </p>
          </div>
          <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.025] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6f8984]">
              {t('candidatesAvailable', { count: candidates.length })}
            </p>
            <p className="mt-3 text-[52px] font-semibold leading-none tracking-[-0.05em] text-brand">
              {candidates.length}
            </p>
            <p className="mt-2 text-xs font-medium leading-5 text-[#8fa7a2]">
              {canRevealContacts ? t('contactsUnlocked') : t('contactsHidden')}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[16px] border border-white/[0.055] bg-[#081815] p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <form className="flex h-12 items-center gap-2 rounded-[12px] border border-white/[0.08] bg-[#03130f] px-3">
            <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <input
              name="q"
              defaultValue={query}
              placeholder={t('searchPlaceholder')}
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-600"
            />
            <button
              type="submit"
              className="inline-flex h-8 items-center justify-center rounded-[8px] bg-brand px-3 text-xs font-extrabold text-[#03130d] transition hover:bg-brand-strong"
            >
              {t('search')}
            </button>
          </form>
          {!canRevealContacts ? (
            <Link
              href="/billing"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[12px] border border-amber-300/35 bg-amber-300/10 px-4 text-sm font-extrabold text-amber-200 transition hover:bg-amber-300/15"
            >
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              {t('unlockContacts')}
            </Link>
          ) : null}
        </div>

        {candidates.length > 0 ? (
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {candidates.map((candidate, index) => (
              <CandidatePreviewCard
                key={candidate.id}
                candidate={candidate}
                index={index}
                revealContacts={canRevealContacts}
                labels={{
                  score: t('score'),
                  sessions: t('sessions'),
                  reviewed: t('reviewed'),
                  punctuality: t('punctuality'),
                  nextPlanned: t('nextPlanned'),
                  positiveFeedback: t('positiveFeedback'),
                  compatibility: t('compatibility'),
                  contactHidden: t('contactHidden'),
                  phoneHidden: t('phoneHidden'),
                }}
              />
            ))}
          </div>
        ) : (
          <section className="mt-4 flex min-h-[220px] items-center justify-center rounded-[14px] border border-dashed border-white/[0.09] bg-white/[0.025] p-6 text-center">
            <div className="max-w-[460px]">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04] text-slate-500">
                <Users className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-lg font-extrabold text-white">
                {t('emptyTitle')}
              </h2>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-400">
                {t('emptyDescription')}
              </p>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function CandidatePreviewCard({
  candidate,
  index,
  revealContacts,
  labels,
}: {
  candidate: RankedSeriousCandidate;
  index: number;
  revealContacts: boolean;
  labels: {
    score: string;
    sessions: string;
    reviewed: string;
    punctuality: string;
    nextPlanned: string;
    positiveFeedback: string;
    compatibility: string;
    contactHidden: string;
    phoneHidden: string;
  };
}) {
  const displayName = revealContacts
    ? candidate.name
    : maskPersonName(candidate.name, index);
  const email = revealContacts ? candidate.email : labels.contactHidden;
  const phone = revealContacts
    ? candidate.phoneNumber || labels.phoneHidden
    : labels.phoneHidden;

  return (
    <article className="rounded-[16px] border border-white/[0.07] bg-[#0b2522] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          {candidate.avatarUrl && revealContacts ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={candidate.avatarUrl}
              alt=""
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <span className="grid h-12 w-12 place-items-center rounded-full border border-brand/25 bg-brand/10 text-sm font-black text-brand">
              {getInitials(displayName)}
            </span>
          )}
          <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border border-[#0b2522] bg-brand text-[#03130d]">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-extrabold text-white">
              {index + 1}. {displayName}
            </h2>
            <span className="rounded-full border border-brand/25 bg-brand/10 px-2 py-0.5 text-[10px] font-extrabold text-brand">
              {candidate.classificationLabel}
            </span>
          </div>
          <div className="mt-2 grid gap-1.5 text-xs font-semibold text-slate-400">
            <p className="flex min-w-0 items-center gap-2">
              <Mail className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
              <span className="truncate">{email}</span>
              {!revealContacts ? (
                <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
              ) : null}
            </p>
            <p className="flex min-w-0 items-center gap-2">
              <Phone className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
              <span className="truncate">{phone}</span>
              {!revealContacts ? (
                <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
              ) : null}
            </p>
          </div>
        </div>

        <div className="rounded-[12px] border border-brand/20 bg-brand/10 px-3 py-2 text-center">
          <p className="flex items-center justify-center gap-1 text-xl font-black text-brand">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {candidate.profileScore}
          </p>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8fa7a2]">
            {labels.score}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-[#b8c7c4] sm:grid-cols-3">
        <Metric value={candidate.sessionsAttended} label={labels.sessions} />
        <Metric value={candidate.questionsReviewed} label={labels.reviewed} />
        <Metric
          value={
            candidate.punctualityRate === null
              ? '--'
              : `${candidate.punctualityRate}%`
          }
          label={labels.punctuality}
        />
        <Metric value={candidate.nextSessionsPlanned} label={labels.nextPlanned} />
        <Metric
          value={`${candidate.positivePeerVotes}/${candidate.totalPeerVotes}`}
          label={labels.positiveFeedback}
        />
        <Metric
          value={candidate.compatibilityScore}
          label={
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              {labels.compatibility}
            </span>
          }
        />
      </div>
    </article>
  );
}

function Metric({
  value,
  label,
}: {
  value: string | number;
  label: string | ReactNode;
}) {
  return (
    <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.025] p-2">
      <p className="text-sm font-extrabold text-white">{value}</p>
      <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.1em] text-slate-500">
        {label}
      </p>
    </div>
  );
}

function maskPersonName(name: string, index: number) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? `Candidate ${index + 1}`;
  const last = parts[1];

  if (!last) {
    return `${first.slice(0, 1)}***`;
  }

  return `${first.slice(0, 1)}*** ${last.slice(0, 1)}.`;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
