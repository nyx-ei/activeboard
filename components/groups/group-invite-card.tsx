'use client';

import { useEffect, useMemo, useState } from 'react';
import { Mail, RefreshCw, Send, UserPlus, X } from 'lucide-react';

import { Modal, ModalTitle } from '@/components/ui/modal';
import type { AppLocale } from '@/i18n/routing';

export type PendingDashboardInvitation = {
  id: string;
  invitedEmail: string;
  source?: 'onboarding' | 'dashboard' | 'on_the_fly';
  expiresAt: string;
  createdAt: string;
};

type GroupInviteCardLabels = {
  title: string;
  description: string;
  open: string;
  modalTitle: string;
  modalDescription: string;
  emailLabel: string;
  emailPlaceholder: string;
  send: string;
  sending: string;
  pendingTitle: string;
  pendingEmpty: string;
  resend: string;
  resending: string;
  success: string;
  resendSuccess: string;
  invalidEmail: string;
  inviteExists: string;
  alreadyMember: string;
  cannotInviteSelf: string;
  emailUnavailable: string;
  actionFailed: string;
};

type GroupInviteCardProps = {
  locale: AppLocale;
  groupId: string;
  initialPendingInvitations: PendingDashboardInvitation[];
  labels: GroupInviteCardLabels;
  openRequestKey?: number;
  onInvitationCreated?: (invitation: PendingDashboardInvitation) => void;
};

type InviteApiResponse = {
  created?: Array<{
    id: string;
    invited_email: string;
    expires_at: string;
    created_at: string;
  }>;
  errors?: Array<{
    email: string;
    reason: string;
  }>;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function getErrorMessage(reason: string, labels: GroupInviteCardLabels) {
  switch (reason) {
    case 'invalid_email':
      return labels.invalidEmail;
    case 'invite_exists':
      return labels.inviteExists;
    case 'already_member':
      return labels.alreadyMember;
    case 'cannot_invite_self':
      return labels.cannotInviteSelf;
    case 'email_unavailable':
    case 'email_failed':
      return labels.emailUnavailable;
    default:
      return labels.actionFailed;
  }
}

function formatExpiry(value: string, locale: AppLocale) {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function GroupInviteCard({
  locale,
  groupId,
  initialPendingInvitations,
  labels,
  openRequestKey = 0,
  onInvitationCreated,
}: GroupInviteCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [pendingInvitations, setPendingInvitations] = useState(
    initialPendingInvitations,
  );
  const [isSending, setIsSending] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const normalizedEmail = email.trim().toLowerCase();
  const canSubmit = EMAIL_PATTERN.test(normalizedEmail) && !isSending;
  const visiblePendingInvitations = useMemo(
    () =>
      pendingInvitations.filter(
        (invitation, index, list) =>
          list.findIndex((item) => item.id === invitation.id) === index,
      ),
    [pendingInvitations],
  );

  useEffect(() => {
    if (openRequestKey > 0) {
      setIsOpen(true);
    }
  }, [openRequestKey]);

  useEffect(() => {
    setPendingInvitations(initialPendingInvitations);
  }, [initialPendingInvitations]);

  async function sendInvite() {
    if (!canSubmit) {
      setInlineError(labels.invalidEmail);
      return;
    }

    setIsSending(true);
    setInlineError(null);

    try {
      const response = await fetch(`/api/groups/${groupId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: [normalizedEmail], locale }),
      });
      const payload = (await response
        .json()
        .catch(() => null)) as InviteApiResponse | null;
      const firstError = payload?.errors?.[0];
      const created = payload?.created?.[0];

      if (created) {
        const nextInvitation = {
          id: created.id,
          invitedEmail: created.invited_email,
          source: 'dashboard' as const,
          expiresAt: created.expires_at,
          createdAt: created.created_at,
        };

        setPendingInvitations((current) => [nextInvitation, ...current]);
        onInvitationCreated?.(nextInvitation);
      }

      if (!response.ok || firstError) {
        const message = getErrorMessage(
          firstError?.reason ?? 'action_failed',
          labels,
        );
        setInlineError(message);
        notify(message, 'error');
        return;
      }

      setEmail('');
      notify(labels.success, 'success');
    } catch {
      setInlineError(labels.actionFailed);
      notify(labels.actionFailed, 'error');
    } finally {
      setIsSending(false);
    }
  }

  async function resendInvite(invitation: PendingDashboardInvitation) {
    if (resendingId) {
      return;
    }

    setResendingId(invitation.id);
    setInlineError(null);

    try {
      const response = await fetch(`/api/groups/${groupId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resendInvitationId: invitation.id,
          locale,
        }),
      });
      const payload = (await response
        .json()
        .catch(() => null)) as InviteApiResponse | null;
      const firstError = payload?.errors?.[0];

      if (!response.ok || firstError) {
        const message = getErrorMessage(
          firstError?.reason ?? 'action_failed',
          labels,
        );
        setInlineError(message);
        notify(message, 'error');
        return;
      }

      notify(labels.resendSuccess, 'success');
    } catch {
      setInlineError(labels.actionFailed);
      notify(labels.actionFailed, 'error');
    } finally {
      setResendingId(null);
    }
  }

  return (
    <section className="surface-mockup p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="bg-brand/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-brand">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
            </span>
            <p className="text-sm font-bold text-white">{labels.title}</p>
          </div>
          <p className="mt-2 text-sm leading-5 text-slate-400">
            {labels.description}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="button-primary h-10 shrink-0 rounded-[7px] px-4 text-sm"
        >
          {labels.open}
        </button>
      </div>

      {visiblePendingInvitations.length > 0 ? (
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            {labels.pendingTitle}
          </p>
          <div className="mt-3 space-y-2">
            {visiblePendingInvitations.slice(0, 3).map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between gap-3 rounded-[10px] bg-white/[0.035] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {invitation.invitedEmail}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatExpiry(invitation.expiresAt, locale)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => resendInvite(invitation)}
                  className="hover:border-brand/50 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[7px] border border-white/[0.08] px-2.5 text-xs font-bold text-slate-200 transition hover:text-brand disabled:cursor-wait disabled:opacity-60"
                  disabled={resendingId === invitation.id}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${
                      resendingId === invitation.id ? 'animate-spin' : ''
                    }`}
                    aria-hidden="true"
                  />
                  {resendingId === invitation.id
                    ? labels.resending
                    : labels.resend}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {isOpen ? (
        <Modal
          open
          onClose={() => setIsOpen(false)}
          labelledBy="group-invite-title"
          contentClassName="w-full rounded-t-[18px] border border-white/[0.08] bg-[#080d19] shadow-2xl sm:max-w-[520px] sm:rounded-[18px]"
        >
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="bg-brand/10 flex h-9 w-9 items-center justify-center rounded-[10px] text-brand">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                </span>
                <ModalTitle
                  id="group-invite-title"
                  className="mt-4 text-xl font-bold text-white"
                >
                  {labels.modalTitle}
                </ModalTitle>
                <p className="mt-2 text-sm leading-5 text-slate-400">
                  {labels.modalDescription}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
                aria-label={labels.modalTitle}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-semibold text-slate-300">
                {labels.emailLabel}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void sendInvite();
                    }
                  }}
                  placeholder={labels.emailPlaceholder}
                  autoComplete="email"
                  className="field h-11 min-w-0 flex-1 rounded-[8px] px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void sendInvite()}
                  disabled={!canSubmit}
                  className="button-primary h-11 shrink-0 rounded-[8px] px-4 text-sm disabled:bg-white/[0.08] disabled:text-slate-500 disabled:hover:bg-white/[0.08]"
                >
                  <span className="inline-flex items-center gap-2">
                    <Send className="h-4 w-4" aria-hidden="true" />
                    {isSending ? labels.sending : labels.send}
                  </span>
                </button>
              </div>
            </label>

            {inlineError ? (
              <p className="mt-3 rounded-[8px] border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm font-semibold text-red-200">
                {inlineError}
              </p>
            ) : null}

            <div className="mt-6 border-t border-white/[0.08] pt-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                {labels.pendingTitle}
              </p>
              <div className="mt-3 space-y-2">
                {visiblePendingInvitations.length > 0 ? (
                  visiblePendingInvitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between gap-3 rounded-[10px] bg-white/[0.035] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {invitation.invitedEmail}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatExpiry(invitation.expiresAt, locale)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => resendInvite(invitation)}
                        className="hover:border-brand/50 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[7px] border border-white/[0.08] px-2.5 text-xs font-bold text-slate-200 transition hover:text-brand disabled:cursor-wait disabled:opacity-60"
                        disabled={resendingId === invitation.id}
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${
                            resendingId === invitation.id ? 'animate-spin' : ''
                          }`}
                          aria-hidden="true"
                        />
                        {resendingId === invitation.id
                          ? labels.resending
                          : labels.resend}
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">
                    {labels.pendingEmpty}
                  </p>
                )}
              </div>
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
