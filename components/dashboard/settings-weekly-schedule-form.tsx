'use client';

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

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M9 4.5h6M5.5 7.5h13M9 10.5v6M15 10.5v6M7.5 7.5l.6 10a2 2 0 0 0 2 1.8h3.8a2 2 0 0 0 2-1.8l.6-10"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
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

export function SettingsWeeklyScheduleForm({ action, locale, groupId, labels }: SettingsWeeklyScheduleFormProps) {
  const [drafts, setDrafts] = useState<ScheduleDraft[]>([createDraft(0)]);

  function updateDraft(id: string, patch: Partial<ScheduleDraft>) {
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));
  }

  function addDraft() {
    setDrafts((current) => [...current, createDraft(current.length)]);
  }

  function removeDraft(id: string) {
    setDrafts((current) => (current.length > 1 ? current.filter((draft) => draft.id !== id) : current));
  }

  return (
    <form action={action} className="relative mt-4 rounded-[12px] bg-white/[0.04] p-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="groupId" value={groupId} />

      <div className="absolute -top-9 right-0">
        <button type="button" onClick={addDraft} className="text-sm font-bold text-brand transition hover:text-emerald-300">
          + {labels.addDay}
        </button>
      </div>

      <div className="space-y-2">
        {drafts.map((draft) => (
          <div
            key={draft.id}
            className="grid grid-cols-[minmax(96px,1.15fr)_minmax(82px,0.9fr)_14px_minmax(82px,0.9fr)_minmax(70px,0.65fr)_14px_minmax(20px,auto)] items-center gap-2"
          >
            <select
              name="weekday"
              className="field-compact min-w-0 rounded-[7px] text-sm"
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
            <input
              name="startTime"
              type="time"
              className="field-compact min-w-0 rounded-[7px] text-sm"
              value={draft.startTime}
              onChange={(event) => updateDraft(draft.id, { startTime: event.target.value })}
            />
            <span className="text-center text-sm text-slate-500">→</span>
            <input
              name="endTime"
              type="time"
              className="field-compact min-w-0 rounded-[7px] text-sm"
              value={draft.endTime}
              onChange={(event) => updateDraft(draft.id, { endTime: event.target.value })}
            />
            <input
              name="questionGoal"
              type="number"
              min="1"
              max="500"
              className="field-compact min-w-0 rounded-[7px] text-center text-sm"
              value={draft.questionGoal}
              onChange={(event) => updateDraft(draft.id, { questionGoal: event.target.value })}
              aria-label={labels.questionGoal}
            />
            <span className="text-xs font-bold text-slate-500">Q</span>
            <button
              type="button"
              onClick={() => removeDraft(draft.id)}
              className="text-slate-500 transition hover:text-white disabled:opacity-40"
              disabled={drafts.length === 1}
              aria-label={labels.removeDay}
            >
              <TrashIcon />
            </button>
          </div>
        ))}
      </div>

      <SubmitButton pendingLabel={labels.saveSchedulePending} className="button-primary mt-3 h-10 w-full rounded-[7px] text-sm">
        {labels.saveSchedule}
      </SubmitButton>
    </form>
  );
}
