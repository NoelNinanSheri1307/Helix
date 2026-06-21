import React, { useEffect, useRef } from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  projectName: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  projectName,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  isLoading = false,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trapping and initial focus setting
  useEffect(() => {
    if (isOpen) {
      // Focus the cancel button to prevent accidental trigger of destructive action
      const focusTimeout = setTimeout(() => {
        cancelButtonRef.current?.focus();
      }, 50);

      const handleTab = (e: KeyboardEvent) => {
        if (e.key !== 'Tab' || !modalRef.current) return;

        const focusableElements = modalRef.current.querySelectorAll(
          'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]'
        );
        if (!focusableElements.length) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      };

      window.addEventListener('keydown', handleTab);
      return () => {
        clearTimeout(focusTimeout);
        window.removeEventListener('keydown', handleTab);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      {/* Backdrop overlay listener for closing */}
      <div className="absolute inset-0 cursor-default" onClick={onClose} />
      
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative w-full max-w-md rounded-lg border border-zinc-900 bg-zinc-950 p-6 shadow-2xl animate-scale-up"
      >
        <h2 id="modal-title" className="text-lg font-serif-display font-medium text-ivory tracking-tight">
          {title}
        </h2>
        
        <div className="mt-3">
          <p className="text-xs text-zinc-400 leading-relaxed">
            {message}
          </p>
          <div className="mt-3 px-3 py-2 rounded bg-zinc-900/50 border border-zinc-900 text-xs font-mono-ui text-amber-500 break-all select-all">
            {projectName}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-medium border border-zinc-900 rounded bg-zinc-950 text-zinc-400 hover:text-ivory hover:bg-zinc-900 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed outline-none focus:ring-1 focus:ring-zinc-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-medium border border-red-900/30 rounded bg-red-950/20 text-red-400 hover:text-red-300 hover:bg-red-900/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed outline-none focus:ring-1 focus:ring-red-700 flex items-center gap-1.5"
          >
            {isLoading && (
              <span className="w-3 h-3 rounded-full border-2 border-red-400/30 border-t-red-400 animate-spin" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
