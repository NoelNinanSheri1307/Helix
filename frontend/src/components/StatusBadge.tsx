import React from 'react';
import { RepositoryStatus } from '../types';

interface StatusBadgeProps {
  status: RepositoryStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'READY':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border border-zinc-800 bg-zinc-950 text-zinc-400 select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 mr-1.5" />
          Ready
        </span>
      );
    case 'CLONING':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border border-amber-900/30 bg-amber-950/10 text-amber-400 select-none animate-pulse-subtle">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-ping" />
          Cloning
        </span>
      );
    case 'CLONED':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border border-emerald-900/30 bg-emerald-950/10 text-emerald-400 select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
          Cloned
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border border-red-900/30 bg-red-950/10 text-red-400 select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
          Failed
        </span>
      );
    case 'SCANNING':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border border-blue-900/30 bg-blue-950/10 text-blue-400 select-none animate-pulse-subtle">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-ping" />
          Scanning
        </span>
      );
    default:
      return null;
  }
};
