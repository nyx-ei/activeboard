'use client';

import { ArrowLeft, CalendarDays, Check, Clock3, CreditCard, Mail, Trash2, UserRound, Users } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';

import { useRouter } from '@/i18n/navigation';
import { completeFounderOnboardingAction } from '@/app/[locale]/create-group/actions';
import { CURATED_TIMEZONES } from '@/components/dashboard/user-schedule-form';
import { cn, normalizeEmail } from '@/lib/utils';

type CreateGroupWizardLabels = {
  title: string;
  accountTitle: string;
  accountSubtitle: string;
  fullName: string;
  fullNamePlaceholder: string;
  email: string;
  password: string;
  passwordHint: string;
  examType: string;
  examSession: string;
  language: string;
  timezone: string;
  languageEnglish: string;
  languageFrench: string;
  selectPlaceholder: string;
  examTypeMccqe1: string;
  examTypeUsmle: string;
  examTypePlab: string;
  examTypeOther: string;
  examAprilMay2026: string;
  examAugustSeptember2026: string;
  examOctober2026: string;
  examPlanningAhead: string;
  stepAccount: string;
  continueToPlan: string;
  planTitle: string;
  planSubtitle: string;
  stepPlan: string;
  planStarter: string;
  planStarterDescription: string;
  planUnlimited: string;
  planUnlimitedDescription: string;
  continueToSchedule: string;
  studyScheduleTitle: string;
  studyScheduleSubtitle: string;
  stepSchedule: string;
  setScheduleNow: string;
  continueWithoutSchedule: string;
  addSlot: string;
  weekdays: Record<string, string>;
  nextQuestionBanks: string;
  banksTitle: string;
  banksSubtitle: string;
  stepBanks: string;
  nextTeam: string;
  bankCmcPrep: string;
  bankAceQbank: string;
  bankUworld: string;
  bankCanadaQbank: string;
  bankAmboss: string;
  bankOther: string;
  teamTitle: string;
  teamSubtitle: string;
  stepTeam: string;
  groupName: string;
  groupNamePlaceholder: string;
  memberEmails: string;
  memberEmailPlaceholder: string;
  addMember: string;
  createGroup: string;
  createGroupPending: string;
  accountExists: string;
  createdTitle: string;
  createdDescription: string;
  inviteCode: string;
  copyInviteLink: string;
  completionRule: string;
  inviteEmailWarning: string;
  goToDashboard: string;
  signInToContinue: string;
  missingFields: string;
  genericError: string;
};

type WizardStep = 0 | 1 | 2 | 3 | 4 | 5;
type ExamType = 'mccqe1' | 'usmle' | 'plab' | 'other';
type ExamSession = 'april_may_2026' | 'august_september_2026' | 'october_2026' | 'planning_ahead' | '';
type PlanType = 'starter' | 'unlimited';
type ScheduleSlot = {
  id: string;
  weekday: string;
  startTime: string;
  endTime: string;
  questionGoal: string;
};

type CreateGroupWizardProps = {
  locale: string;
  labels: CreateGroupWizardLabels;
  initialProfile: {
    displayName: string;
    email: string;
    examType: ExamType | '';
    examSession: ExamSession;
    language: 'en' | 'fr';
    timezone: string;
    questionBanks: string[];
  } | null;
  isAuthenticated: boolean;
};

const ACCOUNT_DRAFT_KEY = 'activeboard:create-group-account-draft';
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const BANK_OPTIONS = ['cmc_prep', 'aceqbank', 'uworld', 'canadaqbank', 'amboss', 'other'] as const;

function createSlot(index: number): ScheduleSlot {
  return {
    id: `${Date.now()}-${index}`,
    weekday: 'monday',
    startTime: '19:00',
    endTime: '20:00',
    questionGoal: '30',
  };
}

function Progress({ step }: { step: WizardStep }) {
  const activeStep = Math.min(step, 4);

  return (
    <div className="flex w-full items-center gap-1.5 sm:w-auto sm:gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index} className={cn('h-1 flex-1 rounded-full sm:w-7 sm:flex-none', index <= activeStep ? 'bg-brand' : 'bg-[#233046]')} />
      ))}
    </div>
  );
}

export function CreateGroupWizard({ locale, labels, initialProfile, isAuthenticated }: CreateGroupWizardProps) {
  const router = useRouter();
  const mobileScheduleLabels =
    locale === 'fr'
      ? { day: 'Jour', start: 'Début', end: 'Fin' }
      : { day: 'Day', start: 'Start', end: 'End' };
  const [step, setStep] = useState<WizardStep>(0);
  const [displayName, setDisplayName] = useState(initialProfile?.displayName ?? '');
  const [email, setEmail] = useState(initialProfile?.email ?? '');
  const [password, setPassword] = useState('');
  const [examType, setExamType] = useState<ExamType | ''>(initialProfile?.examType ?? '');
  const [examSession, setExamSession] = useState<ExamSession>(initialProfile?.examSession ?? '');
  const [selectedLocale, setSelectedLocale] = useState<'en' | 'fr'>(initialProfile?.language ?? (locale === 'fr' ? 'fr' : 'en'));
  const [timezone, setTimezone] = useState(initialProfile?.timezone ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'));
  const [plan, setPlan] = useState<PlanType>('starter');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [questionBanks, setQuestionBanks] = useState<string[]>(initialProfile?.questionBanks.length ? initialProfile.questionBanks : ['cmc_prep']);
  const [groupName, setGroupName] = useState('');
  const [memberEmails, setMemberEmails] = useState(['']);
  const [slots, setSlots] = useState<ScheduleSlot[]>([createSlot(0)]);
  const [inviteCode, setInviteCode] = useState('');
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [emailDeliveryFailed, setEmailDeliveryFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (isAuthenticated) {
      window.sessionStorage.removeItem(ACCOUNT_DRAFT_KEY);
      return;
    }

    const rawDraft = window.sessionStorage.getItem(ACCOUNT_DRAFT_KEY);
    if (!rawDraft) {
      return;
    }

    try {
      const draft = JSON.parse(rawDraft) as {
        displayName?: string;
        email?: string;
        password?: string;
        examType?: ExamType;
        examSession?: ExamSession;
        locale?: 'en' | 'fr';
        timezone?: string;
      };

      if (draft.displayName) setDisplayName(draft.displayName);
      if (draft.email) setEmail(draft.email);
      if (draft.password) setPassword(draft.password);
      if (draft.examType) setExamType(draft.examType);
      if (draft.examSession) setExamSession(draft.examSession);
      if (draft.locale) setSelectedLocale(draft.locale);
      if (draft.timezone) setTimezone(draft.timezone);
      if (draft.displayName && draft.email && draft.password) {
        setStep(1);
      }
    } catch {
      window.sessionStorage.removeItem(ACCOUNT_DRAFT_KEY);
    }
  }, [isAuthenticated]);

  const validAccount =
    displayName.trim().length > 1 &&
    email.trim().length > 3 &&
    examType &&
    examSession &&
    timezone.trim().length > 0 &&
    (isAuthenticated || password.trim().length >= 8);
  const validSchedule =
    !scheduleEnabled || slots.every((slot) => slot.weekday && slot.startTime && slot.endTime && Number(slot.questionGoal) > 0);
  const validBanks = questionBanks.length > 0;
  const validTeam = groupName.trim().length > 1 && memberEmails.map((value) => value.trim()).filter(Boolean).length >= 1;

  function updateSlot(id: string, patch: Partial<ScheduleSlot>) {
    setSlots((current) => current.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)));
  }

  function handleAccountNext() {
    if (!validAccount) {
      setErrorMessage(labels.missingFields);
      return;
    }

    if (!isAuthenticated) {
      window.sessionStorage.setItem(
        ACCOUNT_DRAFT_KEY,
        JSON.stringify({
          displayName: displayName.trim(),
          email: normalizeEmail(email),
          password,
          examType,
          examSession,
          locale: selectedLocale,
          timezone,
        }),
      );
    }

    setErrorMessage(null);
    setStep(1);
  }

  function toggleBank(bank: string) {
    setQuestionBanks((current) => (current.includes(bank) ? current.filter((value) => value !== bank) : [...current, bank]));
  }

  function goBack() {
    if (step === 0) {
      router.push(`/${locale}`);
      return;
    }

    if (step === 5) {
      setStep(4);
      return;
    }

    setStep((current) => Math.max(0, current - 1) as WizardStep);
  }

  function submitFounderOnboarding() {
    if (!validTeam || !validBanks || !validSchedule || !validAccount) {
      setErrorMessage(labels.missingFields);
      return;
    }

    const sanitizedMemberEmails = [...new Set(memberEmails.map((value) => normalizeEmail(value)).filter(Boolean))];

    const draft = {
      displayName: displayName.trim(),
      email: normalizeEmail(email),
      ...(isAuthenticated ? {} : { password }),
      examType,
      examSession,
      locale: selectedLocale,
      timezone: timezone.trim(),
      plan,
      questionBanks,
      schedule: scheduleEnabled
        ? slots.map((slot) => ({
            weekday: slot.weekday,
            startTime: slot.startTime,
            endTime: slot.endTime,
            questionGoal: Number(slot.questionGoal),
          }))
        : [],
      groupName: groupName.trim(),
      memberEmails: sanitizedMemberEmails,
    };

    setErrorMessage(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set('locale', locale);
      formData.set('draft', JSON.stringify(draft));

      const result = await completeFounderOnboardingAction(formData);

      if (!result.ok) {
        setErrorMessage(result.reason === 'account_exists' ? labels.accountExists : result.reason === 'missing_fields' ? labels.missingFields : labels.genericError);
        return;
      }

      window.sessionStorage.removeItem(ACCOUNT_DRAFT_KEY);
      setCreatedGroupId(result.groupId);
      setInviteCode(result.inviteCode);
      setRequiresLogin(result.requiresLogin);
      setEmailDeliveryFailed(result.emailDeliveryFailed);
      setStep(5);
    });
  }

  function goToWorkspace() {
    if (requiresLogin) {
      const next = createdGroupId ? `/${locale}/groups/${createdGroupId}` : `/${locale}/dashboard`;
      window.location.assign(`/${locale}/auth/login?next=${encodeURIComponent(next)}`);
      return;
    }

    window.location.assign(createdGroupId ? `/${locale}/groups/${createdGroupId}` : `/${locale}/dashboard`);
  }

  const bankLabels: Record<(typeof BANK_OPTIONS)[number], string> = {
    cmc_prep: labels.bankCmcPrep,
    aceqbank: labels.bankAceQbank,
    uworld: labels.bankUworld,
    canadaqbank: labels.bankCanadaQbank,
    amboss: labels.bankAmboss,
    other: labels.bankOther,
  };

  return (
    <main className="flex min-h-screen flex-col bg-background text-white">
      <header className="border-b border-white/[0.08] px-3 py-3 sm:px-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={goBack}
            className="flex min-w-0 items-center gap-2 text-slate-500 transition hover:text-white sm:gap-4"
          >
            <ArrowLeft className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" aria-hidden="true" />
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] bg-brand text-xs font-bold text-white sm:h-9 sm:w-9 sm:text-sm">AB</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white sm:text-xl">{labels.title}</span>
            </span>
          </button>
          <Progress step={step} />
        </div>
      </header>

      <section className="mx-auto w-full max-w-[640px] flex-1 px-3 py-6 sm:px-5 sm:py-10">
        {step === 0 ? (
          <div>
            <div className="flex items-start gap-3">
              <UserRound className="mt-1 h-5 w-5 text-brand" aria-hidden="true" />
              <div>
                <h1 className="text-2xl font-semibold tracking-[-0.02em]">{labels.accountTitle}</h1>
                <p className="mt-2 text-base font-medium text-slate-400">{labels.accountSubtitle}</p>
              </div>
            </div>
            <div className="mt-7 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-300">{labels.fullName}</span>
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="field h-10 rounded-[6px] px-3 text-sm" placeholder={labels.fullNamePlaceholder} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-300">{labels.email}</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="field h-10 rounded-[6px] px-3 text-sm" placeholder="you@example.com" />
              </label>
              {!isAuthenticated ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-300">{labels.password}</span>
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="field h-10 rounded-[6px] px-3 text-sm" />
                  <span className="mt-1 block text-xs text-slate-500">{labels.passwordHint}</span>
                </label>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-300">{labels.examType}</span>
                  <select value={examType} onChange={(event) => setExamType(event.target.value as ExamType)} className="field h-10 rounded-[6px] px-3 text-sm">
                    <option value="">{labels.selectPlaceholder}</option>
                    <option value="mccqe1">{labels.examTypeMccqe1}</option>
                    <option value="usmle">{labels.examTypeUsmle}</option>
                    <option value="plab">{labels.examTypePlab}</option>
                    <option value="other">{labels.examTypeOther}</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-300">{labels.examSession}</span>
                  <select value={examSession} onChange={(event) => setExamSession(event.target.value as ExamSession)} className="field h-10 rounded-[6px] px-3 text-sm">
                    <option value="">{labels.selectPlaceholder}</option>
                    <option value="april_may_2026">{labels.examAprilMay2026}</option>
                    <option value="august_september_2026">{labels.examAugustSeptember2026}</option>
                    <option value="october_2026">{labels.examOctober2026}</option>
                    <option value="planning_ahead">{labels.examPlanningAhead}</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-300">{labels.language}</span>
                  <select value={selectedLocale} onChange={(event) => setSelectedLocale(event.target.value === 'fr' ? 'fr' : 'en')} className="field h-10 rounded-[6px] px-3 text-sm">
                    <option value="en">{labels.languageEnglish}</option>
                    <option value="fr">{labels.languageFrench}</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-300">{labels.timezone}</span>
                  <select value={timezone} onChange={(event) => setTimezone(event.target.value)} className="field h-10 rounded-[6px] px-3 text-sm">
                    {CURATED_TIMEZONES.map((timezoneOption) => (
                      <option key={timezoneOption} value={timezoneOption}>
                        {timezoneOption}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="button" onClick={handleAccountNext} disabled={!validAccount} className="button-primary h-14 w-full rounded-[7px] text-sm sm:h-16 sm:text-base disabled:opacity-45">
                {labels.continueToPlan}
              </button>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div>
            <div className="flex items-start gap-3">
              <CreditCard className="mt-1 h-5 w-5 text-brand" aria-hidden="true" />
              <div>
                <h1 className="text-2xl font-semibold tracking-[-0.02em]">{labels.planTitle}</h1>
                <p className="mt-2 text-base font-medium text-slate-400">{labels.planSubtitle}</p>
              </div>
            </div>
            <div className="mt-7 grid gap-4">
              {(['starter', 'unlimited'] as PlanType[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPlan(value)}
                  className={cn(
                    'rounded-[7px] border p-5 text-left transition',
                    plan === value ? 'border-brand bg-brand/10' : 'border-white/10 bg-[#111827] hover:border-white/20',
                  )}
                >
                  <p className="text-base font-semibold text-white">{value === 'starter' ? labels.planStarter : labels.planUnlimited}</p>
                  <p className="mt-2 text-sm text-slate-400">{value === 'starter' ? labels.planStarterDescription : labels.planUnlimitedDescription}</p>
                </button>
              ))}
              <button type="button" onClick={() => setStep(2)} className="button-primary mt-1 h-14 w-full rounded-[7px] text-sm sm:h-16 sm:text-base">
                {labels.continueToSchedule}
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <div className="flex items-start gap-3">
              <Clock3 className="mt-1 h-5 w-5 text-brand" aria-hidden="true" />
              <div>
                <h1 className="text-2xl font-semibold tracking-[-0.02em]">{labels.studyScheduleTitle}</h1>
                <p className="mt-2 text-base font-medium text-slate-400">{labels.studyScheduleSubtitle}</p>
              </div>
            </div>
            <div className="mt-7 space-y-4">
              <label className="flex min-h-[68px] items-center gap-3 rounded-[7px] border border-white/10 bg-[#111827] px-4 py-4 text-sm font-semibold text-slate-300 sm:gap-4 sm:px-5 sm:text-base">
                <input type="checkbox" checked={scheduleEnabled} onChange={(event) => setScheduleEnabled(event.target.checked)} className="h-5 w-5 rounded border-white/20 bg-[#0f1628] accent-brand" />
                {labels.setScheduleNow}
              </label>
              {scheduleEnabled ? (
                <div className="space-y-3">
                  {slots.map((slot) => (
                    <div key={slot.id} className="rounded-[10px] bg-[#111827] p-3 sm:p-4">
                      <div className="grid gap-3 sm:grid-cols-[1.2fr_0.9fr_16px_0.9fr_0.7fr_16px_24px] sm:items-center sm:gap-2">
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 sm:hidden">
                            {mobileScheduleLabels.day}
                          </span>
                          <select value={slot.weekday} onChange={(event) => updateSlot(slot.id, { weekday: event.target.value })} className="field-compact rounded-[6px] px-3 text-sm">
                            {WEEKDAYS.map((weekday) => (
                              <option key={weekday} value={weekday}>
                                {labels.weekdays[weekday]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="grid grid-cols-2 gap-3 sm:contents">
                          <label className="block">
                            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 sm:hidden">
                              {mobileScheduleLabels.start}
                            </span>
                            <input value={slot.startTime} onChange={(event) => updateSlot(slot.id, { startTime: event.target.value })} type="time" className="field-compact rounded-[6px] px-3 text-sm" />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 sm:hidden">
                              {mobileScheduleLabels.end}
                            </span>
                            <input value={slot.endTime} onChange={(event) => updateSlot(slot.id, { endTime: event.target.value })} type="time" className="field-compact rounded-[6px] px-3 text-sm" />
                          </label>
                        </div>
                        <span className="hidden text-center text-slate-500 sm:block">-&gt;</span>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 sm:hidden">
                            Q
                          </span>
                          <input value={slot.questionGoal} onChange={(event) => updateSlot(slot.id, { questionGoal: event.target.value })} type="number" min="1" className="field-compact rounded-[6px] px-3 text-center text-sm" />
                        </label>
                        <span className="hidden text-xs font-bold text-slate-500 sm:block">Q</span>
                        <button type="button" onClick={() => setSlots((current) => (current.length > 1 ? current.filter((item) => item.id !== slot.id) : current))} className="justify-self-end rounded-md p-1 text-slate-500 hover:text-white">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setSlots((current) => [...current, createSlot(current.length)])} className="text-sm font-semibold text-brand hover:text-emerald-300">
                    + {labels.addSlot}
                  </button>
                </div>
              ) : null}
              <button type="button" disabled={!validSchedule} onClick={() => setStep(3)} className="button-primary h-14 w-full rounded-[7px] text-sm sm:h-16 sm:text-base disabled:opacity-45">
                {scheduleEnabled ? labels.nextQuestionBanks : labels.continueWithoutSchedule}
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-1 h-5 w-5 text-brand" aria-hidden="true" />
              <div>
                <h1 className="text-2xl font-semibold tracking-[-0.02em]">{labels.banksTitle}</h1>
                <p className="mt-2 text-base font-medium text-slate-400">{labels.banksSubtitle}</p>
              </div>
            </div>
            <div className="mt-7 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {BANK_OPTIONS.map((bank) => {
                  const selected = questionBanks.includes(bank);
                  return (
                    <button
                      key={bank}
                      type="button"
                      onClick={() => toggleBank(bank)}
                      className={cn(
                        'flex items-center gap-3 rounded-[7px] border px-4 py-3 text-left text-sm font-semibold transition',
                        selected ? 'border-brand bg-brand/10 text-brand' : 'border-white/10 bg-[#111827] text-slate-200 hover:border-white/20',
                      )}
                    >
                      <span className={cn('h-4 w-4 rounded-[4px] border', selected ? 'border-brand bg-brand/20' : 'border-white/20')} />
                      <span>{bankLabels[bank]}</span>
                    </button>
                  );
                })}
              </div>
              <button type="button" disabled={!validBanks} onClick={() => setStep(4)} className="button-primary h-14 w-full rounded-[7px] text-sm sm:h-16 sm:text-base disabled:opacity-45">
                {labels.stepTeam}
              </button>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div>
            <div className="flex items-start gap-3">
              <Users className="mt-1 h-5 w-5 text-brand" aria-hidden="true" />
              <div>
                <h1 className="text-2xl font-semibold tracking-[-0.02em]">{labels.teamTitle}</h1>
                <p className="mt-2 text-base font-medium text-slate-400">{labels.teamSubtitle}</p>
              </div>
            </div>
            <div className="mt-7 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-300">{labels.groupName}</span>
                <input value={groupName} onChange={(event) => setGroupName(event.target.value)} className="field h-10 rounded-[6px] px-3 text-sm" placeholder={labels.groupNamePlaceholder} />
              </label>
              <div>
                <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <Mail className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  {labels.memberEmails}
                </span>
                <div className="space-y-2">
                  {memberEmails.map((memberEmail, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        value={memberEmail}
                        onChange={(event) =>
                          setMemberEmails((current) => current.map((value, currentIndex) => (currentIndex === index ? event.target.value : value)))
                        }
                        className="field h-10 min-w-0 flex-1 rounded-[6px] px-3 text-sm"
                        type="email"
                        placeholder={labels.memberEmailPlaceholder}
                      />
                      {memberEmails.length > 1 ? (
                        <button type="button" onClick={() => setMemberEmails((current) => current.filter((_, currentIndex) => currentIndex !== index))} className="shrink-0 rounded-md p-1 text-slate-500 hover:text-white">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                {memberEmails.length < 4 ? (
                  <button type="button" onClick={() => setMemberEmails((current) => [...current, ''])} className="mt-3 text-sm font-semibold text-brand hover:text-emerald-300">
                    + {labels.addMember}
                  </button>
                ) : null}
              </div>
              {errorMessage ? <div className="rounded-[7px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{errorMessage}</div> : null}
              <button type="button" disabled={!validTeam || isPending} onClick={submitFounderOnboarding} className="button-primary h-14 w-full rounded-[7px] text-sm sm:h-16 sm:text-base disabled:opacity-45">
                {isPending ? labels.createGroupPending : labels.createGroup}
              </button>
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="flex min-h-[560px] flex-col items-center justify-center text-center">
            <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-brand/12 text-brand">
              <Check className="h-9 w-9" aria-hidden="true" />
            </div>
            <h1 className="mt-8 text-2xl font-semibold tracking-[-0.02em]">{labels.createdTitle}</h1>
            <p className="mt-4 max-w-[560px] text-base font-medium leading-7 text-slate-400">{labels.createdDescription}</p>
            {emailDeliveryFailed ? (
              <div className="mt-5 w-full rounded-[7px] border border-amber-400/20 bg-amber-400/[0.08] px-5 py-4 text-sm font-semibold leading-6 text-amber-300">
                {labels.inviteEmailWarning}
              </div>
            ) : null}
            <div className="mt-8 w-full rounded-[7px] bg-[#111827] px-4 py-5 sm:px-6 sm:py-6">
              <p className="text-sm font-semibold text-slate-500">{labels.inviteCode}</p>
              <p className="mt-3 break-all text-2xl font-semibold tracking-[0.18em] text-brand sm:text-3xl sm:tracking-[0.25em]">{inviteCode}</p>
              <button type="button" onClick={() => navigator.clipboard.writeText(inviteCode).catch(() => undefined)} className="mt-3 text-sm font-semibold text-brand">
                {labels.copyInviteLink}
              </button>
            </div>
            <div className="mt-7 w-full rounded-[7px] border border-amber-400/20 bg-amber-400/[0.08] px-5 py-4 text-sm font-semibold leading-6 text-amber-300">
              {labels.completionRule}
            </div>
            <button type="button" onClick={goToWorkspace} className="button-primary mt-7 h-14 w-full rounded-[7px] text-sm sm:h-16 sm:text-base">
              {requiresLogin ? labels.signInToContinue : labels.goToDashboard}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
