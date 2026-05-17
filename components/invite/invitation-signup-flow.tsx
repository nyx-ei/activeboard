'use client';

import { KeyRound, Lock, User } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';

import type { AppLocale } from '@/i18n/routing';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type InvitationSignupFlowProps = {
  invitationId: string;
  groupInviteId: string;
  lockedEmail: string;
  locale: AppLocale;
  labels: {
    title: string;
    description: string;
    socialTitle: string;
    socialSubtitle: string;
    lockedEmail: string;
    displayName: string;
    displayNamePlaceholder: string;
    password: string;
    passwordHint: string;
    createAccountAndJoin: string;
    creatingAccount: string;
    missingFields: string;
    accountExists: string;
    genericError: string;
    acceptError: string;
  };
};

type SignupResponse = {
  ok?: boolean;
  reason?: string;
};

type AcceptResponse = {
  accepted?: boolean;
  reason?: string;
  group?: {
    id?: string;
  };
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
  invitationId,
  groupInviteId,
  lockedEmail,
  locale,
  labels,
}: InvitationSignupFlowProps) {
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
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

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: lockedEmail,
      password,
    });

    if (signInError) {
      setMessage(labels.genericError);
      return;
    }

    const acceptResponse = await fetch(
      `/api/invitations/${invitationId}/accept`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      },
    );
    const acceptPayload = (await acceptResponse
      .json()
      .catch(() => null)) as AcceptResponse | null;

    if (
      !acceptResponse.ok ||
      !acceptPayload?.accepted ||
      !acceptPayload.group?.id
    ) {
      setMessage(acceptPayload?.reason ?? labels.acceptError);
      return;
    }

    window.location.assign(`/${locale}/groups/${acceptPayload.group.id}`);
  }

  return (
    <section className="surface-mockup p-6">
      <div className="border-brand/25 bg-brand/10 rounded-[16px] border p-4">
        <p className="text-sm font-bold leading-6 text-white">
          {labels.socialTitle}
        </p>
        <p className="mt-1 flex items-center gap-2 text-sm leading-6 text-slate-300">
          <Lock className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
          <span>{labels.socialSubtitle}</span>
        </p>
      </div>
      <h1 className="mt-4 text-2xl font-semibold text-white">{labels.title}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        {labels.description}
      </p>

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-300">
            {labels.lockedEmail}
          </span>
          <span className="flex h-11 items-center gap-3 rounded-[6px] border border-white/10 bg-slate-800/70 px-3 text-sm font-semibold text-slate-300">
            <Lock
              className="h-4 w-4 shrink-0 text-slate-500"
              aria-hidden="true"
            />
            <input
              type="email"
              value={lockedEmail}
              disabled
              aria-label={labels.lockedEmail}
              className="w-full cursor-not-allowed bg-transparent text-slate-300 outline-none disabled:opacity-100"
            />
          </span>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-300">
            {labels.displayName}
          </span>
          <span className="relative block">
            <User
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand"
              aria-hidden="true"
            />
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={labels.displayNamePlaceholder}
              className="field h-11 rounded-[6px] px-3 pl-10 text-sm"
            />
          </span>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-300">
            {labels.password}
          </span>
          <span className="relative block">
            <KeyRound
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand"
              aria-hidden="true"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field h-11 rounded-[6px] px-3 pl-10 text-sm"
            />
          </span>
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
          label={labels.createAccountAndJoin}
          pendingLabel={labels.creatingAccount}
        />
      </button>
    </section>
  );
}
