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
    <div className="flex items-center gap-3">
      <Image
        src="/landing/activeboard-mark.png"
        alt=""
        width={40}
        height={80}
        priority
        unoptimized
        className="h-[38px] w-auto object-contain"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-[26px] font-bold leading-none tracking-[-0.035em] text-white">
          ActiveBoard
        </p>
        <p className="mt-1 text-[8px] font-bold uppercase leading-none tracking-[0.2em] text-brand">
          Study. Simulate. Succeed.
        </p>
      </div>
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
    <main className="-mx-2 -mb-24 -mt-4 min-h-screen overflow-hidden bg-[#01070d] px-5 pb-10 pt-8 sm:-mx-6 sm:px-9 lg:px-9">
      <section className="mx-auto grid min-h-[690px] max-w-[1280px] grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(420px,480px)_minmax(0,1fr)]">
        <div className="relative z-10 w-full max-w-[454px]">
          <ActiveBoardLandingLogo />

          <p className="mt-10 inline-flex max-w-full items-center gap-3 rounded-full border border-white/[0.11] bg-[#050d15]/80 px-4 py-2.5 text-[14px] font-medium text-[#d6dce5] shadow-[0_0_0_1px_rgba(22,210,144,0.02)]">
            <Users
              className="h-[18px] w-[18px] text-brand"
              aria-hidden="true"
            />
            {t('landingBadge')}
          </p>

          <h1 className="mt-6 text-[39px] font-bold leading-[1.02] tracking-[-0.04em] text-white sm:text-[46px]">
            {t('landingTitle')}
            <span className="block text-brand">{t('landingTitleAccent')}</span>
          </h1>
          <p className="mt-5 max-w-[430px] text-[19px] font-normal leading-[1.32] tracking-[-0.015em] text-[#c5c9d0]">
            {t('landingSubtitle')}
          </p>

          <div className="mt-5">
            <LandingDirectSignupForm
              locale={locale}
              labels={{
                email: t('directEmail'),
                partnerEmail: t('directPartnerEmail'),
                addPartner: t('directAddPartner'),
                difficultyTitle: t('directDifficultyTitle'),
                difficultyLow: t('directDifficultyLow'),
                difficultyMedium: t('directDifficultyMedium'),
                difficultyHigh: t('directDifficultyHigh'),
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

        <div className="relative hidden min-h-[610px] min-w-0 items-center justify-end overflow-hidden lg:flex">
          <div className="relative flex w-full min-w-0 justify-end">
            <Image
              src="/landing/direct-signup-devices.png"
              alt="ActiveBoard live question phone and review laptop"
              width={527}
              height={474}
              priority
              unoptimized
              className="relative z-10 mt-9 h-auto w-full max-w-[728px] object-contain"
              sizes="(min-width: 1280px) 728px, calc(100vw - 560px)"
            />
          </div>
        </div>
        <div className="relative lg:hidden">
          <Image
            src="/landing/direct-signup-devices.png"
            alt="ActiveBoard live question phone and review laptop"
            width={527}
            height={474}
            priority
            unoptimized
            className="mx-auto w-full max-w-[620px] object-contain"
            sizes="100vw"
          />
        </div>
      </section>
    </main>
  );
}
