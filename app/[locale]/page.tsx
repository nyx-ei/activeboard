import {
  ArrowRight,
  CalendarCheck2,
  Lock,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import type { AppLocale } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';

type LocaleHomePageProps = {
  params: { locale: string };
};

function ActiveBoardLandingLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-brand text-base font-extrabold text-white shadow-[0_16px_34px_rgba(31,230,166,0.24)]">
        AB
      </div>
      <span className="text-[24px] font-extrabold leading-none text-white sm:text-[28px]">
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

  const proofItems = [
    { key: 'heroStep2', Icon: CalendarCheck2 },
    { key: 'heroStep3', Icon: ShieldCheck },
    { key: 'heroStep4', Icon: Sparkles },
  ] as const;

  return (
    <main
      id="top"
      className="min-h-screen overflow-x-hidden bg-[#01080d] text-white"
    >
      <section className="relative isolate min-h-screen overflow-hidden bg-[linear-gradient(115deg,#01070d_0%,#02090d_48%,#053526_100%)]">
        <header className="relative z-20 mx-auto flex w-full max-w-[1500px] items-center px-5 pt-5 sm:px-8 lg:px-12 lg:pt-6">
          <ActiveBoardLandingLogo />
        </header>

        <div className="relative z-10 mx-auto grid w-full max-w-[1500px] grid-cols-1 items-center gap-6 px-5 pb-7 pt-5 sm:px-8 lg:min-h-[calc(100vh-76px)] lg:grid-cols-[minmax(560px,700px)_minmax(0,1fr)] lg:gap-0 lg:px-12 lg:pb-8 lg:pt-4 xl:grid-cols-[minmax(620px,760px)_minmax(0,1fr)]">
          <div className="max-w-[760px]">
            <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[12px] font-bold leading-snug text-[#d6e2df] sm:text-[13px]">
              <Users className="h-4 w-4 shrink-0 text-brand" aria-hidden />
              <span>{t('landingBadge')}</span>
            </p>

            <h1 className="mt-5 max-w-[760px] text-[34px] font-extrabold leading-[1.02] text-white sm:text-[46px] lg:text-[52px] xl:text-[58px]">
              <span>{t('landingHeroLine1')} </span>
              <span className="bg-gradient-to-r from-brand to-[#63f3cf] bg-clip-text text-transparent">
                {t('landingHeroLine2')}
              </span>
              <span> {t('landingHeroLine3')}</span>
            </h1>

            <p className="mt-4 max-w-[590px] text-[16px] font-medium leading-6 text-[#d2dcda] sm:text-[18px]">
              {t('landingSubtitle')}
            </p>

            <div className="mt-4 grid max-w-[590px] gap-2 rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3.5">
              {proofItems.map(({ key, Icon }) => {
                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 text-[14px] font-bold leading-snug text-[#e9f2ef] sm:text-[15px]"
                  >
                    <Icon
                      className="h-5 w-5 shrink-0 text-brand"
                      aria-hidden
                    />
                    <span>{t(key)}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 max-w-[590px] space-y-2.5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href={`/${locale}/onboarding/account`}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] bg-brand px-6 text-[15px] font-extrabold text-[#03130e] shadow-[0_24px_60px_rgba(31,230,166,0.24)] transition hover:bg-brand-strong sm:text-base"
                >
                  {t('primaryCta')}
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </a>
                <a
                  href="#how-it-works"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.035] px-5 text-sm font-extrabold text-white transition hover:border-brand/50 hover:text-brand"
                >
                  {t('secondaryCta')}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[13px] font-semibold text-white/72">
                <span className="inline-flex items-center gap-2">
                  <Lock className="h-4 w-4 text-white/55" aria-hidden />
                  {t('noCreditCard')}
                </span>
              </div>
            </div>
          </div>

          <div className="relative min-h-[260px] overflow-visible [perspective:1200px] lg:min-h-[560px]">
            <div className="absolute inset-y-8 right-[-8%] hidden w-[86%] rounded-full bg-brand/12 blur-3xl lg:block" />
            <Image
              src="/landing/direct-signup-devices.png"
              alt="ActiveBoard live question phone and review laptop"
              width={527}
              height={474}
              priority
              unoptimized
              className="relative z-10 mx-auto h-auto w-full max-w-[500px] origin-right object-contain opacity-95 drop-shadow-[0_34px_90px_rgba(0,0,0,0.64)] sm:max-w-[580px] lg:absolute lg:right-[-9%] lg:top-[4%] lg:max-w-[820px] lg:[transform:rotateY(-18deg)_rotateX(2deg)_scale(1.08)] xl:right-[-10%] xl:max-w-[940px] xl:[transform:rotateY(-20deg)_rotateX(3deg)_scale(1.16)]"
              sizes="(min-width: 1280px) 920px, (min-width: 1024px) 58vw, 100vw"
            />
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="mx-auto grid w-full max-w-[1180px] gap-4 px-5 py-8 sm:px-8 lg:grid-cols-3 lg:px-12"
      >
        {[
          ['1', 'howStep1'],
          ['2', 'howStep2'],
          ['3', 'howStep3'],
        ].map(([number, key]) => (
          <div
            key={number}
            className="rounded-[8px] border border-white/[0.08] bg-white/[0.03] p-5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-extrabold text-[#04120e]">
              {number}
            </div>
            <p className="mt-4 text-base font-extrabold leading-snug text-white">
              {t(key)}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
