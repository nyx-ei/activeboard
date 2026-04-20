'use client';

import { ArrowLeft, CalendarDays, Check, Clock3, Mail, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type CreateGroupWizardLabels = {
  title: string;
  examPeriodTitle: string;
  examPeriodSubtitle: string;
  examSession: string;
  selectPlaceholder: string;
  examAprilMay2026: string;
  examAugustSeptember2026: string;
  examOctober2026: string;
  examPlanningAhead: string;
  next: string;
  teamTitle: string;
  teamSubtitle: string;
  groupName: string;
  groupNamePlaceholder: string;
  memberEmails: string;
  memberEmailPlaceholder: string;
  addMember: string;
  studyScheduleTitle: string;
  studyScheduleSubtitle: string;
  setScheduleNow: string;
  continueWithoutSchedule: string;
  nextTeam: string;
  addSlot: string;
  createGroup: string;
  createdTitle: string;
  createdDescription: string;
  inviteCode: string;
  copyInviteLink: string;
  completionRule: string;
  goToDashboard: string;
  weekdays: Record<string, string>;
};

type ScheduleSlot = {
  id: string;
  weekday: string;
  startTime: string;
  endTime: string;
  questionGoal: string;
};

const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const defaultQuestionBanks = ['cmc_prep'];

function createSlot(index: number): ScheduleSlot {
  return {
    id: `${Date.now()}-${index}`,
    weekday: 'monday',
    startTime: '19:00',
    endTime: '20:00',
    questionGoal: '30',
  };
}

function Progress({ step }: { step: number }) {
  const activeStep = Math.min(step, 2);

  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <span key={index} className={`h-1 w-7 rounded-full ${index <= activeStep ? 'bg-brand' : 'bg-[#233046]'}`} />
      ))}
    </div>
  );
}

export function CreateGroupWizard({ locale, labels }: { locale: string; labels: CreateGroupWizardLabels }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [examSession, setExamSession] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [memberEmails, setMemberEmails] = useState(['']);
  const [slots, setSlots] = useState<ScheduleSlot[]>([createSlot(0)]);
  const inviteCode = useMemo(() => {
    const seed = `${groupName}-${memberEmails.join('-')}`.toUpperCase();
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) {
      hash = (hash * 31 + seed.charCodeAt(index)) % 999999;
    }
    return String(hash || 45753).padStart(6, '0').slice(0, 6);
  }, [groupName, memberEmails]);

  const validExam = Boolean(examSession);
  const validTeam = groupName.trim().length > 1 && memberEmails.filter((value) => value.trim()).length >= 1;
  const validSchedule =
    !scheduleEnabled || slots.every((slot) => slot.weekday && slot.startTime && slot.endTime && Number(slot.questionGoal) > 0);

  function updateSlot(id: string, patch: Partial<ScheduleSlot>) {
    setSlots((current) => current.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)));
  }

  function completeDraft() {
    const draft = {
      examSession,
      groupName,
      memberEmails: memberEmails.map((value) => value.trim()).filter(Boolean),
      schedule: scheduleEnabled ? slots : [],
      questionBanks: defaultQuestionBanks,
      inviteCode,
      createdAt: new Date().toISOString(),
    };
    window.sessionStorage.setItem('activeboard:create-group-draft', JSON.stringify(draft));
    setStep(3);
  }

  function goToDashboard() {
    router.push(`/${locale}/dashboard`);
  }

  return (
    <main className="flex min-h-screen flex-col bg-background text-white">
      <header className="flex h-[68px] items-center justify-between border-b border-white/[0.08] px-4 sm:px-7">
        <button
          type="button"
          onClick={() => (step > 0 && step < 3 ? setStep((value) => value - 1) : router.push(`/${locale}`))}
          className="flex min-w-0 items-center gap-3 text-slate-500 transition hover:text-white sm:gap-4"
        >
          <ArrowLeft className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] bg-brand text-sm font-bold text-white">AB</span>
          <span className="truncate text-lg font-semibold text-white sm:text-xl">{labels.title}</span>
        </button>
        <Progress step={step} />
      </header>

      <section className="mx-auto w-full max-w-[620px] flex-1 px-5 py-10">
        {step === 0 ? (
          <div>
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-1 h-5 w-5 text-brand" aria-hidden="true" />
              <div>
                <h1 className="text-2xl font-semibold tracking-[-0.02em]">{labels.examPeriodTitle}</h1>
                <p className="mt-2 text-base font-medium text-slate-400">{labels.examPeriodSubtitle}</p>
              </div>
            </div>
            <div className="mt-7 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-300">{labels.examSession}</span>
                <select value={examSession} onChange={(event) => setExamSession(event.target.value)} className="field h-10 rounded-[6px] px-3 text-sm">
                  <option value="">{labels.selectPlaceholder}</option>
                  <option value="april_may_2026">{labels.examAprilMay2026}</option>
                  <option value="august_september_2026">{labels.examAugustSeptember2026}</option>
                  <option value="october_2026">{labels.examOctober2026}</option>
                  <option value="planning_ahead">{labels.examPlanningAhead}</option>
                </select>
              </label>
              <button type="button" disabled={!validExam} onClick={() => setStep(1)} className="button-primary h-16 w-full rounded-[7px] text-base disabled:opacity-45">
                {labels.next}
              </button>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div>
            <div className="flex items-start gap-3">
              <Clock3 className="mt-1 h-5 w-5 text-brand" aria-hidden="true" />
              <div>
                <h1 className="text-2xl font-semibold tracking-[-0.02em]">{labels.studyScheduleTitle}</h1>
                <p className="mt-2 text-base font-medium text-slate-400">{labels.studyScheduleSubtitle}</p>
              </div>
            </div>
            <div className="mt-7 space-y-4">
              <label className="flex h-[68px] items-center gap-4 rounded-[7px] border border-white/10 bg-[#111827] px-5 text-base font-semibold text-slate-300">
                <input
                  type="checkbox"
                  checked={scheduleEnabled}
                  onChange={(event) => setScheduleEnabled(event.target.checked)}
                  className="h-5 w-5 rounded border-white/20 bg-[#0f1628] accent-brand"
                />
                {labels.setScheduleNow}
              </label>

              {scheduleEnabled ? (
                <div className="space-y-3">
                  {slots.map((slot) => (
                    <div key={slot.id} className="grid grid-cols-[1fr_1fr] items-center gap-2 rounded-[7px] bg-[#111827] p-2 sm:grid-cols-[1.2fr_0.9fr_16px_0.9fr_0.7fr_16px_24px]">
                      <select value={slot.weekday} onChange={(event) => updateSlot(slot.id, { weekday: event.target.value })} className="field-compact rounded-[6px] text-sm">
                        {weekdays.map((weekday) => (
                          <option key={weekday} value={weekday}>
                            {labels.weekdays[weekday]}
                          </option>
                        ))}
                      </select>
                      <input value={slot.startTime} onChange={(event) => updateSlot(slot.id, { startTime: event.target.value })} type="time" className="field-compact rounded-[6px] text-sm" />
                      <span className="hidden text-center text-slate-500 sm:block">-&gt;</span>
                      <input value={slot.endTime} onChange={(event) => updateSlot(slot.id, { endTime: event.target.value })} type="time" className="field-compact rounded-[6px] text-sm" />
                      <input value={slot.questionGoal} onChange={(event) => updateSlot(slot.id, { questionGoal: event.target.value })} type="number" min="1" className="field-compact rounded-[6px] text-center text-sm" />
                      <span className="text-xs font-bold text-slate-500">Q</span>
                      <button type="button" onClick={() => setSlots((current) => (current.length > 1 ? current.filter((item) => item.id !== slot.id) : current))} className="text-slate-500 hover:text-white">
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setSlots((current) => [...current, createSlot(current.length)])} className="text-sm font-semibold text-brand hover:text-emerald-300">
                    + {labels.addSlot}
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                disabled={!validSchedule}
                onClick={() => setStep(2)}
                className="button-primary h-16 w-full rounded-[7px] text-base disabled:opacity-45"
              >
                {scheduleEnabled ? labels.nextTeam : labels.continueWithoutSchedule}
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
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
                        onChange={(event) => setMemberEmails((current) => current.map((value, currentIndex) => (currentIndex === index ? event.target.value : value)))}
                        className="field h-10 rounded-[6px] px-3 text-sm"
                        type="email"
                        placeholder={labels.memberEmailPlaceholder}
                      />
                      {memberEmails.length > 1 ? (
                        <button type="button" onClick={() => setMemberEmails((current) => current.filter((_, currentIndex) => currentIndex !== index))} className="text-slate-500 hover:text-white">
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
              <button type="button" disabled={!validTeam} onClick={completeDraft} className="button-primary h-16 w-full rounded-[7px] text-base disabled:opacity-45">
                <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                {labels.createGroup}
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex min-h-[560px] flex-col items-center justify-center text-center">
            <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-brand/12 text-brand">
              <Check className="h-9 w-9" aria-hidden="true" />
            </div>
            <h1 className="mt-8 text-2xl font-semibold tracking-[-0.02em]">{labels.createdTitle}</h1>
            <p className="mt-4 max-w-[560px] text-base font-medium leading-7 text-slate-400">{labels.createdDescription}</p>
            <div className="mt-8 w-full rounded-[7px] bg-[#111827] px-6 py-6">
              <p className="text-sm font-semibold text-slate-500">{labels.inviteCode}</p>
              <p className="mt-3 text-3xl font-semibold tracking-[0.25em] text-brand">{inviteCode}</p>
              <button type="button" className="mt-3 text-sm font-semibold text-brand">
                {labels.copyInviteLink}
              </button>
            </div>
            <div className="mt-7 w-full rounded-[7px] border border-amber-400/20 bg-amber-400/[0.08] px-5 py-4 text-sm font-semibold leading-6 text-amber-300">
              {labels.completionRule}
            </div>
            <button type="button" onClick={goToDashboard} className="button-primary mt-7 h-16 w-full rounded-[7px] text-base">
              {labels.goToDashboard}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
