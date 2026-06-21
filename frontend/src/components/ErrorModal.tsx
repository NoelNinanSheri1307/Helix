import React, { useEffect, useRef } from 'react';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  reason?: string;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  reason,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    if (isOpen) {
      const focusTimeout = setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(focusTimeout);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="absolute inset-0 cursor-default" onClick={onClose} />
      
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-lg border border-red-950/40 bg-zinc-950 p-6 shadow-2xl animate-scale-up"
      >
        <h2 className="text-lg font-serif-display font-medium text-ivory tracking-tight flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          {title}
        </h2>
        
        <div className="mt-4 space-y-3">
          <p className="text-xs text-zinc-400 leading-relaxed">
            {message}
          </p>
          {reason && (
            <div className="px-3 py-2.5 rounded bg-red-950/5 border border-red-950/20 text-xs font-sans text-silverish">
              <span className="font-semibold text-ivory block mb-1">Reason:</span>
              {reason}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold border border-zinc-900 rounded bg-zinc-950 text-zinc-400 hover:text-ivory hover:bg-zinc-900 transition-all cursor-pointer outline-none focus:ring-1 focus:ring-zinc-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorModal;
