"use client";

import React, { useState, useEffect } from 'react';
import { RepoCard } from '../../components/RepoCard';
import { ErrorModal } from '../../components/ErrorModal';
import { Repository, RepositoryStatus } from '../../types';
import { Search, FolderGit, SlidersHorizontal } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { getRepositories, deleteRepository, refreshRepository, cloneRepository, updateRepository } from '../../lib/api';

type FilterStatus = 'All' | RepositoryStatus;

export default function RepositoriesPage() {
  const { data: session } = useSession();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCloneErrorOpen, setIsCloneErrorOpen] = useState(false);

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

  // Filtering list
  const filteredRepos = repositories.filter(repo => {
    let matchesFilter = false;
    if (filter === 'All') {
      matchesFilter = true;
    } else if (filter === 'READY' || filter === 'CLONED') {
      matchesFilter = ['READY', 'CLONED', 'UP_TO_DATE', 'UPDATES_AVAILABLE'].includes(repo.status);
    } else if (filter === 'CLONING') {
      matchesFilter = ['CLONING', 'SYNCING', 'ANALYZING'].includes(repo.status);
    } else {
      matchesFilter = repo.status === filter;
    }

    const matchesSearch = repo.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (repo.language || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusCount = (status: FilterStatus) => {
    if (status === 'All') return repositories.length;
    if (status === 'READY' || status === 'CLONED') {
      return repositories.filter(r => ['READY', 'CLONED', 'UP_TO_DATE', 'UPDATES_AVAILABLE'].includes(r.status)).length;
    }
    if (status === 'CLONING') {
      return repositories.filter(r => ['CLONING', 'SYNCING', 'ANALYZING'].includes(r.status)).length;
    }
    return repositories.filter(r => r.status === status).length;
  };

  const filterTabs: { name: FilterStatus; label: string; activeColor: string }[] = [
    { name: 'All', label: 'All Repositories', activeColor: 'border-zinc-500 text-ivory' },
    { name: 'READY', label: 'Ready', activeColor: 'border-zinc-700 text-zinc-300 bg-zinc-900/10' },
    { name: 'CLONING', label: 'Cloning', activeColor: 'border-blue-500 text-blue-400 bg-blue-500/5' },
    { name: 'CLONED', label: 'Cloned', activeColor: 'border-emerald-500 text-emerald-400 bg-emerald-500/5' },
    { name: 'FAILED', label: 'Failed', activeColor: 'border-accent-purple text-purple-400 bg-accent-purple/5' }
  ];

  return (
    <div className="space-y-10 selection:bg-gold/20 selection:text-gold">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-serif-display font-medium text-ivory tracking-tight" id="repositories-heading">
            Repositories
          </h1>
          <p className="text-xs text-silverish font-sans">
            Manage your code bases, view processing status and access generated blueprints.
          </p>
        </div>
        
        {/* Repo count */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-zinc-950 border border-zinc-900 text-xs font-medium text-silverish">
          <FolderGit size={14} className="text-zinc-650" />
          <span>{repositories.length} Total Repositories</span>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pt-2 border-t border-zinc-900">
        
        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 text-xs">
          {filterTabs.map((tab) => {
            const isActive = filter === tab.name;
            const count = getStatusCount(tab.name);
            return (
              <button
                key={tab.name}
                onClick={() => setFilter(tab.name)}
                className={`px-3 py-1.5 rounded border text-xs transition-all duration-300 flex items-center gap-2 cursor-pointer ${
                  isActive 
                    ? tab.activeColor 
                    : 'border-zinc-900 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800 bg-zinc-950/20'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  isActive ? 'bg-black/40 text-ivory' : 'bg-zinc-950 text-zinc-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Utility */}
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-64">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-550">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="Search by name or language..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-900 rounded py-1.5 pl-9 pr-4 text-xs text-ivory placeholder-zinc-600 focus:outline-none focus:border-zinc-800 transition-colors"
              id="input-repo-search"
            />
          </div>
          <button 
            className="p-2 rounded bg-zinc-950 border border-zinc-900 text-zinc-500 hover:text-ivory transition-colors"
            title="Refine filters"
          >
            <SlidersHorizontal size={14} />
          </button>
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="p-20 text-center rounded-lg border border-zinc-900 bg-zinc-950/40 text-xs text-zinc-500 font-mono">
          <span className="animate-pulse">Loading repositories...</span>
        </div>
      ) : filteredRepos.length === 0 ? (
        <div className="p-20 text-center rounded-lg border border-zinc-900 bg-zinc-950/40 text-xs text-zinc-500">
          No repositories match the active filter or search criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRepos.map((repo) => (
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

      <ErrorModal
        isOpen={isCloneErrorOpen}
        onClose={() => setIsCloneErrorOpen(false)}
        title="Clone Failed"
        message="An error occurred while attempting to clone the repository. Technical details have been logged in the backend application."
        reason="Unable to complete repository checkout."
      />
    </div>
  );
}
