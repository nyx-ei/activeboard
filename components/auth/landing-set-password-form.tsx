'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { setupLandingPasswordAction } from '@/app/[locale]/auth/set-password/actions';
import type { AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

type LandingSetPasswordFormProps = {
  email: string;
  homeHref: string;
  token: string;
  nextPath: string;
};

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
  email,
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

    if (reason === 'account_exists') {
      return t('accountExists');
    }

    return t('unexpectedError');
  }

  function submitPassword() {
    setMessage(null);
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
        const resolvedNextPath = result.groupId
          ? `/${locale}/groups/${result.groupId}`
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
        <div className="mt-4 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            {t('setPasswordEmailLabel')}
          </p>
          <p className="mt-1 break-all text-sm font-bold text-white">
            {email}
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-4">
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
          <span className="mt-1 block text-xs text-slate-500">
            {t('passwordHint')}
          </span>
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
        className="mt-4 inline-flex w-full items-center justify-center rounded-[6px] border border-white/10 px-4 py-3 text-sm font-bold text-slate-300 transition hover:border-brand/40 hover:text-white"
      >
        {t('setPasswordBackHome')}
      </a>
    </div>
  );
}
