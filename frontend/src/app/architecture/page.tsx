"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Layers, Activity, AlertTriangle, Box, ArrowRight, ExternalLink, ArrowLeft } from 'lucide-react';
import { getRepositories, getRepositoryArchitecture } from '../../lib/api';
import { Repository, RepositoryArchitecture } from '../../types';

export default function ArchitectureCrossPage() {
  const { data: session } = useSession();
  const user = session?.user;

  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [architectures, setArchitectures] = useState<Record<string, RepositoryArchitecture>>({});
  const [loading, setLoading] = useState(true);

  const fetchArchitectureData = async () => {
    if (!user?.email) return;
    try {
      const list = await getRepositories(user.email);
      setRepositories(list);

      // Fetch architecture info for all repositories in parallel
      const archPromises = list.map(async repo => {
        try {
          const arch = await getRepositoryArchitecture(repo.id, user.email!);
          return { repoId: repo.id, arch };
        } catch (err) {
          return { repoId: repo.id, arch: null };
        }
      });

      const results = await Promise.all(archPromises);
      const archMap: Record<string, RepositoryArchitecture> = {};
      results.forEach(res => {
        if (res.arch) {
          archMap[res.repoId] = res.arch;
        }
      });
      setArchitectures(archMap);
    } catch (err) {
      console.error("Error loading architecture metrics", err);
    }
  };

  useEffect(() => {
    if (user?.email) {
      setLoading(true);
      fetchArchitectureData().finally(() => setLoading(false));
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
          await fetchArchitectureData();
        } else {
          setRepositories(list);
        }
      } catch (err) {
        console.error("Polling repositories failed:", err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [repositories, user?.email]);

  // Aggregate stats
  const totalRepos = repositories.length;
  const patternCounts: Record<string, number> = {};
  Object.values(architectures).forEach(arch => {
    patternCounts[arch.architecture_type] = (patternCounts[arch.architecture_type] || 0) + 1;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-mono-ui text-zinc-350">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-xs text-zinc-550 hover:text-gold transition-colors select-none">
        <ArrowLeft size={14} /> Back to Dashboard
      </Link>
      
      {/* Header section */}
      <div>
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono block font-semibold">Architecture Catalog</span>
        <h1 className="text-2xl font-serif-display font-medium text-ivory tracking-tight mt-1 flex items-center gap-2">
          <Layers className="text-gold" size={22} /> System Architectures
        </h1>
        <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
          Explore inferred architectural patterns, structural design models, and software layouts across all registered codebases.
        </p>
      </div>

      {loading ? (
        <div className="py-24 text-center text-xs text-zinc-500 animate-pulse font-mono">
          Scanning system architectures...
        </div>
      ) : totalRepos === 0 ? (
        <div className="py-16 text-center rounded-lg border border-zinc-900 bg-zinc-950/40">
          <Layers size={36} className="mx-auto text-zinc-800 mb-3" />
          <p className="text-sm text-zinc-400">No scanned repositories found.</p>
          <p className="text-xs text-zinc-650 mt-1">Architecture analysis is available once repositories have been cloned and scanned.</p>
        </div>
      ) : (
        <>
          {/* Patterns breakdown metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4.5 rounded-lg border border-zinc-900 bg-zinc-950 flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Total Monitored</span>
              <span className="text-2xl font-semibold text-ivory mt-0.5">{totalRepos} repos</span>
            </div>
            {Object.entries(patternCounts).map(([pattern, count]) => (
              <div key={pattern} className="p-4.5 rounded-lg border border-zinc-900 bg-zinc-950 flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono truncate" title={pattern}>{pattern}</span>
                <span className="text-2xl font-semibold text-gold mt-0.5">{count} repos</span>
              </div>
            ))}
          </div>

          {/* Catalog grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            {repositories.map(repo => {
              const arch = architectures[repo.id];
              const summary = arch ? (arch.architecture_summary as any) : null;
              const confidence = summary ? summary.confidence_score : null;

              return (
                <div key={repo.id} className="p-5 rounded-lg border border-zinc-900 bg-zinc-950/40 flex flex-col justify-between gap-5 hover:border-zinc-850 hover:bg-zinc-950/80 transition-all">
                  <div className="space-y-4">
                    
                    {/* Repo metadata */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] text-zinc-550 font-mono block">Ecosystem: {repo.language || 'Unknown'}</span>
                        <h2 className="text-base font-bold text-ivory font-sans-ui mt-0.5">{repo.name}</h2>
                      </div>
                      <Link 
                        href={`/repositories/${repo.id}`}
                        className="p-1 rounded text-zinc-550 hover:text-gold hover:bg-zinc-950 transition-all"
                        title="View Detailed Repository"
                      >
                        <ExternalLink size={14} />
                      </Link>
                    </div>

                    {/* Inferred Model info */}
                    {arch ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-zinc-900/40 pb-2">
                          <span className="text-xs text-zinc-500">Pattern</span>
                          <span className="text-xs font-bold text-gold">{arch.architecture_type}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-zinc-900/40 pb-2">
                          <span className="text-xs text-zinc-500">Confidence</span>
                          <span className={`text-xs font-bold font-mono ${
                            confidence && confidence >= 85 ? 'text-emerald-400' :
                            confidence && confidence >= 60 ? 'text-amber-400' : 'text-zinc-400'
                          }`}>
                            {confidence ? `${confidence}%` : 'N/A'}
                          </span>
                        </div>
                        {summary?.health_signals && (
                          <div className="grid grid-cols-2 gap-2.5 pt-1.5">
                            <div className="p-2 rounded bg-zinc-950/20 border border-zinc-900 text-center">
                              <span className="text-[9px] uppercase tracking-wider text-zinc-550 font-mono block">Design Cleanliness</span>
                              <span className="text-xs font-bold text-ivory font-mono mt-0.5 block">{summary.health_signals.separation_of_concerns_score ?? 100}/100</span>
                            </div>
                            <div className="p-2 rounded bg-zinc-950/20 border border-zinc-900 text-center">
                              <span className="text-[9px] uppercase tracking-wider text-zinc-550 font-mono block">Coupling Ratio</span>
                              <span className="text-xs font-bold text-ivory font-mono mt-0.5 block">{summary.health_signals.coupling_score ?? 0}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-600 italic py-6">
                        Architecture profile details not available.
                      </div>
                    )}
                  </div>

                  {arch && (
                    <Link
                      href={`/repositories/${repo.id}?tab=architecture`}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 hover:border-gold hover:text-gold transition-colors font-sans-ui w-full"
                    >
                      Explore Components and Flows <ArrowRight size={12} />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

    </div>
  );
}
