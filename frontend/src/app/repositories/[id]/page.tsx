"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Braces, FileCog, Files, FolderTree, GitBranch, Play, Star, FileText, Box, Info, Code, Layers, Workflow, AlertTriangle, AlertCircle, Activity } from 'lucide-react';
import { DirectoryTree } from '../../../components/DirectoryTree';
import { StatusBadge } from '../../../components/StatusBadge';
import { getRepositories, getRepositoryStructure, getRepositoryEntities, getRepositoryGraph, getRepositoryArchitecture, getRepositoryCallGraph, CallGraphData, getRepositoryFlows, ExecutionFlow } from '../../../lib/api';
import { Repository, RepositoryStructure, CodeEntity, RepositoryGraph, RepositoryArchitecture } from '../../../types';
import { KnowledgeGraph } from '../../../components/KnowledgeGraph';
import { CallGraph } from '../../../components/CallGraph';
import { ExecutionFlows } from '../../../components/ExecutionFlows';
import { EmptyState } from '../../../components/EmptyState';

export default function RepositoryDetailsPage() {
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [repository, setRepository] = useState<Repository | null>(null);
  const [structure, setStructure] = useState<RepositoryStructure | null>(null);
  const [entities, setEntities] = useState<CodeEntity[]>([]);
  const [graph, setGraph] = useState<RepositoryGraph | null>(null);
  const [architecture, setArchitecture] = useState<RepositoryArchitecture | null>(null);
  const [callGraph, setCallGraph] = useState<CallGraphData | null>(null);
  const [flows, setFlows] = useState<ExecutionFlow[]>([]);
  const [initialCallGraphNode, setInitialCallGraphNode] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'tree' | 'languages' | 'frameworks' | 'entryPoints' | 'dependencies' | 'configFiles' | 'entities' | 'graph' | 'endpoints' | 'architecture' | 'callgraph' | 'flows'>('tree');
  const [entitySearch, setEntitySearch] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('ALL');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      const validTabs = ['tree', 'languages', 'frameworks', 'entryPoints', 'dependencies', 'configFiles', 'entities', 'graph', 'endpoints', 'architecture', 'callgraph', 'flows'];
      if (tabParam && validTabs.includes(tabParam)) {
        setActiveTab(tabParam as any);
      }
    }
  }, []);


  useEffect(() => {
    const load = async () => {
      if (!session?.user?.email || !params.id) return;
      setLoading(true);
      setError('');
      try {
        const repositories = await getRepositories(session.user.email);
        const selected = repositories.find(item => item.id === params.id);
        if (!selected) throw new Error('Repository not found');
        setRepository(selected);
        if (selected.status === 'CLONED') {
          const [structData, entitiesData, graphData, architectureData, callGraphData, flowsData] = await Promise.all([
            getRepositoryStructure(params.id, session.user.email),
            getRepositoryEntities(params.id, session.user.email),
            getRepositoryGraph(params.id, session.user.email).catch(() => null),
            getRepositoryArchitecture(params.id, session.user.email).catch(() => null),
            getRepositoryCallGraph(params.id, session.user.email).catch(() => null),
            getRepositoryFlows(params.id, session.user.email).catch(() => [])
          ]);
          setStructure(structData);
          setEntities(entitiesData);
          setGraph(graphData);
          setArchitecture(architectureData);
          setCallGraph(callGraphData);
          setFlows(flowsData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load repository');
      } finally {
        setLoading(false);
      }
    };
    load();

  }, [params.id, session?.user?.email]);

  if (loading) return <div className="p-16 text-center text-xs text-zinc-500 animate-pulse font-mono">Loading repository structure...</div>;
  if (error || !repository) return <div className="p-8 rounded border border-red-900/30 bg-red-950/10 text-sm text-red-400">{error || 'Repository not found'}</div>;

  // Rules-based details calculations (No LLM required)
  const getBuildTool = (filesList: string[]) => {
    if (filesList.some(f => f.endsWith('pom.xml'))) return 'Maven';
    if (filesList.some(f => f.endsWith('build.gradle'))) return 'Gradle';
    if (filesList.some(f => f.endsWith('package.json'))) return 'npm / yarn';
    if (filesList.some(f => f.endsWith('Cargo.toml'))) return 'Cargo';
    if (filesList.some(f => f.endsWith('requirements.txt') || f.endsWith('pyproject.toml'))) return 'pip / Poetry';
    return 'None';
  };

  const getRepoType = (frameworkName: string | null, languageName: string | null) => {
    if (frameworkName === 'Spring Boot') return 'Spring Boot Backend';
    if (frameworkName === 'Next.js') return 'Next.js Web Application';
    if (frameworkName === 'FastAPI') return 'FastAPI Backend Service';
    if (frameworkName === 'React') return 'React Frontend Application';
    if (frameworkName === 'Django') return 'Django Web Application';
    if (frameworkName === 'Flask') return 'Flask Web Application';
    if (frameworkName === 'Vite') return 'Vite Web Application';
    if (languageName) return `${languageName} Codebase`;
    return 'General Codebase';
  };

  const buildTool = structure ? getBuildTool(structure.files) : 'None';
  const repoType = structure ? getRepoType(repository.framework, repository.language) : 'General Codebase';

  return (
    <div className="space-y-8">
      <Link href="/repositories" className="inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-gold transition-colors select-none">
        <ArrowLeft size={14} /> Back to repositories
      </Link>

      <section className="p-6 rounded-lg border border-zinc-900 bg-zinc-950 card-radial-glow">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono-ui">Repository overview</p>
            <h1 className="text-3xl font-serif-display font-medium text-ivory tracking-tight mt-2">{repository.name}</h1>
            <p className="text-sm text-zinc-400 mt-2 max-w-3xl leading-relaxed">{repository.description || 'No description provided.'}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <StatusBadge status={repository.status} />
            {repository.framework && repository.framework !== 'Unknown' && !structure && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border border-gold/20 bg-gold/5 text-gold/80 font-mono-ui select-none">
                {repository.framework}
              </span>
            )}
          </div>
        </div>
        
        {structure && (
          <div className="mt-5 pt-4 border-t border-zinc-900/60">
            <p className="text-[10px] uppercase tracking-widest text-zinc-550 font-mono-ui mb-2.5 font-semibold">Technology Stack</p>
            <div className="flex flex-wrap gap-2">
              {/* Project Type Badge */}
              {structure.project_type && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10.5px] font-medium border border-amber-500/20 bg-amber-500/5 text-amber-400 font-mono-ui select-none">
                  {structure.project_type}
                </span>
              )}
              {/* Framework Badges */}
              {structure.frameworks?.map(fw => (
                <span key={fw} className="inline-flex items-center px-2.5 py-0.5 rounded text-[10.5px] font-medium border border-gold/20 bg-gold/5 text-gold font-mono-ui select-none">
                  {fw}
                </span>
              ))}
              {/* Tailwind Badge if detected in dependencies */}
              {structure.dependencies?.some(d => d.toLowerCase().startsWith('tailwindcss')) && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10.5px] font-medium border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 font-mono-ui select-none">
                  Tailwind CSS
                </span>
              )}
              {/* Language Badges */}
              {structure.languages?.map(lang => (
                <span key={lang} className="inline-flex items-center px-2.5 py-0.5 rounded text-[10.5px] font-medium border border-blue-500/20 bg-blue-500/5 text-blue-400 font-mono-ui select-none">
                  {lang}
                </span>
              ))}
              {/* Runtime Badges */}
              {structure.runtimes?.map(rt => (
                <span key={rt} className="inline-flex items-center px-2.5 py-0.5 rounded text-[10.5px] font-medium border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 font-mono-ui select-none">
                  {rt}
                </span>
              ))}
              {/* Build Tools Badges */}
              {structure.build_tools?.map(bt => (
                <span key={bt} className="inline-flex items-center px-2.5 py-0.5 rounded text-[10.5px] font-medium border border-purple-500/20 bg-purple-500/5 text-purple-400 font-mono-ui select-none">
                  {bt}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-5 mt-6 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5"><GitBranch size={14} className="text-zinc-700" /> {repository.branch || 'Unknown branch'}</span>
          <span className="flex items-center gap-1.5"><Star size={14} className="text-zinc-700" /> {repository.stars ?? 0} stars</span>
          <span className="text-zinc-650">{repository.owner}/{repository.name}</span>
          {repository.sizeKb !== null && (
            <span className="text-zinc-600 font-mono-ui">Size: {repository.sizeKb} KB</span>
          )}
        </div>
      </section>

      {!structure ? (
        <section className="p-12 text-center rounded-lg border border-zinc-900 bg-zinc-950/50">
          <FolderTree size={28} className="mx-auto text-zinc-800 mb-3" />
          <p className="text-sm text-zinc-300">Structure is not available yet.</p>
          <p className="text-xs text-zinc-600 mt-1">Clone this repository from its card to create the structure scan.</p>
        </section>
      ) : (
        <>
          {/* Interactive Stat Cards Grid */}
          <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <div className="p-4 rounded-lg border border-zinc-900 bg-zinc-950 flex items-center gap-3">
              <span className="text-zinc-500"><Files size={17} /></span>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-600">Total Files</p>
                <p className="text-lg text-ivory font-semibold">{structure.total_files}</p>
              </div>
            </div>
            
            <InteractiveStat 
              icon={<FolderTree size={17} />} 
              label="Directories" 
              value={structure.total_directories} 
              active={activeTab === 'tree'} 
              onClick={() => setActiveTab('tree')} 
            />
            
            <InteractiveStat 
              icon={<Braces size={17} />} 
              label="Languages" 
              value={structure.languages.length} 
              active={activeTab === 'languages'} 
              onClick={() => setActiveTab('languages')} 
            />

            <InteractiveStat 
              icon={<Box size={17} />} 
              label="Frameworks" 
              value={structure.frameworks?.length ?? 0} 
              active={activeTab === 'frameworks'} 
              onClick={() => setActiveTab('frameworks')} 
            />
            
            <InteractiveStat 
              icon={<Play size={17} />} 
              label="Entry Points" 
              value={structure.entry_points.length} 
              active={activeTab === 'entryPoints'} 
              onClick={() => setActiveTab('entryPoints')} 
            />

            <InteractiveStat 
              icon={<FileText size={17} />} 
              label="Dependencies" 
              value={structure.dependencies?.length ?? 0} 
              active={activeTab === 'dependencies'} 
              onClick={() => setActiveTab('dependencies')} 
            />
            
            <InteractiveStat 
              icon={<FileCog size={17} />} 
              label="Config Files" 
              value={(structure.dev_config_files?.length ?? 0) + (structure.app_config_files?.length ?? 0)} 
              active={activeTab === 'configFiles'} 
              onClick={() => setActiveTab('configFiles')} 
            />

            <InteractiveStat 
              icon={<Code size={17} />} 
              label="AST Entities" 
              value={entities.length} 
              active={activeTab === 'entities'} 
              onClick={() => setActiveTab('entities')} 
            />

            <InteractiveStat 
              icon={<GitBranch size={17} />} 
              label="Knowledge Graph" 
              value={graph?.nodes.length ?? 0} 
              active={activeTab === 'graph'} 
              onClick={() => setActiveTab('graph')} 
            />
            
            <InteractiveStat 
              icon={<Activity size={17} />} 
              label="Call Graph" 
              value={callGraph?.edges.length ?? 0} 
              active={activeTab === 'callgraph'} 
              onClick={() => setActiveTab('callgraph')} 
            />

            <InteractiveStat 
              icon={<Workflow size={17} />} 
              label="Execution Flows" 
              value={flows.length} 
              active={activeTab === 'flows'} 
              onClick={() => setActiveTab('flows')} 
            />
            
            <InteractiveStat 
              icon={<Play size={17} />} 
              label="Endpoints" 
              value={entities.filter(e => e.entity_type === 'ENDPOINT').length} 
              active={activeTab === 'endpoints'} 
              onClick={() => setActiveTab('endpoints')} 
            />

            <InteractiveStat 
              icon={<Layers size={17} />} 
              label="Architecture" 
              value={architecture?.components.length ?? 0} 
              active={activeTab === 'architecture'} 
              onClick={() => setActiveTab('architecture')} 
            />
          </section>


          {/* Core Panel and Summary Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* Inspector Panel (Left 2 Columns) */}
            <section className="xl:col-span-2 rounded-lg border border-zinc-900 bg-zinc-950 overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/40">
                <h2 className="text-sm text-ivory flex items-center gap-2">
                  {activeTab === 'tree' && <FolderTree size={16} className="text-gold" />}
                  {activeTab === 'languages' && <Braces size={16} className="text-gold" />}
                  {activeTab === 'frameworks' && <Box size={16} className="text-gold" />}
                  {activeTab === 'entryPoints' && <Play size={16} className="text-gold" />}
                  {activeTab === 'dependencies' && <FileText size={16} className="text-gold" />}
                  {activeTab === 'configFiles' && <FileCog size={16} className="text-gold" />}
                  {activeTab === 'entities' && <Code size={16} className="text-gold" />}
                  {activeTab === 'graph' && <GitBranch size={16} className="text-gold" />}
                  {activeTab === 'endpoints' && <Play size={16} className="text-gold" />}
                  {activeTab === 'architecture' && <Layers size={16} className="text-gold" />}
                  {activeTab === 'callgraph' && <Activity size={16} className="text-gold" />}
                  {activeTab === 'flows' && <Workflow size={16} className="text-gold" />}
                  <span className="capitalize">
                    {activeTab === 'tree' ? 'Directory Structure Tree' : 
                     activeTab === 'languages' ? 'Detected Languages' : 
                     activeTab === 'frameworks' ? 'Detected Frameworks & Ecosystems' : 
                     activeTab === 'entryPoints' ? 'Application Entry Points' : 
                     activeTab === 'dependencies' ? 'Extracted Project Dependencies' : 
                     activeTab === 'configFiles' ? 'Categorized Config Files' : 
                     activeTab === 'entities' ? 'AST Parsed Code Entities' : 
                     activeTab === 'endpoints' ? 'Identified API Endpoints' : 
                     activeTab === 'architecture' ? 'System Architecture Analysis' : 
                     activeTab === 'callgraph' ? 'Behavior Call Graph Analysis' : 
                     activeTab === 'flows' ? 'Execution Flows Analysis' : 'Connected Knowledge Graph'}
                  </span>
                </h2>
                <span className="text-[10px] text-zinc-500 font-mono-ui font-medium">Repository Inspector</span>
              </div>
              
              <div className="bg-zinc-950/10 flex-1 min-h-[350px]">
                {activeTab === 'tree' && (
                  <div className="max-h-[500px] overflow-y-auto p-4">
                    <DirectoryTree directories={structure.directories} files={structure.files} />
                  </div>
                )}

                {activeTab === 'languages' && (
                  <div className="p-5 space-y-6">
                    <div>
                      <h3 className="text-[10px] uppercase tracking-wider text-zinc-650 mb-3 font-mono-ui font-semibold">Primary Ecosystems</h3>
                      <div className="flex flex-wrap gap-2">
                        {structure.languages.map(lang => (
                          <span key={lang} className="px-2.5 py-1 rounded text-xs border border-zinc-900 bg-zinc-950 text-zinc-350 select-none font-medium">
                            {lang}
                          </span>
                        ))}
                      </div>
                    </div>

                    {structure.repository_statistics?.extension_counts && (
                      <div className="pt-5 border-t border-zinc-900/60">
                        <h3 className="text-[10px] uppercase tracking-wider text-zinc-650 mb-3.5 font-mono-ui font-semibold">Extension Breakdown</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {Object.entries(structure.repository_statistics.extension_counts)
                            .sort((a, b) => b[1] - a[1])
                            .map(([ext, count]) => {
                              const pct = structure.total_files > 0 ? ((count / structure.total_files) * 100).toFixed(1) : '0';
                              return (
                                <div key={ext} className="px-3.5 py-2.5 rounded border border-zinc-900 bg-zinc-950/30 flex flex-col">
                                  <span className="text-xs font-mono-ui text-zinc-400 font-semibold">{ext || 'no-ext'}</span>
                                  <span className="text-sm font-semibold text-ivory mt-1">{count} files</span>
                                  <span className="text-[9.5px] text-zinc-550 mt-0.5 font-mono">{pct}% distribution</span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'frameworks' && (
                  <div className="p-5">
                    <h3 className="text-[10px] uppercase tracking-wider text-zinc-650 mb-4 font-mono-ui font-semibold">Detected Frameworks & Ecosystems</h3>
                    {structure.frameworks?.length ? (
                      <div className="flex flex-wrap gap-2.5">
                        {structure.frameworks.map(fw => (
                          <span key={fw} className="px-3 py-1.5 rounded border border-gold/20 bg-gold/5 text-gold font-sans text-xs select-none font-medium">
                            {fw}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <EmptyState message="I can't find any frameworks or ecosystems in this repository codebase." />
                    )}
                  </div>
                )}

                {activeTab === 'entryPoints' && (
                  <div className="p-5">
                    <h3 className="text-[10px] uppercase tracking-wider text-zinc-650 mb-4 font-mono-ui font-semibold">Likely Application Entry Points</h3>
                    {structure.entry_points.length ? (
                      <ul className="space-y-2">
                        {structure.entry_points.map(ep => (
                          <li key={ep} className="flex items-center gap-3 text-xs text-zinc-350 font-mono-ui border-b border-zinc-900 pb-2 last:border-0 last:pb-0">
                            <Play size={12} className="text-emerald-500 fill-emerald-500/20 shrink-0" />
                            <span className="break-all">{ep}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <EmptyState message="No core bootstrap or entry point files detected in typical locations." />
                    )}
                  </div>
                )}

                {activeTab === 'dependencies' && (
                  <div className="p-5">
                    <h3 className="text-[10px] uppercase tracking-wider text-zinc-650 mb-4 font-mono-ui font-semibold">Extracted Project Dependencies</h3>
                    {structure.dependencies?.length ? (
                      <div className="max-h-[400px] overflow-y-auto pr-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {structure.dependencies.map(dep => (
                            <div key={dep} className="px-3 py-2 rounded border border-zinc-900 bg-zinc-950/40 text-xs font-mono-ui text-zinc-350 break-all select-all hover:border-zinc-850 transition-colors">
                              {dep}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <EmptyState message="I can't find any package dependencies here (e.g. package.json, requirements.txt, or pom.xml)." />
                    )}
                  </div>
                )}

                {activeTab === 'configFiles' && (
                  <div className="space-y-6 p-5">
                    {(structure.dev_config_files?.length ?? 0) + (structure.app_config_files?.length ?? 0) === 0 ? (
                      <EmptyState message="No configuration files detected in this repository." />
                    ) : (
                      <>
                        {structure.dev_config_files?.length > 0 && (
                          <div>
                            <h3 className="text-[10px] uppercase tracking-wider text-zinc-650 mb-3.5 font-mono-ui font-semibold">Development Configuration</h3>
                            <ul className="space-y-2">
                              {structure.dev_config_files.map(file => (
                                <li key={file} className="text-xs text-zinc-400 font-mono-ui border-b border-zinc-900 pb-2 last:border-0 last:pb-0 break-all">{file}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {structure.app_config_files?.length > 0 && (
                          <div className={structure.dev_config_files?.length > 0 ? "pt-4 border-t border-zinc-900/60" : ""}>
                            <h3 className="text-[10px] uppercase tracking-wider text-zinc-650 mb-3.5 font-mono-ui font-semibold">Application Configuration</h3>
                            <ul className="space-y-2">
                              {structure.app_config_files.map(file => (
                                <li key={file} className="text-xs text-zinc-400 font-mono-ui border-b border-zinc-900 pb-2 last:border-0 last:pb-0 break-all">{file}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'entities' && (
                  <div className="p-5 flex flex-col h-[520px]">
                    {/* Search and Filters Header */}
                    <div className="space-y-4 mb-4 shrink-0">
                      <input
                        type="text"
                        placeholder="Search entities by name or file path..."
                        value={entitySearch}
                        onChange={(e) => setEntitySearch(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-900 rounded-md px-3.5 py-2 text-xs text-zinc-350 placeholder-zinc-650 focus:outline-none focus:border-gold transition-colors font-mono"
                      />

                      <div className="flex flex-wrap gap-1.5 border-b border-zinc-900 pb-3">
                        <button
                          type="button"
                          onClick={() => setEntityTypeFilter('ALL')}
                          className={`px-3 py-1 rounded text-[10px] uppercase tracking-wider font-mono font-medium transition-all cursor-pointer ${
                            entityTypeFilter === 'ALL'
                              ? 'bg-gold/15 text-gold border border-gold/20'
                              : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                          }`}
                        >
                          All ({entities.length})
                        </button>
                        {Array.from(new Set(entities.map(e => e.entity_type))).sort().map(type => {
                          const count = entities.filter(e => e.entity_type === type).length;
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setEntityTypeFilter(type)}
                              className={`px-3 py-1 rounded text-[10px] uppercase tracking-wider font-mono font-medium transition-all cursor-pointer ${
                                entityTypeFilter === type
                                  ? 'bg-gold/15 text-gold border border-gold/20'
                                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                              }`}
                            >
                              {type.replace(/_/g, ' ')} ({count})
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Entities Large List View */}
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {entities.filter(e => {
                        const matchesSearch = e.entity_name.toLowerCase().includes(entitySearch.toLowerCase()) || 
                                              e.file_path.toLowerCase().includes(entitySearch.toLowerCase());
                        const matchesType = entityTypeFilter === 'ALL' || e.entity_type === entityTypeFilter;
                        return matchesSearch && matchesType;
                      }).length === 0 ? (
                        <EmptyState message="I can't find any parsed code entities matching your search criteria." />
                      ) : (
                        entities.filter(e => {
                          const matchesSearch = e.entity_name.toLowerCase().includes(entitySearch.toLowerCase()) || 
                                                e.file_path.toLowerCase().includes(entitySearch.toLowerCase());
                          const matchesType = entityTypeFilter === 'ALL' || e.entity_type === entityTypeFilter;
                          return matchesSearch && matchesType;
                        }).map(item => {
                          let icon = <Code size={13} className="text-blue-500" />;
                          let colorClass = "border-blue-500/10 bg-blue-500/5 text-blue-400";
                          const type = item.entity_type;
                          if (type === 'CLASS') {
                            icon = <Box size={13} className="text-amber-500" />;
                            colorClass = "border-amber-500/10 bg-amber-500/5 text-amber-400";
                          } else if (type === 'MODEL' || type === 'ENTITY') {
                            icon = <Box size={13} className="text-yellow-500" />;
                            colorClass = "border-yellow-500/10 bg-yellow-500/5 text-yellow-400";
                          } else if (type === 'DTO') {
                            icon = <FileText size={13} className="text-orange-400" />;
                            colorClass = "border-orange-500/10 bg-orange-500/5 text-orange-400";
                          } else if (type === 'WIDGET') {
                            icon = <Box size={13} className="text-lime-500" />;
                            colorClass = "border-lime-500/10 bg-lime-500/5 text-lime-400";
                          } else if (type === 'SCREEN') {
                            icon = <FileText size={13} className="text-green-500" />;
                            colorClass = "border-green-500/10 bg-green-500/5 text-green-400";
                          } else if (type === 'CONTROLLER') {
                            icon = <Box size={13} className="text-orange-500" />;
                            colorClass = "border-orange-500/10 bg-orange-500/5 text-orange-400";
                          } else if (type === 'SERVICE') {
                            icon = <FileCog size={13} className="text-teal-500" />;
                            colorClass = "border-teal-500/10 bg-teal-500/5 text-teal-400";
                          } else if (type === 'REPOSITORY') {
                            icon = <FolderTree size={13} className="text-indigo-500" />;
                            colorClass = "border-indigo-500/10 bg-indigo-500/5 text-indigo-400";
                          } else if (type === 'FUNCTION') {
                            icon = <Code size={13} className="text-blue-500" />;
                            colorClass = "border-blue-500/10 bg-blue-500/5 text-blue-400";
                          } else if (type === 'METHOD') {
                            icon = <Play size={13} className="text-emerald-500" />;
                            colorClass = "border-emerald-500/10 bg-emerald-500/5 text-emerald-400";
                          } else if (type === 'HANDLER') {
                            icon = <Play size={13} className="text-violet-500" />;
                            colorClass = "border-violet-500/10 bg-violet-500/5 text-violet-400";
                          } else if (type === 'PROVIDER') {
                            icon = <Play size={13} className="text-purple-400" />;
                            colorClass = "border-purple-500/10 bg-purple-500/5 text-purple-400";
                          } else if (type === 'HOOK') {
                            icon = <Code size={13} className="text-indigo-400" />;
                            colorClass = "border-indigo-500/10 bg-indigo-500/5 text-indigo-400";
                          } else if (type === 'ENDPOINT' || type === 'ROUTE' || type === 'API ROUTE') {
                            icon = <Play size={13} className="text-red-500" />;
                            colorClass = "border-red-500/10 bg-red-500/5 text-red-400";
                          } else if (type === 'IMPORT') {
                            icon = <FileCog size={13} className="text-purple-500" />;
                            colorClass = "border-purple-500/10 bg-purple-500/5 text-purple-450";
                          } else if (type === 'EXPORT') {
                            icon = <FileText size={13} className="text-cyan-500" />;
                            colorClass = "border-cyan-500/10 bg-cyan-500/5 text-cyan-400";
                          } else if (type === 'INTERFACE') {
                            icon = <Braces size={13} className="text-pink-500" />;
                            colorClass = "border-pink-500/10 bg-pink-500/5 text-pink-400";
                          } else if (type === 'DECORATOR') {
                            icon = <Braces size={13} className="text-yellow-650" />;
                            colorClass = "border-yellow-650/10 bg-yellow-650/5 text-yellow-500";
                          } else if (['DOCKER', 'CONTAINER', 'PORT', 'VOLUME', 'NETWORK'].includes(type)) {
                            icon = <Box size={13} className="text-cyan-600" />;
                            colorClass = "border-cyan-600/10 bg-cyan-600/5 text-cyan-500";
                          } else if (['KUBERNETES', 'POD', 'DEPLOYMENT', 'INGRESS'].includes(type)) {
                            icon = <Box size={13} className="text-blue-600" />;
                            colorClass = "border-blue-600/10 bg-blue-600/5 text-blue-500";
                          } else if (['INFRASTRUCTURE', 'PLAYBOOK'].includes(type)) {
                            icon = <FileCog size={13} className="text-stone-500" />;
                            colorClass = "border-stone-500/10 bg-stone-500/5 text-stone-400";
                          }

                          return (
                            <div 
                              key={item.id} 
                              className="px-4 py-3 rounded border border-zinc-900 bg-zinc-950/30 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-zinc-800 hover:bg-zinc-950/60 transition-all select-all font-mono-ui"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="shrink-0">{icon}</span>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-ivory truncate select-all font-mono">{item.entity_name}</p>
                                  <p className="text-[10px] text-zinc-500 truncate mt-0.5 select-all" title={item.file_path}>
                                    {item.file_path}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                                <span className={`px-2 py-0.5 rounded border text-[9.5px] uppercase font-mono tracking-wider ${colorClass}`}>
                                  {item.entity_type.replace(/_/g, ' ')}
                                </span>
                                <span className="font-mono text-gold bg-gold/5 border border-gold/10 px-2 py-0.5 rounded text-[10px]">
                                  Line {item.line_number}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'endpoints' && (
                  <div className="p-5 space-y-4 max-h-[500px] overflow-y-auto">
                    <div className="space-y-2.5">
                      {entities.filter(e => e.entity_type === 'ENDPOINT').length === 0 ? (
                        <EmptyState message="I can't find API endpoints in this repository codebase." />
                      ) : (
                        entities.filter(e => e.entity_type === 'ENDPOINT').map(item => {
                          const parts = item.entity_name.split(' ');
                          const method = parts.length > 1 ? parts[0] : 'ROUTE';
                          const path = parts.length > 1 ? parts.slice(1).join(' ') : item.entity_name;
                          
                          let colorClass = "border-zinc-800 bg-zinc-900/40 text-zinc-400";
                          const mUpper = method.toUpperCase();
                          if (mUpper === 'GET') colorClass = "border-emerald-500/10 bg-emerald-500/5 text-emerald-400";
                          else if (mUpper === 'POST') colorClass = "border-blue-500/10 bg-blue-500/5 text-blue-400";
                          else if (mUpper === 'PUT') colorClass = "border-amber-500/10 bg-amber-500/5 text-amber-400";
                          else if (mUpper === 'DELETE') colorClass = "border-red-500/10 bg-red-500/5 text-red-400";
                          
                          return (
                            <div 
                              key={item.id} 
                              className="px-4 py-3 rounded border border-zinc-900 bg-zinc-950/30 flex items-center justify-between gap-3 hover:border-zinc-850 transition-colors font-mono-ui"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className={`px-2 py-0.5 rounded border text-[10px] font-semibold font-mono tracking-wider ${colorClass}`}>
                                  {method}
                                </span>
                                <span className="text-xs font-semibold text-ivory truncate select-all font-mono">{path}</span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-[10px] text-zinc-550 truncate max-w-[200px]" title={item.file_path}>{item.file_path}</span>
                                <span className="font-mono text-gold bg-gold/5 border border-gold/10 px-1.5 py-0.5 rounded text-[9.5px]">L{item.line_number}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'graph' && graph && (
                  <KnowledgeGraph 
                    nodes={graph.nodes} 
                    edges={graph.edges} 
                    architectureHint={graph.architecture_hint} 
                    repositoryName={repository?.name || 'Unknown Repository'}
                    userEmail={session?.user?.email || 'Unknown User'}
                  />
                )}

                {activeTab === 'architecture' && (
                  <div className="p-6 space-y-8 max-h-[580px] overflow-y-auto pr-2">
                    {architecture ? (
                      <>
                        {/* Summary Grid & Enhanced Metrics */}
                        {(() => {
                          const summary = (architecture.architecture_summary || {}) as any;
                          const confidenceScore = summary.confidence_score;
                          const evidence = (summary.evidence || []) as string[];
                          const secondaryArch = summary.secondary_architecture;
                          const technologyRoles = (summary.technology_roles || {}) as Record<string, string[]>;
                          const architecturalDrift = (summary.architectural_drift || []) as string[];
                          const healthSignals = (summary.health_signals || {}) as any;
                          const couplingScore = healthSignals.coupling_score ?? 0;
                          const circularDeps = (healthSignals.circular_dependencies || []) as string[];
                          const godClasses = (healthSignals.god_classes || []) as any[];
                          const deadModules = (healthSignals.dead_modules || []) as string[];
                          const socScore = healthSignals.separation_of_concerns_score ?? 100;

                          return (
                            <>
                              {/* Architecture Info Cards */}
                              <div>
                                <h3 className="text-[10px] uppercase tracking-wider text-zinc-650 mb-3.5 font-mono-ui font-semibold">Architecture Profile</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                  {/* Wide Pattern & Confidence Card */}
                                  <div className="p-4.5 rounded border border-zinc-900 bg-zinc-950/40 col-span-1 sm:col-span-2 md:col-span-3 space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                      <div>
                                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-mono">Architecture Pattern</span>
                                        <span className="text-base font-bold text-gold mt-1 block">
                                          {architecture.architecture_type}
                                          {secondaryArch && (
                                            <span className="text-xs text-zinc-400 font-normal ml-2">
                                              + {secondaryArch} (Secondary Pattern)
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                      {confidenceScore !== undefined && (
                                        <div className="flex items-center gap-3 bg-zinc-900/60 px-4 py-2 rounded border border-zinc-800 self-start sm:self-auto">
                                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Confidence</span>
                                          <span className={`text-base font-bold font-mono ${
                                            confidenceScore >= 85 ? 'text-emerald-400' :
                                            confidenceScore >= 60 ? 'text-amber-400' : 'text-rose-400'
                                          }`}>
                                            {confidenceScore}%
                                          </span>
                                          {confidenceScore < 85 && (
                                            <span className="text-[9.5px] px-1.5 py-0.5 rounded border border-amber-500/20 bg-amber-500/5 text-amber-300 font-semibold tracking-wider uppercase font-mono">
                                              {confidenceScore < 60 ? 'Unconventional' : 'Moderate Match'}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    
                                    {evidence.length > 0 && (
                                      <div className="pt-3.5 border-t border-zinc-900/80">
                                        <span className="text-[10px] text-zinc-550 uppercase tracking-wider block font-mono mb-2">Evidence-Based Explanation</span>
                                        <ul className="list-disc list-inside space-y-1 text-xs text-zinc-400">
                                          {evidence.map((item, idx) => (
                                            <li key={idx} className="leading-relaxed list-none pl-3 relative before:content-['•'] before:text-gold before:absolute before:left-0">{item}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>

                                  {/* Standard Profile Fields */}
                                  <div className="p-3.5 rounded border border-zinc-900 bg-zinc-950/40">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-mono">Project Blueprint Type</span>
                                    <span className="text-sm font-bold text-ivory mt-1 block">{architecture.project_type}</span>
                                  </div>
                                  <div className="p-3.5 rounded border border-zinc-900 bg-zinc-950/40">
                                    <span className="text-[10px] text-zinc-555 uppercase tracking-wider block font-mono">Deployment Model</span>
                                    <span className="text-sm font-bold text-ivory mt-1 block">{architecture.deployment_model || "Not specified"}</span>
                                  </div>
                                  <div className="p-3.5 rounded border border-zinc-900 bg-zinc-950/40">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-mono">Database Integration</span>
                                    <span className="text-sm font-bold text-ivory mt-1 block">{summary.database_layer || "No database layer details"}</span>
                                  </div>
                                  <div className="p-3.5 rounded border border-zinc-900 bg-zinc-950/40">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-mono">Authentication Provider</span>
                                    <span className="text-sm font-bold text-ivory mt-1 block">{summary.authentication_layer || "No auth layer details"}</span>
                                  </div>
                                  
                                  {/* Technologies Card */}
                                  <div className="p-3.5 rounded border border-zinc-900 bg-zinc-950/40 col-span-1 sm:col-span-2">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-mono">Primary Packages & Frameworks</span>
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                      {summary.primary_technologies?.map((tech: string) => (
                                        <span key={tech} className="px-1.5 py-0.5 rounded bg-zinc-900/60 border border-zinc-800 text-[10px] text-zinc-300 font-mono">{tech}</span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Architectural Drift Warning Section */}
                              {architecturalDrift.length > 0 && (
                                <div className="pt-6 border-t border-zinc-900/60">
                                  <h3 className="text-[10px] uppercase tracking-wider text-zinc-650 mb-3.5 font-mono-ui font-semibold flex items-center gap-2">
                                    <AlertTriangle size={12} className="text-amber-400 animate-pulse" /> Architectural Drift Warning
                                  </h3>
                                  <div className="p-4 rounded-lg border border-amber-500/10 bg-amber-500/5 space-y-2">
                                    {architecturalDrift.map((warning, idx) => (
                                      <div key={idx} className="flex items-start gap-2.5 text-xs text-amber-300">
                                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                        <span>{warning}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Technology Role Mapping Grid */}
                              {Object.keys(technologyRoles).length > 0 && (
                                <div className="pt-6 border-t border-zinc-900/60">
                                  <h3 className="text-[10px] uppercase tracking-wider text-zinc-650 mb-3.5 font-mono-ui font-semibold">Technology Role Mapping</h3>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    {Object.entries(technologyRoles).map(([role, techs]) => {
                                      if (!techs || (techs as string[]).length === 0) return null;
                                      return (
                                        <div key={role} className="p-4 rounded-lg border border-zinc-900 bg-zinc-950/20 space-y-2.5">
                                          <span className="text-[11px] font-bold text-gold font-mono-ui block tracking-wide">{role}</span>
                                          <div className="flex flex-wrap gap-1.5">
                                            {(techs as string[]).map(tech => (
                                              <span key={tech} className="px-2 py-0.5 rounded bg-zinc-900/80 border border-zinc-800 text-[10px] text-zinc-350 font-mono">{tech}</span>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Repository Design Health Signals Section */}
                              <div className="pt-6 border-t border-zinc-900/60">
                                <h3 className="text-[10px] uppercase tracking-wider text-zinc-650 mb-4 font-mono-ui font-semibold flex items-center gap-1.5">
                                  <Activity size={12} className="text-gold" /> Repository Design Health Signals
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                  {/* Health Scores and Cycles */}
                                  <div className="space-y-4">
                                    <div className="p-4 rounded-lg border border-zinc-900 bg-zinc-950/20 flex items-center justify-between">
                                      <div className="space-y-1">
                                        <span className="text-xs font-bold text-ivory">Separation of Concerns Score</span>
                                        <p className="text-[10px] text-zinc-550 leading-normal max-w-[240px]">Measures layering cleanliness. Deductions for bypassing middleware layers.</p>
                                      </div>
                                      <div className={`text-2xl font-bold font-mono ${
                                        socScore >= 80 ? 'text-emerald-400' :
                                        socScore >= 50 ? 'text-amber-400' : 'text-rose-400'
                                      }`}>
                                        {socScore}/100
                                      </div>
                                    </div>

                                    <div className="p-4 rounded-lg border border-zinc-900 bg-zinc-950/20 flex items-center justify-between">
                                      <div className="space-y-1">
                                        <span className="text-xs font-bold text-ivory">Coupling Ratio</span>
                                        <p className="text-[10px] text-zinc-555 leading-normal max-w-[240px]">Density of active calls and usage relationships relative to codebase size.</p>
                                      </div>
                                      <div className="text-2xl font-bold font-mono text-gold">
                                        {couplingScore}%
                                      </div>
                                    </div>

                                    {circularDeps.length > 0 ? (
                                      <div className="p-4 rounded-lg border border-rose-950/30 bg-rose-950/5 space-y-2.5">
                                        <span className="text-xs font-bold text-rose-300 block">Circular Dependencies Identified ({circularDeps.length})</span>
                                        <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                                          {circularDeps.map((cycle: string, idx: number) => (
                                            <div key={idx} className="p-2 rounded border border-rose-950/40 bg-zinc-950/50 text-[10px] text-zinc-400 font-mono leading-normal break-all">
                                              {cycle}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="p-4.5 rounded-lg border border-zinc-900 bg-zinc-950/10 text-xs text-zinc-550 font-mono text-center py-6">
                                        No circular dependencies identified.
                                      </div>
                                    )}
                                  </div>

                                  {/* Code Smells Lists */}
                                  <div className="space-y-4">
                                    <div className="p-4.5 rounded-lg border border-zinc-900 bg-zinc-950/20 space-y-3">
                                      <span className="text-xs font-bold text-ivory block">Large / God Classes ({godClasses.length})</span>
                                      {godClasses.length > 0 ? (
                                        <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1">
                                          {godClasses.map((gc: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center text-[10.5px] p-2 rounded border border-zinc-900 bg-zinc-950/40">
                                              <span className="font-mono text-zinc-300 truncate" title={gc.class_name}>{gc.class_name}</span>
                                              <span className="text-[10px] text-rose-400 bg-rose-500/5 px-2 py-0.5 rounded font-mono border border-rose-500/10 shrink-0">{gc.method_count} methods</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-[10.5px] text-zinc-500 font-mono py-2">No God classes identified (threshold &ge; 8 methods).</div>
                                      )}
                                    </div>

                                    <div className="p-4.5 rounded-lg border border-zinc-900 bg-zinc-950/20 space-y-3">
                                      <span className="text-xs font-bold text-ivory block">Dead Modules / Unused Entities</span>
                                      {deadModules.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto pr-1">
                                          {deadModules.map((name: string, idx: number) => (
                                            <span key={idx} className="px-2 py-0.5 rounded bg-zinc-900/60 border border-zinc-800 text-[10px] text-zinc-400 font-mono">{name}</span>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-[10.5px] text-zinc-550 font-mono py-2">No dead modules found. All entities are linked.</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </>
                          );
                        })()}

                        {/* System Components Timeline */}
                        <div className="pt-6 border-t border-zinc-900/60">
                          <h3 className="text-[10px] uppercase tracking-wider text-zinc-650 mb-4 font-mono-ui font-semibold">Identified System Components</h3>
                          <div className="space-y-4">
                            {architecture.components.map((comp, idx) => (
                              <div key={idx} className="p-4 rounded-lg border border-zinc-900 bg-zinc-950/30 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-sm font-bold text-ivory">{comp.name}</span>
                                    <span className="px-2 py-0.5 rounded border border-gold/15 bg-gold/5 text-gold text-[9.5px] uppercase font-mono tracking-wider font-semibold">{comp.type}</span>
                                  </div>
                                  <p className="text-xs text-zinc-400 leading-relaxed max-w-xl">{comp.description}</p>
                                </div>
                                <div className="flex flex-wrap gap-1.5 items-center shrink-0">
                                  {comp.technologies.map(tech => (
                                    <span key={tech} className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10.5px] text-zinc-350 font-mono-ui font-medium">{tech}</span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Detected Request Flows */}
                        <div className="pt-6 border-t border-zinc-900/60">
                          <div className="flex items-center gap-2 mb-4">
                            <Workflow size={15} className="text-gold" />
                            <h3 className="text-[10px] uppercase tracking-wider text-zinc-650 font-mono-ui font-semibold">Inferred Request & Call Flows</h3>
                          </div>
                          <div className="space-y-6">
                            {architecture.detected_flows.map((flow, fIdx) => (
                              <div key={fIdx} className="p-4.5 rounded-lg border border-zinc-900 bg-zinc-950/20 space-y-3.5">
                                <h4 className="text-xs font-semibold text-gold font-mono-ui">{flow.name}</h4>
                                <div className="flex flex-wrap items-center gap-2">
                                  {flow.steps.map((step, sIdx) => (
                                    <React.Fragment key={sIdx}>
                                      <div className="px-3 py-1.5 rounded border border-zinc-900 bg-zinc-950 text-xs font-mono text-zinc-350 shadow-md">
                                        {step}
                                      </div>
                                      {sIdx < flow.steps.length - 1 && (
                                        <span className="text-gold font-bold px-1 select-none animate-pulse">➔</span>
                                      )}
                                    </React.Fragment>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <EmptyState message="I couldn't analyze the system architecture for this repository." />
                    )}
                  </div>
                )}

                {activeTab === 'callgraph' && (
                  <div className="p-4">
                    {callGraph ? (
                      <CallGraph
                        nodes={callGraph.nodes}
                        edges={callGraph.edges}
                        callChains={callGraph.call_chains}
                        repositoryName={repository?.name || 'Unknown'}
                        initialNodeName={initialCallGraphNode}
                      />
                    ) : (
                      <EmptyState message="No call graph behavior data is currently available. Make sure the repository has been cloned and analyzed." />
                    )}
                  </div>
                )}

                {activeTab === 'flows' && (
                  <div className="p-4">
                    <ExecutionFlows
                      repositoryId={params.id}
                      userEmail={session?.user?.email || ''}
                      onViewCallGraph={(nodeName) => {
                        setInitialCallGraphNode(nodeName);
                        setActiveTab('callgraph');
                      }}
                    />
                  </div>
                )}
              </div>
            </section>

            {/* Repository Intelligence Summary (Right 1 Column) */}
            <div className="space-y-6">
              <section className="rounded-lg border border-zinc-900 bg-zinc-950 p-5">
                <h2 className="text-sm text-ivory flex items-center gap-2 mb-4 font-serif-display font-medium tracking-tight">
                  <Box size={15} className="text-gold" /> Repository Summary
                </h2>
                
                <div className="space-y-3.5 text-xs font-mono-ui">
                  <div className="flex justify-between border-b border-zinc-900/40 pb-2.5">
                    <span className="text-zinc-500">Repository Type</span>
                    <span className="text-ivory font-medium text-right">{structure.project_type || structure.repository_summary?.repository_type || repoType}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900/40 pb-2.5">
                    <span className="text-zinc-500">Primary Language</span>
                    <span className="text-ivory font-medium text-right">{structure.repository_summary?.primary_language || repository.language || "Unknown"}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900/40 pb-2.5">
                    <span className="text-zinc-500">Frameworks</span>
                    <span className="text-gold font-medium text-right truncate max-w-[170px]" title={structure.repository_summary?.frameworks?.join(", ") || repository.framework || "None"}>
                      {structure.repository_summary?.frameworks?.join(", ") || repository.framework || "None"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900/40 pb-2.5">
                    <span className="text-zinc-500">Runtime</span>
                    <span className="text-ivory font-medium text-right">{structure.runtimes?.join(", ") || structure.repository_summary?.runtimes?.join(", ") || "None"}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900/40 pb-2.5">
                    <span className="text-zinc-500">Architecture Hint</span>
                    <span className="text-ivory font-medium text-right text-[11px]" title={structure.repository_summary?.architecture_hint || "Standard Directory Layout"}>
                      {structure.repository_summary?.architecture_hint || "Standard Directory Layout"}
                    </span>
                  </div>
                  {repository.frameworkConfidence !== null && repository.framework !== 'Unknown' && (
                    <div className="flex justify-between border-b border-zinc-900/40 pb-2.5">
                      <span className="text-zinc-500">Confidence</span>
                      <span className="text-ivory font-medium text-right">{(repository.frameworkConfidence * 100).toFixed(0)}%</span>
                    </div>
                  )}
                  <div className="flex justify-between border-b border-zinc-900/40 pb-2.5">
                    <span className="text-zinc-500">Build Tools</span>
                    <span className="text-ivory font-medium text-right">{structure.build_tools?.join(", ") || structure.repository_summary?.build_tools?.join(", ") || buildTool}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900/40 pb-2.5">
                    <span className="text-zinc-500">Entry Points</span>
                    <span className="text-ivory font-medium text-right">{structure.repository_summary?.entry_points?.length ?? structure.entry_points.length}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900/40 pb-2.5">
                    <span className="text-zinc-500">Dependencies</span>
                    <span className="text-ivory font-medium text-right">{structure.repository_summary?.dependencies?.length ?? structure.dependencies?.length ?? 0}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900/40 pb-2.5">
                    <span className="text-zinc-500">Total Files</span>
                    <span className="text-ivory font-medium text-right">{structure.repository_summary?.file_count ?? structure.total_files}</span>
                  </div>
                  <div className="flex justify-between pb-1">
                    <span className="text-zinc-500">Directories</span>
                    <span className="text-ivory font-medium text-right">{structure.repository_summary?.directory_count ?? structure.total_directories}</span>
                  </div>
                </div>
              </section>
            </div>
            
          </div>
        </>
      )}
    </div>
  );
}

function InteractiveStat({ 
  icon, 
  label, 
  value, 
  active, 
  onClick 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: number; 
  active: boolean; 
  onClick: () => void 
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-4 rounded-lg border flex items-center gap-3 w-full text-left transition-all duration-200 cursor-pointer outline-none ${
        active 
          ? 'border-gold bg-gold/5 shadow-[0_0_15px_rgba(212,175,55,0.04)] text-gold' 
          : 'border-zinc-900 bg-zinc-950 text-zinc-500 hover:border-zinc-800 hover:text-zinc-300'
      }`}
    >
      <span className={active ? 'text-gold' : 'text-zinc-500'}>{icon}</span>
      <div>
        <p className="text-[10px] uppercase tracking-wider font-sans font-medium">{label}</p>
        <p className="text-lg text-ivory font-semibold mt-0.5 font-sans-ui">{value}</p>
      </div>
    </button>
  );
}

function EntityGroupCard({ 
  title, 
  count, 
  items, 
  icon 
}: { 
  title: string; 
  count: number; 
  items: CodeEntity[]; 
  icon: React.ReactNode; 
}) {
  return (
    <div className="rounded-lg border border-zinc-900 bg-zinc-950/40 overflow-hidden flex flex-col h-[280px]">
      <div className="px-4 py-3 border-b border-zinc-900 bg-zinc-950/80 flex items-center justify-between">
        <span className="text-xs font-semibold text-ivory flex items-center gap-2">
          {icon} {title}
        </span>
        <span className="px-2 py-0.5 rounded text-[10px] font-mono-ui font-semibold border border-zinc-800 bg-zinc-900 text-zinc-400">
          {count}
        </span>
      </div>
      <div className="p-3 flex-1 overflow-y-auto space-y-2">
        {items.length === 0 ? (
          <p className="text-[11px] text-zinc-650 font-mono-ui py-8 text-center">No parsed {title.toLowerCase()} found.</p>
        ) : (
          items.map(item => (
            <div key={item.id} className="p-2.5 rounded border border-zinc-900 bg-zinc-950/30 flex flex-col hover:border-zinc-850 transition-colors">
              <span className="text-xs font-semibold text-zinc-350 break-all select-all font-mono-ui">{item.entity_name}</span>
              <span className="text-[10px] text-zinc-500 mt-1 flex items-center justify-between gap-2">
                <span className="truncate break-all" title={item.file_path}>{item.file_path}</span>
                <span className="shrink-0 font-mono text-gold bg-gold/5 border border-gold/10 px-1.5 py-0.5 rounded text-[9.5px]">L{item.line_number}</span>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
