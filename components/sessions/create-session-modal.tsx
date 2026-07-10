'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  Clock,
  Copy,
  HelpCircle,
  Lock,
  MessageCircle,
  Pencil,
  Search,
  SlidersHorizontal,
  UsersRound,
} from 'lucide-react';

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
  existingSession,
}: {
  locale: string;
  groups: Array<{
    id: string;
    name: string;
    memberCount: number;
    membersPreview?: Array<{
      id: string;
      initials: string;
      name?: string | null;
      email?: string | null;
      phoneNumber?: string | null;
      avatarUrl: string | null;
    }>;
  }>;
  initialGroupId: string;
  canCreateSession: boolean;
  action?: (formData: FormData) => void | Promise<void>;
  labels: CreateSessionModalLabels;
  sessionPolicy?: SessionCreationPolicy;
  planNextAccess?: PlanNextAccess;
  onClose: () => void;
  existingSession?: {
    id: string;
    groupId: string;
    name: string | null;
    scheduledAt: string;
    questionGoal: number;
    timerMode: 'per_question' | 'global';
    timerSeconds: number;
    meetingLink: string | null;
  };
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isExistingSessionPlan = Boolean(existingSession);
  const [name, setName] = useState(existingSession?.name ?? '');
  const [selectedGroupId, setSelectedGroupId] = useState(
    existingSession?.groupId ?? initialGroupId,
  );
  const [participantSearch, setParticipantSearch] = useState('');
  const [scheduledAt, setScheduledAt] = useState(() =>
    existingSession
      ? formatDateTimeLocalValue(new Date(existingSession.scheduledAt))
      : getDefaultScheduledAtInputValue(),
  );
  const [questionGoal, setQuestionGoal] = useState(
    String(existingSession?.questionGoal ?? sessionPolicy.defaultQuestionGoal),
  );
  const [timerMode, setTimerMode] = useState<'per_question' | 'global'>(
    existingSession?.timerMode ?? 'per_question',
  );
  const [timerSeconds, setTimerSeconds] = useState(
    String(
      existingSession?.timerSeconds ??
        sessionPolicy.perQuestionTimerDefaultSeconds,
    ),
  );
  const [meetingLink, setMeetingLink] = useState(
    existingSession?.meetingLink ?? '',
  );
  const [timerHelpMode, setTimerHelpMode] = useState<
    'per_question' | 'global' | null
  >(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [paidCandidateResults, setPaidCandidateResults] = useState<
    ParticipantCandidate[]
  >([]);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const minScheduledAt = getMinScheduledAtInputValue();
  const canInviteCandidates = Boolean(planNextAccess?.canInviteCandidates);
  const isLockedTestPlan = Boolean(
    (planNextAccess?.isTestPhase && !canInviteCandidates) ||
      isExistingSessionPlan,
  );
  const shouldLockTimerSettings =
    isLockedTestPlan && !isExistingSessionPlan;
  const existingSessionId = existingSession?.id;
  const existingSessionGroupId = existingSession?.groupId;
  const existingSessionName = existingSession?.name;
  const existingSessionScheduledAt = existingSession?.scheduledAt;
  const existingSessionQuestionGoal = existingSession?.questionGoal;
  const existingSessionTimerMode = existingSession?.timerMode;
  const existingSessionTimerSeconds = existingSession?.timerSeconds;
  const existingSessionMeetingLink = existingSession?.meetingLink;

  useEffect(() => {
    if (!existingSessionId || !existingSessionGroupId) {
      return;
    }

    setName(existingSessionName ?? '');
    setSelectedGroupId(existingSessionGroupId);
    setScheduledAt(
      formatDateTimeLocalValue(new Date(existingSessionScheduledAt ?? '')),
    );
    setQuestionGoal(String(existingSessionQuestionGoal ?? sessionPolicy.defaultQuestionGoal));
    setTimerMode(existingSessionTimerMode ?? 'per_question');
    setTimerSeconds(
      String(
        existingSessionTimerSeconds ??
          sessionPolicy.perQuestionTimerDefaultSeconds,
      ),
    );
    setMeetingLink(existingSessionMeetingLink ?? '');
  }, [
    existingSessionGroupId,
    existingSessionId,
    existingSessionMeetingLink,
    existingSessionName,
    existingSessionQuestionGoal,
    existingSessionScheduledAt,
    existingSessionTimerMode,
    existingSessionTimerSeconds,
    sessionPolicy.defaultQuestionGoal,
    sessionPolicy.perQuestionTimerDefaultSeconds,
  ]);

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
        formatCandidateName(left).localeCompare(formatCandidateName(right)),
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
    const visibleCandidates = canInviteCandidates
      ? participantCandidates
      : participantCandidates.filter((candidate) =>
          candidate.groupIds.includes(selectedGroupId),
        );
    const search = participantSearch.trim().toLowerCase();
    if (!canInviteCandidates || !search) {
      return visibleCandidates;
    }

    return visibleCandidates.filter((candidate) =>
      `${candidate.name ?? ''} ${candidate.initials} ${candidate.email ?? ''} ${candidate.phoneNumber ?? ''}`
        .toLowerCase()
        .includes(search),
    );
  }, [canInviteCandidates, participantCandidates, participantSearch, selectedGroupId]);
  const selectedParticipantCount = selectedParticipantIds.length;
  const minimumParticipantCount = isExistingSessionPlan
    ? 1
    : sessionPolicy.minimumGroupMembersToStart;
  const returnTo = selectedGroup
    ? existingSession
      ? `/${locale}/sessions/${existingSession.id}?stage=progress`
      : `/${locale}/dashboard?groupId=${encodeURIComponent(selectedGroup.id)}`
    : `/${locale}/dashboard`;
  const participantCopy = getCleanParticipantCopy(locale);
  const timerModeCopy = getCleanTimerModeCopy(locale);
  const wizardCopy = getSessionWizardCopy(locale);
  const submitLabel = isExistingSessionPlan
    ? locale === 'fr'
      ? 'Planifier la séance'
      : 'Schedule session'
    : labels.createSession;

  const requiredLabel = locale === 'fr' ? 'Obligatoire' : 'Required';
  const isNameInvalid = !name.trim();
  const isParticipantsInvalid =
    !isLockedTestPlan && selectedParticipantCount < minimumParticipantCount;
  const isScheduledAtInvalid = !isValidScheduledAtInput(
    scheduledAt,
    isLockedTestPlan,
  );
  const isMeetingLinkInvalid = isExistingSessionPlan && !meetingLink.trim();
  const isQuestionGoalInvalid =
    !Number.isFinite(Number(questionGoal)) ||
    Number(questionGoal) < 1 ||
    Number(questionGoal) > sessionPolicy.maxQuestionGoal;
  const isTimerSecondsInvalid =
    !Number.isFinite(Number(timerSeconds)) ||
    Number(timerSeconds) < 1 ||
    Number(timerSeconds) > sessionPolicy.maxTimerSeconds;
  const stepHasIssue =
    wizardStep === 0
      ? isNameInvalid || isParticipantsInvalid
      : wizardStep === 1
        ? isScheduledAtInvalid
        : isMeetingLinkInvalid ||
          isQuestionGoalInvalid ||
          isTimerSecondsInvalid;

  function goToNextWizardStep() {
    setErrorMessage(null);
    setWizardStep((current) => Math.min(current + 1, 2));
  }

  function goToPreviousWizardStep() {
    setErrorMessage(null);
    setWizardStep((current) => Math.max(current - 1, 0));
  }

  const WizardStepIcon =
    wizardStep === 0
      ? MessageCircle
      : wizardStep === 1
        ? CalendarClock
        : SlidersHorizontal;

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
              phoneNumber?: string | null;
            }>;
          } | null;

          if (!response.ok || !payload?.ok || cancelled) {
            return;
          }

          setPaidCandidateResults(
            (payload.candidates ?? []).map((candidate) => ({
              id: candidate.id,
              name: candidate.name,
              initials: getInitials(candidate.name || candidate.email),
              email: candidate.email,
              phoneNumber: candidate.phoneNumber,
              avatarUrl: candidate.avatarUrl,
              groupIds: [],
              groupNames: [],
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
    if (!isLockedTestPlan || isExistingSessionPlan) {
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
    isExistingSessionPlan,
    planNextAccess?.lockedQuestionGoal,
    sessionPolicy.defaultQuestionGoal,
    sessionPolicy.perQuestionTimerDefaultSeconds,
  ]);

  const validationIssue = getCreateSessionValidationIssue({
    locale,
    canCreateSession,
    selectedParticipantCount,
    minimumParticipantCount,
    name,
    scheduledAt,
    questionGoal,
    maxQuestionGoal: sessionPolicy.maxQuestionGoal,
    timerSeconds,
    maxTimerSeconds: sessionPolicy.maxTimerSeconds,
    meetingLink,
    requireMeetingLink: isExistingSessionPlan,
    allowPastScheduledAt: isLockedTestPlan,
  });
  return (
    <Modal
      open
      onClose={onClose}
      backdropLabel={labels.close}
      initialFocusRef={closeButtonRef}
      mobileSheet
      contentClassName="max-h-[90vh] w-full max-w-[calc(100vw-12px)] overscroll-contain overflow-x-hidden overflow-y-auto rounded-t-[18px] bg-[#111827] p-2.5 shadow-2xl ring-1 ring-white/[0.08] [scrollbar-width:none] sm:max-w-[540px] sm:rounded-[14px] sm:p-6 [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {wizardStep > 0 ? (
              <button
                type="button"
                onClick={goToPreviousWizardStep}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.035] text-slate-300 transition hover:border-brand/50 hover:text-white"
                aria-label={wizardCopy.previous}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
            <ModalTitle className="flex min-w-0 flex-1 items-center gap-2 text-xl font-extrabold text-white">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                readOnly={isExistingSessionPlan}
                placeholder={labels.sessionNamePlaceholder}
                className="min-w-0 flex-1 truncate bg-transparent text-xl font-extrabold text-white outline-none placeholder:text-slate-500 read-only:cursor-not-allowed"
                autoComplete="off"
                aria-label={labels.sessionName}
              />
              {isExistingSessionPlan ? (
                <Lock className="h-4 w-4 shrink-0 text-amber-200" aria-hidden="true" />
              ) : (
                <Pencil className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
              )}
            </ModalTitle>
          </div>
          {isNameInvalid ? (
            <p className="mt-1 text-xs font-bold text-rose-300">
              {requiredLabel}
            </p>
          ) : null}
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {wizardCopy.steps.map((step, index) => (
              <span
                key={step}
                className={`h-1.5 rounded-full ${
                  index <= wizardStep ? 'bg-brand' : 'bg-white/[0.08]'
                }`}
                aria-hidden="true"
              />
            ))}
          </div>
          <p className="mt-3 flex items-center justify-center gap-2 text-center text-sm font-extrabold text-white">
            <WizardStepIcon className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
            {wizardCopy.steps[wizardStep]}
          </p>
        </div>
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
        className="mt-5 flex min-w-0 flex-col gap-4"
        onSubmit={(event) => {
          if (isCreating) {
            event.preventDefault();
            return;
          }

          event.preventDefault();
          if (wizardStep < 2) {
            goToNextWizardStep();
            return;
          }

          if (validationIssue) {
            setErrorMessage(validationIssue);
            return;
          }

          setErrorMessage(null);
          setIsCreating(true);
          window.sessionStorage.setItem('activeboard:session-flow-active', '1');
          window.dispatchEvent(
            new CustomEvent('activeboard:session-flow-started'),
          );
          const startedAt = performance.now();
          const formData = new FormData(event.currentTarget);
          void fetch(
            existingSession
              ? `/api/sessions/${existingSession.id}/schedule`
              : '/api/sessions',
            {
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
              scheduledAt: toScheduledAtPayload(
                String(formData.get('scheduledAt') ?? ''),
              ),
              questionGoal: Number(formData.get('questionGoal')),
              timerMode: formData.get('timerMode'),
              timerSeconds: Number(formData.get('timerSeconds')),
              meetingLink: formData.get('meetingLink'),
            }),
            },
          )
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
        <input type="hidden" name="groupId" value={selectedGroupId} />
        <input type="hidden" name="sessionName" value={name} />
        <input type="hidden" name="scheduledAt" value={scheduledAt} />
        <input type="hidden" name="questionGoal" value={questionGoal} />
        <input type="hidden" name="timerMode" value={timerMode} />
        <input type="hidden" name="timerSeconds" value={timerSeconds} />
        <input type="hidden" name="meetingLink" value={meetingLink} />
        {selectedParticipantIds.map((participantId) => (
          <input
            key={participantId}
            type="hidden"
            name="participantUserIds"
            value={participantId}
          />
        ))}
        <label
          className={
            isLockedTestPlan || wizardStep !== 0 ? 'hidden' : 'block'
          }
        >
          <span className="text-sm font-bold text-slate-300">
            {participantCopy.poolLabel}
          </span>
          <select
            disabled={isLockedTestPlan}
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
                {group.name} · {formatPoolMemberCount(group.memberCount, locale)}
              </option>
            ))}
          </select>
        </label>

        <div className={wizardStep === 0 ? 'block' : 'hidden'}>
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
            <label
              className={`flex h-10 items-center gap-2 rounded-[8px] border px-2 text-sm text-slate-300 ${
                canInviteCandidates
                  ? 'border-white/[0.06] bg-[#071512]'
                  : 'border-amber-200/20 bg-amber-200/[0.06]'
              }`}
            >
              <Search
                className="h-4 w-4 shrink-0 text-slate-500"
                aria-hidden="true"
              />
              {!canInviteCandidates ? (
                <Lock
                  className="h-4 w-4 shrink-0 text-amber-200"
                  aria-hidden="true"
                />
              ) : null}
              <input
                value={participantSearch}
                onChange={(event) => setParticipantSearch(event.target.value)}
                placeholder={
                  canInviteCandidates
                    ? participantCopy.search
                    : isLockedTestPlan
                      ? participantCopy.searchLockedTest
                      : participantCopy.searchLockedPayment
                }
                disabled={!canInviteCandidates}
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-500 disabled:cursor-not-allowed"
              />
            </label>
            {!canInviteCandidates && !isLockedTestPlan ? (
              <a
                href={`/${locale}/billing`}
                className="mt-2 inline-flex h-8 items-center justify-center rounded-full border border-brand/30 px-3 text-xs font-extrabold text-brand transition hover:bg-brand/10"
              >
                {participantCopy.unlockSearch}
              </a>
            ) : null}
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {filteredParticipantCandidates.length > 0 ? (
                filteredParticipantCandidates.map((candidate) => {
                  const isSelected = selectedParticipantIds.includes(
                    candidate.id,
                  );
                  const candidateName = formatCandidateName(candidate);
                  const candidateContact = formatCandidateContact(
                    candidate,
                    participantCopy,
                  );
                  const candidatePhone = candidate.phoneNumber?.trim();

                  return (
                    <label
                      key={candidate.id}
                      className={`grid h-10 cursor-pointer grid-cols-[32px_minmax(72px,1fr)_minmax(82px,0.86fr)_auto] items-center gap-2 rounded-[9px] px-2 transition ${
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
                      <span className="min-w-0 truncate text-sm font-semibold">
                        {candidateName}
                      </span>
                      <span className="min-w-0 truncate text-xs font-semibold text-slate-400">
                        {candidateContact}
                      </span>
                      {candidatePhone ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void copyCandidatePhone(candidatePhone);
                          }}
                          className="flex h-7 shrink-0 items-center justify-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-2 text-[10px] font-bold text-slate-400 transition hover:border-brand/40 hover:text-brand"
                          aria-label={participantCopy.copyPhone}
                          title={participantCopy.copyPhone}
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{participantCopy.copyAction}</span>
                        </button>
                      ) : (
                        <span aria-hidden="true" />
                      )}
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
          {isParticipantsInvalid ? (
            <p className="mt-1 text-xs font-bold text-rose-300">
              {requiredLabel}
            </p>
          ) : null}
        </div>

        <div className={wizardStep === 1 ? 'block' : 'hidden'}>
          <span className="text-sm font-bold text-slate-300">
            {labels.scheduledAt}
          </span>
          <div className="mt-2 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,0.64fr)] gap-1.5 sm:gap-2">
            <label className="relative block min-w-0">
              {isLockedTestPlan ? (
                <Lock
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-200"
                  aria-hidden="true"
                />
              ) : null}
              <input
                type="date"
                min={minScheduledAt.slice(0, 10)}
                value={scheduledAt.slice(0, 10)}
                disabled={isLockedTestPlan}
                onChange={(event) =>
                  setScheduledAt(
                    mergeDateWithTime(scheduledAt, event.target.value),
                  )
                }
                className={`field h-10 min-w-0 max-w-full rounded-[7px] px-1.5 py-2 text-center text-[12px] [color-scheme:dark] sm:px-3 sm:text-left sm:text-sm ${
                  isLockedTestPlan
                    ? 'cursor-not-allowed pr-9 text-slate-400 opacity-75'
                    : ''
                }`}
                aria-label={
                  locale === 'fr' ? 'Date de la séance' : 'Session date'
                }
              />
            </label>
            <input
              type="time"
              value={scheduledAt.slice(11, 16)}
              onChange={(event) =>
                setScheduledAt(
                  mergeLockedDateWithTime(scheduledAt, event.target.value),
                )
              }
              className="field h-10 min-w-0 max-w-full rounded-[7px] px-1.5 py-2 text-center text-[12px] [color-scheme:dark] sm:px-3 sm:text-left sm:text-sm"
              aria-label={
                locale === 'fr' ? 'Heure de la séance' : 'Session time'
              }
            />
          </div>
          {isScheduledAtInvalid ? (
            <p className="mt-1 text-xs font-bold text-rose-300">
              {requiredLabel}
            </p>
          ) : null}
        </div>

        <label className={wizardStep === 2 ? 'order-[32] block' : 'hidden'}>
          <span className="text-sm font-bold text-slate-300">
            {locale === 'fr' ? 'Lien de réunion' : 'Meeting link'}
          </span>
          <input
            type="url"
            value={meetingLink}
            onChange={(event) => setMeetingLink(event.target.value)}
            placeholder="https://..."
            className="field mt-2 h-10 rounded-[7px] px-3 py-2 text-sm"
            autoComplete="off"
          />
          {isMeetingLinkInvalid ? (
            <p className="mt-1 text-xs font-bold text-rose-300">
              {requiredLabel}
            </p>
          ) : null}
        </label>

        <div
          className={`order-[31] grid min-w-0 grid-cols-2 gap-1.5 sm:gap-2 ${
            wizardStep === 2 ? '' : 'hidden'
          }`}
        >
          <label className="relative block min-w-0">
            <span className="block text-xs font-bold leading-tight text-slate-300 sm:text-sm">
              {labels.questionCount}
            </span>
            {isLockedTestPlan ? (
              <Lock
                className="pointer-events-none absolute right-3 top-[38px] h-4 w-4 text-amber-200"
                aria-hidden="true"
              />
            ) : null}
            <input
              type="number"
              min="1"
              max={sessionPolicy.maxQuestionGoal}
              value={questionGoal}
              readOnly={isLockedTestPlan}
              onChange={(event) => setQuestionGoal(event.target.value)}
              className="field mt-2 h-10 min-w-0 rounded-[7px] px-2 py-2 text-sm read-only:cursor-not-allowed read-only:pr-9 read-only:opacity-70 sm:px-3"
            />
            {isQuestionGoalInvalid ? (
              <p className="mt-1 text-xs font-bold text-rose-300">
                {requiredLabel}
              </p>
            ) : null}
          </label>
          <label className="block min-w-0">
            <span className="block text-xs font-bold leading-tight text-slate-300 sm:text-sm">
              {timerMode === 'global'
                ? labels.totalTimerSeconds
                : labels.timerSeconds}
            </span>
            <input
              type="number"
              min="1"
              max={sessionPolicy.maxTimerSeconds}
              value={timerSeconds}
              readOnly={shouldLockTimerSettings}
              onChange={(event) => setTimerSeconds(event.target.value)}
              className="field mt-2 h-10 min-w-0 rounded-[7px] px-2 py-2 text-sm read-only:cursor-not-allowed read-only:opacity-70 sm:px-3"
            />
            {isTimerSecondsInvalid ? (
              <p className="mt-1 text-xs font-bold text-rose-300">
                {requiredLabel}
              </p>
            ) : null}
          </label>
        </div>

        <div className={wizardStep === 2 ? 'order-[30] block' : 'hidden'}>
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
                    value={value}
                    checked={timerMode === value}
                    onChange={() =>
                      !shouldLockTimerSettings &&
                      updateTimerMode(value as 'per_question' | 'global')
                    }
                    disabled={shouldLockTimerSettings}
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

        {!isLockedTestPlan ? (
          <p className="text-xs italic text-slate-500">{labels.modalHint}</p>
        ) : null}
        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-[10px] border border-rose-300/20 bg-rose-300/[0.08] px-3 py-3 text-sm font-semibold leading-5 text-rose-100 shadow-[0_16px_42px_rgba(0,0,0,0.18)]"
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-300/10 text-rose-200">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">{errorMessage}</span>
          </div>
        ) : null}
        {wizardStep < 2 ? (
          <button
            type="button"
            onClick={goToNextWizardStep}
            disabled={stepHasIssue}
            className="button-primary disabled:bg-brand/40 h-10 w-full rounded-[7px] py-2 text-sm font-extrabold disabled:text-white/60"
          >
            {wizardCopy.next}
          </button>
        ) : (
          <SubmitButton
            pendingLabel={labels.createSessionPending}
            className="button-primary disabled:bg-brand/40 h-10 w-full rounded-[7px] py-2 text-sm disabled:text-white/60"
            disabled={isCreating || stepHasIssue}
          >
            {isCreating ? labels.createSessionPending : submitLabel}
          </SubmitButton>
        )}
      </form>
    </Modal>
  );
}

function getDefaultScheduledAtInputValue(): string {
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

function getMinScheduledAtInputValue(): string {
  const now = new Date();
  now.setSeconds(0, 0);

  return formatDateTimeLocalValue(now);
}

function formatDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');

  if (!Number.isFinite(date.getTime())) {
    return getDefaultScheduledAtInputValue();
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toScheduledAtPayload(value: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return date.toISOString();
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

function mergeDateWithTime(currentValue: string, nextDate: string) {
  const safeDate = nextDate.slice(0, 10);
  const currentTime = currentValue.slice(11, 16) || '09:00';

  if (!safeDate || !currentTime) {
    return currentValue;
  }

  return `${safeDate}T${currentTime}`;
}

function isValidScheduledAtInput(value: string, allowPast = false) {
  if (!value) {
    return false;
  }

  const scheduledAt = new Date(value);

  if (!Number.isFinite(scheduledAt.getTime())) {
    return false;
  }

  return allowPast || scheduledAt.getTime() >= Date.now() - 5 * 60 * 1000;
}

function getCreateSessionValidationIssue({
  locale,
  canCreateSession,
  selectedParticipantCount,
  minimumParticipantCount,
  name,
  scheduledAt,
  questionGoal,
  maxQuestionGoal,
  timerSeconds,
  maxTimerSeconds,
  meetingLink,
  requireMeetingLink = false,
  allowPastScheduledAt = false,
}: {
  locale: string;
  canCreateSession: boolean;
  selectedParticipantCount: number;
  minimumParticipantCount: number;
  name: string;
  scheduledAt: string;
  questionGoal: string;
  maxQuestionGoal: number;
  timerSeconds: string;
  maxTimerSeconds: number;
  meetingLink?: string;
  requireMeetingLink?: boolean;
  allowPastScheduledAt?: boolean;
}) {
  const copy = getCreateSessionValidationCopy(locale);
  const questionGoalValue = Number(questionGoal);
  const timerSecondsValue = Number(timerSeconds);

  if (!canCreateSession) {
    return copy.notAllowed;
  }

  if (selectedParticipantCount < minimumParticipantCount) {
    return copy.minimumParticipants
      .replace('{minimum}', String(minimumParticipantCount))
      .replace('{selected}', String(selectedParticipantCount));
  }

  if (!name.trim()) {
    return copy.sessionName;
  }

  if (!isValidScheduledAtInput(scheduledAt, allowPastScheduledAt)) {
    return copy.scheduledAt;
  }

  if (requireMeetingLink && !meetingLink?.trim()) {
    return copy.meetingLink;
  }

  if (
    !Number.isFinite(questionGoalValue) ||
    questionGoalValue < 1 ||
    questionGoalValue > maxQuestionGoal
  ) {
    return copy.questionGoal.replace('{maximum}', String(maxQuestionGoal));
  }

  if (
    !Number.isFinite(timerSecondsValue) ||
    timerSecondsValue < 1 ||
    timerSecondsValue > maxTimerSeconds
  ) {
    return copy.timerSeconds.replace('{maximum}', String(maxTimerSeconds));
  }

  return null;
}

function getCreateSessionValidationCopy(locale: string) {
  if (locale === 'fr') {
    return {
      notAllowed:
        "La création de session n'est pas disponible pour ton profil actuel.",
      minimumParticipants:
        'Sélectionne au moins {minimum} participants pour créer une session. Actuellement : {selected}.',
      sessionName: 'Ajoute un nom de séance.',
      scheduledAt: 'Choisis une date et une heure valides.',
      meetingLink: 'Ajoute le lien de réunion avant de planifier la séance.',
      questionGoal:
        'Le nombre de questions doit être compris entre 1 et {maximum}.',
      timerSeconds:
        'Le minuteur doit être compris entre 1 et {maximum} secondes.',
    };
  }

  return {
    notAllowed:
      'Session creation is not available for your current profile.',
    minimumParticipants:
      'Select at least {minimum} participants to create a session. Current selection: {selected}.',
    sessionName: 'Add a session name.',
    scheduledAt: 'Choose a valid date and time.',
    meetingLink: 'Add the meeting link before scheduling the session.',
    questionGoal: 'Number of questions must be between 1 and {maximum}.',
    timerSeconds: 'Timer must be between 1 and {maximum} seconds.',
  };
}

type ParticipantCandidate = {
  id: string;
  name?: string | null;
  initials: string;
  email?: string;
  phoneNumber?: string | null;
  avatarUrl: string | null;
  groupIds: string[];
  groupNames: string[];
};

function formatPoolMemberCount(memberCount: number, locale: string) {
  if (locale === 'fr') {
    return `${memberCount} membre${memberCount > 1 ? 's' : ''}`;
  }

  return `${memberCount} member${memberCount === 1 ? '' : 's'}`;
}

function formatCandidateName(candidate: ParticipantCandidate) {
  return candidate.name?.trim() || candidate.initials;
}

function formatCandidateContact(
  candidate: ParticipantCandidate,
  copy: ReturnType<typeof getCleanParticipantCopy>,
) {
  return (
    candidate.phoneNumber?.trim() ||
    copy.contactUnavailable
  );
}

async function copyCandidatePhone(phoneNumber: string) {
  const value = phoneNumber.trim();
  if (!value || typeof navigator === 'undefined' || !navigator.clipboard) {
    return;
  }

  await navigator.clipboard.writeText(value);
}

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
      name?: string | null;
      email?: string | null;
      phoneNumber?: string | null;
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
        name: member.name,
        email: member.email ?? undefined,
        phoneNumber: member.phoneNumber,
        avatarUrl: member.avatarUrl,
        groupIds: [group.id],
        groupNames: [group.name],
      });
    }
  }

  return [...candidateById.values()].sort((left, right) =>
    formatCandidateName(left).localeCompare(formatCandidateName(right)),
  );
}

function getCleanParticipantCopy(locale: string) {
  if (locale === 'fr') {
    return {
      poolLabel: 'Pool de départ',
      participants: 'Participants de la session',
      selected: '{count} sélectionnés',
      search: 'Rechercher un membre',
      searchLockedTest: 'Recherche disponible après 3 séances test',
      searchLockedPayment: 'Paiement requis pour rechercher des candidats',
      unlockSearch: 'Débloquer la recherche',
      questions: '{count} Q',
      copyPhone: 'Copier le téléphone',
      copyAction: 'Copier',
      contactUnavailable: 'Téléphone non renseigné',
      empty: 'Aucun membre disponible',
    };
  }

  return {
    poolLabel: 'Starting pool',
    participants: 'Session participants',
    selected: '{count} selected',
    search: 'Search a member',
    searchLockedTest: 'Search unlocks after 3 test sessions',
    searchLockedPayment: 'Payment required to search candidates',
    unlockSearch: 'Unlock search',
    questions: '{count} Q',
    copyPhone: 'Copy phone number',
    copyAction: 'Copy',
    contactUnavailable: 'No phone',
    empty: 'No member available',
  };
}

function getSessionWizardCopy(locale: string) {
  if (locale === 'fr') {
    return {
      previous: 'Étape précédente',
      next: 'Suivant',
      steps: [
        'Organisez un groupe WhatsApp',
        'Avec les membres du groupe, fixez le temps',
        'Avec les membres du groupe, choisissez le mode de session',
      ],
    };
  }

  return {
    previous: 'Previous step',
    next: 'Next',
    steps: [
      'Organize a WhatsApp group',
      'With the group members, set the time',
      'With the group members, choose the session mode',
    ],
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
      searchLockedTest: 'Recherche disponible après 3 séances test',
      searchLockedPayment: 'Paiement requis pour rechercher des candidats',
      unlockSearch: 'Débloquer la recherche',
      questions: '{count} Q',
      empty: 'Aucun membre disponible',
    };
  }

  return {
    poolLabel: 'Starting pool',
    participants: 'Session participants',
    selected: '{count} selected',
    search: 'Search a member',
    searchLockedTest: 'Search unlocks after 3 test sessions',
    searchLockedPayment: 'Payment required to search candidates',
    unlockSearch: 'Unlock search',
    questions: '{count} Q',
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
