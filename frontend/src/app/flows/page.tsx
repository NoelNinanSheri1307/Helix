"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Search, Workflow, ArrowRight, ExternalLink, Activity, ArrowLeft } from 'lucide-react';
import { getRepositories, getRepositoryFlows, ExecutionFlow } from '../../lib/api';
import { Repository } from '../../types';

interface DecoratedFlow extends ExecutionFlow {
  repoName: string;
}

export default function FlowsCrossPage() {
  const { data: session } = useSession();
  const user = session?.user;

  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [allFlows, setAllFlows] = useState<DecoratedFlow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const fetchFlowsData = async () => {
    if (!user?.email) return;
    try {
      const list = await getRepositories(user.email);
      setRepositories(list);

      const flowPromises = list.map(async repo => {
        try {
          const repoFlows = await getRepositoryFlows(repo.id, user.email!);
          return repoFlows.map(f => ({ ...f, repoName: repo.name }));
        } catch (err) {
          return [];
        }
      });

      const results = await Promise.all(flowPromises);
      const aggregated = results.flat();
      setAllFlows(aggregated);
    } catch (err) {
      console.error("Error loading behavior flows", err);
    }
  };

  useEffect(() => {
    if (user?.email) {
      setLoading(true);
      fetchFlowsData().finally(() => setLoading(false));
    }
  }, [user?.email]);

  // Poll status of cloning/syncing repositories to refresh list in real-time
  useEffect(() => {
    const activeSync = repositories.some(r => ['CLONING', 'SYNCING', 'ANALYZING'].includes(r.status));
    if (!activeSync || !user?.email) return;

    const interval = setInterval(async () => {
      try {
        const list = await getRepositories(user.email as string);
        const statusChanged = list.some(repo => {
          const prev = repositories.find(r => r.id === repo.id);
          return prev && prev.status !== repo.status;
        });

        if (statusChanged) {
          await fetchFlowsData();
        } else {
          setRepositories(list);
        }
      } catch (err) {
        console.error("Polling repositories failed:", err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [repositories, user?.email]);

  const flowTypes = useMemo(() => {
    return Array.from(new Set(allFlows.map(f => f.flow_type))).sort();
  }, [allFlows]);

  // Filtered flows based on search query and type filter
  const filteredFlows = useMemo(() => {
    return allFlows.filter(f => {
      const matchesSearch = f.flow_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            f.repoName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            f.flow_type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'ALL' || f.flow_type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [allFlows, searchQuery, typeFilter]);

  const confidenceBadge = (score: number) => {
    const s = score * 100;
    let color = 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400';
    let label = 'Verified';
    if (s < 70) {
      color = 'border-amber-500/20 bg-amber-500/5 text-amber-400';
      label = 'Inferred';
    } else if (s < 85) {
      color = 'border-blue-500/20 bg-blue-500/5 text-blue-450';
      label = 'High Match';
    }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border ${color}`}>
        {label} ({s.toFixed(0)}%)
      </span>
    );
  };

  const getFlowTypeColor = (type: string) => {
    const t = type.toUpperCase();
    if (t === 'AUTHENTICATION') return 'border-red-500/20 bg-red-500/5 text-red-400';
    if (t === 'PAYMENT') return 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400';
    if (t === 'FILE_UPLOAD') return 'border-purple-500/20 bg-purple-500/5 text-purple-400';
    if (t === 'PREDICTION' || t === 'TRAINING') return 'border-cyan-500/20 bg-cyan-500/5 text-cyan-400';
    if (t === 'CRUD') return 'border-amber-500/20 bg-amber-500/5 text-amber-400';
    return 'border-zinc-800 bg-zinc-900/60 text-zinc-450';
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-mono-ui text-zinc-350">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-xs text-zinc-550 hover:text-gold transition-colors select-none">
        <ArrowLeft size={14} /> Back to Dashboard
      </Link>
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono block font-semibold">Behavior Index</span>
          <h1 className="text-2xl font-serif-display font-medium text-ivory tracking-tight mt-1 flex items-center gap-2">
            <Workflow className="text-gold" size={22} /> Execution Flows Catalog
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            Search, filter, and trace software workflows, API routes, and operations across all scanned codebases.
          </p>
        </div>

        {/* Global Search */}
        <div className="relative w-full md:w-72 shrink-0">
          <Search size={14} className="absolute left-3 top-2.5 text-zinc-600" />
          <input
            type="text"
            placeholder="Search flows, repos, types..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-900 rounded pl-9 pr-4 py-1.5 text-xs text-zinc-350 placeholder-zinc-650 focus:outline-none focus:border-gold transition-colors font-mono"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center text-xs text-zinc-500 animate-pulse font-mono">
          Assembling execution flows catalog...
        </div>
      ) : allFlows.length === 0 ? (
        <div className="py-16 text-center rounded-lg border border-zinc-900 bg-zinc-950/40">
          <Workflow size={36} className="mx-auto text-zinc-800 mb-3" />
          <p className="text-sm text-zinc-400">No execution flows found.</p>
          <p className="text-xs text-zinc-650 mt-1">Please ensure codebases are cloned and behavioral dependency tracking is completed.</p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Filters List */}
          <div className="flex flex-wrap gap-1.5 border-b border-zinc-900/60 pb-3">
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1 rounded text-[10px] uppercase tracking-wider font-mono font-medium transition-all cursor-pointer ${
                typeFilter === 'ALL'
                  ? 'bg-gold/15 text-gold border border-gold/20'
                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              All Flows ({allFlows.length})
            </button>
            {flowTypes.map(type => {
              const count = allFlows.filter(f => f.flow_type === type).length;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilter(type)}
                  className={`px-3 py-1 rounded text-[10px] uppercase tracking-wider font-mono font-medium transition-all cursor-pointer ${
                    typeFilter === type
                      ? 'bg-gold/15 text-gold border border-gold/20'
                      : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                  }`}
                >
                  {type.replace(/_/g, ' ')} ({count})
                </button>
              );
            })}
          </div>

          {/* List display */}
          <div className="space-y-3">
            {filteredFlows.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-600">
                No flows matches the search criteria.
              </div>
            ) : (
              filteredFlows.map(flow => (
                <div key={flow.id} className="p-4 rounded-lg border border-zinc-900 bg-zinc-950/30 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-zinc-850 hover:bg-zinc-950/65 transition-all">
                  
                  {/* Flow description */}
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center flex-wrap gap-2.5">
                      <span className={`px-2 py-0.5 rounded border text-[9px] uppercase font-mono tracking-wider font-semibold ${getFlowTypeColor(flow.flow_type)}`}>
                        {flow.flow_type.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        Codebase: <span className="text-zinc-350 font-semibold">{flow.repoName}</span>
                      </span>
                      {confidenceBadge(flow.confidence_score)}
                    </div>
                    
                    <h3 className="text-sm font-bold text-ivory font-sans-ui truncate">{flow.flow_name}</h3>
                    <p className="text-[10.5px] text-zinc-550 font-mono truncate" title={flow.entry_point || ''}>
                      Entry Point: `{flow.entry_point || 'None'}` · {flow.steps.length} execution steps
                    </p>
                  </div>

                  {/* Flow links */}
                  <div className="shrink-0 flex items-center gap-2">
                    <Link
                      href={`/repositories/${flow.repository_id}?tab=flows`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-[10.5px] text-zinc-400 hover:border-gold hover:text-gold transition-colors font-sans-ui"
                    >
                      Trace Sequence Path <ArrowRight size={12} />
                    </Link>
                  </div>

                </div>
              ))
            )}
          </div>

        </div>
      )}

    </div>
  );
}
