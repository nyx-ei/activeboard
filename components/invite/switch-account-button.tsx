'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type SwitchAccountButtonProps = {
  nextPath: string;
  label: string;
};

export function SwitchAccountButton({ nextPath, label }: SwitchAccountButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          const supabase = createSupabaseBrowserClient();
          await supabase.auth.signOut();
          window.location.assign(nextPath);
          router.refresh();
        })
      }
      className="button-primary mt-6 inline-flex h-12 items-center justify-center rounded-[8px] px-5 text-sm"
      disabled={isPending}
    >
      {label}
    </button>
  );
}
