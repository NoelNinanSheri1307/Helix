"use client";

import React, { useState, useEffect } from 'react';
import { RepoCard } from '../../components/RepoCard';
import { ErrorModal } from '../../components/ErrorModal';
import { HelixResourceDialog } from '../../components/HelixResourceDialog';
import { GitFork, Terminal, Clock, ShieldAlert, Plus, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { getRepositories, submitRepository, deleteRepository, refreshRepository, cloneRepository, updateRepository } from '../../lib/api';
import { Repository } from '../../types';

export default function DashboardPage() {
  const { data: session } = useSession();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [repoUrl, setRepoUrl] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCloneErrorOpen, setIsCloneErrorOpen] = useState(false);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [limitDetail, setLimitDetail] = useState('');

  const handleDelete = async (id: string) => {
    if (!session?.user?.email) return;
    const success = await deleteRepository(id, session.user.email);
    if (success) {
      setRepositories(prev => prev.filter(repo => repo.id !== id));
    } else {
      alert("Failed to delete repository.");
    }
  };

  const handleRefresh = async (id: string) => {
    if (!session?.user?.email) return;
    const updatedRepo = await refreshRepository(id, session.user.email);
    if (updatedRepo) {
      setRepositories(prev => prev.map(repo => repo.id === id ? updatedRepo : repo));
    } else {
      alert("Failed to refresh repository metadata.");
    }
  };

  const handleClone = async (id: string) => {
    if (!session?.user?.email) return;
    const targetRepo = repositories.find(r => r.id === id);
    if (!targetRepo) return;

    const email = session.user.email as string;

    if (!targetRepo.currentCommitSha) {
      setRepositories(prev => prev.map(repo => repo.id === id ? { ...repo, status: 'CLONING' } : repo));
      const result = await cloneRepository(id, email);
      const updated = await getRepositories(email);
      setRepositories(updated);
      if (!result.success) {
        setIsCloneErrorOpen(true);
      }
    } else {
      setRepositories(prev => prev.map(repo => repo.id === id ? { ...repo, status: 'SYNCING' } : repo));
      const updatedRepo = await updateRepository(id, email);
      if (updatedRepo) {
        setRepositories(prev => prev.map(repo => repo.id === id ? updatedRepo : repo));
      } else {
        alert("Failed to update repository.");
        const updated = await getRepositories(email);
        setRepositories(updated);
      }
    }
  };

  // Fetch repositories from API on load and whenever session email changes
  useEffect(() => {
    const fetchRepos = async () => {
      if (session?.user?.email) {
        setLoading(true);
        try {
          const data = await getRepositories(session.user.email);
          setRepositories(data);
        } catch (err) {
          console.error("Failed to fetch repositories:", err);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchRepos();
  }, [session?.user?.email]);

  // Poll status of cloning/syncing repositories
  useEffect(() => {
    const activeSync = repositories.some(r => ['CLONING', 'SYNCING', 'ANALYZING'].includes(r.status));
    if (!activeSync || !session?.user?.email) return;

    const interval = setInterval(async () => {
      try {
        const data = await getRepositories(session!.user!.email as string);
        setRepositories(data);
      } catch (err) {
        console.error("Polling repositories failed:", err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [repositories, session?.user?.email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitSuccess(false);

    if (!repoUrl) {
      setError('Please provide a repository URL.');
      return;
    }

    if (!session?.user?.email) {
      setError('You must be signed in to submit a repository.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitRepository(session.user.email, repoUrl);
      if (!res.success || res.error) {
        if (res.error?.includes('repository_limit_exceeded') || res.error?.includes('limit reached') || res.error?.includes('Maximum limit')) {
          let cleanDetail = 'Maximum limit of 7 active repositories reached.';
          if (res.error) {
            try {
              const parsed = JSON.parse(res.error);
              cleanDetail = parsed.detail || parsed.error || res.error;
            } catch {
              cleanDetail = res.error;
            }
          }
          setLimitDetail(cleanDetail);
          setLimitDialogOpen(true);
        } else {
          let cleanMsg = 'An error occurred while submitting the repository.';
          if (res.error) {
            try {
              const parsed = JSON.parse(res.error);
              cleanMsg = parsed.detail || parsed.error || res.error;
            } catch {
              cleanMsg = res.error;
            }
          }
          setError(cleanMsg);
        }
      } else {
        setRepoUrl('');
        setSubmitSuccess(true);
        
        // Immediately reload repositories from database
        const updated = await getRepositories(session.user.email);
        setRepositories(updated);

        // Hide success state after a few seconds
        setTimeout(() => {
          setSubmitSuccess(false);
        }, 4000);
      }
    } catch (err: any) {
      const errMsg = err.message || '';
      if (errMsg.includes('repository_limit_exceeded') || errMsg.includes('limit reached') || errMsg.includes('Maximum limit')) {
        let cleanDetail = 'Maximum limit of 7 active repositories reached. Please delete an existing repository to import a new one.';
        try {
          const parsed = JSON.parse(errMsg);
          cleanDetail = parsed.detail || parsed.error || errMsg;
        } catch {
          cleanDetail = errMsg;
        }
        setLimitDetail(cleanDetail);
        setLimitDialogOpen(true);
      } else {
        setError('An error occurred while submitting the repository.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get recently submitted/modified repositories (max 3)
  const recentRepos = repositories.slice(0, 3);

  // Calculate quick stats
  const totalCount = repositories.length;
  const completedCount = repositories.filter(r => r.status === 'CLONED').length;
  const processingCount = repositories.filter(r => r.status === 'CLONING').length;
  const failedCount = repositories.filter(r => r.status === 'FAILED').length;

  return (
    <div className="space-y-10 selection:bg-gold/20 selection:text-gold">
      
      {/* Welcome Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-serif-display font-medium text-ivory tracking-tight" id="dashboard-heading">
          Workspace Overview
        </h1>
        <p className="text-xs text-silverish font-sans">
          Deploy repository blueprints and verify onboarding status.
        </p>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-900 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono-ui">Total Monitored</p>
            <p className="text-2xl font-sans-ui font-semibold text-ivory mt-1">{totalCount}</p>
          </div>
          <div className="text-zinc-700"><GitFork size={20} /></div>
        </div>

        <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-900 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono-ui">Blueprints Active</p>
            <p className="text-2xl font-sans-ui font-semibold text-gold mt-1">{completedCount}</p>
          </div>
          <div className="text-gold/40"><CheckCircle2 size={20} /></div>
        </div>

        <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-900 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono-ui">In Queue</p>
            <p className="text-2xl font-sans-ui font-semibold text-blue-400 mt-1">{processingCount}</p>
          </div>
          <div className="text-blue-500/40 animate-pulse-subtle"><Clock size={20} /></div>
        </div>

        <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-900 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono-ui">Faulted Reports</p>
            <p className="text-2xl font-sans-ui font-semibold text-purple-400 mt-1">{failedCount}</p>
          </div>
          <div className="text-accent-purple/40"><ShieldAlert size={20} /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Repo Submission Section - Left 2 Columns on Desktop */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-lg bg-zinc-950 border border-gold-subtle card-radial-glow">
            <h2 className="text-xl font-serif-display font-medium text-ivory tracking-tight mb-2">
              Ingest Repository
            </h2>
            <p className="text-xs text-silverish mb-6">
              Input a GitHub URL to start mapping the application architecture and indexing imports.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-950/20 border border-red-900/30 text-red-400 text-xs rounded font-sans">
                {error}
              </div>
            )}

            {submitSuccess && (
              <div className="mb-4 p-3 bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 text-xs rounded font-sans flex items-center gap-2">
                <CheckCircle2 size={14} />
                <span>Repository ingested successfully. Metadata is now available below.</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/facebook/react"
                disabled={isSubmitting}
                className="flex-1 bg-black border border-zinc-900 hover:border-zinc-800 focus:border-zinc-700 rounded p-3 text-xs text-ivory placeholder-zinc-650 focus:outline-none transition-colors"
                id="input-repo-url"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 bg-gold hover:bg-gold-hover text-black text-xs font-semibold rounded transition-all duration-300 flex items-center justify-center gap-2 border border-gold/25 cursor-pointer"
                id="btn-repo-submit"
              >
                <Plus size={14} />
                {isSubmitting ? 'Submitting...' : 'Analyze Repository'}
              </button>
            </form>
            <div className="mt-4 text-[10px] text-zinc-650 font-mono-ui flex items-center gap-2">
              <Terminal size={12} />
              <span>Status updates will display in real-time below and on the repositories tab.</span>
            </div>
          </div>
        </div>

        {/* Informational Panel - Right Column on Desktop */}
        <div className="p-6 rounded-lg bg-zinc-950 border border-zinc-900 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-base font-serif-display font-medium text-ivory tracking-tight">Workspace Guidelines</h3>
            <ul className="space-y-2 text-xs text-silverish list-disc list-inside">
              <li>Submitting repos will update lists locally.</li>
              <li>Status transitions simulate ingestion latency.</li>
              <li>Source files remain in browser context.</li>
              <li>Authentication checks are simulated.</li>
            </ul>
          </div>
        </div>

      </div>

      {/* Recent Repositories Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-serif-display font-medium text-ivory tracking-tight">
            Recent Repositories
          </h2>
          <Link href="/repositories" className="text-xs text-gold hover:underline flex items-center gap-1">
            View All
          </Link>
        </div>

        {loading ? (
          <div className="p-12 text-center rounded-lg border border-zinc-900 bg-zinc-950/40 text-xs text-zinc-500 font-mono">
            <span className="animate-pulse">Loading repositories...</span>
          </div>
        ) : recentRepos.length === 0 ? (
          <div className="p-12 text-center rounded-lg border border-zinc-900 bg-zinc-950/40 text-xs text-zinc-500">
            No repositories found. Submit a URL above to begin.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recentRepos.map((repo) => (
              <RepoCard
                key={repo.id}
                repository={repo}
                onDelete={handleDelete}
                onRefresh={handleRefresh}
                onClone={handleClone}
              />
            ))}
          </div>
        )}
      </div>

      <ErrorModal
        isOpen={isCloneErrorOpen}
        onClose={() => setIsCloneErrorOpen(false)}
        title="Clone Failed"
        message="An error occurred while attempting to clone the repository. Technical details have been logged in the backend application."
        reason="Unable to complete repository checkout."
      />

      <HelixResourceDialog
        isOpen={limitDialogOpen}
        onClose={() => setLimitDialogOpen(false)}
        title="Active Repository Limit"
        detail={limitDetail}
      />
    </div>
  );
}
