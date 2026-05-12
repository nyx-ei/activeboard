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

const proofItems = [
  ['landingProofFree', CheckCircle2],
  ['landingProofQbanks', null],
  ['landingProofCard', CreditCard],
] as const;

function ActiveBoardLandingLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-[46px] w-[39px]">
        <span className="absolute left-0 top-[6px] h-[36px] w-[11px] rotate-[28deg] rounded-full bg-brand" />
        <span className="absolute left-[17px] top-[6px] h-[36px] w-[11px] -rotate-[28deg] rounded-full bg-brand" />
        <span className="bg-brand/90 absolute left-[13px] top-[26px] h-[10px] w-[24px] rotate-[28deg] rounded-full" />
      </div>
      <div>
        <p className="text-[26px] font-extrabold leading-none tracking-[-0.03em] text-white">
          ActiveBoard
        </p>
        <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-brand">
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
      <section className="mx-auto grid min-h-[690px] max-w-[1280px] grid-cols-1 items-center gap-6 lg:grid-cols-[480px_1fr]">
        <div className="relative z-10 w-full max-w-[454px]">
          <ActiveBoardLandingLogo />

          <p className="mt-10 inline-flex max-w-full items-center gap-3 rounded-full border border-white/[0.11] bg-[#050d15]/80 px-4 py-2.5 text-[15px] font-medium text-[#d6dce5] shadow-[0_0_0_1px_rgba(22,210,144,0.02)]">
            <Users
              className="h-[18px] w-[18px] text-brand"
              aria-hidden="true"
            />
            {t('landingBadge')}
          </p>

          <h1 className="mt-6 text-[42px] font-extrabold leading-[0.98] tracking-[-0.045em] text-white sm:text-[50px]">
            {t('landingTitle')}
            <span className="block text-brand">{t('landingTitleAccent')}</span>
          </h1>
          <p className="mt-5 max-w-[430px] text-[21px] font-medium leading-[1.28] tracking-[-0.02em] text-[#c5c9d0]">
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

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[15px] font-medium text-[#d6dce5]">
            {proofItems.map(([item, Icon], index) => (
              <span key={item} className="inline-flex items-center gap-2">
                {Icon ? (
                  <Icon className="h-5 w-5 text-brand" aria-hidden="true" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                )}
                {t(item)}
                {index < proofItems.length - 1 ? (
                  <span className="ml-2 h-1.5 w-1.5 rounded-full bg-brand" />
                ) : null}
              </span>
            ))}
          </div>
        </div>

        <div className="relative hidden min-h-[610px] items-center justify-end lg:flex">
          <Image
            src="/landing/direct-signup-devices.png"
            alt="ActiveBoard live question phone and review laptop"
            width={981}
            height={585}
            priority
            className="relative z-10 mt-9 w-[760px] max-w-none object-contain"
            sizes="760px"
          />
        </div>
        <div className="relative lg:hidden">
          <Image
            src="/landing/direct-signup-devices.png"
            alt="ActiveBoard live question phone and review laptop"
            width={981}
            height={585}
            priority
            className="mx-auto w-full max-w-[620px] object-contain"
            sizes="100vw"
          />
        </div>
      </section>
    </main>
  );
}
