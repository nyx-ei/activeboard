'use client';

import type React from 'react';
import { useState } from 'react';

import { useRouter } from '@/i18n/navigation';
import { CreateSessionModal } from '@/components/sessions/create-session-modal';
import type { SessionCreationPolicy } from '@/lib/policy/defaults';
import type { PlanNextAccess } from '@/lib/session/plan-next-access';

type SessionPlanNextRuntimeProps = {
  locale: string;
  sessionId: string;
  groups: React.ComponentProps<typeof CreateSessionModal>['groups'];
  initialGroupId: string;
  sessionTitle: string;
  questionGoal: number;
  timerSeconds: number;
  timerMode: 'per_question' | 'global';
  sessionPolicy: SessionCreationPolicy;
  planNextAccess?: PlanNextAccess;
};

function getLabels(locale: string) {
  if (locale === 'fr') {
    return {
      newSession: 'Nouvelle séance',
      createSession: 'Planifier la prochaine séance',
      createSessionPending: 'Planification...',
      groupName: 'Groupe',
      sessionName: 'Nom de la séance',
      sessionNamePlaceholder: 'ex. Prochaine séance',
      scheduledAt: 'Date et heure',
      questionCount: 'Questions',
      timerMode: 'Mode timing',
      perQuestionMode: 'Question par question',
      globalMode: 'Mode examen',
      timerSeconds: 'Secondes par question',
      totalTimerSeconds: 'Temps total (secondes)',
      modalHint:
        'Choisissez les participants, la date, le mode et le lien de réunion pour créer la prochaine séance.',
      close: 'Fermer',
      groupAccessHint: 'Verrouillé pour les séances test',
    };
  }

  return {
    newSession: 'New session',
    createSession: 'Schedule next session',
    createSessionPending: 'Scheduling...',
    groupName: 'Group',
    sessionName: 'Session name',
    sessionNamePlaceholder: 'e.g. Next session',
    scheduledAt: 'Date and time',
    questionCount: 'Questions',
    timerMode: 'Timing mode',
    perQuestionMode: 'Question by question',
    globalMode: 'Exam mode',
    timerSeconds: 'Seconds per question',
    totalTimerSeconds: 'Total time (seconds)',
    modalHint:
      'Choose participants, date, mode, and meeting link to create the next session.',
    close: 'Close',
    groupAccessHint: 'Locked for test sessions',
  };
}

export function SessionPlanNextRuntime({
  locale,
  sessionId,
  groups,
  initialGroupId,
  sessionTitle,
  questionGoal,
  timerSeconds,
  timerMode,
  sessionPolicy,
  planNextAccess,
}: SessionPlanNextRuntimeProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const returnTo = `/${locale}/sessions/${sessionId}?stage=progress&feedback=done`;

  function closeWizard() {
    setIsOpen(false);
    router.replace(`/sessions/${sessionId}?stage=progress&feedback=done`);
  }

  if (!isOpen) {
    return null;
  }

  return (
    <CreateSessionModal
      locale={locale}
      groups={groups}
      initialGroupId={initialGroupId}
      canCreateSession
      labels={getLabels(locale)}
      sessionPolicy={{
        ...sessionPolicy,
        defaultQuestionGoal: questionGoal,
        perQuestionTimerDefaultSeconds:
          timerMode === 'per_question'
            ? timerSeconds
            : sessionPolicy.perQuestionTimerDefaultSeconds,
        globalTimerDefaultSeconds:
          timerMode === 'global'
            ? timerSeconds
            : sessionPolicy.globalTimerDefaultSeconds,
      }}
      planNextAccess={planNextAccess}
      onClose={closeWizard}
      initialSessionName={sessionTitle}
      continuitySessionId={sessionId}
      continuityReturnTo={returnTo}
      forceCreate
    />
  );
}
