'use client';

import { useEffect, useRef, useState } from 'react';

import type { AppLocale } from '@/i18n/routing';

type InvitationAutoAcceptProps = {
  invitationId: string;
  locale: AppLocale;
  labels: {
    title: string;
    description: string;
    error: string;
    retry: string;
  };
};

type AcceptResponse = {
  accepted?: boolean;
  reason?: string;
  redirectTo?: string;
  group?: {
    id?: string;
  };
};

export function InvitationAutoAccept({
  invitationId,
  locale,
  labels,
}: InvitationAutoAcceptProps) {
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;
    const controller = new AbortController();

    async function acceptInvitation() {
      setError(null);

      try {
        const response = await fetch(
          `/api/invitations/${invitationId}/accept`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locale }),
            signal: controller.signal,
          },
        );
        const payload = (await response
          .json()
          .catch(() => null)) as AcceptResponse | null;

        if (!response.ok || !payload?.accepted || !payload.group?.id) {
          setError(payload?.reason ?? labels.error);
          return;
        }

        window.location.assign(
          payload.redirectTo ?? `/${locale}/groups/${payload.group.id}`,
        );
      } catch (acceptError) {
        if ((acceptError as Error).name === 'AbortError') {
          return;
        }

        setError(labels.error);
      }
    }

    void acceptInvitation();

    return () => controller.abort();
  }, [invitationId, labels.error, locale]);

  return (
    <section className="surface-mockup w-full max-w-[520px] p-6 text-center">
      <div
        className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent"
        aria-hidden="true"
      />
      <h1 className="mt-5 text-2xl font-semibold text-white">{labels.title}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        {error ?? labels.description}
      </p>
      {error ? (
        <button
          type="button"
          className="button-primary mt-6 inline-flex h-12 items-center justify-center rounded-[8px] px-5 text-sm"
          onClick={() => {
            startedRef.current = false;
            window.location.reload();
          }}
        >
          {labels.retry}
        </button>
      ) : null}
    </section>
  );
}
