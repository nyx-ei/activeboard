'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

type Mode = 'sign-in' | 'sign-up';

type AuthFormProps = {
  initialMode?: Mode;
  redirectToOverride?: string;
  signUpRedirectToOverride?: string;
  requireExamSessionOnSignUp?: boolean;
  deferSignUpToRedirect?: boolean;
  inviteIdForSignUp?: string;
  lockedEmail?: string;
  variant?: 'page' | 'modal';
};

const CREATE_GROUP_ACCOUNT_DRAFT_KEY = 'activeboard:create-group-account-draft';

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

export function AuthForm({
  initialMode,
  redirectToOverride,
  signUpRedirectToOverride,
  requireExamSessionOnSignUp = true,
  deferSignUpToRedirect = false,
  inviteIdForSignUp,
  lockedEmail,
  variant = 'page',
}: AuthFormProps = {}) {
  const t = useTranslations('Auth');
  const locale = useLocale() as AppLocale;
  const searchParams = useSearchParams();
  const searchNext = searchParams.get('next');
  const redirectTo = redirectToOverride ?? searchNext ?? `/${locale}/dashboard`;
  const signUpRedirectTo = signUpRedirectToOverride ?? redirectTo;
  const hasExplicitRedirectTarget = Boolean(redirectToOverride ?? signUpRedirectToOverride ?? searchNext);
  const [mode, setMode] = useState<Mode>(initialMode ?? (searchParams.get('mode') === 'sign-up' ? 'sign-up' : 'sign-in'));
  const [email, setEmail] = useState(lockedEmail ?? '');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [examSession, setExamSession] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'error' | 'success'>('success');
  const [isPending, startTransition] = useTransition();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    if (mode !== 'sign-up' || !deferSignUpToRedirect) {
      return;
    }

    try {
      const rawDraft = window.sessionStorage.getItem(CREATE_GROUP_ACCOUNT_DRAFT_KEY);
      if (!rawDraft) {
        return;
      }

      const draft = JSON.parse(rawDraft) as {
        fullName?: string;
        email?: string;
        examSession?: string;
      };

      setDisplayName((current) => current || draft.fullName || '');
      setEmail((current) => current || draft.email || '');
      setExamSession((current) => current || draft.examSession || '');
    } catch {
      window.sessionStorage.removeItem(CREATE_GROUP_ACCOUNT_DRAFT_KEY);
    }
  }, [deferSignUpToRedirect, mode]);

  useEffect(() => {
    if (!lockedEmail) {
      return;
    }

    setEmail(lockedEmail);
  }, [lockedEmail]);

  function resolveAuthError(message: string) {
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes('already registered') || normalizedMessage.includes('already been registered')) {
      return t('accountExists');
    }

    if (normalizedMessage.includes('password should be at least') || normalizedMessage.includes('weak password')) {
      return t('weakPassword');
    }

    if (normalizedMessage.includes('invalid email') || normalizedMessage.includes('email address is invalid')) {
      return t('invalidEmail');
    }

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
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password || (mode === 'sign-up' && (!displayName || (requireExamSessionOnSignUp && !examSession)))) {
      setMessageTone('error');
      setMessage(t('missingFields'));
      return;
    }

    if (mode === 'sign-in') {
      const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

      if (error) {
        setMessageTone('error');
        setMessage(resolveAuthError(error.message));
        return;
      }

      setMessageTone('success');
      setMessage(t('signInSuccess'));
      if (hasExplicitRedirectTarget) {
        window.location.assign(redirectTo);
        return;
      }
      window.location.assign(redirectTo);
      return;
    }

    if (!requireExamSessionOnSignUp && deferSignUpToRedirect) {
      window.sessionStorage.setItem(
        CREATE_GROUP_ACCOUNT_DRAFT_KEY,
            JSON.stringify({
          displayName,
          email: normalizedEmail,
          password,
          locale,
        }),
      );
      window.location.assign(signUpRedirectTo);
      return;
    }

    if (inviteIdForSignUp) {
      const inviteResponse = await fetch('/api/invite-auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteId: inviteIdForSignUp,
          email: normalizedEmail,
          password,
          displayName,
          locale,
        }),
      });

      const invitePayload = (await inviteResponse.json().catch(() => null)) as
        | { ok?: boolean; reason?: string }
        | null;

      if (!inviteResponse.ok || !invitePayload?.ok) {
        setMessageTone('error');
        if (invitePayload?.reason === 'invite_email_mismatch') {
          setMessage(t('invalidCredentials'));
        } else if (invitePayload?.reason === 'account_exists') {
          setMessage(t('invalidCredentials'));
        } else {
          setMessage(t('unexpectedError'));
        }
        return;
      }

      const { error: inviteSignInError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

      if (inviteSignInError) {
        setMessageTone('error');
        setMessage(resolveAuthError(inviteSignInError.message));
        return;
      }
    } else {
      const signUpResponse = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          displayName,
          examSession,
          locale,
        }),
      });

      const signUpPayload = (await signUpResponse.json().catch(() => null)) as
        | { ok?: boolean; reason?: string }
        | null;

      if (!signUpResponse.ok || !signUpPayload?.ok) {
        setMessageTone('error');
        if (signUpPayload?.reason === 'account_exists') {
          setMessage(t('accountExists'));
        } else if (signUpPayload?.reason === 'weak_password') {
          setMessage(t('weakPassword'));
        } else if (signUpPayload?.reason === 'invalid_email') {
          setMessage(t('invalidEmail'));
        } else if (signUpPayload?.reason === 'missing_fields') {
          setMessage(t('missingFields'));
        } else {
          setMessage(t('unexpectedError'));
        }
        return;
      }

      const { error: signInAfterSignUpError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

      if (signInAfterSignUpError) {
        setMessageTone('error');
        setMessage(resolveAuthError(signInAfterSignUpError.message));
        return;
      }
    }

    setMessageTone('success');
    setMessage(t('signUpSuccess'));
    window.location.assign(signUpRedirectTo);
  }

  async function handleGoogle() {
    const nextUrl = mode === 'sign-up' ? signUpRedirectTo : redirectTo;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/${locale}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
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
    <div className={cn('w-full max-w-[410px]', variant === 'modal' && 'max-w-none')}>
      {variant === 'page' ? (
        <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-[8px] bg-brand text-xl font-extrabold text-white">
          AB
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-brand text-sm font-extrabold text-white">AB</span>
          <span className="text-base font-extrabold text-white">ActiveBoard</span>
        </div>
      )}
      <div className={cn(variant === 'page' ? 'mt-5 text-center' : 'mt-4 text-left')}>
        <h1 className={cn('font-extrabold tracking-tight text-white', variant === 'page' ? 'text-2xl' : 'text-xl')}>
          {mode === 'sign-in' ? t('welcomeBack') : requireExamSessionOnSignUp || !deferSignUpToRedirect ? t('createAccountTitle') : t('createGroupTitle')}
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-400">
          {mode === 'sign-in' ? t('welcomeBackSubtitle') : requireExamSessionOnSignUp || !deferSignUpToRedirect ? t('createAccountSubtitle') : t('createGroupSubtitle')}
        </p>
      </div>

      <div className={cn('space-y-4', variant === 'page' ? 'mt-8' : 'mt-5')}>
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
            disabled={Boolean(lockedEmail)}
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

        {mode === 'sign-up' && requireExamSessionOnSignUp ? (
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
