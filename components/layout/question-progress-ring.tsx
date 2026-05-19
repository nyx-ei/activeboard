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
      title={label}
      className={`relative inline-grid h-10 w-10 shrink-0 place-items-center rounded-full transition hover:scale-[1.02] sm:h-12 sm:w-12 ${tone.glow}`}
      style={{
        background: `conic-gradient(${tone.ring} ${progress}%, rgba(143, 167, 162, 0.18) 0)`,
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-[3px] rounded-full bg-[#00100f]"
      />
      <span
        className={`relative z-10 text-[14px] font-semibold leading-none tabular-nums sm:text-[16px] ${tone.text}`}
      >
        {visibleCount}
      </span>
    </Link>
  );
}
