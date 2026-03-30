'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

type LogoutButtonProps = {
  className?: string;
  showIcon?: boolean;
};

export function LogoutButton({ className, showIcon = false }: LogoutButtonProps) {
  const t = useTranslations('Common');
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          const supabase = createSupabaseBrowserClient();
          await supabase.auth.signOut();
          router.push(`/${locale}/auth/login`);
          router.refresh();
        })
      }
      className={cn('button-secondary', className)}
      disabled={isPending}
    >
      {showIcon ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path d="M14 7l5 5l-5 5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <path d="M19 12H9" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M11 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
      ) : null}
      {isPending ? t('signingOut') : t('signOut')}
    </button>
  );
}
