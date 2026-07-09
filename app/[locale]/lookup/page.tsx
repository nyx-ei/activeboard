import { getTranslations } from 'next-intl/server';

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
  const canRevealProfiles = planNextAccess.canInviteCandidates;
  const { candidates } = await getRankedSeriousCandidates({
    userId: user.id,
    locale: language,
  });

  return (
    <main className="relative flex flex-1 flex-col gap-5 pb-28">
      <FeedbackBanner
        message={searchParams.feedbackMessage}
        tone={searchParams.feedbackTone}
        feedbackId={searchParams.feedbackId}
      />

      <section className="rounded-[16px] border border-white/[0.055] bg-[#071f1c] px-4 py-4 sm:px-5">
        <h1 className="inline-flex rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-xs font-extrabold text-brand">
          {t('eyebrow')}
        </h1>
      </section>

      {candidates.length > 0 ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {candidates.map((candidate, index) => (
            <CandidatePreviewCard
              key={candidate.id}
              candidate={candidate}
              index={index}
              revealProfile={canRevealProfiles}
              scoreLabel={t('score')}
            />
          ))}
        </section>
      ) : (
        <section className="rounded-[16px] border border-dashed border-white/[0.09] bg-white/[0.025] p-8 text-center">
          <p className="text-sm font-extrabold text-slate-400">
            {t('emptyTitle')}
          </p>
        </section>
      )}

      {!canRevealProfiles ? (
        <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-5 pt-12 [background:linear-gradient(180deg,rgba(0,16,15,0),rgba(0,16,15,0.92)_42%,rgba(0,16,15,0.98))]">
          <Link
            href="/billing"
            className="flex h-14 w-full max-w-[420px] items-center justify-center rounded-[14px] border border-amber-300/35 bg-[#17210f]/95 px-5 text-base font-black text-amber-200 shadow-[0_20px_60px_rgba(0,0,0,0.45)] transition hover:bg-[#1e2a14]"
          >
            {t('unlockContacts')}
          </Link>
        </div>
      ) : null}
    </main>
  );
}

function CandidatePreviewCard({
  candidate,
  index,
  revealProfile,
  scoreLabel,
}: {
  candidate: RankedSeriousCandidate;
  index: number;
  revealProfile: boolean;
  scoreLabel: string;
}) {
  const displayName = revealProfile
    ? candidate.name
    : maskPersonName(candidate.name, index);

  return (
    <article className="flex min-h-[112px] items-center gap-4 rounded-[16px] border border-white/[0.07] bg-[#0b2522] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
      {candidate.avatarUrl && revealProfile ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={candidate.avatarUrl}
          alt=""
          className="h-14 w-14 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-brand/25 bg-brand/10 text-sm font-black text-brand">
          {getInitials(displayName)}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-extrabold text-white">
          {displayName}
        </p>
        <div className="mt-2 space-y-1.5">
          <span className="block h-2 w-28 rounded-full bg-white/[0.08]" />
          <span className="block h-2 w-20 rounded-full bg-white/[0.055]" />
        </div>
      </div>

      <div className="shrink-0 rounded-[12px] border border-brand/20 bg-brand/10 px-3 py-2 text-center">
        <p className="text-xl font-black leading-none text-brand">
          {candidate.profileScore}
        </p>
        <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#8fa7a2]">
          {scoreLabel}
        </p>
      </div>
    </article>
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
