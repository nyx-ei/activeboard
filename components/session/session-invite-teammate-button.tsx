'use client';

import { Mail, UserPlus, X } from 'lucide-react';
import { FormEvent, useId, useRef, useState } from 'react';

import { Modal, ModalTitle } from '@/components/ui/modal';

type InviteStatus = 'idle' | 'sending' | 'success' | 'error';

export type SessionInviteTeammateLabels = {
  button: string;
  title: string;
  description: string;
  email: string;
  emailPlaceholder: string;
  send: string;
  sending: string;
  cancel: string;
  close: string;
  success: string;
  successEmailWarning: string;
  invalidEmail: string;
  cannotInviteSelf: string;
  alreadyMember: string;
  groupFull: string;
  reviewInProgress: string;
  inviteExists: string;
  sessionNotActive: string;
  notAuthorized: string;
  genericError: string;
};

type SessionInviteTeammateButtonProps = {
  locale: string;
  sessionId: string;
  labels: SessionInviteTeammateLabels;
  disabledReason?: string | null;
};

function getErrorMessage(
  reason: string | undefined,
  labels: SessionInviteTeammateLabels,
) {
  switch (reason) {
    case 'invalid_email':
      return labels.invalidEmail;
    case 'cannot_invite_self':
      return labels.cannotInviteSelf;
    case 'already_member':
      return labels.alreadyMember;
    case 'group_full':
      return labels.groupFull;
    case 'invite_exists':
      return labels.inviteExists;
    case 'session_not_active':
      return labels.sessionNotActive;
    case 'not_authorized':
    case 'unauthorized':
      return labels.notAuthorized;
    default:
      return labels.genericError;
  }
}

export function SessionInviteTeammateButton({
  locale,
  sessionId,
  labels,
  disabledReason = null,
}: SessionInviteTeammateButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<InviteStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const inviteeEmail = email.trim();
    if (!inviteeEmail) {
      setStatus('error');
      setMessage(labels.invalidEmail);
      return;
    }

    setStatus('sending');
    setMessage(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({
          email: inviteeEmail,
          locale,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        reason?: string;
        alreadyMember?: boolean;
        emailDeliveryFailed?: boolean;
      } | null;

      if (!response.ok || payload?.ok === false) {
        setStatus('error');
        setMessage(getErrorMessage(payload?.reason, labels));
        return;
      }

      setStatus('success');
      setEmail('');
      setMessage(
        payload?.alreadyMember
          ? labels.alreadyMember
          : payload?.emailDeliveryFailed
            ? labels.successEmailWarning
            : labels.success,
      );
    } catch {
      setStatus('error');
      setMessage(labels.genericError);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (disabledReason) {
            return;
          }

          setIsOpen(true);
          setStatus('idle');
          setMessage(null);
        }}
        disabled={Boolean(disabledReason)}
        className={
          disabledReason
            ? 'inline-flex h-9 w-9 shrink-0 cursor-not-allowed items-center justify-center rounded-[8px] border border-white/[0.08] bg-white/[0.025] text-slate-600 opacity-70'
            : 'hover:border-brand/40 focus:ring-brand/50 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-white/[0.08] bg-white/[0.04] text-slate-300 transition hover:text-brand focus:outline-none focus:ring-2'
        }
        aria-label={disabledReason ?? labels.button}
        title={disabledReason ?? labels.button}
      >
        <UserPlus className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
      </button>

      {isOpen ? (
        <Modal
          open={isOpen}
          onClose={() => setIsOpen(false)}
          labelledBy={titleId}
          describedBy={descriptionId}
          initialFocusRef={inputRef}
          contentClassName="w-full max-w-[420px] rounded-t-[16px] border border-white/[0.08] bg-[#101827] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:rounded-[14px]"
          backdropLabel={labels.close}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <ModalTitle
                id={titleId}
                className="text-lg font-extrabold text-white"
              >
                {labels.title}
              </ModalTitle>
              <p
                id={descriptionId}
                className="mt-2 text-sm leading-6 text-slate-400"
              >
                {labels.description}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
              aria-label={labels.close}
            >
              <X className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                {labels.email}
              </span>
              <span className="focus-within:border-brand/50 mt-2 flex h-12 items-center gap-3 rounded-[8px] border border-white/[0.08] bg-[#0b1220] px-3">
                <Mail
                  className="h-4 w-4 shrink-0 text-brand"
                  aria-hidden="true"
                />
                <input
                  ref={inputRef}
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (status !== 'sending') {
                      setStatus('idle');
                      setMessage(null);
                    }
                  }}
                  placeholder={labels.emailPlaceholder}
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-600"
                  disabled={status === 'sending'}
                  required
                />
              </span>
            </label>

            {message ? (
              <p
                className={
                  status === 'success'
                    ? 'border-brand/20 bg-brand/10 rounded-[8px] border px-3 py-2 text-sm font-semibold text-brand'
                    : 'rounded-[8px] border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300'
                }
                aria-live="polite"
              >
                {message}
              </p>
            ) : null}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="button-secondary h-11 flex-1 rounded-[8px] text-sm font-extrabold"
                disabled={status === 'sending'}
              >
                {labels.cancel}
              </button>
              <button
                type="submit"
                className="button-primary h-11 flex-1 rounded-[8px] text-sm font-extrabold"
                disabled={status === 'sending'}
              >
                {status === 'sending' ? labels.sending : labels.send}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
