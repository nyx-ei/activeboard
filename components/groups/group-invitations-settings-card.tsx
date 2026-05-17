'use client';

import { useMemo, useState } from 'react';
import { Mail, RefreshCw, ShieldX } from 'lucide-react';

import type { AppLocale } from '@/i18n/routing';

export type ManagedPendingInvitation = {
  id: string;
  invitedEmail: string;
  source?: 'onboarding' | 'dashboard' | 'on_the_fly';
  expiresAt: string;
  createdAt: string;
};

type InvitationSettingsLabels = {
  title: string;
  description: string;
  empty: string;
  sourceOnboarding: string;
  sourceDashboard: string;
  sourceOnTheFly: string;
  expiresIn: string;
  expired: string;
  resend: string;
  resending: string;
  revoke: string;
  revoking: string;
  resendSuccess: string;
  revokeSuccess: string;
  actionFailed: string;
  emailUnavailable: string;
};

type GroupInvitationsSettingsCardProps = {
  locale: AppLocale;
  invitations: ManagedPendingInvitation[];
  labels: InvitationSettingsLabels;
  onInvitationRevoked?: (invitationId: string) => void;
};

type InvitationActionResponse = {
  ok?: boolean;
  reason?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function notify(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(
    new CustomEvent('activeboard:feedback', {
      detail: {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        message,
        tone,
      },
    }),
  );
}

function getSourceLabel(
  source: ManagedPendingInvitation['source'],
  labels: InvitationSettingsLabels,
) {
  if (source === 'onboarding') return labels.sourceOnboarding;
  if (source === 'on_the_fly') return labels.sourceOnTheFly;
  return labels.sourceDashboard;
}

function getRemainingDays(expiresAt: string) {
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(remainingMs / DAY_MS);
}

function getExpiryLabel(
  expiresAt: string,
  labels: InvitationSettingsLabels,
  locale: AppLocale,
) {
  const days = getRemainingDays(expiresAt);
  if (days <= 0) {
    return labels.expired;
  }

  const relative = new Intl.RelativeTimeFormat(locale, {
    numeric: 'auto',
  }).format(days, 'day');

  return labels.expiresIn.replace('{value}', relative);
}

function getErrorMessage(
  reason: string | undefined,
  labels: InvitationSettingsLabels,
) {
  if (reason === 'email_unavailable' || reason === 'email_failed') {
    return labels.emailUnavailable;
  }

  return labels.actionFailed;
}

export function GroupInvitationsSettingsCard({
  locale,
  invitations,
  labels,
  onInvitationRevoked,
}: GroupInvitationsSettingsCardProps) {
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    action: 'resend' | 'revoke';
  } | null>(null);
  const sortedInvitations = useMemo(
    () =>
      [...invitations].sort(
        (a, b) =>
          new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
      ),
    [invitations],
  );

  async function runAction(
    invitation: ManagedPendingInvitation,
    action: 'resend' | 'revoke',
  ) {
    if (pendingAction) {
      return;
    }

    setPendingAction({ id: invitation.id, action });

    try {
      const response = await fetch(`/api/invitations/${invitation.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, locale }),
      });
      const payload = (await response
        .json()
        .catch(() => null)) as InvitationActionResponse | null;

      if (!response.ok || !payload?.ok) {
        notify(getErrorMessage(payload?.reason, labels), 'error');
        return;
      }

      if (action === 'revoke') {
        onInvitationRevoked?.(invitation.id);
        notify(labels.revokeSuccess, 'success');
        return;
      }

      notify(labels.resendSuccess, 'success');
    } catch {
      notify(labels.actionFailed, 'error');
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="surface-mockup p-5">
      <div className="flex items-start gap-3">
        <span className="bg-brand/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-brand">
          <Mail className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">{labels.title}</p>
          <p className="mt-1 text-sm leading-5 text-slate-400">
            {labels.description}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {sortedInvitations.length > 0 ? (
          sortedInvitations.map((invitation) => {
            const isResending =
              pendingAction?.id === invitation.id &&
              pendingAction.action === 'resend';
            const isRevoking =
              pendingAction?.id === invitation.id &&
              pendingAction.action === 'revoke';

            return (
              <div
                key={invitation.id}
                className="rounded-[12px] bg-white/[0.035] p-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">
                      {invitation.invitedEmail}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                      <span className="rounded-full border border-white/[0.08] px-2 py-1 text-slate-300">
                        {getSourceLabel(invitation.source, labels)}
                      </span>
                      <span className="bg-brand/10 rounded-full px-2 py-1 text-brand">
                        {getExpiryLabel(invitation.expiresAt, labels, locale)}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void runAction(invitation, 'resend')}
                      disabled={Boolean(pendingAction)}
                      className="hover:border-brand/50 inline-flex h-9 items-center gap-1.5 rounded-[7px] border border-white/[0.08] px-3 text-xs font-bold text-slate-200 transition hover:text-brand disabled:cursor-wait disabled:opacity-60"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${
                          isResending ? 'animate-spin' : ''
                        }`}
                        aria-hidden="true"
                      />
                      {isResending ? labels.resending : labels.resend}
                    </button>
                    <button
                      type="button"
                      onClick={() => void runAction(invitation, 'revoke')}
                      disabled={Boolean(pendingAction)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-[7px] border border-red-300/20 px-3 text-xs font-bold text-red-200 transition hover:border-red-300/45 hover:bg-red-400/10 disabled:cursor-wait disabled:opacity-60"
                    >
                      <ShieldX className="h-3.5 w-3.5" aria-hidden="true" />
                      {isRevoking ? labels.revoking : labels.revoke}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-slate-400">{labels.empty}</p>
        )}
      </div>
    </section>
  );
}
