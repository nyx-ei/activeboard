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
        'rounded-[20px] border px-4 py-3 text-sm backdrop-blur',
        isSuccess
          ? 'border-brand/25 bg-brand/10 text-brand'
          : 'border-rose-500/20 bg-rose-500/10 text-rose-300',
      )}
    >
      {message}
    </div>
  );
}
