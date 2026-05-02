'use client';

import { useState } from 'react';
import { Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Modal, ModalTitle } from '@/components/ui/modal';
import { SubmitButton } from '@/components/ui/submit-button';
import { markDashboardPayloadStale } from '@/components/dashboard/dashboard-data-cache';

export type CreateSessionModalLabels = {
  newSession: string;
  createSession: string;
  createSessionPending: string;
  groupName: string;
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
  groups,
  initialGroupId,
  canCreateSession,
  action,
  labels,
  onClose,
}: {
  locale: string;
  groups: Array<{ id: string; name: string; memberCount: number }>;
  initialGroupId: string;
  canCreateSession: boolean;
  action: (formData: FormData) => void | Promise<void>;
  labels: CreateSessionModalLabels;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const [questionGoal, setQuestionGoal] = useState('10');
  const [timerMode, setTimerMode] = useState<'per_question' | 'global'>(
    'per_question',
  );
  const [timerSeconds, setTimerSeconds] = useState('90');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateTimerMode = (value: 'per_question' | 'global') => {
    setTimerMode(value);
    setTimerSeconds(value === 'global' ? '600' : '90');
  };

  const selectedGroup =
    groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null;
  const memberCount = selectedGroup?.memberCount ?? 0;
  const returnTo = selectedGroup
    ? `/${locale}/groups/${selectedGroup.id}`
    : `/${locale}/groups`;

  const isValid =
    canCreateSession &&
    Boolean(selectedGroupId) &&
    memberCount >= 2 &&
    name.trim().length > 0 &&
    Number(questionGoal) > 0 &&
    Number(timerSeconds) > 0;

  return (
    <Modal
      open
      onClose={onClose}
      backdropLabel={labels.close}
      mobileSheet
      contentClassName="max-h-[90vh] w-full max-w-[478px] overflow-y-auto rounded-t-[18px] bg-[#111827] p-4 shadow-2xl ring-1 ring-white/[0.08] [scrollbar-width:none] sm:rounded-[14px] sm:p-6 [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex items-center justify-between">
        <ModalTitle className="text-lg font-extrabold text-white">
          {labels.newSession}
        </ModalTitle>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-slate-400 hover:text-white"
          aria-label={labels.close}
        >
          x
        </button>
      </div>

      <form
        action={action}
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          if (!isValid || isCreating) {
            event.preventDefault();
            return;
          }

          event.preventDefault();
          setErrorMessage(null);
          setIsCreating(true);
          window.sessionStorage.setItem('activeboard:session-flow-active', '1');
          window.dispatchEvent(
            new CustomEvent('activeboard:session-flow-started'),
          );
          const startedAt = performance.now();
          const formData = new FormData(event.currentTarget);
          void fetch('/api/sessions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            cache: 'no-store',
            body: JSON.stringify({
              locale: formData.get('locale'),
              returnTo: formData.get('returnTo'),
              groupId: formData.get('groupId'),
              sessionName: formData.get('sessionName'),
              questionGoal: Number(formData.get('questionGoal')),
              timerMode: formData.get('timerMode'),
              timerSeconds: Number(formData.get('timerSeconds')),
            }),
          })
            .then(async (response) => {
              const payload = (await response.json().catch(() => null)) as {
                ok?: boolean;
                message?: string;
                redirectTo?: string;
              } | null;

              if (payload?.redirectTo) {
                console.info(
                  `[perf] createSession:api ${Math.round(performance.now() - startedAt)}ms`,
                );
                markDashboardPayloadStale('sessions');
                router.push(payload.redirectTo as never);
                return;
              }

              if (!response.ok || payload?.ok === false) {
                window.sessionStorage.removeItem(
                  'activeboard:session-flow-active',
                );
                setErrorMessage(
                  payload?.message ?? labels.createSessionPending,
                );
                setIsCreating(false);
                return;
              }

              setIsCreating(false);
            })
            .catch(() => {
              window.sessionStorage.removeItem('activeboard:session-flow-active');
              setErrorMessage(labels.createSessionPending);
              setIsCreating(false);
            });
        }}
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="returnTo" value={returnTo} />

        <label className="block">
          <span className="text-sm font-bold text-slate-300">
            {labels.groupName}
          </span>
          <select
            name="groupId"
            value={selectedGroupId}
            onChange={(event) => setSelectedGroupId(event.target.value)}
            className="field mt-2 h-10 rounded-[7px] px-3 py-2 text-sm"
          >
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-bold text-slate-300">
            {labels.sessionName}
          </span>
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
          <span className="text-sm font-bold text-slate-300">
            {labels.questionCount}
          </span>
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
          <span className="text-sm font-bold text-slate-300">
            {labels.timerMode}
          </span>
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
                    : 'hover:border-brand/50 border-white/[0.08] bg-white/[0.035] text-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="timerMode"
                  value={value}
                  checked={timerMode === value}
                  onChange={() =>
                    updateTimerMode(value as 'per_question' | 'global')
                  }
                  className="sr-only"
                />
                <Clock
                  className="h-4 w-4"
                  aria-hidden="true"
                  strokeWidth={1.8}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-bold text-slate-300">
            {timerMode === 'global'
              ? labels.totalTimerSeconds
              : labels.timerSeconds}
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
        {memberCount < 2 ? (
          <p className="text-xs font-semibold text-slate-500">
            {labels.groupAccessHint}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="text-sm font-semibold text-rose-300">{errorMessage}</p>
        ) : null}
        <SubmitButton
          pendingLabel={labels.createSessionPending}
          className="button-primary disabled:bg-brand/40 h-10 w-full rounded-[7px] py-2 text-sm disabled:text-white/60"
          disabled={!isValid || isCreating}
        >
          {isCreating ? labels.createSessionPending : labels.createSession}
        </SubmitButton>
      </form>
    </Modal>
  );
}
