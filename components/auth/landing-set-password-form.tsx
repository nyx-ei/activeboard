'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { setupLandingPasswordAction } from '@/app/[locale]/auth/set-password/actions';
import type { AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

type LandingSetPasswordFormProps = {
  homeHref: string;
  token: string;
  nextPath: string;
};

type PasswordStrength = {
  labelKey:
    | 'passwordStrengthWeak'
    | 'passwordStrengthFair'
    | 'passwordStrengthGood'
    | 'passwordStrengthStrong';
  score: 1 | 2 | 3 | 4;
};

function getPasswordStrength(password: string): PasswordStrength {
  let score = 0;

  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) {
    return { labelKey: 'passwordStrengthWeak', score: 1 };
  }

  if (score === 2) {
    return { labelKey: 'passwordStrengthFair', score: 2 };
  }

  if (score === 3) {
    return { labelKey: 'passwordStrengthGood', score: 3 };
  }

  return { labelKey: 'passwordStrengthStrong', score: 4 };
}

function PendingInlineLabel({
  pending,
  label,
  pendingLabel,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
}) {
  return (
    <span className="relative inline-flex items-center justify-center">
      <span
        className={cn(
          'inline-flex items-center justify-center transition',
          pending && 'text-transparent',
        )}
      >
        {label}
      </span>
      {pending ? (
        <span className="absolute inset-0 inline-flex items-center justify-center gap-2">
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
          <span>{pendingLabel}</span>
        </span>
      ) : null}
    </span>
  );
}

export function LandingSetPasswordForm({
  homeHref,
  token,
  nextPath,
}: LandingSetPasswordFormProps) {
  const t = useTranslations('Auth');
  const locale = useLocale() as AppLocale;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'error' | 'success'>('error');
  const [isPending, startTransition] = useTransition();
  const strength = getPasswordStrength(password);

  function resolveError(reason: string | undefined) {
    if (reason === 'missing_fields') {
      return t('missingFields');
    }

    if (reason === 'password_mismatch') {
      return t('passwordMismatch');
    }

    if (reason === 'weak_password') {
      return t('weakPassword');
    }

    if (reason === 'invalid_token') {
      return t('setPasswordInvalidLink');
    }

    if (reason === 'invalid_onboarding_draft') {
      return t('setPasswordInvalidDraft');
    }

    if (reason === 'account_exists') {
      return t('accountExists');
    }

    return t('unexpectedError');
  }

  function submitPassword() {
    setMessage(null);
    setMessageTone('error');

    if (!password || !confirmPassword) {
      setMessage(t('missingFields'));
      return;
    }

    if (password !== confirmPassword) {
      setMessage(t('passwordMismatch'));
      return;
    }

    if (password.length < 8) {
      setMessage(t('weakPassword'));
      return;
    }

    const formData = new FormData();
    formData.set('token', token);
    formData.set('password', password);
    formData.set('confirmPassword', confirmPassword);

    startTransition(async () => {
      const result = await setupLandingPasswordAction(formData);
      if (!result.ok) {
        setMessageTone('error');
        setMessage(resolveError(result.reason));
        return;
      }

      setMessageTone('success');
      setMessage(t('setPasswordSuccess'));
      window.setTimeout(() => {
        if (result.requiresGroupSetup) {
          window.location.assign(
            `/${locale}/auth/group-setup?token=${encodeURIComponent(token)}`,
          );
          return;
        }

        const resolvedNextPath = result.groupId
          ? `/${locale}/dashboard?groupId=${encodeURIComponent(result.groupId)}`
          : nextPath;
        window.location.assign(
          `/${locale}/auth/login?next=${encodeURIComponent(resolvedNextPath)}`,
        );
      }, 700);
    });
  }

  return (
    <div className="w-full max-w-[410px]">
      <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-[8px] bg-brand text-xl font-extrabold text-white">
        AB
      </div>
      <div className="mt-5 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          {t('setPasswordTitle')}
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-400">
          {t('setPasswordLandingSubtitle')}
        </p>
      </div>

      <div className="mt-7 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-300">
            {t('newPassword')}
          </span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field h-10 rounded-[6px] px-3 text-sm"
          />
          <div className="mt-3" aria-live="polite">
            <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
              {[1, 2, 3, 4].map((step) => (
                <span
                  key={step}
                  className={cn(
                    'h-1.5 rounded-full bg-white/10 transition-colors',
                    step <= strength.score &&
                      strength.score === 1 &&
                      'bg-rose-400',
                    step <= strength.score &&
                      strength.score === 2 &&
                      'bg-amber-300',
                    step <= strength.score &&
                      strength.score === 3 &&
                      'bg-sky-300',
                    step <= strength.score &&
                      strength.score === 4 &&
                      'bg-brand',
                  )}
                />
              ))}
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-500">{t('passwordHint')}</span>
              <span className="font-bold text-slate-300">
                {t(strength.labelKey)}
              </span>
            </div>
          </div>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-300">
            {t('confirmPassword')}
          </span>
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

      <button
        type="button"
        onClick={submitPassword}
        className="button-primary mt-6 h-16 w-full rounded-[6px] text-base"
        disabled={isPending}
      >
        <PendingInlineLabel
          pending={isPending}
          label={t('setPasswordAction')}
          pendingLabel={t('setPasswordPending')}
        />
      </button>
      <a
        href={homeHref}
        className="hover:border-brand/40 mt-4 inline-flex w-full items-center justify-center rounded-[6px] border border-white/10 px-4 py-3 text-sm font-bold text-slate-300 transition hover:text-white"
      >
        {t('setPasswordBackHome')}
      </a>
    </div>
  );
}
