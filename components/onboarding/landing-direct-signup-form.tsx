'use client';

import { useMemo, useState, useTransition } from 'react';
import { Check, Mail, Plus, Trash2, UserRound } from 'lucide-react';

import { completeFounderOnboardingAction } from '@/app/[locale]/create-group/actions';
import { normalizeEmail } from '@/lib/utils';

type LandingDirectSignupLabels = {
  email: string;
  partnerEmail: string;
  addPartner: string;
  submit: string;
  pending: string;
  missingFields: string;
  accountExists: string;
  inviteExists: string;
  genericError: string;
  createdTitle: string;
  createdDescription: string;
  inviteCode: string;
  signInToContinue: string;
};

type LandingDirectSignupFormProps = {
  locale: string;
  labels: LandingDirectSignupLabels;
};

const MAX_PARTNERS = 5;
const DEFAULT_QUESTION_BANKS = [
  'cmc_prep',
  'aceqbank',
  'uworld',
  'canadaqbank',
  'amboss',
  'other',
];

function deriveDisplayName(email: string) {
  const localPart = email
    .split('@')[0]
    ?.replace(/[._-]+/g, ' ')
    .trim();
  if (!localPart) {
    return 'ActiveBoard Captain';
  }

  return localPart
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function resolveError(
  reason: string | undefined,
  labels: LandingDirectSignupLabels,
) {
  if (reason === 'account_exists') {
    return labels.accountExists;
  }

  if (reason === 'invite_exists') {
    return labels.inviteExists;
  }

  if (reason === 'missing_fields') {
    return labels.missingFields;
  }

  return labels.genericError;
}

export function LandingDirectSignupForm({
  locale,
  labels,
}: LandingDirectSignupFormProps) {
  const [email, setEmail] = useState('');
  const [partnerEmails, setPartnerEmails] = useState(['']);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [passwordSetupToken, setPasswordSetupToken] = useState('');
  const [isPending, startTransition] = useTransition();

  const normalizedFounderEmail = normalizeEmail(email);
  const normalizedPartnerEmails = useMemo(
    () =>
      [
        ...new Set(
          partnerEmails
            .map((partnerEmail) => normalizeEmail(partnerEmail))
            .filter(Boolean),
        ),
      ].filter((partnerEmail) => partnerEmail !== normalizedFounderEmail),
    [normalizedFounderEmail, partnerEmails],
  );
  const canAddPartner = partnerEmails.length < MAX_PARTNERS;
  const isValid =
    normalizedFounderEmail.includes('@') && normalizedPartnerEmails.length >= 1;

  function updatePartnerEmail(index: number, value: string) {
    setPartnerEmails((current) =>
      current.map((partnerEmail, currentIndex) =>
        currentIndex === index ? value : partnerEmail,
      ),
    );
  }

  function removePartnerEmail(index: number) {
    setPartnerEmails((current) =>
      current.length > 1
        ? current.filter((_, currentIndex) => currentIndex !== index)
        : current,
    );
  }

  function submitSignup() {
    if (!isValid) {
      setErrorMessage(labels.missingFields);
      return;
    }

    const displayName = deriveDisplayName(normalizedFounderEmail);
    const draft = {
      displayName,
      email: normalizedFounderEmail,
      examType: 'mccqe1',
      examSession: 'planning_ahead',
      locale: locale === 'fr' ? 'fr' : 'en',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      plan: 'starter',
      difficultyLevel: 'medium',
      questionBanks: DEFAULT_QUESTION_BANKS,
      schedule: [],
      groupName: `${displayName}'s Reliability Sprint`,
      memberEmails: normalizedPartnerEmails,
    };

    setErrorMessage(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('locale', locale);
      formData.set('draft', JSON.stringify(draft));

      const result = await completeFounderOnboardingAction(formData);
      if (!result.ok) {
        setErrorMessage(resolveError(result.reason, labels));
        return;
      }

      setCreatedGroupId(result.groupId);
      setInviteCode(result.inviteCode);
      setPasswordSetupToken(result.passwordSetupToken ?? '');
    });
  }

  if (createdGroupId) {
    const nextPath = `/${locale}/groups/${createdGroupId}`;
    const continuePath = passwordSetupToken
      ? `/${locale}/auth/set-password?token=${encodeURIComponent(
          passwordSetupToken,
        )}&next=${encodeURIComponent(nextPath)}`
      : `/${locale}/auth/login?next=${encodeURIComponent(nextPath)}`;
    return (
      <div className="border-brand/20 bg-brand/[0.08] rounded-[12px] border p-4 sm:p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-[#04110d]">
          <Check className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-xl font-extrabold text-white">
          {labels.createdTitle}
        </h2>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-300">
          {labels.createdDescription}
        </p>
        <div className="mt-4 rounded-[8px] border border-white/[0.08] bg-black/20 p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
            {labels.inviteCode}
          </p>
          <p className="mt-1 break-all text-2xl font-extrabold tracking-[0.18em] text-brand">
            {inviteCode}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.assign(continuePath)}
          className="button-primary mt-4 h-12 w-full rounded-[7px] text-base"
        >
          {labels.signInToContinue}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[420px]">
      <div className="space-y-[7px]">
        <label className="relative block">
          <UserRound
            className="pointer-events-none absolute left-[18px] top-1/2 h-5 w-5 -translate-y-1/2 text-brand"
            aria-hidden="true"
          />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-[43px] w-full rounded-[5px] border border-[#1c2d40] bg-[#020910]/70 pl-[54px] pr-4 text-[14px] font-medium text-white outline-none transition placeholder:text-[#c1c7cf] focus:border-brand focus:ring-2 focus:ring-emerald-400/20"
            placeholder={labels.email}
            autoComplete="email"
          />
        </label>

        <div className="space-y-[7px]">
          {partnerEmails.map((partnerEmail, index) => (
            <div key={index} className="flex items-center gap-2">
              <label className="relative block min-w-0 flex-1">
                <Mail
                  className="pointer-events-none absolute left-[18px] top-1/2 h-5 w-5 -translate-y-1/2 text-brand"
                  aria-hidden="true"
                />
                <input
                  type="email"
                  value={partnerEmail}
                  onChange={(event) =>
                    updatePartnerEmail(index, event.target.value)
                  }
                  className="h-[43px] w-full rounded-[5px] border border-[#1c2d40] bg-[#020910]/70 pl-[54px] pr-4 text-[14px] font-medium text-white outline-none transition placeholder:text-[#c1c7cf] focus:border-brand focus:ring-2 focus:ring-emerald-400/20"
                  placeholder={labels.partnerEmail}
                  autoComplete="email"
                />
              </label>
              {partnerEmails.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removePartnerEmail(index)}
                  className="flex h-[43px] w-10 shrink-0 items-center justify-center rounded-[5px] border border-[#1c2d40] text-slate-500 transition hover:border-rose-400/40 hover:text-rose-300"
                  aria-label="Remove partner"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ))}
        </div>

        {canAddPartner ? (
          <button
            type="button"
            onClick={() => setPartnerEmails((current) => [...current, ''])}
            className="hover:border-brand/50 flex h-[43px] w-full items-center gap-[18px] rounded-[5px] border border-[#1c2d40] bg-[#020910]/70 px-[18px] text-left text-[14px] font-medium text-[#c1c7cf] transition hover:text-white"
          >
            <Plus className="h-5 w-5 text-brand" aria-hidden="true" />
            {labels.addPartner}
          </button>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="mt-3 rounded-[7px] border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-200">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="button"
        data-landing-submit
        disabled={!isValid || isPending}
        onClick={submitSignup}
        className="mt-[10px] flex h-[47px] w-full items-center justify-center rounded-[5px] bg-brand text-[19px] font-bold tracking-[-0.02em] text-[#05110d] transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? labels.pending : labels.submit}
      </button>
    </div>
  );
}
