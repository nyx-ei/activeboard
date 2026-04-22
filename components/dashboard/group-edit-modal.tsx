'use client';

import { Pencil, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ModalPortal } from '@/components/ui/modal-portal';
import { SubmitButton } from '@/components/ui/submit-button';

type GroupEditModalProps = {
  action: (formData: FormData) => void | Promise<void>;
  locale: string;
  groupId: string;
  initialName: string;
  initialMeetingLink: string;
  labels: {
    open: string;
    title: string;
    close: string;
    cancel: string;
    groupName: string;
    groupNamePlaceholder: string;
    meetingLink: string;
    meetingLinkPlaceholder: string;
    meetingLinkWarning: string;
    helper: string;
    savePending: string;
    save: string;
  };
};

export function GroupEditModal({
  action,
  locale,
  groupId,
  initialName,
  initialMeetingLink,
  labels,
}: GroupEditModalProps) {
  const [open, setOpen] = useState(false);
  const [nameValue, setNameValue] = useState(initialName);
  const [meetingLinkValue, setMeetingLinkValue] = useState(initialMeetingLink);
  const hasChanges =
    nameValue.trim() !== initialName.trim() ||
    meetingLinkValue.trim() !== initialMeetingLink.trim();

  useEffect(() => {
    if (!open) return;
    setNameValue(initialName);
    setMeetingLinkValue(initialMeetingLink);
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [initialMeetingLink, initialName, open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-md p-1 text-slate-500 transition hover:text-brand" aria-label={labels.open}>
        <Pencil className="h-4 w-4" aria-hidden="true" strokeWidth={1.7} />
      </button>

      {open ? (
        <ModalPortal>
        <div className="fixed inset-0 flex items-end justify-center bg-black/72 px-0 py-0 backdrop-blur-[2px] sm:items-center sm:px-4 sm:py-6" style={{ zIndex: 1000 }} role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0 cursor-default" aria-label={labels.close} onClick={() => setOpen(false)} />
          <section className="relative max-h-[min(88vh,620px)] w-full max-w-[480px] overflow-y-auto rounded-t-[16px] border border-white/[0.06] bg-[#11192c] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.55)] [scrollbar-width:none] sm:rounded-[10px] sm:p-6 [&::-webkit-scrollbar]:hidden">
            <div className="flex items-center justify-between gap-4">
              <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-white">
                <Pencil className="h-4 w-4 text-brand" aria-hidden="true" strokeWidth={1.8} />
                {labels.title}
              </h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-slate-400 transition hover:bg-white/[0.06] hover:text-white" aria-label={labels.close}>
                <X className="h-5 w-5" aria-hidden="true" strokeWidth={1.8} />
              </button>
            </div>

            <form action={action} className="mt-6 space-y-4">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="groupId" value={groupId} />

              <label className="block">
                <span className="text-sm font-bold text-slate-400">{labels.groupName}</span>
                <input
                  name="groupName"
                  value={nameValue}
                  onChange={(event) => setNameValue(event.target.value)}
                  placeholder={labels.groupNamePlaceholder}
                  className="mt-2 h-10 w-full rounded-[6px] border border-white/[0.08] bg-white/[0.07] px-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/80"
                />
              </label>

              <label className="block border-t border-white/[0.06] pt-4">
                <span className="text-sm font-bold text-slate-400">{labels.meetingLink}</span>
                <input
                  name="meetingLink"
                  value={meetingLinkValue}
                  onChange={(event) => setMeetingLinkValue(event.target.value)}
                  placeholder={labels.meetingLinkPlaceholder}
                  className="mt-2 h-10 w-full rounded-[6px] border border-white/[0.08] bg-white/[0.07] px-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/80"
                />
                <span className="mt-2 block text-[11px] font-semibold text-slate-500">{labels.helper}</span>
              </label>

              <div className="grid grid-cols-2 gap-3 pt-2 sm:gap-4">
                <button type="button" onClick={() => setOpen(false)} className="button-secondary h-10 rounded-[6px] text-sm font-bold">
                  {labels.cancel}
                </button>
                <SubmitButton pendingLabel={labels.savePending} disabled={!hasChanges} className="button-primary h-10 rounded-[6px] text-sm font-bold">
                  {labels.save}
                </SubmitButton>
              </div>
            </form>
          </section>
        </div>
        </ModalPortal>
      ) : null}
    </>
  );
}
