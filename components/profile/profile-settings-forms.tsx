'use client';

import { useState } from 'react';

import { SubmitButton } from '@/components/ui/submit-button';

type ProfileDetailsFormProps = {
  action: (formData: FormData) => void;
  locale: string;
  displayName: string;
  initialExamSession: string;
  initialQuestionBanks: string[];
  labels: {
    displayName: string;
    examSession: string;
    selectPlaceholder: string;
    examAprilMay2026: string;
    examAugustSeptember2026: string;
    examOctober2026: string;
    examPlanningAhead: string;
    questionBanks: string;
    bankCmcPrep: string;
    otherBank: string;
    saveProfile: string;
    saveProfilePending: string;
  };
};

const QUESTION_BANKS = [
  { value: 'cmc_prep', labelKey: 'bankCmcPrep' },
  { value: 'aceqbank', label: 'AceQbank' },
  { value: 'uworld', label: 'UWorld' },
  { value: 'canadaqbank', label: 'CanadaQBank' },
  { value: 'amboss', label: 'Amboss' },
  { value: 'other', labelKey: 'otherBank' },
] as const;

export function ProfileDetailsForm({
  action,
  locale,
  displayName,
  initialExamSession,
  initialQuestionBanks,
  labels,
}: ProfileDetailsFormProps) {
  const [selectedBanks, setSelectedBanks] = useState(() => new Set(initialQuestionBanks));

  function toggleBank(value: string) {
    setSelectedBanks((current) => {
      const next = new Set(current);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }

  return (
    <form action={action} className="mt-5 space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {[...selectedBanks].map((bank) => (
        <input key={bank} type="hidden" name="questionBanks" value={bank} />
      ))}

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-400">{labels.displayName}</span>
        <input name="displayName" className="field h-10 rounded-[7px] px-3 py-2 text-sm" defaultValue={displayName} />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-400">{labels.examSession}</span>
        <select name="examSession" className="field h-10 rounded-[7px] px-3 py-2 text-sm" defaultValue={initialExamSession}>
          <option value="">{labels.selectPlaceholder}</option>
          <option value="april_may_2026">{labels.examAprilMay2026}</option>
          <option value="august_september_2026">{labels.examAugustSeptember2026}</option>
          <option value="october_2026">{labels.examOctober2026}</option>
          <option value="planning_ahead">{labels.examPlanningAhead}</option>
        </select>
      </label>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-400">{labels.questionBanks}</p>
        <div className="grid grid-cols-2 gap-2">
          {QUESTION_BANKS.map((bank) => {
            const label = 'label' in bank ? bank.label : labels[bank.labelKey];
            const selected = selectedBanks.has(bank.value);

            return (
              <button
                key={bank.value}
                type="button"
                onClick={() => toggleBank(bank.value)}
                className={[
                  'h-8 min-w-0 truncate rounded-[7px] border px-2 text-left text-[11px] font-medium leading-none transition',
                  selected
                    ? 'border-brand/35 bg-brand/12 text-brand'
                    : 'border-white/10 bg-white/[0.035] text-slate-400 hover:border-brand/30 hover:bg-brand/10 hover:text-brand',
                ].join(' ')}
                title={label}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <SubmitButton pendingLabel={labels.saveProfilePending} className="button-primary w-full rounded-[7px] py-2.5 text-sm">
        {labels.saveProfile}
      </SubmitButton>
    </form>
  );
}

type PasswordFormProps = {
  action: (formData: FormData) => void;
  locale: string;
  labels: {
    securityTitle: string;
    passwordPlaceholder: string;
    passwordHint: string;
    savePasswordPending: string;
    togglePassword: string;
  };
};

export function PasswordUpdateForm({ action, locale, labels }: PasswordFormProps) {
  const [visible, setVisible] = useState(false);

  return (
    <form action={action} className="mt-4 border-t border-white/[0.06] pt-4">
      <input type="hidden" name="locale" value={locale} />
      <p className="text-sm font-semibold text-slate-400">{labels.securityTitle}</p>
      <div className="mt-2 flex items-center gap-2">
        <div className="relative flex-1">
          <input
            className="field h-10 rounded-[7px] py-2 pl-3 pr-10 text-sm"
            name="password"
            type={visible ? 'text' : 'password'}
            minLength={8}
            placeholder={labels.passwordPlaceholder}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 transition hover:text-white"
            aria-label={labels.togglePassword}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              {visible ? (
                <path
                  d="M5 5l14 14M9.7 9.7A3 3 0 0 0 14.3 14.3M7.4 7.8C5.6 8.9 4.2 10.4 3.3 12c1.8 3.2 5.1 5.2 8.7 5.2c1.3 0 2.6-.3 3.7-.8M10.5 6.9c.5-.1 1-.1 1.5-.1c3.6 0 6.9 2 8.7 5.2c-.5.9-1.1 1.7-1.9 2.4"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              ) : (
                <>
                  <path
                    d="M3.3 12c1.8-3.2 5.1-5.2 8.7-5.2s6.9 2 8.7 5.2c-1.8 3.2-5.1 5.2-8.7 5.2s-6.9-2-8.7-5.2Z"
                    fill="none"
                    stroke="currentColor"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                  <path d="M12 15a3 3 0 1 0 0-6a3 3 0 0 0 0 6Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
                </>
              )}
            </svg>
          </button>
        </div>
        <SubmitButton pendingLabel={labels.savePasswordPending} className="button-primary h-10 rounded-[7px] px-4 py-2 text-sm">
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
          </svg>
        </SubmitButton>
      </div>
      <p className="mt-1 text-xs text-slate-500">{labels.passwordHint}</p>
    </form>
  );
}
