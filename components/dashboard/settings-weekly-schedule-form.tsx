'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { SubmitButton } from '@/components/ui/submit-button';

type ScheduleDraft = {
  id: string;
  weekday: string;
  startTime: string;
  endTime: string;
  questionGoal: string;
};

type SettingsWeeklyScheduleFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  locale: string;
  groupId: string;
  inline?: boolean;
  labels: {
    addDay: string;
    saveSchedule: string;
    saveSchedulePending: string;
    questionGoal: string;
    removeDay: string;
    weekdays: Record<string, string>;
  };
};

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function getMeridiem(value: string) {
  const hour = Number(value.slice(0, 2));
  return hour >= 12 ? 'pm' : 'am';
}

function createDraft(index: number): ScheduleDraft {
  return {
    id: `${Date.now()}-${index}`,
    weekday: index % 2 === 0 ? 'monday' : 'wednesday',
    startTime: '19:00',
    endTime: '21:00',
    questionGoal: '50',
  };
}

export function SettingsWeeklyScheduleForm({ action, locale, groupId, inline = false, labels }: SettingsWeeklyScheduleFormProps) {
  const [drafts, setDrafts] = useState<ScheduleDraft[]>([]);

  function updateDraft(id: string, patch: Partial<ScheduleDraft>) {
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));
  }

  function addDraft() {
    setDrafts((current) => [...current, createDraft(current.length)]);
  }

  function removeDraft(id: string) {
    setDrafts((current) => current.filter((draft) => draft.id !== id));
  }

  return (
    <form action={action} className={inline ? 'relative mt-0' : 'relative mt-3'}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="groupId" value={groupId} />

      <div className={inline ? 'mt-2' : 'absolute -top-8 right-0'}>
        <button type="button" onClick={addDraft} className="text-xs font-bold text-brand transition hover:text-emerald-300">
          + {labels.addDay}
        </button>
      </div>

      <div className={inline ? 'mt-2 space-y-1.5 empty:hidden' : 'space-y-1.5 rounded-[8px] bg-white/[0.035] p-2 empty:hidden sm:p-2.5'}>
        {drafts.map((draft) => (
          <div
            key={draft.id}
            className="grid grid-cols-[minmax(82px,1.05fr)_minmax(68px,0.85fr)_minmax(68px,0.85fr)_minmax(46px,0.58fr)_18px] items-center gap-1.5 rounded-[7px] bg-white/[0.025] p-1.5 min-[430px]:grid-cols-[minmax(92px,1.1fr)_minmax(72px,0.9fr)_minmax(72px,0.9fr)_minmax(50px,0.6fr)_18px] sm:grid-cols-[minmax(96px,1.12fr)_minmax(78px,0.9fr)_14px_minmax(78px,0.9fr)_minmax(58px,0.65fr)_12px_18px] sm:bg-transparent sm:p-0"
          >
            <select
              name="weekday"
              className="h-8 min-w-0 rounded-[5px] border border-white/[0.08] bg-white/[0.08] px-2 text-[12px] font-bold text-white outline-none focus:border-brand"
              value={draft.weekday}
              onChange={(event) => updateDraft(draft.id, { weekday: event.target.value })}
              aria-label={labels.addDay}
            >
              {WEEKDAYS.map((weekday) => (
                <option key={weekday} value={weekday}>
                  {labels.weekdays[weekday]}
                </option>
              ))}
            </select>
            <div className="flex h-8 min-w-0 items-center rounded-[5px] border border-white/[0.08] bg-white/[0.08] px-2 focus-within:border-brand">
              <input
                name="startTime"
                type="time"
                className="min-w-0 flex-1 bg-transparent p-0 text-[12px] font-bold text-white outline-none"
                value={draft.startTime}
                onChange={(event) => updateDraft(draft.id, { startTime: event.target.value })}
              />
              <span className="ml-1 text-[10px] font-bold text-slate-400">{getMeridiem(draft.startTime)}</span>
            </div>
            <span className="hidden text-center text-xs text-slate-500 sm:block">-&gt;</span>
            <div className="flex h-8 min-w-0 items-center rounded-[5px] border border-white/[0.08] bg-white/[0.08] px-2 focus-within:border-brand">
              <input
                name="endTime"
                type="time"
                className="min-w-0 flex-1 bg-transparent p-0 text-[12px] font-bold text-white outline-none"
                value={draft.endTime}
                onChange={(event) => updateDraft(draft.id, { endTime: event.target.value })}
              />
              <span className="ml-1 text-[10px] font-bold text-slate-400">{getMeridiem(draft.endTime)}</span>
            </div>
            <input
              name="questionGoal"
              type="number"
              min="1"
              max="500"
              className="h-8 min-w-0 rounded-[5px] border border-white/[0.08] bg-white/[0.08] px-1.5 text-center text-[12px] font-bold text-white outline-none focus:border-brand"
              value={draft.questionGoal}
              onChange={(event) => updateDraft(draft.id, { questionGoal: event.target.value })}
              aria-label={labels.questionGoal}
            />
            <span className="hidden text-xs font-bold text-slate-500 sm:inline">Q</span>
            <button
              type="button"
              onClick={() => removeDraft(draft.id)}
              className="text-slate-500 transition hover:text-white"
              aria-label={labels.removeDay}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      {drafts.length > 0 ? (
        <SubmitButton pendingLabel={labels.saveSchedulePending} className="button-primary mt-2.5 h-8 w-full rounded-[5px] text-xs">
          {labels.saveSchedule}
        </SubmitButton>
      ) : null}
    </form>
  );
}
