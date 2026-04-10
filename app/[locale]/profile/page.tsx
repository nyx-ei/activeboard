import { getTranslations } from 'next-intl/server';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import { getDashboardData } from '@/lib/demo/data';

type ProfilePageProps = {
  params: { locale: string };
  searchParams: {
    feedbackMessage?: string;
    feedbackTone?: string;
  };
};

function getHeatmapCellClass(intensity: 0 | 1 | 2 | 3 | 4) {
  switch (intensity) {
    case 4:
      return 'bg-brand';
    case 3:
      return 'bg-emerald-400/80';
    case 2:
      return 'bg-emerald-400/55';
    case 1:
      return 'bg-emerald-400/25';
    default:
      return 'bg-white/[0.05]';
  }
}

export default async function ProfilePage({ params, searchParams }: ProfilePageProps) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);
  const t = await getTranslations('Profile');
  const dashboardT = await getTranslations('Dashboard');
  const sessionT = await getTranslations('Session');
  const data = await getDashboardData(user, false, true);

  return (
    <main className="mx-auto flex w-full max-w-[980px] flex-1 flex-col gap-6">
      <FeedbackBanner message={searchParams.feedbackMessage} tone={searchParams.feedbackTone} />

      <section className="surface p-6 sm:p-8">
        <Link href="/dashboard" className="button-ghost -ml-4 px-4">
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M15 6l-6 6l6 6"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
          {t('backToDashboard')}
        </Link>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">{t('title')}</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-400">{t('description')}</p>
          </div>
          <span className="shrink-0 rounded-full bg-white/[0.05] px-4 py-2 text-sm font-semibold text-slate-200">
            {dashboardT('questionsAnsweredValue', { count: data.metrics.answeredCount })}
          </span>
        </div>
      </section>

      <section className="surface p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
              {dashboardT('trialProgressTitle')}
            </p>
            <p className="mt-2 text-lg font-bold text-white">
              {dashboardT('trialProgressSummary', {
                current: data.profileAnalytics.trialProgress.current,
                total: data.profileAnalytics.trialProgress.total,
              })}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              {data.profileAnalytics.trialProgress.isComplete
                ? dashboardT('trialProgressComplete')
                : data.profileAnalytics.trialProgress.showWarning
                  ? dashboardT('trialProgressWarning', {
                      remaining: data.profileAnalytics.trialProgress.remaining,
                    })
                  : dashboardT('trialProgressDescription', {
                      remaining: data.profileAnalytics.trialProgress.remaining,
                    })}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-white/[0.05] px-4 py-2 text-sm font-semibold text-slate-200">
            {t('sessionsCompletedValue', { count: data.metrics.completedSessionsCount })}
          </span>
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full transition-[width] ${
              data.profileAnalytics.trialProgress.isComplete
                ? 'bg-amber-400'
                : data.profileAnalytics.trialProgress.showWarning
                  ? 'bg-amber-300'
                  : 'bg-brand'
            }`}
            style={{
              width: `${Math.min(
                100,
                Math.round(
                  (data.profileAnalytics.trialProgress.current / data.profileAnalytics.trialProgress.total) * 100,
                ),
              )}%`,
            }}
          />
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="surface p-5">
          <p className="text-sm font-medium text-slate-400">{t('summaryQuestions')}</p>
          <p className="mt-3 text-4xl font-extrabold tracking-tight text-white">{data.metrics.answeredCount}</p>
        </article>
        <article className="surface p-5">
          <p className="text-sm font-medium text-slate-400">{t('summarySessions')}</p>
          <p className="mt-3 text-4xl font-extrabold tracking-tight text-white">{data.metrics.completedSessionsCount}</p>
        </article>
        <article className="surface p-5">
          <p className="text-sm font-medium text-slate-400">{t('summaryAccuracy')}</p>
          <p className="mt-3 text-4xl font-extrabold tracking-tight text-white">
            {data.metrics.successRate !== null ? `${data.metrics.successRate}%` : dashboardT('noData')}
          </p>
        </article>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <article className="surface p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-lg font-bold text-white">{dashboardT('heatmapTitle')}</p>
              <p className="mt-1 text-sm text-slate-400">{dashboardT('heatmapDescription')}</p>
            </div>
            <span className="text-sm font-semibold text-slate-500">{dashboardT('last12Weeks')}</span>
          </div>
          <div className="mt-5 grid grid-cols-7 gap-1.5 sm:grid-cols-14 md:grid-cols-16">
            {data.profileAnalytics.heatmap.map((day) => (
              <div
                key={day.date}
                className={`aspect-square rounded-[6px] border border-white/5 ${getHeatmapCellClass(day.intensity)}`}
                title={`${day.date} - ${day.count}`}
              />
            ))}
          </div>
        </article>

        <article className="surface p-5">
          <p className="text-lg font-bold text-white">{dashboardT('trendTitle')}</p>
          <p className="mt-1 text-sm text-slate-400">{dashboardT('trendDescription')}</p>
          <div className="mt-5 space-y-3">
            {data.profileAnalytics.weeklyTrend.map((point) => (
              <div key={point.label} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-white">{point.label}</span>
                  <span className="text-slate-400">
                    {point.total > 0
                      ? dashboardT('trendAccuracyValue', { accuracy: point.accuracy ?? 0, count: point.total })
                      : dashboardT('trendEmpty')}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${point.accuracy ?? 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="surface p-5">
          <p className="text-lg font-bold text-white">{dashboardT('physicianActivityTitle')}</p>
          <div className="mt-4 space-y-3">
            {data.profileAnalytics.physicianActivityAccuracy.map((item) => (
              <div key={item.category} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-white">{sessionT(`physicianActivity.${item.category}` as never)}</span>
                  <span className="text-slate-400">
                    {item.total > 0
                      ? dashboardT('accuracyValue', { accuracy: item.accuracy, count: item.total })
                      : dashboardT('noData')}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${item.accuracy}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface p-5">
          <p className="text-lg font-bold text-white">{dashboardT('dimensionOfCareTitle')}</p>
          <div className="mt-4 space-y-3">
            {data.profileAnalytics.dimensionOfCareAccuracy.map((item) => (
              <div key={item.category} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-white">{sessionT(`dimensionOfCare.${item.category}` as never)}</span>
                  <span className="text-slate-400">
                    {item.total > 0
                      ? dashboardT('accuracyValue', { accuracy: item.accuracy, count: item.total })
                      : dashboardT('noData')}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${item.accuracy}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface p-5">
          <p className="text-lg font-bold text-white">{dashboardT('confidenceCalibrationTitle')}</p>
          <div className="mt-4 space-y-3">
            {data.profileAnalytics.confidenceCalibration.map((item) => (
              <div key={item.confidence} className="rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-white">
                    {item.confidence === 'low'
                      ? dashboardT('confidenceLow')
                      : item.confidence === 'medium'
                        ? dashboardT('confidenceMedium')
                        : dashboardT('confidenceHigh')}
                  </span>
                  <span className="text-sm text-slate-400">
                    {item.total > 0
                      ? dashboardT('accuracyValue', { accuracy: item.accuracy, count: item.total })
                      : dashboardT('noData')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="surface p-5">
          <p className="text-lg font-bold text-white">{dashboardT('errorTypesTitle')}</p>
          {data.profileAnalytics.errorTypeBreakdown.length > 0 ? (
            <div className="mt-4 space-y-3">
              {data.profileAnalytics.errorTypeBreakdown.map((item) => (
                <div
                  key={item.errorType}
                  className="flex items-center justify-between gap-3 rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-3"
                >
                  <span className="font-medium text-white">{sessionT(`errorType.${item.errorType}` as never)}</span>
                  <span className="rounded-full bg-white/[0.05] px-3 py-1 text-sm font-semibold text-slate-300">
                    {dashboardT('errorTypeCount', { count: item.count })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">{dashboardT('errorTypesEmpty')}</p>
          )}
        </article>

        <article className="surface p-5">
          <p className="text-lg font-bold text-white">{dashboardT('blueprintGridTitle')}</p>
          <p className="mt-1 text-sm text-slate-400">{dashboardT('blueprintGridDescription')}</p>
          <div className="mt-5 overflow-x-auto">
            <div className="min-w-[860px]">
              <div className="grid grid-cols-[180px_repeat(6,minmax(88px,1fr))] gap-2">
                <div />
                {data.profileAnalytics.dimensionOfCareAccuracy.map((item) => (
                  <div key={item.category} className="text-center text-xs font-semibold text-slate-400">
                    {sessionT(`dimensionOfCare.${item.category}` as never)}
                  </div>
                ))}
                {data.profileAnalytics.physicianActivityAccuracy.map((activity) => (
                  <div key={activity.category} className="contents">
                    <div className="flex items-center text-sm font-semibold text-white">
                      {sessionT(`physicianActivity.${activity.category}` as never)}
                    </div>
                    {data.profileAnalytics.blueprintGrid
                      .filter((cell) => cell.physicianActivity === activity.category)
                      .map((cell) => (
                        <div
                          key={`${cell.physicianActivity}-${cell.dimensionOfCare}`}
                          className="rounded-[14px] border border-white/8 bg-white/[0.03] px-2 py-3 text-center text-xs"
                        >
                          <p className="font-bold text-white">{cell.accuracy !== null ? `${cell.accuracy}%` : '--'}</p>
                          <p className="mt-1 text-slate-500">{cell.total > 0 ? `${cell.total}Q` : dashboardT('noData')}</p>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
