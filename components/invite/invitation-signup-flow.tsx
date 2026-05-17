'use client';

import { useMemo, useState, useTransition } from 'react';

import { AuthForm } from '@/components/auth/auth-form';
import type { AppLocale } from '@/i18n/routing';

type InvitationSignupFlowProps = {
  groupInviteId: string;
  invitationPath: string;
  lockedEmail: string;
  locale: AppLocale;
  groupName: string;
  labels: {
    title: string;
    description: string;
    lockedEmail: string;
    displayName: string;
    displayNamePlaceholder: string;
    password: string;
    confirmPassword: string;
    passwordHint: string;
    createAccount: string;
    creatingAccount: string;
    signInTitle: string;
    signInDescription: string;
    missingFields: string;
    passwordMismatch: string;
    accountExists: string;
    genericError: string;
  };
};

type SignupResponse = {
  ok?: boolean;
  reason?: string;
};

function PendingLabel({
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
      <span className={pending ? 'text-transparent' : undefined}>{label}</span>
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

export function InvitationSignupFlow({
  groupInviteId,
  invitationPath,
  lockedEmail,
  locale,
  groupName,
  labels,
}: InvitationSignupFlowProps) {
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [step, setStep] = useState<'create' | 'sign-in'>('create');
  const [isPending, startTransition] = useTransition();
  const passwordStrength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  }, [password]);

  async function createAccount() {
    setMessage(null);
    const name = displayName.trim();

    if (!name || password.length < 8) {
      setMessage(labels.missingFields);
      return;
    }

    if (password !== confirmPassword) {
      setMessage(labels.passwordMismatch);
      return;
    }

    const response = await fetch('/api/invite-auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inviteId: groupInviteId,
        email: lockedEmail,
        password,
        displayName: name,
        locale,
      }),
    });
    const payload = (await response
      .json()
      .catch(() => null)) as SignupResponse | null;

    if (!response.ok || !payload?.ok) {
      setMessage(
        payload?.reason === 'account_exists'
          ? labels.accountExists
          : labels.genericError,
      );
      return;
    }

    setStep('sign-in');
  }

  if (step === 'sign-in') {
    return (
      <section className="surface-mockup p-6">
        <div className="border-brand/20 bg-brand/10 mb-5 rounded-[14px] border p-4">
          <h2 className="text-lg font-semibold text-white">
            {labels.signInTitle}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {labels.signInDescription}
          </p>
        </div>
        <AuthForm
          initialMode="sign-in"
          initialEmail={lockedEmail}
          redirectToOverride={invitationPath}
          lockedEmail={lockedEmail}
          variant="modal"
        />
      </section>
    );
  }

  return (
    <section className="surface-mockup p-6">
      <span className="border-brand/25 bg-brand/10 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
        {groupName}
      </span>
      <h1 className="mt-4 text-2xl font-semibold text-white">{labels.title}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        {labels.description}
      </p>

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-300">
            {labels.lockedEmail}
          </span>
          <input
            type="email"
            value={lockedEmail}
            disabled
            className="field h-11 rounded-[6px] px-3 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-300">
            {labels.displayName}
          </span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder={labels.displayNamePlaceholder}
            className="field h-11 rounded-[6px] px-3 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-300">
            {labels.password}
          </span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field h-11 rounded-[6px] px-3 text-sm"
          />
          <div className="mt-2 grid grid-cols-3 gap-2" aria-hidden="true">
            {[1, 2, 3].map((level) => (
              <span
                key={level}
                className={`h-1.5 rounded-full ${
                  passwordStrength >= level ? 'bg-brand' : 'bg-white/10'
                }`}
              />
            ))}
          </div>
          <span className="mt-1 block text-xs text-slate-500">
            {labels.passwordHint}
          </span>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-300">
            {labels.confirmPassword}
          </span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="field h-11 rounded-[6px] px-3 text-sm"
          />
        </label>
      </div>

      {message ? (
        <div className="mt-4 rounded-[14px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {message}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => startTransition(createAccount)}
        className="button-primary mt-6 h-14 w-full rounded-[6px] text-base"
        disabled={isPending}
      >
        <PendingLabel
          pending={isPending}
          label={labels.createAccount}
          pendingLabel={labels.creatingAccount}
        />
      </button>
    </section>
  );
}
