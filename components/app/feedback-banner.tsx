import { cn } from '@/lib/utils';

type FeedbackBannerProps = {
  message?: string | null;
  tone?: string | null;
};

export function FeedbackBanner({ message, tone }: FeedbackBannerProps) {
  if (!message) {
    return null;
  }

  const isSuccess = tone === 'success';

  return (
    <div
      className={cn(
        'rounded-3xl border px-4 py-3 text-sm',
        isSuccess ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700',
      )}
    >
      {message}
    </div>
  );
}

