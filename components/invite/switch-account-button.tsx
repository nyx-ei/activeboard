'use client';

import { useTransition } from 'react';

type SwitchAccountButtonProps = {
  nextPath: string;
  label: string;
};

export function SwitchAccountButton({ nextPath, label }: SwitchAccountButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          await fetch('/api/auth/logout', {
            method: 'POST',
            cache: 'no-store',
          });
          window.location.assign(nextPath);
        })
      }
      className="button-primary mt-6 inline-flex h-12 items-center justify-center rounded-[8px] px-5 text-sm"
      disabled={isPending}
    >
      {label}
    </button>
  );
}
