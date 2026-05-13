import { CheckCircle2, CreditCard, Users } from 'lucide-react';
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
    <div data-landing-logo className="mt-3 flex max-w-[150px] items-center gap-2 lg:mt-2 lg:max-w-none lg:gap-3">
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
    <main className="-mx-2 -mb-24 -mt-6 min-h-screen overflow-hidden bg-[#01070d] px-5 pb-9 pt-0 sm:-mx-6 sm:px-9 sm:pt-0 lg:px-9">
      <section className="mx-auto grid min-h-[calc(100vh-72px)] max-w-[1280px] grid-cols-1 items-center gap-5 lg:grid-cols-[minmax(400px,454px)_minmax(0,1fr)] lg:gap-8">
        <div className="relative z-10 w-full max-w-[454px]">
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
            <span className="block text-brand">{t('landingTitleAccent')}</span>
          </h1>
          <p className="mt-4 max-w-[430px] text-[18px] font-normal leading-[1.32] tracking-[-0.01em] text-[#c5c9d0]">
            {t('landingSubtitle')}
          </p>

          <div className="mt-4">
            <LandingDirectSignupForm
              locale={locale}
              labels={{
                email: t('directEmail'),
                partnerEmail: t('directPartnerEmail'),
                addPartner: t('directAddPartner'),
                submit: t('directSubmit'),
                pending: t('directPending'),
                missingFields: t('directMissingFields'),
                accountExists: t('directAccountExists'),
                inviteExists: t('directInviteExists'),
                genericError: t('directGenericError'),
                createdTitle: t('directCreatedTitle'),
                createdDescription: t('directCreatedDescription'),
                inviteCode: t('directInviteCode'),
                signInToContinue: t('directSignInToContinue'),
              }}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] font-normal text-[#d6dce5]">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-brand" aria-hidden="true" />
              {t('landingProofFree')}
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            <span>{t('landingProofQbanks')}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            <span className="inline-flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-brand" aria-hidden="true" />
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
    </main>
  );
}
