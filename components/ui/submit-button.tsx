'use client';

import { useFormStatus } from 'react-dom';

import { cn } from '@/lib/utils';

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingLabel: string;
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
        'disabled:cursor-not-allowed disabled:opacity-70',
        className,
      )}
      disabled={isDisabled}
      aria-disabled={isDisabled}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
