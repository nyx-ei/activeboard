'use client';

import { memo, useState, useTransition } from 'react';
import { Share2, Trash2 } from 'lucide-react';

import { useRouter } from '@/i18n/navigation';

export type SessionListItem = {
  id: string;
  group_id?: string;
  groupName?: string | null;
  name: string | null;
  scheduled_at: string;
  share_code: string;
  status: 'scheduled' | 'active' | 'incomplete' | 'completed' | 'cancelled';
  question_goal?: number;
  answeredQuestionCount?: number;
  questionCount?: number;
};

export type SessionCardLabels = {
  share: string;
  delete: string;
  copied: string;
  statusScheduled: string;
  statusActive: string;
  statusCompleted: string;
  statusIncomplete: string;
  statusCancelled: string;
};

function StatusBadge({
  status,
  labels,
}: {
  status: SessionListItem['status'];
  labels: SessionCardLabels;
}) {
  const label =
    status === 'active'
      ? labels.statusActive
      : status === 'incomplete'
        ? labels.statusIncomplete
        : status === 'completed'
          ? labels.statusCompleted
          : status === 'cancelled'
            ? labels.statusCancelled
            : labels.statusScheduled;

  return (
    <span className="border-brand/20 bg-brand/12 inline-flex min-h-6 items-center rounded-full border px-2.5 py-1 text-[11px] font-bold text-brand shadow-[0_0_0_1px_rgba(16,185,129,0.08)]">
      {label}
    </span>
  );
}

export const SessionCard = memo(function SessionCard({
  session,
  locale,
  labels,
  returnTo,
  onCancelOptimistic,
  onCancelRollback,
}: {
  session: SessionListItem;
  locale: string;
  labels: SessionCardLabels;
  returnTo?: string;
  onCancelOptimistic?: (sessionId: string) => void;
  onCancelRollback?: (sessionId: string) => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [, startTransition] = useTransition();
  const answeredCount = session.answeredQuestionCount ?? 0;
  const targetCount = session.question_goal || session.questionCount || 10;
  const openSession = () => {
    startTransition(() => {
      router.push(`/sessions/${session.id}`);
    });
  };

  async function shareSession(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const shareUrl = `${window.location.origin}/${locale}/sessions/${session.id}`;
    const text = `${session.name ?? session.groupName ?? 'ActiveBoard'} - ${session.share_code}`;

    if (navigator.share) {
      await navigator.share({ title: 'ActiveBoard', text, url: shareUrl });
      return;
    }

    await navigator.clipboard.writeText(`${text} ${shareUrl}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function showFeedback(tone: 'success' | 'error', message: string) {
    window.dispatchEvent(
      new CustomEvent('activeboard:feedback', {
        detail: {
          tone,
          message,
          id: `cancel-session-${session.id}-${tone}-${Date.now()}`,
        },
      }),
    );
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={openSession}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          openSession();
        }
      }}
      className="hover:border-brand/70 group cursor-pointer rounded-[10px] border border-white/[0.07] bg-[#0f1628] px-4 py-3 transition hover:bg-[#111b30]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-extrabold text-white">
              {session.name ?? session.groupName ?? 'ActiveBoard'}
            </h2>
            <StatusBadge status={session.status} labels={labels} />
            <button
              type="button"
              aria-label={labels.delete}
              aria-busy={isCancelling}
              disabled={isCancelling}
              onClick={(event) => {
                event.stopPropagation();
                if (isCancelling) {
                  return;
                }

                setIsCancelling(true);
                void fetch(`/api/sessions/${session.id}/cancel`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  credentials: 'same-origin',
                  cache: 'no-store',
                  body: JSON.stringify({ locale, returnTo }),
                })
                  .then(async (response) => {
                    const payload = (await response
                      .json()
                      .catch(() => null)) as {
                      ok?: boolean;
                      message?: string;
                      redirectTo?: string;
                    } | null;

                    if (!response.ok || payload?.ok === false) {
                      onCancelRollback?.(session.id);
                      showFeedback('error', payload?.message ?? labels.delete);
                      setIsCancelling(false);
                      return;
                    }

                    onCancelOptimistic?.(session.id);
                    window.dispatchEvent(
                      new CustomEvent('activeboard:dashboard-invalidate', {
                        detail: { view: 'sessions' },
                      }),
                    );
                    if (payload?.message) {
                      showFeedback('success', payload.message);
                    }
                  })
                  .catch(() => {
                    onCancelRollback?.(session.id);
                    showFeedback('error', labels.delete);
                    setIsCancelling(false);
                  });
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-rose-300 transition hover:bg-white/[0.06] hover:text-rose-200 disabled:cursor-wait disabled:opacity-80"
            >
              {isCancelling ? (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden="true"
                />
              ) : (
                <Trash2
                  className="h-4 w-4"
                  aria-hidden="true"
                  strokeWidth={1.8}
                />
              )}
            </button>
          </div>
          <p className="mt-1 text-xs font-medium text-slate-500">
            {new Intl.DateTimeFormat(locale, {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(session.scheduled_at))}{' '}
            <span className="px-1">:</span>
            {answeredCount} / {targetCount} Q
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-slate-500">
          {copied ? (
            <span className="text-[10px] font-bold text-brand">
              {labels.copied}
            </span>
          ) : null}
          <button
            type="button"
            aria-label={labels.share}
            onClick={shareSession}
            className="rounded-md p-1.5 transition hover:bg-white/[0.06] hover:text-brand"
          >
            <Share2 className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </article>
  );
});
