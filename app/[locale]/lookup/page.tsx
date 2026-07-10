import { getTranslations } from 'next-intl/server';
import { ArrowLeft, LockKeyhole } from 'lucide-react';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import { getUserBillingSnapshot } from '@/lib/billing/user-tier';
import { getRankedSeriousCandidates } from '@/lib/matching/serious-candidates';
import type { RankedSeriousCandidate } from '@/lib/matching/serious-candidates';
import { getPlanNextAccess } from '@/lib/session/plan-next-access';
import { getUnlimitedPaymentLink } from '@/lib/stripe/payment-links';

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
  const [t, planNextAccess, billingSnapshot] = await Promise.all([
    getTranslations('Lookup'),
    getPlanNextAccess(user.id),
    getUserBillingSnapshot(user.id),
  ]);
  const canRevealProfiles = planNextAccess.canInviteCandidates;
  const { candidates } = await getRankedSeriousCandidates({
    userId: user.id,
    locale: language,
  });
  const paymentLink = getUnlimitedPaymentLink(
    billingSnapshot?.email ?? user.email ?? null,
  );

  return (
    <main className="relative flex flex-1 flex-col gap-5 pb-28">
      <FeedbackBanner
        message={searchParams.feedbackMessage}
        tone={searchParams.feedbackTone}
        feedbackId={searchParams.feedbackId}
      />

      <section className="flex items-center gap-3 rounded-[16px] border border-white/[0.055] bg-[#071f1c] px-4 py-4 sm:px-5">
        <Link
          href="/dashboard"
          prefetch={false}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-slate-300 transition hover:border-brand/45 hover:text-white"
          aria-label={language === 'fr' ? 'Retour dashboard' : 'Back to dashboard'}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
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
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/42 px-4 py-5 sm:items-center">
          <div className="w-full max-w-[420px] rounded-[22px] border border-amber-300/35 bg-[#111827]/96 p-5 text-center shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-300 text-[#062b22]">
              <LockKeyhole className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="mt-4 text-lg font-black text-white">
              {language === 'fr'
                ? 'Débloque les candidats sérieux'
                : 'Unlock serious candidates'}
            </p>
            <p className="mt-2 text-sm font-semibold leading-5 text-slate-400">
              {language === 'fr'
                ? 'Les scores restent visibles. Les contacts et profils complets se débloquent après paiement.'
                : 'Scores stay visible. Contacts and complete profiles unlock after payment.'}
            </p>
            <a
              href={paymentLink}
              className="mt-5 flex h-12 w-full items-center justify-center rounded-[12px] border border-amber-300/35 bg-[#17210f]/95 px-5 text-sm font-black text-amber-200 shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition hover:bg-[#1e2a14]"
            >
              {t('unlockContacts')}
            </a>
          </div>
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
