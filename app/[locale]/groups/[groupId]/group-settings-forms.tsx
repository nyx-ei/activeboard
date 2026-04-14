'use client';

import { Check, Link as LinkIcon, Send } from 'lucide-react';
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
  compact?: boolean;
};

type GroupMeetingLinkFormProps = {
  action: ServerAction;
  locale: string;
  groupId: string;
  initialMeetingLink: string;
  label: string;
  placeholder: string;
  warning: string;
  pendingLabel: string;
  submitLabel: string;
};

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
              <Check className="h-4 w-4" aria-hidden="true" />
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
  compact = false,
}: InviteMemberFormProps) {
  const [email, setEmail] = useState('');
  const isValid = email.trim().length > 0;

  return (
    <>
      <h2 className={compact ? 'text-sm font-semibold text-slate-400' : 'text-xl font-bold text-white'}>{label}</h2>
      <form action={action} className={compact ? 'mt-2 space-y-2' : 'mt-4 space-y-3'}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="groupId" value={groupId} />
        <label className="block">
          <span className={compact ? 'sr-only' : 'mb-2 block text-sm font-medium text-slate-300'}>{emailLabel}</span>
          <div className="flex items-center gap-3">
            <input
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={emailPlaceholder}
              autoComplete="email"
              className={compact ? 'field h-10 rounded-[7px] px-3 py-2 text-sm' : 'field'}
            />
            <SubmitButton
              pendingLabel={pendingLabel}
              disabled={!isValid}
              className="button-primary min-w-[44px] px-4 text-white disabled:bg-white/[0.08] disabled:text-slate-500 disabled:hover:bg-white/[0.08]"
            >
              <span aria-label={submitLabel}>
                <Send className="h-4 w-4" aria-hidden="true" />
              </span>
            </SubmitButton>
          </div>
        </label>
      </form>
    </>
  );
}

function isValidMeetingLink(value: string) {
  if (!value.trim()) return false;

  try {
    const url = new URL(value.trim());
    return (
      url.protocol === 'https:' &&
      (url.hostname.includes('zoom.us') || url.hostname.includes('meet.google.com') || url.hostname.includes('teams.microsoft.com'))
    );
  } catch {
    return false;
  }
}

export function GroupMeetingLinkForm({
  action,
  locale,
  groupId,
  initialMeetingLink,
  label,
  placeholder,
  warning,
  pendingLabel,
  submitLabel,
}: GroupMeetingLinkFormProps) {
  const [meetingLink, setMeetingLink] = useState(initialMeetingLink);
  const isValid = isValidMeetingLink(meetingLink);
  const isChanged = meetingLink.trim() !== initialMeetingLink.trim();

  return (
    <form action={action} className="border-t border-white/[0.06] pt-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="groupId" value={groupId} />
      <label className="block">
        <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-400">
          <LinkIcon className="h-4 w-4 text-slate-500" aria-hidden="true" />
          {label}
        </span>
        <div className="flex items-center gap-3">
          <input
            name="meetingLink"
            type="url"
            value={meetingLink}
            onChange={(event) => setMeetingLink(event.target.value)}
            placeholder={placeholder}
            autoComplete="url"
            className="field h-10 rounded-[7px] px-3 py-2 text-sm"
            required
          />
          <SubmitButton
            pendingLabel={pendingLabel}
            disabled={!isValid || !isChanged}
            className="button-primary min-w-[44px] px-4 text-white disabled:bg-white/[0.08] disabled:text-slate-500 disabled:hover:bg-white/[0.08]"
          >
            <span aria-label={submitLabel}>
              <Check className="h-4 w-4" aria-hidden="true" />
            </span>
          </SubmitButton>
        </div>
      </label>
      {!isValid ? <p className="mt-2 text-xs font-semibold text-amber-400">{warning}</p> : null}
    </form>
  );
}
