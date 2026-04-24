'use client';

import { LogOut } from 'lucide-react';
import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

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
          await fetch('/api/auth/logout', {
            method: 'POST',
            cache: 'no-store',
          });
          router.push(`/${locale}/auth/login`);
          router.refresh();
        })
      }
      className={cn('button-secondary', className)}
      disabled={isPending}
      aria-busy={isPending}
    >
      {showIcon ? <LogOut className="h-4 w-4" aria-hidden="true" /> : null}
      <span className="relative inline-flex items-center justify-center">
        <span className={cn('inline-flex items-center justify-center transition', isPending && 'text-transparent')}>
          {t('signOut')}
        </span>
        {isPending ? (
          <span className="absolute inset-0 inline-flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
            <span>{t('signingOut')}</span>
          </span>
        ) : null}
      </span>
    </button>
  );
}
