import React from 'react';
import { X, ShieldAlert } from 'lucide-react';

interface HelixResourceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  detail?: string;
}

export const HelixResourceDialog: React.FC<HelixResourceDialogProps> = ({
  isOpen,
  onClose,
  title = "Resource Limit Reached",
  detail
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Dialog Card */}
      <div className="relative bg-zinc-950 border border-zinc-900 rounded-lg max-w-xl w-full shadow-2xl overflow-hidden flex flex-col md:flex-row transform transition-all duration-300 z-10 animate-in fade-in zoom-in-95 duration-200">

        {/* Left Side: Mascot Column */}
        <div className="md:w-1/3 bg-black flex items-center justify-center p-6 border-b md:border-b-0 md:border-r border-zinc-900 shrink-0">
          <img
            src="/helix_mascot.png"
            alt="Helix Mascot"
            className="w-24 h-24 object-contain opacity-90 filter drop-shadow-[0_0_8px_rgba(212,175,55,0.2)] animate-pulse"
          />
        </div>

        {/* Right Side: Message Column */}
        <div className="flex-1 p-6 flex flex-col justify-between space-y-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gold">
              <ShieldAlert size={16} />
              <span className="text-[10px] font-mono uppercase tracking-widest">Helix Protocol</span>
            </div>
            <h2 className="text-base font-serif-display font-medium text-ivory tracking-tight">
              {title}
            </h2>
            <p className="text-[11px] text-zinc-450 leading-relaxed font-sans-ui">
              Hello! I am independently developed by my creator Noel Ninan Sheri,  and operate on critical infrastructure resources. To maintain high-quality repository intelligence and hosted storage resources, and to ensure fair access for all users, usage limits are enforced. Thank you for your understanding.
            </p>
            {detail && (
              <div className="mt-3 p-2.5 rounded bg-gold/5 border border-gold/15 text-[10.5px] font-mono text-gold leading-normal">
                {detail}
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded bg-zinc-900 border border-zinc-800 text-[10.5px] font-mono text-zinc-400 hover:border-gold hover:text-gold hover:bg-gold/5 transition-all cursor-pointer"
            >
              Acknowledge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
