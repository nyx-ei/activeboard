'use client';

import { useMemo, useState, useTransition } from 'react';
import { Check, Lock, Mail, Plus, Trash2, UserRound } from 'lucide-react';

import { completeFounderOnboardingAction } from '@/app/[locale]/create-group/actions';
import { cn, normalizeEmail } from '@/lib/utils';

type DifficultyLevel = 'low' | 'medium' | 'high';

type LandingDirectSignupLabels = {
  email: string;
  password: string;
  passwordHint: string;
  partnerEmail: string;
  addPartner: string;
  difficultyTitle: string;
  difficultyLow: string;
  difficultyMedium: string;
  difficultyHigh: string;
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
  const [password, setPassword] = useState('');
  const [partnerEmails, setPartnerEmails] = useState(['']);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState('');
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
    normalizedFounderEmail.includes('@') &&
    password.trim().length >= 8 &&
    normalizedPartnerEmails.length >= 1;

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
      password,
      examType: 'mccqe1',
      examSession: 'planning_ahead',
      locale: locale === 'fr' ? 'fr' : 'en',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      plan: 'starter',
      difficultyLevel: difficulty,
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
    });
  }

  if (createdGroupId) {
    const nextPath = `/${locale}/groups/${createdGroupId}`;
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
          onClick={() =>
            window.location.assign(
              `/${locale}/auth/login?next=${encodeURIComponent(nextPath)}`,
            )
          }
          className="button-primary mt-4 h-12 w-full rounded-[7px] text-base"
        >
          {labels.signInToContinue}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[430px]">
      <div className="space-y-2">
        <label className="relative block">
          <UserRound
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand"
            aria-hidden="true"
          />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="field h-12 rounded-[7px] pl-11 text-sm"
            placeholder={labels.email}
            autoComplete="email"
          />
        </label>

        <label className="relative block">
          <Lock
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand"
            aria-hidden="true"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field h-12 rounded-[7px] pl-11 text-sm"
            placeholder={labels.password}
            autoComplete="new-password"
          />
        </label>
        <p className="px-1 text-xs font-medium text-slate-500">
          {labels.passwordHint}
        </p>

        <div className="space-y-2">
          {partnerEmails.map((partnerEmail, index) => (
            <div key={index} className="flex items-center gap-2">
              <label className="relative block min-w-0 flex-1">
                <Mail
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand"
                  aria-hidden="true"
                />
                <input
                  type="email"
                  value={partnerEmail}
                  onChange={(event) =>
                    updatePartnerEmail(index, event.target.value)
                  }
                  className="field h-12 rounded-[7px] pl-11 text-sm"
                  placeholder={labels.partnerEmail}
                  autoComplete="email"
                />
              </label>
              {partnerEmails.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removePartnerEmail(index)}
                  className="flex h-12 w-10 shrink-0 items-center justify-center rounded-[7px] border border-white/[0.08] text-slate-500 transition hover:border-rose-400/40 hover:text-rose-300"
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
            className="hover:border-brand/50 flex h-12 w-full items-center gap-3 rounded-[7px] border border-white/[0.08] bg-white/[0.02] px-4 text-left text-sm font-semibold text-slate-300 transition hover:text-white"
          >
            <Plus className="h-4 w-4 text-brand" aria-hidden="true" />
            {labels.addPartner}
          </button>
        ) : null}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          {labels.difficultyTitle}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['low', labels.difficultyLow],
              ['medium', labels.difficultyMedium],
              ['high', labels.difficultyHigh],
            ] as Array<[DifficultyLevel, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setDifficulty(value)}
              className={cn(
                'h-10 rounded-[7px] border text-xs font-extrabold transition',
                difficulty === value
                  ? 'border-brand bg-brand text-[#04110d]'
                  : 'hover:border-brand/50 border-white/[0.08] bg-white/[0.04] text-slate-300',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {errorMessage ? (
        <p className="mt-3 rounded-[7px] border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-200">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!isValid || isPending}
        onClick={submitSignup}
        className="button-primary mt-4 h-14 w-full rounded-[7px] text-base font-extrabold disabled:opacity-50"
      >
        {isPending ? labels.pending : labels.submit}
      </button>
    </div>
  );
}
