'use client';

import { useState } from 'react';
import { Share2, Trash2 } from 'lucide-react';

import { useRouter } from '@/i18n/navigation';
import { SubmitButton } from '@/components/ui/submit-button';

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

function StatusBadge({ status, labels }: { status: SessionListItem['status']; labels: SessionCardLabels }) {
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
    <span className="inline-flex min-h-6 items-center rounded-full border border-brand/20 bg-brand/12 px-2.5 py-1 text-[11px] font-bold text-brand shadow-[0_0_0_1px_rgba(16,185,129,0.08)]">
      {label}
    </span>
  );
}

export function SessionCard({
  session,
  locale,
  labels,
  cancelSessionAction,
  returnTo,
}: {
  session: SessionListItem;
  locale: string;
  labels: SessionCardLabels;
  cancelSessionAction: (formData: FormData) => void | Promise<void>;
  returnTo?: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const answeredCount = session.answeredQuestionCount ?? 0;
  const targetCount = session.question_goal || session.questionCount || 10;

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

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/sessions/${session.id}`)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          router.push(`/sessions/${session.id}`);
        }
      }}
      className="group cursor-pointer rounded-[10px] border border-white/[0.07] bg-[#0f1628] px-4 py-3 transition hover:border-brand/70 hover:bg-[#111b30]"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-sm font-extrabold text-white">{session.name ?? session.groupName ?? 'ActiveBoard'}</h2>
            <StatusBadge status={session.status} labels={labels} />
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
          {copied ? <span className="text-[10px] font-bold text-brand">{labels.copied}</span> : null}
          <button
            type="button"
            aria-label={labels.share}
            onClick={shareSession}
            className="rounded-md p-1.5 transition hover:bg-white/[0.06] hover:text-brand"
          >
            <Share2 className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
          </button>
          <form action={cancelSessionAction} onClick={(event) => event.stopPropagation()}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="sessionId" value={session.id} />
            {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
            <SubmitButton
              pendingLabel=""
              className="rounded-md p-1.5 transition hover:bg-white/[0.06] hover:text-red-300"
              disabled={session.status === 'completed' || session.status === 'cancelled'}
            >
              <span className="sr-only">{labels.delete}</span>
              <Trash2 className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
            </SubmitButton>
          </form>
        </div>
      </div>
    </article>
  );
}
