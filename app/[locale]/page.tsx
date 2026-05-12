import { Check, CreditCard, Users } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { LandingDirectSignupForm } from '@/components/onboarding/landing-direct-signup-form';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';

type LocaleHomePageProps = {
  params: { locale: string };
};

const proofItems = [
  'landingProofFree',
  'landingProofQbanks',
  'landingProofCard',
] as const;

function ProductPreview() {
  return (
    <div className="relative mx-auto min-h-[410px] w-full max-w-[680px] lg:min-h-[520px]">
      <div className="absolute right-0 top-6 w-[82%] rounded-[22px] border border-white/20 bg-[#07101d] p-2 shadow-[0_36px_120px_rgba(0,0,0,0.62)] sm:top-4">
        <div className="rounded-[16px] border border-white/[0.08] bg-[#0d1627] p-6 sm:p-8">
          <div className="grid grid-cols-[72px_1fr] gap-6">
            <div className="space-y-5">
              {['JS', 'AR', 'MK'].map((initials) => (
                <div
                  key={initials}
                  className="border-brand/40 bg-brand/10 flex h-14 w-14 items-center justify-center rounded-full border text-sm font-extrabold text-brand shadow-[0_0_32px_rgba(22,210,144,0.16)]"
                >
                  {initials}
                </div>
              ))}
            </div>
            <div>
              <p className="text-lg font-extrabold text-white">Q2</p>
              <div className="mt-4 space-y-3">
                {[0, 1, 2].map((item) => (
                  <span
                    key={item}
                    className="block h-3 rounded-full bg-white/[0.12]"
                    style={{ width: `${92 - item * 12}%` }}
                  />
                ))}
              </div>
              <div className="mt-8 space-y-3">
                {['A', 'B', 'C', 'D', 'E'].map((option, index) => (
                  <div
                    key={option}
                    className="grid grid-cols-[24px_1fr] items-center gap-4"
                  >
                    <span className="text-sm font-bold text-slate-300">
                      {option}
                    </span>
                    <span
                      className="h-3 rounded-full bg-white/[0.12]"
                      style={{ width: `${42 + index * 8}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto h-3 w-[92%] rounded-b-[20px] bg-[#202938]" />
      </div>

      <div className="absolute bottom-2 left-[4%] w-[34%] min-w-[170px] rounded-[28px] border border-white/20 bg-[#050b15] p-2 shadow-[0_34px_80px_rgba(0,0,0,0.7)] sm:left-[10%]">
        <div className="rounded-[22px] border border-white/[0.08] bg-[#0d1627] p-4">
          <div className="flex items-center justify-between text-xs font-extrabold text-white">
            <span>Q 2/30</span>
            <span className="rounded bg-rose-500 px-2 py-1 text-[10px]">
              2s
            </span>
          </div>
          <div className="mt-5 space-y-2">
            {['A', 'B', 'C', 'D', 'E'].map((option) => (
              <div
                key={option}
                className={`flex h-9 items-center justify-center rounded-[6px] text-sm font-extrabold ${
                  option === 'D'
                    ? 'bg-brand text-[#04110d]'
                    : 'bg-white/[0.09] text-slate-200'
                }`}
              >
                {option}
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1 text-[9px] font-bold">
            {['Low', 'Medium', 'High'].map((value, index) => (
              <span
                key={value}
                className={`rounded border px-1 py-1 text-center ${
                  index === 0
                    ? 'border-amber-400 text-amber-300'
                    : 'border-white/[0.08] text-slate-300'
                }`}
              >
                {value}
              </span>
            ))}
          </div>
          <div className="mt-3 rounded-[6px] bg-brand py-2 text-center text-xs font-extrabold text-[#04110d]">
            Submit
          </div>
        </div>
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
    <main className="-mx-2 flex flex-1 flex-col sm:-mx-6">
      <section className="grid min-h-[calc(100vh-9rem)] items-center gap-8 px-4 pb-10 pt-4 sm:px-6 lg:grid-cols-[0.86fr_1.14fr] lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-[520px] lg:mx-0">
          <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-xs font-semibold text-slate-300">
            <Users className="h-4 w-4 text-brand" aria-hidden="true" />
            {t('landingBadge')}
          </p>

          <h1 className="mt-6 text-[42px] font-extrabold leading-[0.98] tracking-tight text-white sm:text-[58px]">
            {t('landingTitle')}
            <span className="block text-brand">{t('landingTitleAccent')}</span>
          </h1>
          <p className="mt-5 max-w-[440px] text-base font-medium leading-7 text-slate-300 sm:text-lg">
            {t('landingSubtitle')}
          </p>

          <div className="mt-6">
            <LandingDirectSignupForm
              locale={locale}
              labels={{
                email: t('directEmail'),
                password: t('directPassword'),
                passwordHint: t('directPasswordHint'),
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

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-slate-300">
            {proofItems.map((item, index) => (
              <span key={item} className="inline-flex items-center gap-2">
                {index === 2 ? (
                  <CreditCard
                    className="h-4 w-4 text-brand"
                    aria-hidden="true"
                  />
                ) : (
                  <Check className="h-4 w-4 text-brand" aria-hidden="true" />
                )}
                {t(item)}
              </span>
            ))}
          </div>

          <p className="mt-5 text-sm font-medium text-slate-500">
            {t('directExistingAccount')}{' '}
            <Link
              href="/auth/login"
              className="font-bold text-brand hover:text-emerald-300"
            >
              {t('navSignIn')}
            </Link>
          </p>
        </div>

        <div className="hidden lg:block">
          <ProductPreview />
        </div>
        <div className="lg:hidden">
          <ProductPreview />
        </div>
      </section>
    </main>
  );
}
