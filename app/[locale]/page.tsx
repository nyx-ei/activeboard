import { ArrowRight, CheckCircle2, ShieldCheck, Users } from 'lucide-react';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { LandingDirectSignupForm } from '@/components/onboarding/landing-direct-signup-form';
import type { AppLocale } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';

type LocaleHomePageProps = {
  params: { locale: string };
};

function ActiveBoardLandingLogo() {
  return (
    <div
      data-landing-logo
      className="flex max-w-[170px] items-center gap-2 lg:max-w-none lg:gap-3"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] bg-brand text-sm font-extrabold text-white shadow-[0_10px_26px_rgba(31,230,166,0.2)] lg:h-10 lg:w-10 lg:rounded-[8px] lg:text-base">
        AB
      </div>
      <span className="min-w-0 text-[20px] font-extrabold leading-none text-white lg:text-[26px]">
        ActiveBoard
      </span>
    </div>
  );
}

export default async function LocaleHomePage({ params }: LocaleHomePageProps) {
  const locale = params.locale as AppLocale;
  const user = await getCurrentUser();
  const t = await getTranslations('Landing');

  if (user) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <main
      id="top"
      className="relative min-h-screen w-full overflow-x-hidden bg-[radial-gradient(circle_at_82%_8%,rgba(12,110,82,0.34),transparent_34%),linear-gradient(180deg,#01070d_0%,#020a0f_48%,#020805_100%)] pb-10"
    >
      <div className="absolute left-3 top-3 z-40 sm:left-6 sm:top-4 lg:left-9">
        <ActiveBoardLandingLogo />
      </div>

      <section className="mx-auto grid w-full max-w-[1360px] grid-cols-1 items-center gap-8 px-3 pb-10 pt-24 sm:px-4 lg:grid-cols-[minmax(430px,560px)_minmax(0,1fr)] lg:gap-8 lg:px-6 lg:pb-12 lg:pt-28">
        <div className="relative z-10 w-full max-w-[520px]">
          <p
            data-landing-badge
            className="inline-flex max-w-full items-center gap-2.5 rounded-full border border-white/[0.10] bg-white/[0.035] px-3.5 py-2 text-[12px] font-semibold leading-snug text-[#d8e1df]"
          >
            <Users
              className="h-4 w-4 shrink-0 text-brand"
              aria-hidden="true"
            />
            <span className="min-w-0">{t('landingBadge')}</span>
          </p>

          <div data-landing-mobile-image className="relative my-5 lg:hidden">
            <Image
              src="/landing/direct-signup-devices.png"
              alt="ActiveBoard live question phone and review laptop"
              width={527}
              height={474}
              priority
              unoptimized
              className="mx-auto w-full max-w-[360px] object-contain opacity-95"
              sizes="100vw"
            />
          </div>

          <h1
            data-landing-hero
            className="mt-5 text-[33px] font-extrabold leading-[1.04] text-white sm:text-[44px] lg:text-[58px]"
          >
            {t('landingTitleBefore')}{' '}
            <span className="bg-gradient-to-r from-brand to-[#58f4c5] bg-clip-text text-transparent">
              MCCQE
            </span>{' '}
            {t('landingTitleAfter')}
          </h1>
          <p className="mt-4 max-w-[490px] text-[16px] font-medium leading-[1.55] text-[#c6d4d1] sm:text-[18px]">
            {t('landingSubtitle')}
          </p>

          <ul className="mt-5 grid gap-2 rounded-[8px] border border-white/[0.07] bg-white/[0.025] p-3 text-[13px] font-semibold leading-snug text-[#dce7ef] sm:text-[14px]">
            <li className="flex gap-2">
              <CheckCircle2
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand"
                aria-hidden="true"
              />
              <span>{t('heroStep2')}</span>
            </li>
            <li className="flex gap-2">
              <CheckCircle2
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand"
                aria-hidden="true"
              />
              <span>{t('heroStep3')}</span>
            </li>
            <li className="flex gap-2">
              <CheckCircle2
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand"
                aria-hidden="true"
              />
              <span>{t('heroStep4')}</span>
            </li>
          </ul>
          <div className="mt-4 space-y-2">
            <p className="rounded-[8px] border border-brand/15 bg-brand/5 px-3 py-2 text-[12px] font-bold leading-snug text-[#cde5de]">
              {t('heroPatternLine')}
            </p>
            <p className="inline-flex rounded-full border border-brand/15 bg-brand/5 px-3 py-1.5 text-[12px] font-extrabold leading-snug text-white/85">
              {t('heroProofLine')}
            </p>
          </div>

          <div className="mt-5">
            <LandingDirectSignupForm
              locale={locale}
              labels={{
                email: t('directEmail'),
                submit: t('primaryCta'),
                pending: t('directPending'),
                missingFields: t('directMissingFields'),
                accountExists: t('directAccountExists'),
                inviteExists: t('directInviteExists'),
                genericError: t('directGenericError'),
              }}
            />
          </div>

          <a
            href="#how-it-works"
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-4 py-2 text-sm font-bold text-brand transition hover:border-brand/40 hover:text-brand-strong"
          >
            {t('secondaryCta')}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px] font-semibold text-[#d6dce5] sm:text-[13px]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5">
              <CheckCircle2 className="h-4 w-4 text-brand" aria-hidden="true" />
              {t('landingProofFree')}
            </span>
            <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5">
              {t('landingProofQbanks')}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5">
              <ShieldCheck className="h-4 w-4 text-brand" aria-hidden="true" />
              {t('landingProofCard')}
            </span>
          </div>
        </div>

        <div
          data-landing-desktop-image
          className="relative hidden min-h-[560px] min-w-0 items-center justify-end overflow-visible lg:flex"
        >
          <div className="absolute bottom-5 right-0 h-28 w-[78%] rounded-full bg-brand/20 blur-3xl" />
          <div className="absolute right-0 top-6 h-[360px] w-[620px] rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative flex w-full min-w-0 origin-center justify-end [perspective:1100px]">
            <Image
              src="/landing/direct-signup-devices.png"
              alt="ActiveBoard live question phone and review laptop"
              width={527}
              height={474}
              priority
              unoptimized
              className="relative z-10 mt-0 h-auto w-full max-w-[780px] -rotate-[1.5deg] scale-[1.08] object-contain opacity-95 drop-shadow-[0_34px_80px_rgba(0,0,0,0.62)] [transform:rotateY(-9deg)_rotateX(2deg)]"
              sizes="(min-width: 1280px) 820px, calc(100vw - 520px)"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1180px] gap-4 px-3 pb-10 sm:px-4 lg:grid-cols-[1.12fr_0.88fr] lg:px-6 lg:pb-14">
        <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.03] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.14)] sm:p-7">
          <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-brand">
            {t('whyEyebrow')}
          </p>
          <h2 className="mt-3 max-w-[760px] text-[26px] font-extrabold leading-[1.12] text-white sm:text-[34px]">
            {t('whyTitle')}
          </h2>
          <p className="mt-4 max-w-[720px] text-base font-medium leading-7 text-[#c5d4d0] sm:text-[17px]">
            {t('whyBody')}
          </p>
          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {['whyMetric1', 'whyMetric2', 'whyMetric3', 'whyMetric4'].map(
              (key) => (
                <div
                  key={key}
                  className="rounded-[8px] border border-white/[0.07] bg-[#020d0a]/45 px-4 py-3 text-[13px] font-semibold leading-snug text-[#dce7ef]"
                >
                  {t(key)}
                </div>
              ),
            )}
          </div>
        </div>

        <aside className="rounded-[8px] border border-brand/15 bg-[#071812]/90 p-5 sm:p-7">
          <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-brand">
            {t('proofEyebrow')}
          </p>
          <div className="mt-5 grid gap-4">
            <div>
              <p className="text-[42px] font-extrabold leading-none text-white sm:text-5xl">
                13
              </p>
              <p className="mt-2 text-sm font-semibold leading-snug text-[#b5c8c4] sm:text-base">
                {t('proofCompleted')}
              </p>
            </div>
            <div className="h-px bg-white/10" />
            <div>
              <p className="text-[42px] font-extrabold leading-none text-brand sm:text-5xl">
                44
              </p>
              <p className="mt-2 text-sm font-semibold leading-snug text-[#b5c8c4] sm:text-base">
                {t('proofPreparing')}
              </p>
            </div>
            <p className="rounded-full border border-brand/20 bg-brand/10 px-4 py-2 text-sm font-extrabold text-brand">
              {t('proofNext')}
            </p>
          </div>
        </aside>
      </section>

      <section
        id="how-it-works"
        className="mx-auto w-[calc(100%-1.5rem)] max-w-[1180px] rounded-[8px] border border-white/[0.08] bg-[#050d15]/70 p-5 sm:w-[calc(100%-2rem)] sm:p-7 lg:w-[calc(100%-3rem)]"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-brand">
              {t('howTitle')}
            </p>
            <h2 className="mt-3 max-w-[760px] text-[25px] font-extrabold leading-[1.14] text-white sm:text-[34px]">
              {t('impactLine')}
            </h2>
          </div>
          <a
            href="#top"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] bg-brand px-5 text-center text-sm font-extrabold leading-snug text-[#04120e] transition hover:bg-brand-strong sm:shrink-0"
          >
            {t('finalCta')}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-3">
          {[
            ['1', 'howStep1'],
            ['2', 'howStep2'],
            ['3', 'howStep3'],
          ].map(([number, key]) => (
            <div
              key={number}
              className="rounded-[8px] border border-white/[0.08] bg-[#081711]/85 p-5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-extrabold text-[#04120e]">
                {number}
              </div>
              <p className="mt-4 text-base font-extrabold leading-snug text-white sm:text-lg">
                {t(key)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
