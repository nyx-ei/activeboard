'use client';

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { AuthForm } from '@/components/auth/auth-form';

type LandingSignupModalProps = {
  locale: string;
  children: React.ReactNode;
  className?: string;
  closeLabel: string;
};

export function LandingSignupModal({ locale, children, className, closeLabel }: LandingSignupModalProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/78 px-4 py-4 backdrop-blur-[2px] sm:items-center sm:py-6" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0 cursor-default" aria-label={closeLabel} onClick={() => setOpen(false)} />
          <section className="relative my-auto max-h-[calc(100dvh-32px)] w-full max-w-[384px] overflow-y-auto rounded-[6px] border border-white/[0.06] bg-[#11192c] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.58)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button type="button" onClick={() => setOpen(false)} className="sticky right-0 top-0 z-10 ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-[#11192c]/95 text-slate-400 transition hover:text-white" aria-label={closeLabel}>
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="-mt-7">
              <AuthForm
                initialMode="sign-up"
                redirectToOverride={`/${locale}/create-group`}
                requireExamSessionOnSignUp={false}
                deferSignUpToRedirect
                variant="modal"
              />
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
