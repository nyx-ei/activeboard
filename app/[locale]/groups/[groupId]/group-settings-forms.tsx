'use client';

import { useMemo, useState } from 'react';

import { SubmitButton } from '@/components/ui/submit-button';

type ServerAction = (formData: FormData) => void | Promise<void>;

type GroupNameFormProps = {
  action: ServerAction;
  locale: string;
  groupId: string;
  initialName: string;
  label: string;
  placeholder: string;
  pendingLabel: string;
  submitLabel: string;
};

type InviteMemberFormProps = {
  action: ServerAction;
  locale: string;
  groupId: string;
  label: string;
  emailLabel: string;
  emailPlaceholder: string;
  pendingLabel: string;
  submitLabel: string;
};

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M6.5 12.5l3.2 3.2l7.8-8.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M21 4 10 15M21 4l-7 16l-4-8l-8-4l19-4Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function GroupNameForm({
  action,
  locale,
  groupId,
  initialName,
  label,
  placeholder,
  pendingLabel,
  submitLabel,
}: GroupNameFormProps) {
  const [groupName, setGroupName] = useState(initialName);
  const isChanged = useMemo(() => groupName.trim() !== initialName.trim() && groupName.trim().length > 0, [groupName, initialName]);

  return (
    <form action={action}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="groupId" value={groupId} />
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-300">{label}</span>
        <div className="flex items-center gap-3">
          <input
            name="groupName"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            className="field"
          />
          <SubmitButton
            pendingLabel={pendingLabel}
            disabled={!isChanged}
            className="button-primary min-w-[52px] px-4 text-white disabled:bg-white/[0.08] disabled:text-slate-500 disabled:hover:bg-white/[0.08]"
          >
            <span aria-label={submitLabel}>
              <CheckIcon />
            </span>
          </SubmitButton>
        </div>
      </label>
    </form>
  );
}

export function InviteMemberForm({
  action,
  locale,
  groupId,
  label,
  emailLabel,
  emailPlaceholder,
  pendingLabel,
  submitLabel,
}: InviteMemberFormProps) {
  const [email, setEmail] = useState('');
  const isValid = email.trim().length > 0;

  return (
    <>
      <h2 className="text-xl font-bold text-white">{label}</h2>
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="groupId" value={groupId} />
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">{emailLabel}</span>
          <div className="flex items-center gap-3">
            <input
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={emailPlaceholder}
              autoComplete="email"
              className="field"
            />
            <SubmitButton
              pendingLabel={pendingLabel}
              disabled={!isValid}
              className="button-primary min-w-[52px] px-4 text-white disabled:bg-white/[0.08] disabled:text-slate-500 disabled:hover:bg-white/[0.08]"
            >
              <span aria-label={submitLabel}>
                <SendIcon />
              </span>
            </SubmitButton>
          </div>
        </label>
      </form>
    </>
  );
}
