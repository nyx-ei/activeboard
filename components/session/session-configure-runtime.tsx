'use client';

import type React from 'react';
import { useState } from 'react';

import { useRouter } from '@/i18n/navigation';
import { CreateSessionModal } from '@/components/sessions/create-session-modal';
import type { SessionCreationPolicy } from '@/lib/policy/defaults';
import type { PlanNextAccess } from '@/lib/session/plan-next-access';

type SessionConfigureRuntimeProps = {
  locale: string;
  groups: React.ComponentProps<typeof CreateSessionModal>['groups'];
  sessionPolicy: SessionCreationPolicy;
  planNextAccess: PlanNextAccess;
  existingSession: NonNullable<
    React.ComponentProps<typeof CreateSessionModal>['existingSession']
  >;
};

function getLabels(locale: string) {
  if (locale === 'fr') {
    return {
      newSession: 'Nouvelle séance',
      createSession: 'Planifier la séance',
      createSessionPending: 'Planification...',
      groupName: 'Groupe',
      sessionName: 'Nom de la séance',
      sessionNamePlaceholder: 'ex. Session test 1',
      scheduledAt: 'Date et heure',
      questionCount: 'Questions',
      timerMode: 'Mode timing',
      perQuestionMode: 'Question par question',
      globalMode: 'Mode examen',
      timerSeconds: 'Secondes par question',
      totalTimerSeconds: 'Temps total (secondes)',
      modalHint: "Ajoute l'heure et le lien pour planifier cette séance.",
      close: 'Fermer',
      groupAccessHint: 'Verrouillé pour les séances test',
    };
  }

  return {
    newSession: 'New session',
    createSession: 'Schedule session',
    createSessionPending: 'Scheduling...',
    groupName: 'Group',
    sessionName: 'Session name',
    sessionNamePlaceholder: 'e.g. Test session 1',
    scheduledAt: 'Date and time',
    questionCount: 'Questions',
    timerMode: 'Timing mode',
    perQuestionMode: 'Question by question',
    globalMode: 'Exam mode',
    timerSeconds: 'Seconds per question',
    totalTimerSeconds: 'Total time (seconds)',
    modalHint: 'Add the time and meeting link to plan this session.',
    close: 'Close',
    groupAccessHint: 'Locked for test sessions',
  };
}

export function SessionConfigureRuntime({
  locale,
  groups,
  sessionPolicy,
  planNextAccess,
  existingSession,
}: SessionConfigureRuntimeProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);

  function closeWizard() {
    setIsOpen(false);
    router.replace(`/sessions/${existingSession.id}?stage=progress`);
  }

  if (!isOpen) {
    return null;
  }

  return (
    <CreateSessionModal
      locale={locale}
      groups={groups}
      initialGroupId={existingSession.groupId}
      canCreateSession
      labels={getLabels(locale)}
      sessionPolicy={sessionPolicy}
      planNextAccess={planNextAccess}
      existingSession={existingSession}
      onClose={closeWizard}
    />
  );
}
