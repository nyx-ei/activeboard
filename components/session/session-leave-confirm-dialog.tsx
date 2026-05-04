'use client';

import { useEffect } from 'react';

export type SessionLeaveConfirmLabels = {
  title: string;
  description: string;
  cancel: string;
  confirm: string;
};

export function SessionLeaveConfirmDialog({
  labels,
  isLeaving,
  onCancel,
  onConfirm,
}: {
  labels: SessionLeaveConfirmLabels;
  isLeaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLeaving) {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLeaving, onCancel]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 px-4 pb-4 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-leave-confirm-title"
        className="w-full max-w-sm rounded-[8px] border border-white/[0.08] bg-[#0f1628] p-4 text-left shadow-2xl shadow-black/40"
      >
        <h2
          id="session-leave-confirm-title"
          className="text-base font-extrabold text-white"
        >
          {labels.title}
        </h2>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-400">
          {labels.description}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isLeaving}
            onClick={onCancel}
            className="button-ghost rounded-[7px] px-4 py-2.5 text-sm text-slate-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {labels.cancel}
          </button>
          <button
            type="button"
            disabled={isLeaving}
            onClick={onConfirm}
            className="button-primary rounded-[7px] px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
            aria-busy={isLeaving}
          >
            {labels.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
