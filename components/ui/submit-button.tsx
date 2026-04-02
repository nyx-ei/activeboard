'use client';

import { useFormStatus } from 'react-dom';

import { cn } from '@/lib/utils';

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
};

export function SubmitButton({ children, pendingLabel, className, disabled = false }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;

  return (
    <button
      type="submit"
      className={cn(
        'relative disabled:cursor-not-allowed disabled:opacity-70',
        className,
      )}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={pending}
    >
      <span className={cn('inline-flex items-center justify-center gap-2 transition', pending && 'text-transparent')}>
        {children}
      </span>
      {pending ? (
        <span className="absolute inset-0 inline-flex items-center justify-center gap-2">
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
          {pendingLabel ? <span>{pendingLabel}</span> : null}
        </span>
      ) : null}
    </button>
  );
}
