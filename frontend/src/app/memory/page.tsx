"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Brain, ArrowLeft, RefreshCw, Search, Database, Cpu,
  ChevronDown, ChevronUp, Zap, Box, Workflow, Shield,
  Cloud, Container, Sparkles, HardDrive, Check
} from 'lucide-react';
import {
  getRepositories, getRepositoryMemory, generateRepositoryMemory,
  searchRepositoryMemory, MemorySnapshot, MemorySearchResponse,
  MemorySearchResultItem
} from '../../lib/api';
import { Repository } from '../../types';

const SECTION_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  OVERVIEW: { bg: 'bg-amber-500/8', text: 'text-amber-400', border: 'border-amber-500/20' },
  TECHNOLOGY: { bg: 'bg-cyan-500/8', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  DEPENDENCIES: { bg: 'bg-indigo-500/8', text: 'text-indigo-400', border: 'border-indigo-500/20' },
  ARCHITECTURE: { bg: 'bg-blue-500/8', text: 'text-blue-400', border: 'border-blue-500/20' },
  COMPONENT: { bg: 'bg-teal-500/8', text: 'text-teal-400', border: 'border-teal-500/20' },
  FLOW: { bg: 'bg-purple-500/8', text: 'text-purple-400', border: 'border-purple-500/20' },
  ONBOARDING: { bg: 'bg-green-500/8', text: 'text-green-400', border: 'border-green-500/20' },
  DATABASE: { bg: 'bg-orange-500/8', text: 'text-orange-400', border: 'border-orange-500/20' },
  AUTHENTICATION: { bg: 'bg-red-500/8', text: 'text-red-400', border: 'border-red-500/20' },
  EXTERNAL: { bg: 'bg-sky-500/8', text: 'text-sky-400', border: 'border-sky-500/20' },
  INFRASTRUCTURE: { bg: 'bg-zinc-500/8', text: 'text-zinc-400', border: 'border-zinc-500/20' },
  CLOUD: { bg: 'bg-violet-500/8', text: 'text-violet-400', border: 'border-violet-500/20' },
  CONTAINERIZATION: { bg: 'bg-emerald-500/8', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  ML: { bg: 'bg-pink-500/8', text: 'text-pink-400', border: 'border-pink-500/20' },
  HEALTH: { bg: 'bg-rose-500/8', text: 'text-rose-400', border: 'border-rose-500/20' },
  STRUCTURE: { bg: 'bg-lime-500/8', text: 'text-lime-400', border: 'border-lime-500/20' },
};

function getSectionColor(type: string) {
  return SECTION_TYPE_COLORS[type] || { bg: 'bg-zinc-800/30', text: 'text-zinc-400', border: 'border-zinc-700' };
}

function SimilarityBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-zinc-600';
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-zinc-500 w-[36px] text-right">{pct}%</span>
    </div>
  );
}

export default function MemoryPage() {
  const { data: session } = useSession();
  const user = session?.user;

  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [memory, setMemory] = useState<MemorySnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<MemorySearchResponse | null>(null);

  // Snapshot inspector
  const [snapshotExpanded, setSnapshotExpanded] = useState(false);
  const [hasAutoSearched, setHasAutoSearched] = useState(false);

  // Load repos
  useEffect(() => {
    if (user?.email) {
      getRepositories(user.email)
        .then(list => {
          const cloned = list.filter(r => r.status === 'CLONED');
          setRepositories(cloned);
          
          if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const repoParam = params.get('repo');
            const searchParam = params.get('search');
            
            if (searchParam) {
              setSearchQuery(searchParam);
            }
            if (repoParam && cloned.some(r => r.id === repoParam)) {
              setSelectedRepoId(repoParam);
            } else if (cloned.length > 0) {
              setSelectedRepoId(cloned[0].id);
            }
          } else if (cloned.length > 0) {
            setSelectedRepoId(cloned[0].id);
          }
        })
        .catch(err => console.error(err));
    }
  }, [user?.email]);

  // Load memory when repo changes
  useEffect(() => {
    if (selectedRepoId && user?.email) {
      setLoading(true);
      setError('');
      setSearchResults(null);
      getRepositoryMemory(selectedRepoId, user.email)
        .then(data => setMemory(data))
        .catch(() => setMemory(null))
        .finally(() => setLoading(false));
    } else {
      setMemory(null);
    }
  }, [selectedRepoId, user?.email]);

  // Auto-run search if search query is provided via URL
  useEffect(() => {
    if (selectedRepoId && user?.email && searchQuery.trim() && memory && !hasAutoSearched) {
      setHasAutoSearched(true);
      setSearching(true);
      searchRepositoryMemory(selectedRepoId, user.email, searchQuery.trim())
        .then(data => setSearchResults(data))
        .catch(err => setError(err.message || 'Search failed'))
        .finally(() => setSearching(false));
    }
  }, [selectedRepoId, user?.email, memory, searchQuery, hasAutoSearched]);

  const handleGenerate = async () => {
    if (!selectedRepoId || !user?.email) return;
    setGenerating(true);
    setError('');
    try {
      const data = await generateRepositoryMemory(selectedRepoId, user.email);
      setMemory(data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate memory');
    } finally {
      setGenerating(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !selectedRepoId || !user?.email) return;
    setSearching(true);
    try {
      const data = await searchRepositoryMemory(selectedRepoId, user.email, searchQuery.trim());
      setSearchResults(data);
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const selectedRepo = repositories.find(r => r.id === selectedRepoId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-xs text-zinc-550 hover:text-gold transition-colors select-none">
        <ArrowLeft size={14} /> Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono block">Stage 9 — Internal</span>
          <h1 className="text-2xl font-serif-display font-medium text-ivory tracking-tight mt-1 flex items-center gap-2">
            <Brain className="text-gold" size={24} /> Repository Atlas : Embedding Based Search
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
            Explore repository knowledge, architecture, execution flows, onboarding intelligence, and semantic discovery.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-zinc-500 font-mono">Repository:</span>
          <select
            value={selectedRepoId}
            onChange={(e) => setSelectedRepoId(e.target.value)}
            className="bg-zinc-950 border border-zinc-900 rounded px-3 py-1.5 text-xs text-zinc-350 focus:outline-none focus:border-gold transition-colors font-mono max-w-[220px]"
          >
            {repositories.length === 0 && <option value="">No analyzed repos</option>}
            {repositories.map(repo => (
              <option key={repo.id} value={repo.id}>{repo.name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/5 border border-red-500/15 rounded px-3 py-2 font-mono">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-xs text-zinc-500 animate-pulse font-mono">
          Loading atlas state...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column: Status + Controls */}
          <div className="lg:col-span-1 space-y-4">

            {/* Atlas Status */}
            <div className="p-4 rounded-lg border border-zinc-900 bg-zinc-950/20 space-y-4">
              <span className="text-[9.5px] uppercase tracking-wider text-zinc-600 font-mono block">Atlas Status</span>

              {memory ? (
                <>
                  <div className="space-y-2">
                    <StatusRow label="Snapshot" value={`v${memory.snapshot_version}`} color="text-emerald-400" />
                    <StatusRow label="Embeddings" value={String(memory.embedding_count)} color="text-cyan-400" />
                    <StatusRow
                      label="Generated"
                      value={memory.updated_at ? new Date(memory.updated_at).toLocaleString() : 'Never'}
                      color="text-zinc-350"
                    />
                    <StatusRow
                      label="Repository"
                      value={selectedRepo?.name || '—'}
                      color="text-gold"
                    />
                  </div>

                  <div className="pt-2 border-t border-zinc-900/60 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={generating}
                      className="w-full py-1.5 rounded bg-zinc-900 border border-zinc-800 text-[10.5px] font-mono-ui text-zinc-400 hover:border-gold hover:text-gold hover:bg-gold/5 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw size={11} className={generating ? 'animate-spin' : ''} />
                      {generating ? 'Regenerating...' : 'Regenerate Snapshot'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500 text-center">No atlas generated yet.</p>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generating}
                    className="w-full py-2 rounded bg-gold/10 border border-gold/20 text-[11px] font-mono-ui text-gold hover:bg-gold/15 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Zap size={12} className={generating ? 'animate-spin' : ''} />
                    {generating ? 'Generating...' : 'Generate Atlas'}
                  </button>
                </div>
              )}
            </div>

            {/* Snapshot Inspector Toggle */}
            {memory && (
              <div className="rounded-lg border border-zinc-900 bg-zinc-950/20 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSnapshotExpanded(!snapshotExpanded)}
                  className="w-full px-4 py-3 flex items-center justify-between cursor-pointer outline-none hover:bg-zinc-950/50 transition-colors"
                >
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono">Snapshot Inspector</span>
                  {snapshotExpanded ? <ChevronUp size={14} className="text-zinc-600" /> : <ChevronDown size={14} className="text-zinc-600" />}
                </button>
                {snapshotExpanded && (
                  <div className="px-4 pb-4 max-h-[400px] overflow-y-auto">
                    <pre className="text-[9px] font-mono text-zinc-500 leading-relaxed whitespace-pre-wrap break-words">
                      {JSON.stringify(memory.snapshot_content, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Quick Snapshot Overview */}
            {memory && memory.snapshot_content && (
              <div className="p-4 rounded-lg border border-zinc-900 bg-zinc-950/20 space-y-3">
                <span className="text-[9.5px] uppercase tracking-wider text-zinc-600 font-mono block">Snapshot Overview</span>
                <div className="grid grid-cols-2 gap-2">
                  <MiniStat label="Flows" value={memory.snapshot_content.execution_flows?.length ?? 0} />
                  <MiniStat label="Dependencies" value={memory.snapshot_content.dependencies?.length ?? 0} />
                  <MiniStat label="DB Libraries" value={memory.snapshot_content.database_usage?.length ?? 0} />
                  <MiniStat label="Auth Libs" value={memory.snapshot_content.authentication_mechanisms?.length ?? 0} />
                  <MiniStat label="Ext. Services" value={memory.snapshot_content.external_integrations?.length ?? 0} />
                  <MiniStat label="ML Components" value={memory.snapshot_content.ml_components?.length ?? 0} />
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Search */}
          <div className="lg:col-span-2 space-y-4">

            {/* Search Bar */}
            <div className="px-4 py-3.5 rounded-lg border border-zinc-900 bg-zinc-950 flex items-center gap-3">
              <Search size={15} className="text-zinc-600 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Ask about the repository... (e.g., Where is authentication implemented?)"
                className="flex-1 bg-transparent text-xs text-ivory placeholder:text-zinc-650 focus:outline-none font-sans-ui"
                disabled={!memory}
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching || !memory || !searchQuery.trim()}
                className="px-3 py-1.5 rounded bg-gold/10 border border-gold/20 text-[10px] text-gold font-mono-ui hover:bg-gold/20 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {searching ? <RefreshCw size={11} className="animate-spin" /> : <Sparkles size={11} />}
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {!memory && !loading && (
              <div className="py-16 text-center rounded-lg border border-zinc-900 bg-zinc-950/40">
                <Brain size={36} className="mx-auto text-zinc-800 mb-3" />
                <p className="text-sm text-zinc-400">Generate repository atlas first.</p>
                <p className="text-xs text-zinc-650 mt-1">The atlas layer aggregates all repository intelligence into a searchable knowledge base.</p>
              </div>
            )}

            {/* Search Results */}
            {searchResults && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                    {searchResults.results.length} results from {searchResults.total_embeddings} embeddings
                  </span>
                  {(searchResults.referenced_components.length > 0 || searchResults.referenced_flows.length > 0) && (
                    <div className="flex items-center gap-2">
                      {searchResults.referenced_components.length > 0 && (
                        <span className="text-[9px] font-mono text-teal-500 bg-teal-500/8 border border-teal-500/15 px-2 py-0.5 rounded">
                          {searchResults.referenced_components.length} Components
                        </span>
                      )}
                      {searchResults.referenced_flows.length > 0 && (
                        <span className="text-[9px] font-mono text-purple-500 bg-purple-500/8 border border-purple-500/15 px-2 py-0.5 rounded">
                          {searchResults.referenced_flows.length} Flows
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {searchResults.results.map((result, idx) => {
                  const color = getSectionColor(result.section_type);
                  return (
                    <div
                      key={idx}
                      className={`rounded-lg border ${color.border} ${color.bg} overflow-hidden transition-all hover:scale-[1.005]`}
                    >
                      <div className="px-4 py-3 flex items-start gap-3">
                        <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                          <span className="text-[9px] font-mono font-bold text-zinc-600">#{idx + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`text-[9px] font-mono font-bold uppercase tracking-wider ${color.text} px-1.5 py-0.5 rounded border ${color.border}`}>
                              {result.section_type}
                            </span>
                            <span className="text-[9px] font-mono text-zinc-600 truncate">{result.section_key}</span>
                            <div className="ml-auto shrink-0">
                              <SimilarityBar score={result.similarity_score} />
                            </div>
                          </div>
                          <p className="text-[11px] text-zinc-350 leading-relaxed font-sans-ui break-words">
                            {result.section_text}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {searchResults.results.length === 0 && (
                  <div className="py-10 text-center text-xs text-zinc-500 font-mono">
                    No relevant sections found for this query.
                  </div>
                )}
              </div>
            )}

            {/* Sample Queries */}
            {memory && !searchResults && (
              <div className="p-5 rounded-lg border border-zinc-900 bg-zinc-950/20 space-y-3">
                <span className="text-[9.5px] uppercase tracking-wider text-zinc-600 font-mono block">Try These Queries</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Where is authentication implemented?',
                    'How does the database layer work?',
                    'What external services are used?',
                    'How does repository ingestion work?',
                    'What are the main controllers?',
                    'What ML components exist?',
                    'How is the project deployed?',
                    'What is the architecture pattern?',
                  ].map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => { setSearchQuery(q); }}
                      className="px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-850 hover:border-zinc-750 text-[10px] text-zinc-400 hover:text-gold transition-colors cursor-pointer font-sans-ui"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// ── Helper Components ──────────────────────────────────────────────────────────

function StatusRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[10px] font-mono text-zinc-550">{label}</span>
      <span className={`text-[10.5px] font-mono font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-2.5 rounded border border-zinc-900 bg-zinc-950/30 text-center">
      <div className="text-sm font-bold text-ivory font-mono">{value}</div>
      <div className="text-[8.5px] uppercase tracking-wider text-zinc-600 font-mono mt-0.5">{label}</div>
    </div>
  );
}
