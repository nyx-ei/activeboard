'use client';

import { type MouseEvent as ReactMouseEvent, type ReactNode, useEffect, useId, useRef } from 'react';

import { ModalPortal } from '@/components/ui/modal-portal';
import { cn } from '@/lib/utils';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  mobileSheet?: boolean;
  closeOnBackdrop?: boolean;
  backdropLabel?: string;
  labelledBy?: string;
  describedBy?: string;
  initialFocusRef?: React.RefObject<HTMLElement>;
};

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(','),
    ),
  ).filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
}

export function Modal({
  open,
  onClose,
  children,
  className,
  contentClassName,
  mobileSheet = true,
  closeOnBackdrop = true,
  backdropLabel = 'Close',
  labelledBy,
  describedBy,
  initialFocusRef,
}: ModalProps) {
  const internalTitleId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const dialogElement = dialogRef.current;
    const focusTarget =
      initialFocusRef?.current ??
      (dialogElement ? getFocusableElements(dialogElement)[0] : null) ??
      dialogElement;

    window.setTimeout(() => {
      focusTarget?.focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) {
        return;
      }

      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        return;
      }
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (event.shiftKey) {
        if (activeElement === first || activeElement === dialogRef.current) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      restoreFocusRef.current?.focus();
    };
  }, [initialFocusRef, onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <ModalPortal>
      <div
        className={cn(
          'fixed inset-0 flex justify-center bg-black/72 px-0 py-0 backdrop-blur-[2px] sm:px-4 sm:py-6',
          mobileSheet ? 'items-end sm:items-center' : 'items-center',
          className,
        )}
        style={{ zIndex: 1000 }}
        onMouseDown={(event: ReactMouseEvent<HTMLDivElement>) => {
          if (!closeOnBackdrop) {
            return;
          }

          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <section
          ref={(node) => {
            dialogRef.current = node;
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy ?? internalTitleId}
          aria-describedby={describedBy}
          tabIndex={-1}
          className={cn('relative z-[1]', contentClassName)}
          data-backdrop-label={backdropLabel}
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
        >
          {children}
        </section>
      </div>
    </ModalPortal>
  );
}

type ModalTitleProps = {
  id?: string;
  className?: string;
  children: ReactNode;
};

export function ModalTitle({ id, className, children }: ModalTitleProps) {
  return (
    <h2 id={id} className={className}>
      {children}
    </h2>
  );
}
