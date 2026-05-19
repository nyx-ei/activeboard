import { Link } from '@/i18n/navigation';
import { TRIAL_QUESTION_LIMIT } from '@/lib/billing/user-tier';

type QuestionProgressRingProps = {
  answeredCount: number;
  label: string;
};

function getProgressTone(answeredCount: number) {
  if (answeredCount >= TRIAL_QUESTION_LIMIT) {
    return {
      ring: '#ef4444',
      text: 'text-red-300',
      glow: 'shadow-[0_0_18px_rgba(239,68,68,0.35)] animate-pulse',
    };
  }

  if (answeredCount >= 85) {
    return {
      ring: '#f59e0b',
      text: 'text-amber-300',
      glow: 'shadow-[0_0_14px_rgba(245,158,11,0.22)]',
    };
  }

  if (answeredCount >= 70) {
    return {
      ring: '#34d399',
      text: 'text-emerald-300',
      glow: 'shadow-[0_0_14px_rgba(52,211,153,0.2)]',
    };
  }

  return {
    ring: '#60a5fa',
    text: 'text-blue-300',
    glow: 'shadow-[0_0_14px_rgba(96,165,250,0.18)]',
  };
}

export function QuestionProgressRing({
  answeredCount,
  label,
}: QuestionProgressRingProps) {
  const clampedCount = Math.max(0, answeredCount);
  const visibleCount = Math.min(clampedCount, TRIAL_QUESTION_LIMIT);
  const progress = Math.min(
    100,
    Math.round((visibleCount / TRIAL_QUESTION_LIMIT) * 100),
  );
  const tone = getProgressTone(clampedCount);

  return (
    <Link
      href="/billing"
      aria-label={label}
      className="inline-flex h-10 items-center gap-1.5 rounded-[8px] bg-white/[0.035] px-2 text-xs font-extrabold text-slate-200 ring-1 ring-white/[0.07] transition hover:bg-white/[0.055] sm:gap-2 sm:px-3"
    >
      <span
        aria-hidden="true"
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${tone.glow}`}
        style={{
          background: `conic-gradient(${tone.ring} ${progress}%, rgba(148, 163, 184, 0.18) 0)`,
        }}
      >
        <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-[#020814]">
          <span className={`text-[11px] leading-none ${tone.text}`}>◷</span>
        </span>
      </span>
      <span className={`${tone.text} tabular-nums max-[420px]:sr-only`}>
        {visibleCount}/{TRIAL_QUESTION_LIMIT}
      </span>
    </Link>
  );
}
