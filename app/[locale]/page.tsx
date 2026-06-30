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
      className="mt-3 flex max-w-[150px] translate-y-3 items-center gap-2 lg:mt-2 lg:max-w-none lg:translate-y-0 lg:gap-3"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] bg-brand text-sm font-extrabold text-white shadow-[0_10px_26px_rgba(31,230,166,0.24)] lg:h-10 lg:w-10 lg:rounded-[8px] lg:text-base">
        AB
      </div>
      <span className="min-w-0 text-[20px] font-extrabold leading-none tracking-[-0.04em] text-white lg:text-[27px]">
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
      className="-mx-2 -mb-24 -mt-6 min-h-screen overflow-hidden bg-[#01070d] px-5 pb-9 pt-0 sm:-mx-6 sm:px-9 sm:pt-0 lg:px-9"
    >
      <section className="mx-auto grid min-h-[calc(100vh-72px)] max-w-[1280px] grid-cols-1 items-center gap-5 lg:grid-cols-[minmax(400px,500px)_minmax(0,1fr)] lg:gap-8">
        <div className="relative z-10 w-full max-w-[454px] lg:-translate-y-10">
          <ActiveBoardLandingLogo />

          <p
            data-landing-badge
            className="mt-5 inline-flex max-w-full items-center gap-3 rounded-full border border-white/[0.11] bg-[#050d15]/80 px-3.5 py-2 text-[13px] font-medium text-[#d6dce5] shadow-[0_0_0_1px_rgba(22,210,144,0.02)] lg:mt-4"
          >
            <Users
              className="h-[18px] w-[18px] text-brand"
              aria-hidden="true"
            />
            {t('landingBadge')}
          </p>

          <div data-landing-mobile-image className="relative my-4 lg:hidden">
            <Image
              src="/landing/direct-signup-devices.png"
              alt="ActiveBoard live question phone and review laptop"
              width={527}
              height={474}
              priority
              unoptimized
              className="mx-auto w-full max-w-[480px] object-contain"
              sizes="100vw"
            />
          </div>

          <h1
            data-landing-hero
            className="mt-5 text-[38px] font-bold leading-[1.02] tracking-[-0.035em] text-white sm:text-[44px] lg:mt-5"
          >
            {t('landingTitle')}
          </h1>
          <p className="mt-4 max-w-[470px] text-[18px] font-normal leading-[1.32] tracking-[-0.01em] text-[#c5c9d0]">
            {t('landingSubtitle')}
          </p>

          <ul className="mt-5 grid gap-2 text-[15px] font-semibold leading-snug text-[#dce7ef]">
            <li className="flex gap-2">
              <ArrowRight
                className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                aria-hidden="true"
              />
              <span>{t('heroStep1')}</span>
            </li>
            <li className="flex gap-2">
              <ArrowRight
                className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                aria-hidden="true"
              />
              <span>{t('heroStep2')}</span>
            </li>
            <li className="flex gap-2">
              <ArrowRight
                className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                aria-hidden="true"
              />
              <span>{t('heroStep3')}</span>
            </li>
            <li className="flex gap-2">
              <ArrowRight
                className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                aria-hidden="true"
              />
              <span>{t('heroStep4')}</span>
            </li>
          </ul>
          <p className="mt-4 text-[15px] font-extrabold uppercase tracking-[0.16em] text-white/80">
            {t('heroProofLine')}
          </p>

          <div className="mt-4">
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
            className="mt-3 inline-flex items-center gap-2 text-sm font-extrabold text-brand transition hover:text-brand-strong"
          >
            {t('secondaryCta')}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] font-normal text-[#d6dce5]">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-brand" aria-hidden="true" />
              {t('landingProofFree')}
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            <span>{t('landingProofQbanks')}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand" aria-hidden="true" />
              {t('landingProofCard')}
            </span>
          </div>
        </div>

        <div
          data-landing-desktop-image
          className="relative hidden min-h-[500px] min-w-0 items-center justify-end overflow-hidden lg:flex"
        >
          <div className="relative flex w-full min-w-0 justify-end">
            <Image
              src="/landing/direct-signup-devices.png"
              alt="ActiveBoard live question phone and review laptop"
              width={527}
              height={474}
              priority
              unoptimized
              className="relative z-10 mt-0 h-auto w-full max-w-[700px] object-contain"
              sizes="(min-width: 1280px) 700px, calc(100vw - 540px)"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1180px] gap-4 pb-10 lg:grid-cols-[1.1fr_0.9fr] lg:pb-14">
        <div className="rounded-[8px] border border-white/[0.08] bg-[#071812] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)] sm:p-7">
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand">
            {t('whyEyebrow')}
          </p>
          <h2 className="mt-3 max-w-[760px] text-[30px] font-extrabold leading-tight tracking-[-0.025em] text-white sm:text-[38px]">
            {t('whyTitle')}
          </h2>
          <p className="mt-4 max-w-[720px] text-lg leading-8 text-[#c5d4d0]">
            {t('whyBody')}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {['whyMetric1', 'whyMetric2', 'whyMetric3', 'whyMetric4'].map(
              (key) => (
                <div
                  key={key}
                  className="rounded-[8px] border border-white/[0.08] bg-[#020d0a]/70 px-4 py-3 text-sm font-bold text-[#dce7ef]"
                >
                  {t(key)}
                </div>
              ),
            )}
          </div>
        </div>

        <aside className="border-brand/20 rounded-[8px] border bg-[#0a1d16] p-5 sm:p-7">
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand">
            {t('proofEyebrow')}
          </p>
          <div className="mt-5 grid gap-4">
            <div>
              <p className="text-5xl font-extrabold tracking-[-0.04em] text-white">
                194
              </p>
              <p className="mt-1 text-base font-semibold text-[#b5c8c4]">
                {t('proofCandidates')}
              </p>
            </div>
            <div className="h-px bg-white/10" />
            <div>
              <p className="text-5xl font-extrabold tracking-[-0.04em] text-brand">
                13
              </p>
              <p className="mt-1 text-base font-semibold text-[#b5c8c4]">
                {t('proofActiveMembers')}
              </p>
            </div>
          </div>
        </aside>
      </section>

      <section
        id="how-it-works"
        className="mx-auto max-w-[1180px] rounded-[8px] border border-white/[0.08] bg-[#050d15]/80 p-5 sm:p-7"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand">
              {t('howTitle')}
            </p>
            <h2 className="mt-3 max-w-[760px] text-[30px] font-extrabold leading-tight tracking-[-0.025em] text-white sm:text-[38px]">
              {t('impactLine')}
            </h2>
          </div>
          <a
            href="#top"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] bg-brand px-5 text-sm font-extrabold text-[#04120e] transition hover:bg-brand-strong"
          >
            {t('finalCta')}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {[
            ['1', 'howStep1'],
            ['2', 'howStep2'],
            ['3', 'howStep3'],
          ].map(([number, key]) => (
            <div
              key={number}
              className="rounded-[8px] border border-white/[0.08] bg-[#081711] p-5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-base font-extrabold text-[#04120e]">
                {number}
              </div>
              <p className="mt-5 text-lg font-extrabold leading-snug text-white">
                {t(key)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
