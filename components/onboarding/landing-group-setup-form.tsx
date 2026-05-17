'use client';

import { useState, useTransition } from 'react';
import { Mail, Plus, UsersRound } from 'lucide-react';
import { useLocale } from 'next-intl';

import { completeLandingGroupSetupAction } from '@/app/[locale]/auth/group-setup/actions';
import type { AppLocale } from '@/i18n/routing';
import { normalizeEmail } from '@/lib/utils';

type LandingGroupSetupLabels = {
  title: string;
  subtitle: string;
  groupName: string;
  groupNamePlaceholder: string;
  targetExam: string;
  studyLanguage: string;
  teammateEmail: string;
  teammateEmailPlaceholder: string;
  addTeammate: string;
  continue: string;
  skip: string;
  pending: string;
  missingFields: string;
  invalidEmail: string;
  cannotInviteSelf: string;
  inviteExists: string;
  genericError: string;
  emailWarning: string;
  examAprilMay2026: string;
  examAugustSeptember2026: string;
  examOctober2026: string;
  examPlanningAhead: string;
  languageEnglish: string;
  languageFrench: string;
};

type LandingGroupSetupFormProps = {
  token: string;
  founderEmail: string;
  initialGroupName: string;
  initialExamSession: string;
  initialStudyLanguage: AppLocale;
  labels: LandingGroupSetupLabels;
};

const MAX_TEAMMATES = 4;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function resolveError(
  reason: string | undefined,
  labels: LandingGroupSetupLabels,
) {
  if (reason === 'missing_fields') return labels.missingFields;
  if (reason === 'invalid_email') return labels.invalidEmail;
  if (reason === 'cannot_invite_self') return labels.cannotInviteSelf;
  if (reason === 'invite_exists') return labels.inviteExists;
  return labels.genericError;
}

export function LandingGroupSetupForm({
  token,
  founderEmail,
  initialGroupName,
  initialExamSession,
  initialStudyLanguage,
  labels,
}: LandingGroupSetupFormProps) {
  const locale = useLocale() as AppLocale;
  const [groupName, setGroupName] = useState(initialGroupName);
  const [examSession, setExamSession] = useState(
    initialExamSession || 'planning_ahead',
  );
  const [studyLanguage, setStudyLanguage] =
    useState<AppLocale>(initialStudyLanguage);
  const [teammateEmails, setTeammateEmails] = useState(['']);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'error' | 'warning'>('error');
  const [isPending, startTransition] = useTransition();

  function buildFormData(skipInvites: boolean) {
    const formData = new FormData();
    formData.set('token', token);
    formData.set('groupName', groupName.trim());
    formData.set('examSession', examSession);
    formData.set('studyLanguage', studyLanguage);
    formData.set('skipInvites', String(skipInvites));
    teammateEmails.forEach((email, index) => {
      formData.set(`teammateEmail${index}`, normalizeEmail(email));
    });
    return formData;
  }

  function validate(skipInvites: boolean) {
    if (!groupName.trim() || !examSession || !studyLanguage) {
      return labels.missingFields;
    }

    if (skipInvites) {
      return null;
    }

    const normalizedFounderEmail = normalizeEmail(founderEmail);
    const emails = teammateEmails.map(normalizeEmail).filter(Boolean);

    for (const email of emails) {
      if (!EMAIL_PATTERN.test(email)) {
        return labels.invalidEmail;
      }

      if (email === normalizedFounderEmail) {
        return labels.cannotInviteSelf;
      }
    }

    return null;
  }

  function submit(skipInvites: boolean) {
    const validationError = validate(skipInvites);
    if (validationError) {
      setMessageTone('error');
      setMessage(validationError);
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await completeLandingGroupSetupAction(
        buildFormData(skipInvites),
      );

      if (!result.ok) {
        setMessageTone('error');
        setMessage(resolveError(result.reason, labels));
        return;
      }

      if (result.emailWarning) {
        setMessageTone('warning');
        setMessage(labels.emailWarning);
      }

      window.location.assign(
        `/${locale}/auth/login?next=${encodeURIComponent(
          `/${locale}/groups/${result.groupId}`,
        )}`,
      );
    });
  }

  return (
    <div className="w-full max-w-[520px] rounded-[18px] border border-white/10 bg-[#06111d]/80 p-5 shadow-2xl shadow-black/30 sm:p-7">
      <div className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-brand text-[#06110d]">
        <UsersRound className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="mt-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          {labels.title}
        </h1>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-400">
          {labels.subtitle}
        </p>
      </div>

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-300">
            {labels.groupName}
          </span>
          <input
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder={labels.groupNamePlaceholder}
            className="field h-11 rounded-[7px] px-3 text-sm"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-300">
              {labels.targetExam}
            </span>
            <select
              value={examSession}
              onChange={(event) => setExamSession(event.target.value)}
              className="field h-11 rounded-[7px] px-3 text-sm"
            >
              <option value="april_may_2026">{labels.examAprilMay2026}</option>
              <option value="august_september_2026">
                {labels.examAugustSeptember2026}
              </option>
              <option value="october_2026">{labels.examOctober2026}</option>
              <option value="planning_ahead">{labels.examPlanningAhead}</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-300">
              {labels.studyLanguage}
            </span>
            <select
              value={studyLanguage}
              onChange={(event) =>
                setStudyLanguage(event.target.value === 'fr' ? 'fr' : 'en')
              }
              className="field h-11 rounded-[7px] px-3 text-sm"
            >
              <option value="en">{labels.languageEnglish}</option>
              <option value="fr">{labels.languageFrench}</option>
            </select>
          </label>
        </div>

        <div className="space-y-3">
          <span className="block text-sm font-bold text-slate-300">
            {labels.teammateEmail}
          </span>
          {teammateEmails.map((email, index) => (
            <label key={index} className="relative block">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand"
                aria-hidden="true"
              />
              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setTeammateEmails((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? event.target.value : item,
                    ),
                  )
                }
                placeholder={labels.teammateEmailPlaceholder}
                className="field h-11 rounded-[7px] pl-10 pr-3 text-sm"
              />
            </label>
          ))}
          {teammateEmails.length < MAX_TEAMMATES ? (
            <button
              type="button"
              onClick={() => setTeammateEmails((current) => [...current, ''])}
              className="hover:border-brand/40 inline-flex items-center gap-2 rounded-[7px] border border-white/10 px-3 py-2 text-sm font-bold text-brand transition"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {labels.addTeammate}
            </button>
          ) : null}
        </div>
      </div>

      {message ? (
        <p
          className={`mt-4 rounded-[10px] border px-3 py-2 text-sm font-semibold ${
            messageTone === 'warning'
              ? 'border-amber-300/20 bg-amber-300/10 text-amber-100'
              : 'border-rose-400/20 bg-rose-400/10 text-rose-200'
          }`}
        >
          {message}
        </p>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
        <button
          type="button"
          disabled={isPending}
          onClick={() => submit(false)}
          className="button-primary h-12 rounded-[7px] text-base"
        >
          {isPending ? labels.pending : labels.continue}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => submit(true)}
          className="hover:border-brand/40 h-12 rounded-[7px] border border-white/10 px-5 text-sm font-bold text-slate-300 transition hover:text-white disabled:opacity-60"
        >
          {labels.skip}
        </button>
      </div>
    </div>
  );
}
