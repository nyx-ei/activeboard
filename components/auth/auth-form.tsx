'use client';

import { useMemo, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

type Mode = 'sign-in' | 'sign-up';

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

export function AuthForm() {
  const t = useTranslations('Auth');
  const locale = useLocale() as AppLocale;
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('next') ?? `/${locale}/dashboard`;
  const [mode, setMode] = useState<Mode>(searchParams.get('mode') === 'sign-up' ? 'sign-up' : 'sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [examSession, setExamSession] = useState('');
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

    if (!email || !password || (mode === 'sign-up' && (!displayName || !examSession))) {
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
          exam_session: examSession,
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
    <div className="w-full max-w-[410px]">
      <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-[8px] bg-brand text-xl font-extrabold text-white">
        AB
      </div>
      <div className="mt-5 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          {mode === 'sign-in' ? t('welcomeBack') : t('createAccountTitle')}
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-500">
          {mode === 'sign-in' ? t('welcomeBackSubtitle') : t('createAccountSubtitle')}
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {mode === 'sign-up' ? (
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-300">{t('displayName')}</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={t('displayNamePlaceholder')}
              className="field h-10 rounded-[6px] px-3 text-sm"
            />
          </label>
        ) : null}

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-300">{t('email')}</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="field h-10 rounded-[6px] px-3 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-300">{t('password')}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field h-10 rounded-[6px] px-3 text-sm"
          />
          {mode === 'sign-up' ? <span className="mt-1 block text-xs text-slate-500">{t('passwordHint')}</span> : null}
        </label>

        {mode === 'sign-up' ? (
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-300">{t('examSession')}</span>
            <select
              value={examSession}
              onChange={(event) => setExamSession(event.target.value)}
              className="field h-10 rounded-[6px] px-3 text-sm"
            >
              <option value="">{t('examSessionPlaceholder')}</option>
              <option value="april_may_2026">{t('examAprilMay2026')}</option>
              <option value="august_september_2026">{t('examAugustSeptember2026')}</option>
              <option value="october_2026">{t('examOctober2026')}</option>
              <option value="planning_ahead">{t('examPlanningAhead')}</option>
            </select>
            <span className="mt-1 block text-xs text-slate-500">{t('examSessionHint')}</span>
          </label>
        ) : null}
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
          onClick={() => startTransition(handlePasswordAuth)}
          className="button-primary h-16 w-full rounded-[6px] text-base"
          disabled={isPending}
        >
          <PendingInlineLabel
            pending={isPending}
            label={mode === 'sign-in' ? t('signIn') : t('signUp')}
            pendingLabel={mode === 'sign-in' ? t('signInPending') : t('signUpPending')}
          />
        </button>
        <button
          type="button"
          onClick={() => startTransition(handleGoogle)}
          className="h-12 w-full rounded-[6px] border border-white/10 bg-[#0f1628] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#141d33]"
          disabled={isPending}
        >
          <PendingInlineLabel pending={isPending} label={t('google')} pendingLabel={t('googlePending')} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
        className="mx-auto mt-6 block text-sm font-bold text-brand underline-offset-4 transition hover:underline"
      >
        {mode === 'sign-in' ? t('switchToSignUp') : t('switchToSignIn')}
      </button>
    </div>
  );
}
