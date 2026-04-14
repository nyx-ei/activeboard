'use client';

import { ArrowLeft, BookOpen, Check, Clock3, Mail, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type CreateGroupWizardLabels = {
  title: string;
  accountTitle: string;
  accountSubtitle: string;
  fullName: string;
  fullNamePlaceholder: string;
  email: string;
  emailPlaceholder: string;
  password: string;
  passwordHint: string;
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
  nextScheduleBanks: string;
  scheduleTitle: string;
  scheduleSubtitle: string;
  addSlot: string;
  nextQuestionBanks: string;
  questionBanksTitle: string;
  questionBanksSubtitle: string;
  createGroup: string;
  createdTitle: string;
  createdDescription: string;
  inviteCode: string;
  copyInviteLink: string;
  completionRule: string;
  goToDashboard: string;
  weekdays: Record<string, string>;
  banks: Record<string, string>;
};

type ScheduleSlot = {
  id: string;
  weekday: string;
  startTime: string;
  endTime: string;
  questionGoal: string;
};

const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const banks = ['cmc_prep', 'aceqbank', 'uworld', 'canadaqbank', 'amboss', 'other'];

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
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index} className={`h-1 w-7 rounded-full ${index <= step ? 'bg-brand' : 'bg-[#233046]'}`} />
      ))}
    </div>
  );
}

export function CreateGroupWizard({ locale, labels }: { locale: string; labels: CreateGroupWizardLabels }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [examSession, setExamSession] = useState('');
  const [groupName, setGroupName] = useState('');
  const [memberEmails, setMemberEmails] = useState(['']);
  const [slots, setSlots] = useState<ScheduleSlot[]>([createSlot(0)]);
  const [selectedBanks, setSelectedBanks] = useState(new Set(['cmc_prep']));
  const inviteCode = useMemo(() => {
    const seed = `${groupName}-${email || fullName}`.toUpperCase();
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) {
      hash = (hash * 31 + seed.charCodeAt(index)) % 999999;
    }
    return String(hash || 45753).padStart(6, '0').slice(0, 6);
  }, [email, fullName, groupName]);

  const validAccount = fullName.trim().length > 1 && email.includes('@') && password.length >= 8 && Boolean(examSession);
  const validTeam = groupName.trim().length > 1 && memberEmails.filter((value) => value.trim()).length >= 2;
  const validSchedule = slots.every((slot) => slot.weekday && slot.startTime && slot.endTime && Number(slot.questionGoal) > 0);
  const validBanks = selectedBanks.size > 0;

  function updateSlot(id: string, patch: Partial<ScheduleSlot>) {
    setSlots((current) => current.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)));
  }

  function completeDraft() {
    const draft = {
      fullName,
      email,
      examSession,
      groupName,
      memberEmails: memberEmails.map((value) => value.trim()).filter(Boolean),
      schedule: slots,
      questionBanks: [...selectedBanks],
      inviteCode,
      createdAt: new Date().toISOString(),
    };
    window.sessionStorage.setItem('activeboard:create-group-draft', JSON.stringify(draft));
    setStep(4);
  }

  function goToAuth() {
    router.push(`/${locale}/auth/login?mode=sign-up&next=/${locale}/dashboard`);
  }

  return (
    <main className="flex min-h-screen flex-col bg-background text-white">
      <header className="flex h-[68px] items-center justify-between border-b border-white/[0.08] px-7">
        <button type="button" onClick={() => (step > 0 ? setStep((value) => value - 1) : router.push(`/${locale}`))} className="flex items-center gap-4 text-slate-500 transition hover:text-white">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          <span className="flex h-9 w-9 items-center justify-center rounded-[7px] bg-brand text-sm font-bold text-white">AB</span>
          <span className="text-xl font-semibold text-white">{labels.title}</span>
        </button>
        <Progress step={step} />
      </header>

      <section className="mx-auto w-full max-w-[620px] flex-1 px-5 py-10">
        {step === 0 ? (
          <div>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-brand" aria-hidden="true" />
              <div>
                <h1 className="text-2xl font-semibold tracking-[-0.02em]">{labels.accountTitle}</h1>
                <p className="mt-2 text-base font-medium text-slate-400">{labels.accountSubtitle}</p>
              </div>
            </div>
            <div className="mt-7 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-300">{labels.fullName}</span>
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="field h-10 rounded-[6px] px-3 text-sm" placeholder={labels.fullNamePlaceholder} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-300">{labels.email}</span>
                <input value={email} onChange={(event) => setEmail(event.target.value)} className="field h-10 rounded-[6px] px-3 text-sm" type="email" placeholder={labels.emailPlaceholder} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-300">{labels.password}</span>
                <input value={password} onChange={(event) => setPassword(event.target.value)} className="field h-10 rounded-[6px] px-3 text-sm" type="password" />
                <span className="mt-1 block text-xs font-medium text-slate-500">{labels.passwordHint}</span>
              </label>
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
              <button type="button" disabled={!validAccount} onClick={() => setStep(1)} className="button-primary h-16 w-full rounded-[7px] text-base disabled:opacity-45">
                {labels.next}
              </button>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-brand" aria-hidden="true" />
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
                <span className="mb-2 block text-sm font-semibold text-slate-300">{labels.memberEmails}</span>
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
              <button type="button" disabled={!validTeam} onClick={() => setStep(2)} className="button-primary h-16 w-full rounded-[7px] text-base disabled:opacity-45">
                {labels.nextScheduleBanks}
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <div className="flex items-center gap-3">
              <Clock3 className="h-5 w-5 text-brand" aria-hidden="true" />
              <div>
                <h1 className="text-2xl font-semibold tracking-[-0.02em]">{labels.scheduleTitle}</h1>
                <p className="mt-2 text-base font-medium text-slate-400">{labels.scheduleSubtitle}</p>
              </div>
            </div>
            <div className="mt-7 space-y-3">
              {slots.map((slot) => (
                <div key={slot.id} className="grid grid-cols-[1.2fr_0.9fr_16px_0.9fr_0.7fr_16px_24px] items-center gap-2 rounded-[7px] bg-[#111827] p-2">
                  <select value={slot.weekday} onChange={(event) => updateSlot(slot.id, { weekday: event.target.value })} className="field-compact rounded-[6px] text-sm">
                    {weekdays.map((weekday) => (
                      <option key={weekday} value={weekday}>{labels.weekdays[weekday]}</option>
                    ))}
                  </select>
                  <input value={slot.startTime} onChange={(event) => updateSlot(slot.id, { startTime: event.target.value })} type="time" className="field-compact rounded-[6px] text-sm" />
                  <span className="text-center text-slate-500">-&gt;</span>
                  <input value={slot.endTime} onChange={(event) => updateSlot(slot.id, { endTime: event.target.value })} type="time" className="field-compact rounded-[6px] text-sm" />
                  <input value={slot.questionGoal} onChange={(event) => updateSlot(slot.id, { questionGoal: event.target.value })} type="number" min="1" className="field-compact rounded-[6px] text-center text-sm" />
                  <span className="text-xs font-bold text-slate-500">Q</span>
                  <button type="button" onClick={() => setSlots((current) => (current.length > 1 ? current.filter((item) => item.id !== slot.id) : current))} className="text-slate-500 hover:text-white">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setSlots((current) => [...current, createSlot(current.length)])} className="mt-3 text-sm font-semibold text-brand hover:text-emerald-300">
                + {labels.addSlot}
              </button>
              <button type="button" disabled={!validSchedule} onClick={() => setStep(3)} className="button-primary mt-4 h-16 w-full rounded-[7px] text-base disabled:opacity-45">
                {labels.nextQuestionBanks}
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-brand" aria-hidden="true" />
              <div>
                <h1 className="text-2xl font-semibold tracking-[-0.02em]">{labels.questionBanksTitle}</h1>
                <p className="mt-2 text-base font-medium text-slate-400">{labels.questionBanksSubtitle}</p>
              </div>
            </div>
            <div className="mt-7 grid gap-2 sm:grid-cols-2">
              {banks.map((bank) => {
                const selected = selectedBanks.has(bank);
                return (
                  <button
                    key={bank}
                    type="button"
                    onClick={() =>
                      setSelectedBanks((current) => {
                        const next = new Set(current);
                        if (next.has(bank)) next.delete(bank);
                        else next.add(bank);
                        return next;
                      })
                    }
                    className={`flex h-11 items-center gap-3 rounded-[7px] border px-3 text-left text-sm font-semibold transition ${
                      selected ? 'border-brand/45 bg-brand/10 text-brand' : 'border-white/10 bg-[#111827] text-slate-300 hover:border-brand/35'
                    }`}
                  >
                    <span className={`flex h-4 w-4 items-center justify-center rounded-[4px] border ${selected ? 'border-violet-400 bg-violet-400 text-white' : 'border-violet-400/60'}`}>
                      {selected ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
                    </span>
                    {labels.banks[bank]} {bank === 'cmc_prep' ? <span className="ml-auto text-brand">*</span> : null}
                  </button>
                );
              })}
            </div>
            <button type="button" disabled={!validBanks} onClick={completeDraft} className="button-primary mt-6 h-16 w-full rounded-[7px] text-base disabled:opacity-45">
              {labels.createGroup}
            </button>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="flex min-h-[560px] flex-col items-center justify-center text-center">
            <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-brand/12 text-brand">
              <Check className="h-9 w-9" aria-hidden="true" />
            </div>
            <h1 className="mt-8 text-2xl font-semibold tracking-[-0.02em]">{labels.createdTitle}</h1>
            <p className="mt-4 max-w-[560px] text-base font-medium leading-7 text-slate-400">{labels.createdDescription}</p>
            <div className="mt-8 w-full rounded-[7px] bg-[#111827] px-6 py-6">
              <p className="text-sm font-semibold text-slate-500">{labels.inviteCode}</p>
              <p className="mt-3 text-3xl font-semibold tracking-[0.25em] text-brand">{inviteCode}</p>
              <button type="button" className="mt-3 text-sm font-semibold text-brand">{labels.copyInviteLink}</button>
            </div>
            <div className="mt-7 w-full rounded-[7px] border border-amber-400/20 bg-amber-400/[0.08] px-5 py-4 text-sm font-semibold leading-6 text-amber-300">
              {labels.completionRule}
            </div>
            <button type="button" onClick={goToAuth} className="button-primary mt-7 h-16 w-full rounded-[7px] text-base">
              {labels.goToDashboard}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
