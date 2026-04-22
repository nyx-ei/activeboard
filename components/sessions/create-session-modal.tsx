'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

import { SubmitButton } from '@/components/ui/submit-button';

export type CreateSessionModalLabels = {
  newSession: string;
  createSession: string;
  createSessionPending: string;
  sessionName: string;
  sessionNamePlaceholder: string;
  questionCount: string;
  timerMode: string;
  perQuestionMode: string;
  globalMode: string;
  timerSeconds: string;
  totalTimerSeconds: string;
  modalHint: string;
  close: string;
  groupAccessHint: string;
};

export function CreateSessionModal({
  locale,
  groupId,
  memberCount,
  canCreateSession,
  action,
  returnTo,
  labels,
  onClose,
}: {
  locale: string;
  groupId: string;
  memberCount: number;
  canCreateSession: boolean;
  action: (formData: FormData) => void | Promise<void>;
  returnTo: string;
  labels: CreateSessionModalLabels;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [questionGoal, setQuestionGoal] = useState('10');
  const [timerMode, setTimerMode] = useState<'per_question' | 'global'>('per_question');
  const [timerSeconds, setTimerSeconds] = useState('90');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const updateTimerMode = (value: 'per_question' | 'global') => {
    setTimerMode(value);
    setTimerSeconds(value === 'global' ? '600' : '90');
  };

  const isValid =
    canCreateSession &&
    memberCount >= 2 &&
    name.trim().length > 0 &&
    Number(questionGoal) > 0 &&
    Number(timerSeconds) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/60 px-0 backdrop-blur-[2px] [scrollbar-width:none] sm:items-center sm:px-4 [&::-webkit-scrollbar]:hidden">
      <div className="max-h-[90vh] w-full max-w-[478px] overflow-y-auto rounded-t-[18px] bg-[#111827] p-4 shadow-2xl ring-1 ring-white/[0.08] [scrollbar-width:none] sm:rounded-[14px] sm:p-6 [&::-webkit-scrollbar]:hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-white">{labels.newSession}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:text-white" aria-label={labels.close}>
            x
          </button>
        </div>

        <form action={action} className="mt-5 space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="returnTo" value={returnTo} />

          <label className="block">
            <span className="text-sm font-bold text-slate-300">{labels.sessionName}</span>
            <input
              name="sessionName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={labels.sessionNamePlaceholder}
              className="field mt-2 h-10 rounded-[7px] px-3 py-2 text-sm"
              autoComplete="off"
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-300">{labels.questionCount}</span>
            <input
              name="questionGoal"
              type="number"
              min="1"
              max="500"
              value={questionGoal}
              onChange={(event) => setQuestionGoal(event.target.value)}
              className="field mt-2 h-10 rounded-[7px] px-3 py-2 text-sm"
            />
          </label>

          <div>
            <span className="text-sm font-bold text-slate-300">{labels.timerMode}</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[
                ['per_question', labels.perQuestionMode],
                ['global', labels.globalMode],
              ].map(([value, label]) => (
                <label
                  key={value}
                  className={`flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[7px] border text-sm font-bold transition ${
                    timerMode === value
                      ? 'border-brand bg-brand text-[#06120e]'
                      : 'border-white/[0.08] bg-white/[0.035] text-slate-300 hover:border-brand/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="timerMode"
                    value={value}
                    checked={timerMode === value}
                    onChange={() => updateTimerMode(value as 'per_question' | 'global')}
                    className="sr-only"
                  />
                  <Clock className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-bold text-slate-300">
              {timerMode === 'global' ? labels.totalTimerSeconds : labels.timerSeconds}
            </span>
            <input
              name="timerSeconds"
              type="number"
              min="1"
              max="3600"
              value={timerSeconds}
              onChange={(event) => setTimerSeconds(event.target.value)}
              className="field mt-2 h-10 rounded-[7px] px-3 py-2 text-sm"
            />
          </label>

          <p className="text-xs italic text-slate-500">{labels.modalHint}</p>
          {memberCount < 2 ? <p className="text-xs font-semibold text-slate-500">{labels.groupAccessHint}</p> : null}
          <SubmitButton
            pendingLabel={labels.createSessionPending}
            className="button-primary h-10 w-full rounded-[7px] py-2 text-sm disabled:bg-brand/40 disabled:text-white/60"
            disabled={!isValid}
          >
            {labels.createSession}
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
