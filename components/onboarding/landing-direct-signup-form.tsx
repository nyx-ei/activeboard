'use client';

import { useEffect, useState, useTransition } from 'react';
import { Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { startLandingOnboardingAction } from '@/app/[locale]/landing-onboarding/actions';
import { normalizeEmail } from '@/lib/utils';

type LandingDirectSignupLabels = {
  email: string;
  submit: string;
  pending: string;
  missingFields: string;
  accountExists: string;
  inviteExists: string;
  genericError: string;
};

type LandingDirectSignupFormProps = {
  locale: string;
  labels: LandingDirectSignupLabels;
};

const DEFAULT_QUESTION_BANKS = [
  'cmc_prep',
  'aceqbank',
  'uworld',
  'canadaqbank',
  'amboss',
  'other',
];

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

function deriveDisplayNameFromEmail(email: string) {
  const localPart = email.split('@')[0] ?? 'ActiveBoard';
  const readableName = localPart
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!readableName) {
    return 'ActiveBoard';
  }

  return readableName
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function LandingDirectSignupForm({
  locale,
  labels,
}: LandingDirectSignupFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const normalizedFounderEmail = normalizeEmail(email);
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedFounderEmail);
  const isSubmitting = isPending || isNavigating;

  useEffect(() => {
    router.prefetch(`/${locale}/auth/set-password`);
  }, [locale, router]);

  function submitSignup() {
    if (!isValid) {
      setErrorMessage(labels.missingFields);
      return;
    }

    const displayName = deriveDisplayNameFromEmail(normalizedFounderEmail);
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
      memberEmails: [],
    };

    setErrorMessage(null);
    setIsNavigating(true);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('locale', locale);
      formData.set('draft', JSON.stringify(draft));

      const result = await startLandingOnboardingAction(formData);
      if (!result.ok) {
        setIsNavigating(false);
        setErrorMessage(resolveError(result.reason, labels));
        return;
      }

      router.push(
        `/${locale}/auth/set-password?token=${encodeURIComponent(
          result.token,
        )}&next=${encodeURIComponent(`/${locale}/dashboard`)}`,
      );
    });
  }

  return (
    <div className="w-full max-w-[420px]">
      <div className="space-y-[7px]">
        <label className="relative block">
          <Mail
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
      </div>

      {errorMessage ? (
        <p className="mt-3 rounded-[7px] border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-200">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="button"
        data-landing-submit
        disabled={!isValid || isSubmitting}
        onClick={submitSignup}
        className="mt-[10px] flex h-[47px] w-full items-center justify-center rounded-[5px] bg-brand text-[19px] font-bold tracking-[-0.02em] text-[#05110d] transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? labels.pending : labels.submit}
      </button>
    </div>
  );
}
