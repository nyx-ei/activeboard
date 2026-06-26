'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock, HelpCircle, Search, UsersRound } from 'lucide-react';

import { Modal, ModalTitle } from '@/components/ui/modal';
import { SubmitButton } from '@/components/ui/submit-button';
import { markDashboardPayloadStale } from '@/components/dashboard/dashboard-data-cache';
import {
  DEFAULT_SESSION_CREATION_POLICY,
  type SessionCreationPolicy,
} from '@/lib/policy/defaults';
import type { PlanNextAccess } from '@/lib/session/plan-next-access';

export type CreateSessionModalLabels = {
  newSession: string;
  createSession: string;
  createSessionPending: string;
  groupName: string;
  sessionName: string;
  sessionNamePlaceholder: string;
  scheduledAt: string;
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
  sessionPolicy = DEFAULT_SESSION_CREATION_POLICY,
  planNextAccess,
  onClose,
}: {
  locale: string;
  groups: Array<{
    id: string;
    name: string;
    memberCount: number;
    membersPreview?: Array<{
      id: string;
      initials: string;
      avatarUrl: string | null;
    }>;
  }>;
  initialGroupId: string;
  canCreateSession: boolean;
  action: (formData: FormData) => void | Promise<void>;
  labels: CreateSessionModalLabels;
  sessionPolicy?: SessionCreationPolicy;
  planNextAccess?: PlanNextAccess;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [name, setName] = useState('');
  const [hasEditedName, setHasEditedName] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const [participantSearch, setParticipantSearch] = useState('');
  const [scheduledAt, setScheduledAt] = useState(() =>
    getDefaultScheduledAtInputValue(),
  );
  const [questionGoal, setQuestionGoal] = useState(
    String(sessionPolicy.defaultQuestionGoal),
  );
  const [timerMode, setTimerMode] = useState<'per_question' | 'global'>(
    'per_question',
  );
  const [timerSeconds, setTimerSeconds] = useState(
    String(sessionPolicy.perQuestionTimerDefaultSeconds),
  );
  const [timerHelpMode, setTimerHelpMode] = useState<
    'per_question' | 'global' | null
  >(null);
  const [paidCandidateResults, setPaidCandidateResults] = useState<
    ParticipantCandidate[]
  >([]);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const minScheduledAt = getMinScheduledAtInputValue();
  const canInviteCandidates = Boolean(planNextAccess?.canInviteCandidates);
  const isLockedTestPlan = Boolean(
    planNextAccess?.isTestPhase && !canInviteCandidates,
  );

  const updateTimerMode = (value: 'per_question' | 'global') => {
    setTimerMode(value);
    setTimerSeconds(
      String(
        value === 'global'
          ? sessionPolicy.globalTimerDefaultSeconds
          : sessionPolicy.perQuestionTimerDefaultSeconds,
      ),
    );
  };

  const selectedGroup =
    groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null;
  const participantCandidates = useMemo(
    () => {
      const localCandidates = getParticipantCandidates(groups);
      if (!canInviteCandidates || paidCandidateResults.length === 0) {
        return localCandidates;
      }

      const candidateById = new Map(
        localCandidates.map((candidate) => [candidate.id, candidate]),
      );
      for (const candidate of paidCandidateResults) {
        candidateById.set(candidate.id, {
          ...candidate,
          groupIds: [
            ...new Set([
              ...(candidateById.get(candidate.id)?.groupIds ?? []),
              ...candidate.groupIds,
            ]),
          ],
          groupNames: [
            ...new Set([
              ...(candidateById.get(candidate.id)?.groupNames ?? []),
              ...candidate.groupNames,
            ]),
          ],
        });
      }

      return [...candidateById.values()].sort((left, right) =>
        left.initials.localeCompare(right.initials),
      );
    },
    [canInviteCandidates, groups, paidCandidateResults],
  );
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<
    string[]
  >(() =>
    getParticipantCandidates(groups)
      .filter((candidate) => candidate.groupIds.includes(initialGroupId))
      .map((candidate) => candidate.id),
  );
  const filteredParticipantCandidates = useMemo(() => {
    const search = participantSearch.trim().toLowerCase();
    if (!search) {
      return participantCandidates;
    }

    return participantCandidates.filter((candidate) =>
      `${candidate.initials} ${candidate.email ?? ''} ${candidate.groupNames.join(' ')}`
        .toLowerCase()
        .includes(search),
    );
  }, [participantCandidates, participantSearch]);
  const selectedParticipantCount = selectedParticipantIds.length;
  const returnTo = selectedGroup
    ? `/${locale}/dashboard?groupId=${encodeURIComponent(selectedGroup.id)}`
    : `/${locale}/dashboard`;
  const participantCopy = getCleanParticipantCopy(locale);
  const timerModeCopy = getCleanTimerModeCopy(locale);

  useEffect(() => {
    if (hasEditedName || !selectedGroup) {
      return;
    }

    setName(getDefaultSessionName(selectedGroup.name));
  }, [hasEditedName, selectedGroup]);

  useEffect(() => {
    if (!canInviteCandidates) {
      setPaidCandidateResults([]);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const query = participantSearch.trim();
    const timer = window.setTimeout(() => {
      void fetch(
        `/api/session-candidates?query=${encodeURIComponent(query)}`,
        {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        },
      )
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as {
            ok?: boolean;
            candidates?: Array<{
              id: string;
              name: string;
              email: string;
              avatarUrl: string | null;
              compatibilityScore?: number;
            }>;
          } | null;

          if (!response.ok || !payload?.ok || cancelled) {
            return;
          }

          setPaidCandidateResults(
            (payload.candidates ?? []).map((candidate) => ({
              id: candidate.id,
              initials: getInitials(candidate.name || candidate.email),
              email: candidate.email,
              avatarUrl: candidate.avatarUrl,
              compatibilityScore: candidate.compatibilityScore,
              groupIds: [],
              groupNames: [
                candidate.compatibilityScore
                  ? locale === 'fr'
                    ? `${candidate.compatibilityScore} creneaux compatibles`
                    : `${candidate.compatibilityScore} compatible slots`
                  : locale === 'fr'
                    ? 'Candidat paye'
                    : 'Paid candidate',
              ],
            })),
          );
        })
        .catch(() => {
          if (!cancelled) {
            setPaidCandidateResults([]);
          }
        });
    }, query ? 160 : 0);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [canInviteCandidates, locale, participantSearch]);

  useEffect(() => {
    if (!isLockedTestPlan) {
      return;
    }

    setQuestionGoal(
      String(
        planNextAccess?.lockedQuestionGoal ??
          sessionPolicy.defaultQuestionGoal,
      ),
    );
    setTimerMode('per_question');
    setTimerSeconds(String(sessionPolicy.perQuestionTimerDefaultSeconds));
  }, [
    isLockedTestPlan,
    planNextAccess?.lockedQuestionGoal,
    sessionPolicy.defaultQuestionGoal,
    sessionPolicy.perQuestionTimerDefaultSeconds,
  ]);

  const isValid =
    canCreateSession &&
    selectedParticipantCount >= sessionPolicy.minimumGroupMembersToStart &&
    name.trim().length > 0 &&
    isValidScheduledAtInput(scheduledAt) &&
    Number(questionGoal) > 0 &&
    Number(questionGoal) <= sessionPolicy.maxQuestionGoal &&
    Number(timerSeconds) > 0 &&
    Number(timerSeconds) <= sessionPolicy.maxTimerSeconds;

  return (
    <Modal
      open
      onClose={onClose}
      backdropLabel={labels.close}
      initialFocusRef={closeButtonRef}
      mobileSheet
      contentClassName="max-h-[90vh] w-full max-w-[478px] overscroll-contain overflow-y-auto rounded-t-[18px] bg-[#111827] p-4 shadow-2xl ring-1 ring-white/[0.08] [scrollbar-width:none] sm:rounded-[14px] sm:p-6 [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex items-center justify-between">
        <ModalTitle className="text-lg font-extrabold text-white">
          {labels.newSession}
        </ModalTitle>
        <button
          ref={closeButtonRef}
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
              participantUserIds: formData.getAll('participantUserIds'),
              sessionName: formData.get('sessionName'),
              scheduledAt: formData.get('scheduledAt'),
              questionGoal: Number(formData.get('questionGoal')),
              timerMode: formData.get('timerMode'),
              timerSeconds: Number(formData.get('timerSeconds')),
            }),
          })
            .then(async (response) => {
              const payload = (await response.json().catch(() => null)) as {
                ok?: boolean;
                message?: string;
                sessionId?: string;
                redirectTo?: string;
                calendarInvitesDispatchUrl?: string;
              } | null;

              if (payload?.redirectTo && response.ok) {
                console.info(
                  `[perf] createSession:api ${Math.round(performance.now() - startedAt)}ms`,
                );
                if (payload.calendarInvitesDispatchUrl) {
                  void fetch(payload.calendarInvitesDispatchUrl, {
                    method: 'POST',
                    credentials: 'same-origin',
                    cache: 'no-store',
                    keepalive: true,
                  }).catch((error) => {
                    console.warn('calendar invite dispatch failed', error);
                  });
                }
                markDashboardPayloadStale('sessions');
                window.sessionStorage.removeItem(
                  'activeboard:session-flow-active',
                );
                window.location.assign(payload.redirectTo);
                onClose();
                return;
              }

              if (payload?.redirectTo) {
                window.sessionStorage.removeItem(
                  'activeboard:session-flow-active',
                );
                window.location.assign(payload.redirectTo);
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
              window.sessionStorage.removeItem(
                'activeboard:session-flow-active',
              );
              setErrorMessage(labels.createSessionPending);
              setIsCreating(false);
            });
        }}
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="returnTo" value={returnTo} />
        {selectedParticipantIds.map((participantId) => (
          <input
            key={participantId}
            type="hidden"
            name="participantUserIds"
            value={participantId}
          />
        ))}

        <label className="block">
          <span className="text-sm font-bold text-slate-300">
            {participantCopy.poolLabel}
          </span>
          <select
            name="groupId"
            value={selectedGroupId}
            onChange={(event) => {
              const nextGroupId = event.target.value;
              setSelectedGroupId(nextGroupId);
              setSelectedParticipantIds(
                participantCandidates
                  .filter((candidate) => candidate.groupIds.includes(nextGroupId))
                  .map((candidate) => candidate.id),
              );
            }}
            className="field mt-2 h-10 rounded-[7px] px-3 py-2 text-sm"
          >
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>

        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-bold text-slate-300">
              {participantCopy.participants}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {participantCopy.selected.replace(
                '{count}',
                String(selectedParticipantCount),
              )}
            </span>
          </div>
          <div className="mt-2 rounded-[10px] border border-white/[0.08] bg-white/[0.025] p-2">
            <label className="flex h-9 items-center gap-2 rounded-[8px] border border-white/[0.06] bg-[#071512] px-2 text-sm text-slate-300">
              <Search className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <input
                value={participantSearch}
                onChange={(event) => setParticipantSearch(event.target.value)}
                placeholder={participantCopy.search}
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-600"
              />
            </label>
            <div className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {filteredParticipantCandidates.length > 0 ? (
                filteredParticipantCandidates.map((candidate) => {
                  const isSelected = selectedParticipantIds.includes(
                    candidate.id,
                  );

                  return (
                    <label
                      key={candidate.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-[9px] px-2 py-2 transition ${
                        isSelected
                          ? 'bg-brand/10 text-white'
                          : 'text-slate-300 hover:bg-white/[0.04]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(event) => {
                          setSelectedParticipantIds((current) =>
                            event.target.checked
                              ? [...new Set([...current, candidate.id])]
                              : current.filter((id) => id !== candidate.id),
                          );
                        }}
                        className="sr-only"
                      />
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-[#22504a] bg-cover bg-center text-[11px] font-bold text-[#9FF0CE]"
                        style={{
                          backgroundImage: candidate.avatarUrl
                            ? `url("${candidate.avatarUrl}")`
                            : undefined,
                        }}
                      >
                        {candidate.avatarUrl ? null : candidate.initials}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {candidate.initials}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {candidate.email ?? candidate.groupNames.join(' · ')}
                        </span>
                      </span>
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          isSelected
                            ? 'border-brand bg-brand text-[#06120e]'
                            : 'border-white/[0.12] text-transparent'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </label>
                  );
                })
              ) : (
                <div className="flex items-center gap-2 rounded-[9px] px-2 py-3 text-sm text-slate-500">
                  <UsersRound className="h-4 w-4" aria-hidden="true" />
                  {participantCopy.empty}
                </div>
              )}
            </div>
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-bold text-slate-300">
            {labels.sessionName}
          </span>
          <input
            name="sessionName"
            value={name}
            onChange={(event) => {
              setHasEditedName(true);
              setName(event.target.value);
            }}
            placeholder={labels.sessionNamePlaceholder}
            className="field mt-2 h-10 rounded-[7px] px-3 py-2 text-sm"
            autoComplete="off"
          />
        </label>

        <label className="block">
          <span className="text-sm font-bold text-slate-300">
            {labels.scheduledAt}
          </span>
          {isLockedTestPlan ? (
            <>
              <input type="hidden" name="scheduledAt" value={scheduledAt} />
              <input
                type="time"
                value={scheduledAt.slice(11, 16)}
                onChange={(event) =>
                  setScheduledAt(
                    mergeLockedDateWithTime(scheduledAt, event.target.value),
                  )
                }
                className="field mt-2 h-10 min-w-0 rounded-[7px] px-3 py-2 text-sm [color-scheme:dark]"
              />
            </>
          ) : (
            <input
              name="scheduledAt"
              type="datetime-local"
              min={minScheduledAt}
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              className="field mt-2 h-10 min-w-0 rounded-[7px] px-3 py-2 text-sm [color-scheme:dark]"
            />
          )}
        </label>

        <label className="block">
          <span className="text-sm font-bold text-slate-300">
            {labels.questionCount}
          </span>
          <input
            name="questionGoal"
            type="number"
            min="1"
            max={sessionPolicy.maxQuestionGoal}
            value={questionGoal}
            readOnly={isLockedTestPlan}
            onChange={(event) => setQuestionGoal(event.target.value)}
            className="field mt-2 h-10 rounded-[7px] px-3 py-2 text-sm read-only:cursor-not-allowed read-only:opacity-70"
          />
        </label>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-300">
              {labels.timerMode}
            </span>
            {timerHelpMode ? (
              <button
                type="button"
                onClick={() => setTimerHelpMode(null)}
                className="text-xs font-bold text-brand transition hover:text-[#9FF0CE]"
              >
                {locale === 'fr' ? 'Fermer' : 'Close'}
              </button>
            ) : null}
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {[
              [
                'per_question',
                labels.perQuestionMode,
                timerModeCopy.perQuestionTitle,
              ],
              [
                'global',
                labels.globalMode,
                timerModeCopy.globalTitle,
              ],
            ].map(([value, label, title]) => (
              <div
                key={value}
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-[10px] border px-3 py-2 text-left transition ${
                  timerMode === value
                    ? 'border-brand bg-brand text-[#06120e]'
                    : 'hover:border-brand/50 border-white/[0.08] bg-white/[0.035] text-slate-300'
                }`}
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="timerMode"
                    value={value}
                    checked={timerMode === value}
                    onChange={() =>
                      !isLockedTestPlan &&
                      updateTimerMode(value as 'per_question' | 'global')
                    }
                    disabled={isLockedTestPlan}
                    className="sr-only"
                  />
                  <Clock
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                    strokeWidth={1.8}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold">
                      {title}
                    </span>
                    <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.12em] opacity-75">
                      {label}
                    </span>
                  </span>
                </label>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setTimerHelpMode(
                      timerHelpMode === value
                        ? null
                        : (value as 'per_question' | 'global'),
                    );
                  }}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition ${
                    timerMode === value
                      ? 'bg-[#06382d]/10 text-[#06382d]'
                      : 'bg-white/[0.04] text-slate-500 hover:text-white'
                  }`}
                  aria-label={
                    locale === 'fr'
                      ? `Aide ${title}`
                      : `Help ${title}`
                  }
                >
                  <HelpCircle className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          {timerHelpMode ? (
            <div
              role="dialog"
              aria-modal="false"
              className="mt-2 rounded-[10px] border border-brand/25 bg-[#071512] px-3 py-2 text-xs font-semibold leading-5 text-slate-300 shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
            >
              {timerHelpMode === 'per_question'
                ? timerModeCopy.perQuestionHint
                : timerModeCopy.globalHint}
            </div>
          ) : null}
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
            max={sessionPolicy.maxTimerSeconds}
            value={timerSeconds}
            readOnly={isLockedTestPlan}
            onChange={(event) => setTimerSeconds(event.target.value)}
            className="field mt-2 h-10 rounded-[7px] px-3 py-2 text-sm read-only:cursor-not-allowed read-only:opacity-70"
          />
        </label>

        <p className="text-xs italic text-slate-500">
          {isLockedTestPlan
            ? locale === 'fr'
              ? `Seule l'heure est modifiable pendant les ${planNextAccess?.requiredTestSessions ?? 3} seances test.`
              : `Only the time can be changed during the first ${planNextAccess?.requiredTestSessions ?? 3} test sessions.`
            : labels.modalHint}
        </p>
        {selectedParticipantCount < sessionPolicy.minimumGroupMembersToStart ? (
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

function getDefaultSessionName(groupName: string) {
  const cleanName = groupName.trim();

  if (!cleanName) {
    return 'Session';
  }

  return cleanName.length > 38 ? cleanName.slice(0, 38).trim() : cleanName;
}

function getDefaultScheduledAtInputValue() {
  const next = new Date();
  next.setMinutes(next.getMinutes() + 60);
  next.setSeconds(0, 0);
  const roundedMinutes = Math.ceil(next.getMinutes() / 15) * 15;
  if (roundedMinutes >= 60) {
    next.setHours(next.getHours() + 1);
    next.setMinutes(0);
  } else {
    next.setMinutes(roundedMinutes);
  }

  return formatDateTimeLocalValue(next);
}

function getMinScheduledAtInputValue() {
  const now = new Date();
  now.setSeconds(0, 0);

  return formatDateTimeLocalValue(now);
}

function formatDateTimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function mergeLockedDateWithTime(currentValue: string, nextValue: string) {
  const currentDate = currentValue.slice(0, 10);
  const nextTime = nextValue.includes('T')
    ? nextValue.slice(11, 16)
    : nextValue.slice(0, 5);

  if (!currentDate || !nextTime) {
    return currentValue;
  }

  return `${currentDate}T${nextTime}`;
}

function isValidScheduledAtInput(value: string) {
  if (!value) {
    return false;
  }

  const scheduledAt = new Date(value);

  return (
    Number.isFinite(scheduledAt.getTime()) &&
    scheduledAt.getTime() >= Date.now() - 5 * 60 * 1000
  );
}

type ParticipantCandidate = {
  id: string;
  initials: string;
  email?: string;
  compatibilityScore?: number;
  avatarUrl: string | null;
  groupIds: string[];
  groupNames: string[];
};

function getInitials(value: string) {
  return (
    value
      .split(/[\s@._-]+/)
      .map((part) => part.trim()[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'AB'
  );
}

function getParticipantCandidates(
  groups: Array<{
    id: string;
    name: string;
    membersPreview?: Array<{
      id: string;
      initials: string;
      avatarUrl: string | null;
    }>;
  }>,
) {
  const candidateById = new Map<string, ParticipantCandidate>();

  for (const group of groups) {
    for (const member of group.membersPreview ?? []) {
      const current = candidateById.get(member.id);
      if (current) {
        if (!current.groupIds.includes(group.id)) {
          current.groupIds.push(group.id);
        }
        if (!current.groupNames.includes(group.name)) {
          current.groupNames.push(group.name);
        }
        continue;
      }

      candidateById.set(member.id, {
        id: member.id,
        initials: member.initials,
        avatarUrl: member.avatarUrl,
        groupIds: [group.id],
        groupNames: [group.name],
      });
    }
  }

  return [...candidateById.values()].sort((left, right) =>
    left.initials.localeCompare(right.initials),
  );
}

function getCleanParticipantCopy(locale: string) {
  if (locale === 'fr') {
    return {
      poolLabel: 'Pool de départ',
      participants: 'Participants de la session',
      selected: '{count} sélectionnés',
      search: 'Rechercher un membre',
      empty: 'Aucun membre disponible',
    };
  }

  return {
    poolLabel: 'Starting pool',
    participants: 'Session participants',
    selected: '{count} selected',
    search: 'Search a member',
    empty: 'No member available',
  };
}

function getCleanTimerModeCopy(locale: string) {
  if (locale === 'fr') {
    return {
      perQuestionTitle: 'Question puis révision',
      perQuestionDescription:
        'Chaque question est corrigée juste après les réponses.',
      perQuestionHint:
        'Idéal pour une séance guidée : réponse, correction immédiate, puis question suivante.',
      globalTitle: 'Mode examen',
      globalDescription:
        'Toute la série est faite avant la révision depuis la première question.',
      globalHint:
        "Idéal pour simuler un examen : toutes les questions d'abord, puis la révision complète.",
    };
  }

  return {
    perQuestionTitle: 'Question then review',
    perQuestionDescription:
      'Each question is reviewed right after answers are submitted.',
    perQuestionHint:
      'Best for guided practice: answer, immediate review, then the next question.',
    globalTitle: 'Exam mode',
    globalDescription:
      'The full set is answered first, then reviewed from question one.',
    globalHint:
      'Best for exam simulation: all questions first, then one complete review pass.',
  };
}

export function getParticipantCopy(locale: string) {
  if (locale === 'fr') {
    return {
      poolLabel: 'Pool de départ',
      participants: 'Participants de la session',
      selected: '{count} sélectionnés',
      search: 'Rechercher un membre',
      empty: 'Aucun membre disponible',
    };
  }

  return {
    poolLabel: 'Starting pool',
    participants: 'Session participants',
    selected: '{count} selected',
    search: 'Search a member',
    empty: 'No member available',
  };
}

export function getTimerModeCopy(locale: string) {
  if (locale === 'fr') {
    return {
      perQuestionTitle: 'Question puis révision',
      perQuestionDescription:
        'Chaque question est corrigée juste après les réponses.',
      perQuestionHint:
        'Idéal pour une séance guidée : réponse, correction immédiate, puis question suivante.',
      globalTitle: 'Mode examen',
      globalDescription:
        'Toute la série est faite avant la révision depuis la première question.',
      globalHint:
        'Idéal pour simuler un examen : toutes les questions d’abord, puis la révision complète.',
    };
  }

  return {
    perQuestionTitle: 'Question then review',
    perQuestionDescription:
      'Each question is reviewed right after answers are submitted.',
    perQuestionHint:
      'Best for guided practice: answer, immediate review, then the next question.',
    globalTitle: 'Exam mode',
    globalDescription:
      'The full set is answered first, then reviewed from question one.',
    globalHint:
      'Best for exam simulation: all questions first, then one complete review pass.',
  };
}
