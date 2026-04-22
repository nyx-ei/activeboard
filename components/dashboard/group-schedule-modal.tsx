'use client';

import { CalendarDays, Pencil, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ModalPortal } from '@/components/ui/modal-portal';
import { SubmitButton } from '@/components/ui/submit-button';

type Schedule = {
  id: string;
  weekday: string;
  start_time: string;
  end_time: string;
  question_goal: number;
};

type ScheduleDraft = {
  id: string;
  persisted: boolean;
  weekday: string;
  startTime: string;
  endTime: string;
  questionGoal: string;
};

type GroupScheduleModalProps = {
  addAction: (formData: FormData) => void | Promise<void>;
  updateAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  locale: string;
  groupId: string;
  schedules: Schedule[];
  weekdayLabels: Record<string, string>;
  labels: {
    open: string;
    title: string;
    description: string;
    close: string;
    cancel: string;
    addDay: string;
    saveSchedule: string;
    saveSchedulePending: string;
    questionGoal: string;
    removeDay: string;
  };
};

type ModalMode = 'add' | 'edit';

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function timeValue(value: string) {
  return value.slice(0, 5);
}

function createDraft(index: number): ScheduleDraft {
  return {
    id: `new-${Date.now()}-${index}`,
    persisted: false,
    weekday: index % 2 === 0 ? 'monday' : 'wednesday',
    startTime: '19:00',
    endTime: '21:00',
    questionGoal: '50',
  };
}

function scheduleToDraft(schedule: Schedule): ScheduleDraft {
  return {
    id: schedule.id,
    persisted: true,
    weekday: schedule.weekday,
    startTime: timeValue(schedule.start_time),
    endTime: timeValue(schedule.end_time),
    questionGoal: String(schedule.question_goal),
  };
}

export function GroupScheduleModal({
  addAction,
  updateAction,
  deleteAction,
  locale,
  groupId,
  schedules,
  weekdayLabels,
  labels,
}: GroupScheduleModalProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ModalMode>('add');
  const [drafts, setDrafts] = useState<ScheduleDraft[]>([]);
  const slotLabel = locale === 'fr' ? 'Ajouter un créneau' : 'Add slot';

  useEffect(() => {
    if (!open) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  function openModal(nextMode: ModalMode) {
    setMode(nextMode);
    setDrafts(nextMode === 'edit' && schedules.length > 0 ? schedules.map(scheduleToDraft) : [createDraft(0)]);
    setOpen(true);
  }

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
    <>
      <button type="button" onClick={() => openModal('add')} className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 transition hover:text-amber-300">
        {labels.addDay}
      </button>
      <button type="button" onClick={() => openModal('edit')} className="rounded-md p-1 text-slate-500 transition hover:text-brand" aria-label={labels.open}>
        <Pencil className="h-4 w-4" aria-hidden="true" strokeWidth={1.7} />
      </button>

      {open ? (
        <ModalPortal>
          <div className="fixed inset-0 flex items-end justify-center bg-black/72 px-0 py-0 backdrop-blur-[2px] sm:items-center sm:px-4 sm:py-6" style={{ zIndex: 1000 }} role="dialog" aria-modal="true">
            <button type="button" className="absolute inset-0 cursor-default" aria-label={labels.close} onClick={() => setOpen(false)} />
            <section className="relative max-h-[min(88vh,620px)] w-full max-w-[540px] overflow-y-auto rounded-t-[16px] border border-white/[0.06] bg-[#11192c] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.55)] [scrollbar-width:none] sm:rounded-[10px] sm:p-6 [&::-webkit-scrollbar]:hidden">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-white">
                    <CalendarDays className="h-4 w-4 text-brand" aria-hidden="true" strokeWidth={1.8} />
                    {labels.title}
                  </h2>
                  <p className="mt-2 text-sm font-medium text-slate-400">{labels.description}</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-slate-400 transition hover:bg-white/[0.06] hover:text-white" aria-label={labels.close}>
                  <X className="h-5 w-5" aria-hidden="true" strokeWidth={1.8} />
                </button>
              </div>

              <form action={mode === 'edit' ? updateAction : addAction} className="mt-6">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="groupId" value={groupId} />

                <div className="space-y-2">
                  <div className="grid grid-cols-[minmax(88px,1fr)_minmax(68px,0.75fr)_minmax(68px,0.75fr)_minmax(52px,0.55fr)_28px] items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    <span>{locale === 'fr' ? 'Jour' : 'Day'}</span>
                    <span>{locale === 'fr' ? 'Début' : 'Start'}</span>
                    <span>{locale === 'fr' ? 'Fin' : 'End'}</span>
                    <span className="text-center">Q</span>
                    <span />
                  </div>
                  {drafts.map((draft) => (
                    <div key={draft.id} className="rounded-[9px] bg-white/[0.045] p-3 text-sm">
                      {mode === 'edit' ? <input type="hidden" name="scheduleId" value={draft.id} /> : null}
                      <div className="grid grid-cols-[minmax(88px,1fr)_minmax(68px,0.75fr)_minmax(68px,0.75fr)_minmax(52px,0.55fr)_28px] items-center gap-2">
                        <label className="block min-w-0">
                          <select
                            name="weekday"
                            className="h-10 w-full min-w-0 rounded-[6px] border border-white/[0.08] bg-white/[0.08] px-2 text-xs font-bold text-white outline-none focus:border-brand"
                            value={draft.weekday}
                            onChange={(event) => updateDraft(draft.id, { weekday: event.target.value })}
                          >
                            {WEEKDAYS.map((weekday) => (
                              <option key={weekday} value={weekday}>
                                {weekdayLabels[weekday]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block min-w-0">
                          <div className="flex h-10 min-w-0 items-center rounded-[6px] border border-white/[0.08] bg-white/[0.08] px-2 focus-within:border-brand">
                            <input
                              name="startTime"
                              type="time"
                              className="min-w-0 flex-1 bg-transparent p-0 text-xs font-bold text-white outline-none"
                              value={draft.startTime}
                              onChange={(event) => updateDraft(draft.id, { startTime: event.target.value })}
                            />
                          </div>
                        </label>
                        <label className="block min-w-0">
                          <div className="flex h-10 min-w-0 items-center rounded-[6px] border border-white/[0.08] bg-white/[0.08] px-2 focus-within:border-brand">
                            <input
                              name="endTime"
                              type="time"
                              className="min-w-0 flex-1 bg-transparent p-0 text-xs font-bold text-white outline-none"
                              value={draft.endTime}
                              onChange={(event) => updateDraft(draft.id, { endTime: event.target.value })}
                            />
                          </div>
                        </label>
                        <label className="block min-w-0">
                          <input
                            name="questionGoal"
                            type="number"
                            min="1"
                            max="500"
                            className="h-10 w-full min-w-0 rounded-[6px] border border-white/[0.08] bg-white/[0.08] px-2 text-center text-xs font-bold text-white outline-none focus:border-brand"
                            value={draft.questionGoal}
                            onChange={(event) => updateDraft(draft.id, { questionGoal: event.target.value })}
                            aria-label={labels.questionGoal}
                          />
                        </label>
                        <div className="flex justify-center">
                          {draft.persisted ? (
                            <button type="submit" formAction={deleteAction} name="deleteScheduleId" value={draft.id} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/[0.06] hover:text-white" aria-label={labels.removeDay}>
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          ) : (
                            <button type="button" onClick={() => removeDraft(draft.id)} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/[0.06] hover:text-white" aria-label={labels.removeDay}>
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button type="button" onClick={addDraft} className="mt-2 flex h-9 w-full items-center justify-center rounded-[7px] border border-dashed border-white/[0.08] text-xs font-bold text-brand transition hover:bg-brand/10">
                  + {slotLabel}
                </button>

                <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
                  <button type="button" onClick={() => setOpen(false)} className="button-secondary h-10 rounded-[6px] text-sm font-bold">
                    {labels.cancel}
                  </button>
                  <SubmitButton pendingLabel={labels.saveSchedulePending} className="button-primary h-10 rounded-[6px] text-sm font-bold">
                    {labels.saveSchedule}
                  </SubmitButton>
                </div>
              </form>
            </section>
          </div>
        </ModalPortal>
      ) : null}
    </>
  );
}
