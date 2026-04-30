import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import type { ConfidenceLevel } from '@/lib/demo/confidence';
import { getSessionSummaryData } from '@/lib/demo/data';
import type { DimensionOfCare, ErrorType, PhysicianActivity } from '@/lib/types/demo';

type SessionSummaryPageProps = {
  params: { locale: string; sessionId: string };
  searchParams: {
    feedbackMessage?: string;
    feedbackTone?: string;
    feedbackId?: string;
  };
};

function formatConfidence(
  confidence: ConfidenceLevel | null | undefined,
  t: (key: 'confidenceLow' | 'confidenceMedium' | 'confidenceHigh' | 'blank') => string,
) {
  if (confidence === 'low') return t('confidenceLow');
  if (confidence === 'medium') return t('confidenceMedium');
  if (confidence === 'high') return t('confidenceHigh');
  return t('blank');
}

function formatPhysicianActivity(value: PhysicianActivity | null | undefined, t: (key: string) => string) {
  return value ? t(`physicianActivity.${value}`) : t('blank');
}

function formatDimensionOfCare(value: DimensionOfCare | null | undefined, t: (key: string) => string) {
  return value ? t(`dimensionOfCare.${value}`) : t('blank');
}

function formatErrorType(value: ErrorType | null | undefined, t: (key: string) => string) {
  return value ? t(`errorType.${value}`) : t('blank');
}

export default async function SessionSummaryPage({ params, searchParams }: SessionSummaryPageProps) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);
  const t = await getTranslations('SessionSummary');
  const data = await getSessionSummaryData(params.sessionId, user);

  if (!data?.session || !data.group) {
    notFound();
  }

  return (
    <main className="flex flex-1 flex-col gap-6">
      <FeedbackBanner
        message={searchParams.feedbackMessage}
        tone={searchParams.feedbackTone}
        feedbackId={searchParams.feedbackId}
      />

      <section className="surface p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="eyebrow">{t('eyebrow')}</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white">{t('title')}</h1>
            <p className="mt-3 text-base leading-7 text-slate-400">{data.group.name}</p>
          </div>
          <Link href={`/groups/${data.group.id}`} prefetch={false} className="button-primary">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t('backToGroup')}
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="surface p-6">
          <p className="text-sm font-medium text-slate-400">{t('totalQuestions')}</p>
          <p className="mt-3 text-4xl font-extrabold tracking-tight text-white">{data.totalQuestions}</p>
        </article>
        <article className="surface p-6">
          <p className="text-sm font-medium text-slate-400">{t('score')}</p>
          <p className="mt-3 text-4xl font-extrabold tracking-tight text-white">
            {data.correctCount}/{data.totalQuestions}
          </p>
        </article>
        <article className="surface p-6">
          <p className="text-sm font-medium text-slate-400">{t('accuracy')}</p>
          <p className="mt-3 text-4xl font-extrabold tracking-tight text-white">{data.accuracy}%</p>
        </article>
        <article className="surface p-6">
          <p className="text-sm font-medium text-slate-400">{t('timeSpent')}</p>
          <p className="mt-3 text-4xl font-extrabold tracking-tight text-white">
            {t('minutesValue', { count: data.totalDurationMinutes })}
          </p>
        </article>
      </section>

      <section className="surface p-6 sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{t('breakdownTitle')}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              {t('confidenceSummary', {
                confidence: data.answeredCount > 0 ? formatConfidence(data.averageConfidence, t) : t('noConfidenceData'),
              })}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {data.breakdown.map((question) => (
            <article key={question.id} className="surface-soft p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    {t('questionNumber', { number: question.order_index + 1 })}
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-white">
                    {question.body ?? t('untitledQuestion')}
                  </h3>
                </div>
                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                  {t('groupAverageValue', { count: question.groupAverage })}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-6">
                <div className="rounded-[18px] bg-white/[0.04] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('yourAnswer')}</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {question.myAnswer?.selected_option ?? t('blank')}
                  </p>
                </div>
                <div className="rounded-[18px] bg-white/[0.04] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('correctAnswer')}</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {question.correct_option ?? t('blank')}
                  </p>
                </div>
                <div className="rounded-[18px] bg-white/[0.04] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('confidence')}</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {formatConfidence(question.myAnswer?.confidence, t)}
                  </p>
                </div>
                <div className="rounded-[18px] bg-white/[0.04] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('result')}</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {question.myAnswer
                      ? question.myAnswer.is_correct
                        ? t('correct')
                        : t('incorrect')
                      : t('missed')}
                  </p>
                </div>
                <div className="rounded-[18px] bg-white/[0.04] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('physicianActivityLabel')}</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {formatPhysicianActivity(question.classification?.physician_activity, t)}
                  </p>
                </div>
                <div className="rounded-[18px] bg-white/[0.04] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('dimensionOfCareLabel')}</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {formatDimensionOfCare(question.classification?.dimension_of_care, t)}
                  </p>
                </div>
              </div>

              {question.reflection ? (
                <div className="mt-4 rounded-[18px] bg-white/[0.04] px-4 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('privateReflectionLabel')}</p>
                    <p className="text-xs font-semibold text-brand">
                      {formatErrorType(question.reflection.error_type, t)}
                    </p>
                  </div>
                  {question.reflection.private_note ? (
                    <p className="mt-3 text-sm leading-7 text-slate-300">{question.reflection.private_note}</p>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
