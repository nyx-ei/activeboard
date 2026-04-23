import { Check, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { LandingSignupModal } from '@/components/onboarding/landing-signup-modal';
import type { AppLocale } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';

type LocaleHomePageProps = {
  params: { locale: string };
};

const failureCards = [
  {
    title: 'failureDominantTitle',
    description: 'failureDominantDescription',
    quote: 'failureDominantQuote',
  },
  {
    title: 'failureGhostTitle',
    description: 'failureGhostDescription',
    quote: 'failureGhostQuote',
  },
] as const;

const pricingFeatures = ['pricingStarterFeature1', 'pricingStarterFeature2', 'pricingStarterFeature3', 'pricingStarterFeature4'] as const;
const unlimitedFeatures = ['pricingUnlimitedFeature1', 'pricingUnlimitedFeature2', 'pricingUnlimitedFeature3', 'pricingUnlimitedFeature4'] as const;
const faqItems = ['faqWhatsApp', 'faqQbank', 'faqThreshold', 'faqMemberStops'] as const;

function LandingImage({
  src,
  alt,
  className,
  width,
  height,
  priority = false,
}: {
  src: string;
  alt: string;
  className: string;
  width: number;
  height: number;
  priority?: boolean;
}) {
  return <Image src={src} alt={alt} width={width} height={height} className={className} priority={priority} sizes="(min-width: 1024px) 48vw, 90vw" />;
}

export default async function LocaleHomePage({ params }: LocaleHomePageProps) {
  const locale = params.locale as AppLocale;
  const user = await getCurrentUser();
  const t = await getTranslations('Landing');

  if (user) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <main className="-mx-3 flex flex-1 flex-col sm:-mx-6">
      <section className="grid min-h-[unset] items-center gap-4 px-4 pb-10 pt-4 sm:min-h-[590px] sm:gap-7 sm:px-6 sm:pb-14 sm:pt-7 lg:grid-cols-[1fr_0.96fr] lg:px-10">
        <div>
          <p className="inline-flex rounded-full border border-white/[0.08] px-4 py-2 text-sm font-semibold text-slate-400">
            {t('heroEyebrow')}
          </p>
          <h1 className="mt-4 max-w-[620px] text-[40px] font-medium leading-[1] tracking-[-0.05em] text-white [text-align:justify] sm:mt-5 sm:text-[60px] lg:text-[68px]">
            {t('heroTitle')}
          </h1>
          <p className="mt-3 max-w-[650px] text-base font-medium leading-7 text-slate-400 sm:mt-5 sm:text-lg sm:leading-8">{t('heroDescription')}</p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2.5 text-base font-semibold text-slate-300 sm:mt-6 sm:gap-x-7 sm:gap-y-3">
            {[t('heroProof1'), t('heroProof2'), t('heroProof3')].map((proof) => (
              <span key={proof} className="inline-flex items-center gap-2">
                <Check className="h-4 w-4 text-brand" aria-hidden="true" />
                {proof}
              </span>
            ))}
          </div>
          <LandingSignupModal locale={locale} closeLabel={t('close')} className="mt-4 inline-flex rounded-[7px] bg-brand px-5 py-4 text-base font-bold text-white shadow-[0_20px_50px_rgba(16,185,129,0.22)] transition hover:bg-brand-strong sm:mt-6">
            {t('primaryCta')}
          </LandingSignupModal>
          <p className="mt-3 text-sm font-medium text-slate-500 sm:mt-4">{t('noCreditCard')}</p>
        </div>
        <div className="relative hidden min-h-[420px] items-center justify-center lg:flex">
          <LandingImage
            src="/landing/hero-devices.png"
            alt="ActiveBoard question flow on phone and group review on laptop"
            className="w-full max-w-[650px] object-contain opacity-90"
            width={1735}
            height={1032}
            priority
          />
        </div>
      </section>

      <section className="px-6 py-20 lg:px-10">
        <h2 className="max-w-[900px] text-[40px] font-medium leading-tight tracking-[-0.04em] text-white sm:text-[52px]">
          {t('failuresTitle')}
        </h2>
        <p className="mt-6 max-w-[720px] text-lg italic leading-8 text-slate-400">{t('failuresQuote')}</p>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {failureCards.map((card) => (
            <article key={card.title} className="rounded-[12px] border border-white/[0.06] bg-[#101729] p-7">
              <h3 className="text-lg font-semibold text-white">{t(card.title)}</h3>
              <p className="mt-5 text-base font-medium leading-7 text-slate-400">{t(card.description)}</p>
              <p className="mt-4 text-sm italic text-slate-500">{t(card.quote)}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 px-6 py-20 lg:px-10">
        <h2 className="text-[42px] font-medium tracking-[-0.04em] text-white sm:text-[54px]">{t('howTitle')}</h2>
        <p className="mt-6 max-w-[720px] text-lg font-medium leading-8 text-slate-400">{t('howDescription')}</p>
        <div className="mt-10 grid gap-12 lg:grid-cols-2">
          <div>
            <h3 className="text-2xl font-semibold text-white">{t('howConstancyTitle')}</h3>
            <p className="mt-4 max-w-[620px] text-base font-medium leading-7 text-slate-500">{t('howConstancyDescription')}</p>
            <LandingImage
              src="/landing/activity-phone.png"
              alt="ActiveBoard consistency history on a phone"
              className="mt-7 w-full max-w-[360px] object-contain"
              width={492}
              height={508}
            />
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-white">{t('howLiveTitle')}</h3>
            <p className="mt-4 max-w-[620px] text-base font-medium leading-7 text-slate-500">{t('howLiveDescription')}</p>
            <LandingImage
              src="/landing/live-phone.png"
              alt="ActiveBoard live group list on a phone"
              className="mt-7 w-full max-w-[360px] object-contain"
              width={496}
              height={503}
            />
          </div>
        </div>
      </section>

      <section className="px-6 py-20 lg:px-10">
        <h2 className="max-w-[620px] text-[44px] font-medium leading-tight tracking-[-0.045em] text-white sm:text-[54px]">
          {t('builtTitle')}
        </h2>
        <div className="mt-8 space-y-5 text-lg font-medium text-slate-400">
          {[t('builtBullet1'), t('builtBullet2'), t('builtBullet3')].map((bullet) => (
            <p key={bullet} className="flex items-center gap-4">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              {bullet}
            </p>
          ))}
        </div>
        <blockquote className="mt-10 border-l-2 border-brand/50 pl-5 text-lg font-semibold text-slate-300">
          {t('builtQuote')}
        </blockquote>
      </section>

      <section id="pricing" className="scroll-mt-24 px-6 py-20 lg:px-10">
        <h2 className="max-w-[1120px] text-[42px] font-medium leading-tight tracking-[-0.045em] text-white sm:text-[54px]">
          {t('pricingTitle')}
        </h2>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <article className="rounded-[12px] border border-white/[0.06] bg-[#101729] p-8">
            <p className="text-sm font-bold uppercase tracking-[0.08em] text-slate-400">{t('starterPlan')}</p>
            <p className="mt-5 text-5xl font-semibold text-white">$0</p>
            <div className="mt-8 space-y-4">
              {pricingFeatures.map((feature) => (
                <p key={feature} className="flex items-center gap-3 text-base font-medium text-slate-400">
                  <Check className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  {t(feature)}
                </p>
              ))}
            </div>
            <LandingSignupModal locale={locale} closeLabel={t('close')} className="mt-7 flex w-full justify-center rounded-[8px] border border-white/[0.08] px-5 py-4 text-base font-semibold text-slate-300 transition hover:border-brand/50 hover:text-white">
              {t('starterCta')}
            </LandingSignupModal>
          </article>

          <article className="rounded-[12px] border border-brand/20 bg-[#06131b] p-8">
            <p className="text-sm font-bold uppercase tracking-[0.08em] text-brand">{t('unlimitedPlan')}</p>
            <div className="mt-5 flex items-end gap-3">
              <span className="pb-2 text-sm font-semibold text-slate-600 line-through">$25</span>
              <p className="text-5xl font-semibold text-white">$15</p>
              <span className="pb-2 text-base font-medium text-slate-500">/ {t('month')}</span>
            </div>
            <div className="mt-8 space-y-4">
              {unlimitedFeatures.map((feature) => (
                <p key={feature} className="flex items-center gap-3 text-base font-medium text-slate-300">
                  <Check className="h-4 w-4 text-brand" aria-hidden="true" />
                  {t(feature)}
                </p>
              ))}
            </div>
            <button type="button" className="mt-7 w-full rounded-[8px] bg-brand px-5 py-4 text-base font-semibold text-white transition hover:bg-brand-strong">
              {t('unlimitedCta')}
            </button>
            <p className="mt-5 text-sm font-medium text-brand/80">{t('founderPrice')}</p>
          </article>
        </div>
        <p className="mt-8 text-sm font-medium text-slate-500">{t('pricingFootnote')}</p>
      </section>

      <section className="px-6 py-20 lg:px-10">
        <h2 className="text-[42px] font-medium tracking-[-0.045em] text-white sm:text-[54px]">{t('faqTitle')}</h2>
        <div className="mt-10 max-w-[760px] divide-y divide-white/[0.06]">
          {faqItems.map((item) => (
            <details key={item} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-white">
                {t(`${item}Question`)}
                <ChevronDown className="h-4 w-4 text-slate-500 transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="mt-5 max-w-[720px] text-base font-medium leading-8 text-slate-400">{t(`${item}Answer`)}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="px-6 py-24 lg:px-10">
        <h2 className="max-w-[1180px] text-[40px] font-medium leading-tight tracking-[-0.04em] text-white sm:text-[50px]">
          {t('finalTitle')}
        </h2>
        <LandingSignupModal locale={locale} closeLabel={t('close')} className="mt-8 inline-flex rounded-[7px] bg-brand px-5 py-4 text-base font-bold text-white transition hover:bg-brand-strong">
          {t('primaryCta')}
        </LandingSignupModal>
        <p className="mt-4 max-w-[520px] text-sm font-medium leading-6 text-slate-500">{t('finalNote')}</p>
      </section>

      <footer className="border-t border-white/[0.06] px-6 py-4 lg:px-10">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-[5px] bg-brand text-xs font-bold text-white">AB</span>
              <span className="text-base font-semibold text-slate-400">ActiveBoard</span>
            </div>
            <p className="mt-2 text-sm font-medium text-slate-600">{t('footerDescription')}</p>
            <p className="mt-2 text-sm font-medium text-slate-700">ActiveBoard 2026</p>
          </div>
          <div className="flex gap-5 text-sm font-semibold text-slate-500">
            <a href="#pricing" className="hover:text-white">{t('navPricing')}</a>
            <Link href="/auth/login" className="hover:text-white">{t('navSignIn')}</Link>
            <Link href="/" locale={locale === 'fr' ? 'en' : 'fr'} className="hover:text-white">
              {locale === 'fr' ? 'EN' : 'FR'}
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
