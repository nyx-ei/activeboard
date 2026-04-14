'use client';

import { useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { completeOnboardingGroupDraftAction } from '@/app/[locale]/dashboard/actions';

type PendingGroupDraftSyncProps = {
  locale: string;
  successMessage: string;
  errorMessage: string;
  missingFieldsMessage: string;
  billingRequiredMessage: string;
};

const DRAFT_KEY = 'activeboard:create-group-draft';
const SYNC_KEY = 'activeboard:create-group-draft-syncing';

function feedbackUrl(locale: string, tone: 'success' | 'error', message: string, groupId?: string) {
  const params = new URLSearchParams({
    view: groupId ? 'settings' : 'sessions',
    feedbackTone: tone,
    feedbackMessage: message,
  });

  if (groupId) {
    params.set('groupId', groupId);
  }

  return `/${locale}/dashboard?${params.toString()}`;
}

export function PendingGroupDraftSync({
  locale,
  successMessage,
  errorMessage,
  missingFieldsMessage,
  billingRequiredMessage,
}: PendingGroupDraftSyncProps) {
  const router = useRouter();
  const hasStarted = useRef(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }

    const draft = window.sessionStorage.getItem(DRAFT_KEY);
    if (!draft) {
      return;
    }

    const syncMarker = window.sessionStorage.getItem(SYNC_KEY);
    if (syncMarker === draft) {
      return;
    }

    hasStarted.current = true;
    window.sessionStorage.setItem(SYNC_KEY, draft);

    startTransition(async () => {
      const formData = new FormData();
      formData.set('locale', locale);
      formData.set('draft', draft);

      const result = await completeOnboardingGroupDraftAction(formData);

      if (result.ok) {
        window.sessionStorage.removeItem(DRAFT_KEY);
        window.sessionStorage.removeItem(SYNC_KEY);
        router.replace(feedbackUrl(locale, 'success', successMessage, result.groupId) as Parameters<typeof router.replace>[0]);
        router.refresh();
        return;
      }

      window.sessionStorage.removeItem(SYNC_KEY);

      const message =
        result.reason === 'missing_fields'
          ? missingFieldsMessage
          : result.reason === 'billing_required'
            ? billingRequiredMessage
            : errorMessage;

      router.replace(feedbackUrl(locale, 'error', message) as Parameters<typeof router.replace>[0]);
    });
  }, [billingRequiredMessage, errorMessage, locale, missingFieldsMessage, router, successMessage]);

  return null;
}
