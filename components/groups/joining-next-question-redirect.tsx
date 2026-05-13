'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { fetchSessionRuntime } from '@/components/session/runtime-client';

type JoiningNextQuestionRedirectProps = {
  locale: string;
  sessionId: string;
};

export function JoiningNextQuestionRedirect({
  locale,
  sessionId,
}: JoiningNextQuestionRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;

    const pollSession = async () => {
      try {
        const payload = await fetchSessionRuntime(
          `/api/sessions/${sessionId}/runtime`,
        );

        if (
          !cancelled &&
          payload?.sessionStatus === 'active' &&
          payload.questionPhase === 'answering'
        ) {
          router.replace(`/${locale}/sessions/${sessionId}`);
          return;
        }
      } catch {
        // Keep waiting on the group page; the next poll will retry.
      }

      if (!cancelled) {
        timeoutId = window.setTimeout(pollSession, 2000);
      }
    };

    timeoutId = window.setTimeout(pollSession, 800);

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [locale, router, sessionId]);

  return null;
}
