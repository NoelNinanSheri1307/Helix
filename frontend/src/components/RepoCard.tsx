import React, { useState } from 'react';
import { Repository } from '../types';
import { StatusBadge } from './StatusBadge';
import Link from 'next/link';
import { Star, GitBranch, GitFork, Terminal, Trash2, ExternalLink, RefreshCw, Download, LoaderCircle, FolderOpen } from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';

interface RepoCardProps {
  repository: Repository;
  onDelete?: (id: string) => Promise<void> | void;
  onRefresh?: (id: string) => Promise<void> | void;
  onClone?: (id: string) => Promise<void> | void;
}

export const RepoCard: React.FC<RepoCardProps> = ({ repository, onDelete, onRefresh, onClone }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Determine border class based on status for premium aesthetic
  const getBorderClass = (status: Repository['status']) => {
    switch (status) {
      case 'CLONED':
      case 'READY':
      case 'UP_TO_DATE':
        return 'border-gold-subtle';
      case 'UPDATES_AVAILABLE':
        return 'border-yellow-900/40 bg-gold/5';
      case 'CLONING':
      case 'SYNCING':
      case 'ANALYZING':
        return 'border-blue-subtle';
      case 'FAILED':
        return 'border-purple-subtle';
      default:
        return 'border-silver-subtle';
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(repository.id);
    } catch (err) {
      console.error("Delete repository failed:", err);
    } finally {
      setIsDeleting(false);
      setIsDeleteOpen(false);
    }
  };

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh(repository.id);
    } catch (err) {
      console.error("Refresh metadata failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClone = async () => {
    if (!onClone) return;
    setIsCloning(true);
    try {
      await onClone(repository.id);
    } finally {
      setIsCloning(false);
    }
  };

  const cloneInProgress = isCloning || ['CLONING', 'SYNCING', 'ANALYZING'].includes(repository.status);

  const formatStars = (stars?: number | null) => {
    if (stars === null || stars === undefined) return '0 stars';
    if (stars >= 1000) {
      return `${(stars / 1000).toFixed(1)}k stars`;
    }
    return `${stars} stars`;
  };

  const displayOwner = repository.owner ?? "unknown";
  const displayDescription = repository.description ?? "No description provided.";
  const displayBranch = repository.branch ?? "main";
  const displayLanguage = repository.language ?? "Unknown";

  return (
    <div className={`p-5 rounded-lg bg-zinc-950 border card-radial-glow ${getBorderClass(repository.status)} relative overflow-hidden group flex flex-col justify-between min-h-[310px] w-full`}>
      <div className="min-w-0">
        {/* Header Section */}
        <div className="flex justify-between items-center gap-3 mb-1.5 w-full">
          <h3 className="text-base font-serif-display font-medium text-ivory tracking-tight truncate flex-1 min-w-0" title={repository.name}>
            <Link href={`/repositories/${repository.id}`} className="hover:underline">
              {repository.name}
            </Link>
          </h3>
          <a 
            href={repository.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-zinc-600 hover:text-zinc-400 transition-colors flex-shrink-0"
            title="Open in GitHub"
          >
            <ExternalLink size={14} />
          </a>
        </div>

        {/* Owner attribution */}
        <div className="text-[11px] text-zinc-500 font-mono-ui mb-3.5 truncate">
          by <span className="text-zinc-400">{displayOwner}</span> • Submitted {repository.submissionDate}
        </div>

        {/* Status Section */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <StatusBadge status={repository.status} />
          {repository.framework && repository.framework !== "Unknown" && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border border-gold/20 bg-gold/5 text-gold/80 select-none font-sans">
              {repository.framework}
            </span>
          )}
        </div>

        {/* Description Section */}
        <p className="text-xs text-zinc-400 h-10 line-clamp-2 overflow-hidden leading-relaxed mb-4 break-words" title={displayDescription}>
          {displayDescription}
        </p>

        {/* Metadata Section */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3.5 border-t border-zinc-900/50 text-[11px] text-zinc-500 font-mono-ui">
          <div className="flex items-center gap-1.5 min-w-0">
            <Star size={13} className="text-zinc-600 flex-shrink-0" />
            <span className="truncate" title={formatStars(repository.stars)}>{formatStars(repository.stars)}</span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <GitBranch size={13} className="text-zinc-600 flex-shrink-0" />
            <span className="truncate" title={repository.currentBranch ?? displayBranch}>{repository.currentBranch ?? displayBranch}</span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <Terminal size={13} className="text-zinc-600 flex-shrink-0" />
            <span className="truncate" title={displayLanguage}>{displayLanguage}</span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <GitFork size={13} className="text-zinc-600 flex-shrink-0" />
            <span className="truncate" title={`${repository.forks ?? 0} forks`}>{repository.forks ?? 0} forks</span>
          </div>
          {repository.currentCommitSha && (
            <div className="flex items-center gap-1.5 min-w-0 col-span-2 text-zinc-500">
              <span className="text-zinc-600 font-medium">Commit:</span>
              <span className="font-mono text-zinc-400 truncate" title={repository.currentCommitSha}>
                {repository.currentCommitSha.substring(0, 7)}
              </span>
            </div>
          )}
          {repository.lastSyncedTimestamp && (
            <div className="flex items-center gap-1.5 min-w-0 col-span-2 text-zinc-500">
              <span className="text-zinc-600 font-medium">Synced:</span>
              <span className="text-zinc-400 truncate" title={new Date(repository.lastSyncedTimestamp).toLocaleString()}>
                {new Date(repository.lastSyncedTimestamp).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Section */}
      <div className="flex items-center justify-between gap-3 mt-5 pt-3.5 border-t border-zinc-900/80">
        <Link 
          href={`/repositories/${repository.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-zinc-900 bg-zinc-950 text-zinc-400 hover:text-ivory hover:bg-zinc-900 hover:border-zinc-800 transition-all cursor-pointer select-none"
        >
          <FolderOpen size={13} />
          Open
        </Link>
        
        <div className="flex items-center gap-1.5">
          {onRefresh && (
            <button
              onClick={handleRefresh}
              className={`text-zinc-500 hover:text-gold p-1.5 rounded border border-zinc-900 hover:border-zinc-850 hover:bg-zinc-900/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isRefreshing ? 'animate-spin text-gold' : ''
              }`}
              title="Refresh metadata"
              disabled={isRefreshing || cloneInProgress}
            >
              <RefreshCw size={13} />
            </button>
          )}
          {onClone && (
            !repository.currentCommitSha ? (
              <button
                onClick={handleClone}
                disabled={cloneInProgress}
                className="text-zinc-500 hover:text-emerald-400 p-1.5 rounded border border-zinc-900 hover:border-zinc-850 hover:bg-zinc-900/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait inline-flex items-center gap-1"
                title="Clone repository"
              >
                {cloneInProgress ? <LoaderCircle size={13} className="animate-spin" /> : <Download size={13} />}
                <span className="text-[11px] font-mono-ui">Clone</span>
              </button>
            ) : (
              <button
                onClick={handleClone}
                disabled={cloneInProgress}
                className={`p-1.5 rounded border cursor-pointer disabled:opacity-50 disabled:cursor-wait inline-flex items-center gap-1 transition-all ${
                  repository.status === 'UPDATES_AVAILABLE'
                    ? 'border-gold/45 bg-gold/10 text-gold hover:bg-gold/20 shadow-[0_0_10px_rgba(212,175,55,0.2)] animate-pulse'
                    : 'text-zinc-500 hover:text-emerald-400 border-zinc-900 hover:border-zinc-850 hover:bg-zinc-900/50'
                }`}
                title={repository.status === 'UPDATES_AVAILABLE' ? 'Updates available' : 'Update repository'}
              >
                {cloneInProgress ? (
                  <LoaderCircle size={13} className="animate-spin" />
                ) : (
                  <RefreshCw size={13} className={cloneInProgress ? 'animate-spin' : ''} />
                )}
                <span className="text-[11px] font-mono-ui">Update</span>
              </button>
            )
          )}
          {onDelete && (
            <button
              onClick={() => setIsDeleteOpen(true)}
              className="text-zinc-500 hover:text-red-400 p-1.5 rounded border border-zinc-900 hover:border-zinc-850 hover:bg-zinc-900/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Remove repository"
              disabled={cloneInProgress}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Repository"
        message="Are you sure you want to delete this repository?"
        projectName={repository.name}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isLoading={isDeleting}
      />
    </div>
  );
};
