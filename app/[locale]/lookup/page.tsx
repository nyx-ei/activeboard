import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import { getUserBillingSnapshot } from '@/lib/billing/user-tier';
import { hasStripeEnv } from '@/lib/env';
import { isFeatureEnabled } from '@/lib/features/flags';
import { getRankedSeriousCandidates } from '@/lib/matching/serious-candidates';
import type { RankedSeriousCandidate } from '@/lib/matching/serious-candidates';
import { getPlanNextAccess } from '@/lib/session/plan-next-access';
import { getUnlimitedPaymentLink } from '@/lib/stripe/payment-links';
import { getBillingPlans } from '@/lib/stripe/pricing';

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
  const [t, billingT, planNextAccess, billingSnapshot, billingEnabled] = await Promise.all([
    getTranslations('Lookup'),
    getTranslations('Billing'),
    getPlanNextAccess(user.id),
    getUserBillingSnapshot(user.id),
    isFeatureEnabled('canUseStripeBilling'),
  ]);
  const canRevealProfiles = planNextAccess.canInviteCandidates;
  const { candidates } = await getRankedSeriousCandidates({
    userId: user.id,
    locale: language,
  });
  const stripeConfigured = hasStripeEnv();
  const plans = stripeConfigured ? await getBillingPlans(locale) : [];
  const primaryPlan = plans.find((plan) => plan.highlight) ?? plans[0] ?? null;
  const monthlyPrice = locale === 'fr' ? '15$' : '$15';
  const billingReady = Boolean(billingEnabled && stripeConfigured && primaryPlan);
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
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/20 px-0 py-0 sm:px-4 sm:pb-6">
          <div className="w-full max-w-[420px] animate-in slide-in-from-bottom-4 duration-200 sm:max-w-[460px]">
            <section className="rounded-t-[16px] border border-white/[0.06] bg-[#11192c] p-5 shadow-[0_-24px_70px_rgba(0,0,0,0.55)] sm:rounded-[15px] sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-extrabold tracking-tight text-white">
                  {billingT('title')}
                </h2>
                <Link
                  href="/dashboard"
                  className="text-2xl leading-none text-slate-400 transition hover:text-white"
                  aria-label={billingT('close')}
                >
                  x
                </Link>
              </div>

              <div className="mt-5 rounded-[10px] border border-white/[0.06] bg-[#172237] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-extrabold text-white">
                      {billingT('freePlanTitle')}
                    </p>
                    <ul className="mt-3 space-y-1.5 text-xs font-semibold text-slate-400">
                      <li className="flex gap-2">
                        <span className="text-slate-500">+</span>
                        <span>{billingT('freePlanFeatureQuestions')}</span>
                      </li>
                    </ul>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-[10px] font-extrabold text-slate-300">
                      {billingT('currentPlan')}
                    </span>
                    <p className="text-xl font-extrabold text-white">$0</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-[10px] border border-white/[0.06] bg-[#172237] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-extrabold text-white">
                      {billingT('unlimitedPlanTitle')}
                    </p>
                    <ul className="mt-3 space-y-1.5 text-xs font-semibold text-slate-300">
                      <li className="flex gap-2">
                        <span className="text-brand">+</span>
                        <span>{billingT('unlimitedFeatureAnswers')}</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-brand">+</span>
                        <span>{billingT('unlimitedFeatureGroups')}</span>
                      </li>
                    </ul>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-extrabold text-brand">
                      <span className="mr-2 text-sm font-semibold text-slate-500 line-through">
                        {billingT('regularPrice')}
                      </span>
                      {monthlyPrice}{' '}
                      <span className="text-sm font-semibold text-slate-400">
                        / {billingT('perMonth')}
                      </span>
                    </p>
                  </div>
                </div>

                <a
                  href={paymentLink}
                  className="mt-4 flex h-9 w-full items-center justify-center rounded-[7px] bg-brand text-sm font-extrabold text-background transition hover:opacity-90"
                >
                  {billingT('upgradeToUnlimited')}
                </a>

                <p className="mt-3 text-center text-xs font-semibold text-slate-500">
                  {billingT('unlimitedCheckoutHint')}
                </p>
                {!billingEnabled || !stripeConfigured || !billingReady ? (
                  <p className="sr-only">
                    {billingT('subscriptionPlansMissing')}
                  </p>
                ) : null}
              </div>
            </section>
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
