'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

function PendingInlineLabel({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <span className="relative inline-flex items-center justify-center">
      <span className={cn('inline-flex items-center justify-center transition', pending && 'text-transparent')}>{label}</span>
      {pending ? (
        <span className="absolute inset-0 inline-flex items-center justify-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
          <span>{pendingLabel}</span>
        </span>
      ) : null}
    </span>
  );
}

export function ResetPasswordForm() {
  const t = useTranslations('Auth');
  const locale = useLocale() as AppLocale;
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'error' | 'success'>('success');
  const [isRecoveryReady, setIsRecoveryReady] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    async function bootstrapRecoverySession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (session) {
        setIsRecoveryReady(true);
        return;
      }

      const hash = window.location.hash.startsWith('#') ? new URLSearchParams(window.location.hash.slice(1)) : null;
      const accessToken = hash?.get('access_token');
      const refreshToken = hash?.get('refresh_token');

      if (!accessToken || !refreshToken) {
        setIsRecoveryReady(false);
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (!isMounted) {
        return;
      }

      if (error) {
        setIsRecoveryReady(false);
        return;
      }

      window.history.replaceState({}, document.title, window.location.pathname);
      setIsRecoveryReady(true);
    }

    bootstrapRecoverySession();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  async function handleSubmit() {
    setMessage(null);

    if (!password || !confirmPassword) {
      setMessageTone('error');
      setMessage(t('missingFields'));
      return;
    }

    if (password !== confirmPassword) {
      setMessageTone('error');
      setMessage(t('passwordMismatch'));
      return;
    }

    if (password.length < 8) {
      setMessageTone('error');
      setMessage(t('weakPassword'));
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessageTone('error');
      setMessage(t('unexpectedError'));
      return;
    }

    setMessageTone('success');
    setMessage(t('resetPasswordSuccess'));
    window.setTimeout(() => {
      window.location.assign(`/${locale}/auth/login`);
    }, 700);
  }

  return (
    <div className="w-full max-w-[410px]">
      <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-[8px] bg-brand text-xl font-extrabold text-white">
        AB
      </div>
      <div className="mt-5 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">{t('resetPasswordTitle')}</h1>
        <p className="mt-2 text-sm font-medium text-slate-400">{t('resetPasswordSubtitle')}</p>
      </div>

      {!isRecoveryReady ? (
        <div className="mt-8 rounded-[18px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {t('resetPasswordInvalidLink')}
        </div>
      ) : (
        <>
          <div className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-300">{t('newPassword')}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="field h-10 rounded-[6px] px-3 text-sm"
              />
              <span className="mt-1 block text-xs text-slate-500">{t('passwordHint')}</span>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-300">{t('confirmPassword')}</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder={t('confirmPasswordPlaceholder')}
                className="field h-10 rounded-[6px] px-3 text-sm"
              />
            </label>
          </div>

          {message ? (
            <div
              className={cn(
                'mt-4 rounded-[18px] border px-4 py-3 text-sm',
                messageTone === 'success'
                  ? 'border-brand/25 bg-brand/10 text-brand'
                  : 'border-rose-500/20 bg-rose-500/10 text-rose-300',
              )}
            >
              {message}
            </div>
          ) : null}

          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={() => startTransition(handleSubmit)}
              className="button-primary h-16 w-full rounded-[6px] text-base"
              disabled={isPending}
            >
              <PendingInlineLabel pending={isPending} label={t('resetPasswordAction')} pendingLabel={t('resetPasswordPending')} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
