// c:\Users\VICTUS\helix\frontend\src\components\EmptyState.tsx

import React from 'react';

interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center space-y-5 animate-fade-in select-none w-full">
      <div className="relative group">
        <div className="absolute inset-0 rounded-full bg-gold/5 blur-xl group-hover:bg-gold/15 transition-all duration-300"></div>
        <img
          src="/assets/helixkoala.png"
          alt="Helix Koala Mascot"
          className="relative w-24 h-24 object-contain rounded-full border border-zinc-900 bg-zinc-950 p-2 shadow-2xl transform group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div className="relative max-w-sm px-4.5 py-3.5 rounded-lg border border-zinc-900 bg-zinc-950/80 text-zinc-300 font-mono-ui text-xs leading-relaxed shadow-lg">
        {/* Speech Bubble triangle pointer */}
        <div className="absolute top-[-6px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-zinc-950 border-t border-l border-zinc-900 rotate-45"></div>
        <p className="font-semibold text-[9px] uppercase tracking-widest text-gold mb-1 font-mono-ui">Helix</p>
        <p className="text-zinc-400 font-sans leading-relaxed">"{message}"</p>
      </div>
    </div>
  );
}
