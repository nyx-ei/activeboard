'use client';

import { useMemo, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

type Mode = 'sign-in' | 'sign-up';

export function AuthForm() {
  const t = useTranslations('Auth');
  const locale = useLocale() as AppLocale;
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('next') ?? `/${locale}/dashboard`;
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'error' | 'success'>('success');
  const [isPending, startTransition] = useTransition();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  function resolveAuthError(message: string) {
    const normalizedMessage = message.toLowerCase();

    if (
      normalizedMessage.includes('invalid login credentials') ||
      normalizedMessage.includes('email not confirmed') ||
      normalizedMessage.includes('invalid_credentials')
    ) {
      return t('invalidCredentials');
    }

    return t('unexpectedError');
  }

  async function handlePasswordAuth() {
    setMessage(null);

    if (!email || !password || (mode === 'sign-up' && !displayName)) {
      setMessageTone('error');
      setMessage(t('missingFields'));
      return;
    }

    if (mode === 'sign-in') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setMessageTone('error');
        setMessage(resolveAuthError(error.message));
        return;
      }

      setMessageTone('success');
      setMessage(t('signInSuccess'));
      window.location.assign(redirectTo);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: displayName,
          locale,
        },
        emailRedirectTo: `${window.location.origin}/${locale}/auth/callback`,
      },
    });

    if (error) {
      setMessageTone('error');
      setMessage(resolveAuthError(error.message));
      return;
    }

    setMessageTone('success');
    setMessage(t('signUpSuccess'));
  }

  async function handleMagicLink() {
    setMessage(null);

    if (!email) {
      setMessageTone('error');
      setMessage(t('missingFields'));
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/${locale}/auth/callback`,
        data: { locale },
      },
    });

    if (error) {
      setMessageTone('error');
      setMessage(resolveAuthError(error.message));
      return;
    }

    setMessageTone('success');
    setMessage(t('magicLinkSent'));
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/${locale}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      setMessageTone('error');
      setMessage(error.message ? resolveAuthError(error.message) : t('googleError'));
    }
  }

  return (
    <div className="surface w-full max-w-xl p-8 sm:p-10">
      <p className="text-sm uppercase tracking-[0.22em] text-slate-500">{t('eyebrow')}</p>
      <h1 className="mt-4 text-3xl font-semibold text-slate-950">{t('title')}</h1>
      <p className="mt-3 text-base leading-7 text-slate-600">{t('description')}</p>

      <div className="mt-8 space-y-4">
        {mode === 'sign-up' ? (
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">{t('displayName')}</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="w-full rounded-2xl border border-border bg-white px-4 py-3 outline-none ring-brand transition focus:ring-2"
            />
          </label>
        ) : null}

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">{t('email')}</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-2xl border border-border bg-white px-4 py-3 outline-none ring-brand transition focus:ring-2"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">{t('password')}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-2xl border border-border bg-white px-4 py-3 outline-none ring-brand transition focus:ring-2"
          />
        </label>
      </div>

      {message ? (
        <div
          className={cn(
            'mt-4 rounded-2xl border px-4 py-3 text-sm',
            messageTone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700',
          )}
        >
          {message}
        </div>
      ) : null}

      <div className="mt-6 grid gap-3">
        <button
          type="button"
          onClick={() => startTransition(handlePasswordAuth)}
          className="rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong"
          disabled={isPending}
        >
          {isPending ? (mode === 'sign-in' ? t('signInPending') : t('signUpPending')) : mode === 'sign-in' ? t('signIn') : t('signUp')}
        </button>
        <button
          type="button"
          onClick={() => startTransition(handleMagicLink)}
          className="rounded-2xl border border-border bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          disabled={isPending}
        >
          {isPending ? t('magicLinkPending') : t('magicLink')}
        </button>
        <button
          type="button"
          onClick={() => startTransition(handleGoogle)}
          className="rounded-2xl border border-slate-900 bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          disabled={isPending}
        >
          {isPending ? t('googlePending') : t('google')}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
        className="mt-5 text-sm font-medium text-brand-strong underline-offset-4 transition hover:underline"
      >
        {mode === 'sign-in' ? t('switchToSignUp') : t('switchToSignIn')}
      </button>
    </div>
  );
}
