import React, { useState, useEffect } from 'react';
import { 
  Search, Play, Database, Cpu, ChevronDown, ChevronUp, 
  Workflow, ArrowRight, Zap, ExternalLink, Activity
} from 'lucide-react';
import { getRepositoryFlows, searchRepositoryFlows, ExecutionFlow, FlowStep } from '../lib/api';

function toTitleCase(str: string): string {
  return str.replace(/_/g, ' ').split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

interface ExecutionFlowsProps {
  repositoryId: string;
  userEmail: string;
  onViewCallGraph: (nodeName: string) => void;
}

export function ExecutionFlows({ repositoryId, userEmail, onViewCallGraph }: ExecutionFlowsProps) {
  const [flows, setFlows] = useState<ExecutionFlow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFlowId, setSelectedFlowId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});

  // Fetch flows on load or query change
  useEffect(() => {
    const fetchFlows = async () => {
      setLoading(true);
      try {
        if (searchQuery.trim()) {
          const res = await searchRepositoryFlows(repositoryId, userEmail, searchQuery);
          setFlows(res);
        } else {
          const res = await getRepositoryFlows(repositoryId, userEmail);
          setFlows(res);
        }
      } catch (err) {
        console.error("Failed to load execution flows", err);
      } finally {
        setLoading(false);
      }
    };
    
    const delayDebounce = setTimeout(() => {
      fetchFlows();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [repositoryId, userEmail, searchQuery]);

  // Set default selected flow
  useEffect(() => {
    if (flows.length > 0 && selectedFlowId === null) {
      setSelectedFlowId(flows[0].id);
    }
  }, [flows, selectedFlowId]);

  const selectedFlow = flows.find(f => f.id === selectedFlowId);

  const toggleStep = (stepId: number) => {
    setExpandedSteps(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }));
  };

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
    <div className="flex flex-col h-[600px] border border-zinc-900 bg-zinc-950 rounded-lg overflow-hidden font-mono-ui text-zinc-300">
      
      {/* Top search & title bar */}
      <div className="px-5 py-3 border-b border-zinc-900 bg-zinc-950 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
        <div>
          <span className="text-[10px] text-zinc-550 uppercase tracking-widest font-mono block">Behavior Flow Discovery</span>
          <span className="text-xs font-semibold text-ivory mt-0.5 block">Repository Execution Paths</span>
        </div>
        <div className="relative flex-1 max-w-[260px]">
          <Search size={13} className="absolute left-3 top-2.5 text-zinc-650" />
          <input
            type="text"
            placeholder="Search flows by name or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-900 rounded pl-8 pr-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-gold transition-colors font-mono"
          />
        </div>
      </div>

      {/* Main panel layout split */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left list panel */}
        <div className={`w-full md:w-2/5 overflow-y-auto p-4 space-y-2 border-r border-zinc-900 bg-zinc-950/20 ${selectedFlowId ? 'hidden md:block' : 'block'}`}>
          <span className="text-[9.5px] uppercase tracking-wider text-zinc-600 font-mono block mb-2">Discovered execution flows</span>
          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-600 animate-pulse font-mono">Running execution analysis...</div>
          ) : flows.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-650">No execution flows found in repository metadata.</div>
          ) : (
            flows.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFlowId(f.id)}
                className={`w-full text-left p-3.5 rounded border transition-all cursor-pointer flex flex-col gap-2 ${
                  selectedFlowId === f.id
                    ? 'border-gold bg-gold/5 text-gold'
                    : 'border-zinc-900 bg-zinc-950/40 hover:border-zinc-850'
                }`}
              >
                <div className="flex items-center justify-between gap-2.5 w-full">
                  <span className={`px-2 py-0.5 rounded border text-[9px] uppercase font-mono tracking-wider font-semibold ${getFlowTypeColor(f.flow_type)}`}>
                    {f.flow_type.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] text-zinc-550 font-mono">
                    {f.steps.length} Steps
                  </span>
                </div>
                
                <span className="text-xs font-semibold text-ivory block truncate font-sans-ui mt-0.5">{f.flow_name}</span>
                <span className="text-[9.5px] text-zinc-550 truncate block select-all font-mono">Entry: {f.entry_point || 'None'}</span>
              </button>
            ))
          )}
        </div>

        {/* Right details panel */}
        <div className={`flex-1 overflow-y-auto p-5 space-y-6 ${selectedFlowId ? 'block' : 'hidden md:flex md:flex-col md:items-center md:justify-center md:text-center p-12'}`}>
          {selectedFlow ? (
            <div className="space-y-6">
              
              {/* Back to list on mobile */}
              <div className="flex md:hidden items-center justify-between border-b border-zinc-900 pb-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedFlowId(null)}
                  className="text-xs text-gold flex items-center gap-1 cursor-pointer font-sans-ui"
                >
                  ➔ Back to Flows List
                </button>
              </div>

              {/* Flow Header Card */}
              <div className="p-4.5 rounded-lg border border-zinc-900 bg-zinc-950 relative overflow-hidden flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Flow execution properties</span>
                  {confidenceBadge(selectedFlow.confidence_score)}
                </div>
                <h3 className="text-sm font-bold text-gold font-sans-ui tracking-tight">{selectedFlow.flow_name}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-3 border-t border-zinc-900/60 text-[10.5px]">
                  <div>
                    <span className="text-zinc-500 block">Entry Point Node</span>
                    <span className="text-zinc-350 block font-mono font-semibold truncate mt-0.5" title={selectedFlow.entry_point || 'None'}>
                      {selectedFlow.entry_point || 'None'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Flow Classification</span>
                    <span className="text-zinc-350 block font-semibold mt-0.5">
                      {toTitleCase(selectedFlow.flow_type)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Step-by-Step Execution Diagram */}
              <div className="space-y-3.5">
                <span className="text-[10px] text-zinc-500 font-mono font-medium uppercase tracking-wider block">Sequence Flow Diagram</span>
                
                {/* Horizontal diagram path */}
                <div className="p-4 rounded-lg border border-zinc-900 bg-zinc-950/20 flex flex-wrap items-center gap-2 overflow-x-auto pr-2 pb-3.5 select-none">
                  {selectedFlow.steps.map((step, idx) => (
                    <React.Fragment key={step.id}>
                      <button
                        type="button"
                        onClick={() => toggleStep(step.id)}
                        className={`px-3 py-2 rounded border text-xs font-mono text-center shrink-0 transition-colors cursor-pointer ${
                          expandedSteps[step.id]
                            ? 'border-gold bg-gold/5 text-gold font-bold shadow-[0_0_10px_rgba(212,175,55,0.05)]'
                            : 'border-zinc-900 bg-zinc-950 text-zinc-350 hover:border-zinc-800'
                        }`}
                      >
                        <span className="text-[9px] text-zinc-550 block font-normal uppercase mb-0.5">Step {step.step_number}</span>
                        {step.step_name}()
                      </button>
                      {idx < selectedFlow.steps.length - 1 && (
                        <ArrowRight size={12} className="text-zinc-700 shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {/* Vertical expanded detail list */}
                <div className="space-y-2.5 mt-4">
                  <span className="text-[9.5px] uppercase tracking-wider text-zinc-600 block mb-1">Execution Steps Detail</span>
                  {selectedFlow.steps.map((step) => {
                    const isExpanded = expandedSteps[step.id] ?? false;
                    return (
                      <div key={step.id} className="rounded border border-zinc-900 bg-zinc-950/45 overflow-hidden transition-all duration-200">
                        <button
                          type="button"
                          onClick={() => toggleStep(step.id)}
                          className="w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer hover:bg-zinc-950/20"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-850 flex items-center justify-center text-[10px] text-zinc-400 font-mono shrink-0">
                              {step.step_number}
                            </span>
                            <span className="text-xs font-bold font-mono text-ivory truncate">{step.step_name}()</span>
                          </div>
                          <span className="text-[10px] text-zinc-550 font-mono-ui flex items-center gap-1.5 select-none">
                            {step.node_type && (
                              <span className="px-1.5 py-0.5 rounded border border-zinc-900 bg-zinc-950 text-[9px] uppercase tracking-wider shrink-0">
                                {step.node_type}
                              </span>
                            )}
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4.5 pt-1.5 border-t border-zinc-950/30 text-xs font-mono-ui space-y-3 bg-zinc-950/10">
                            {step.description && (
                              <p className="text-zinc-400 leading-relaxed font-sans-ui text-[11.5px]">{step.description}.</p>
                            )}
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px]">
                              {step.file_path && (
                                <div className="space-y-0.5">
                                  <span className="text-zinc-600 uppercase font-mono text-[9px] block">Location Source</span>
                                  <span className="text-zinc-400 block font-mono select-all truncate max-w-[280px]" title={step.file_path}>
                                    {step.file_path}
                                  </span>
                                </div>
                              )}
                              {step.line_number && (
                                <div className="space-y-0.5">
                                  <span className="text-zinc-600 uppercase font-mono text-[9px] block">Source Code Line</span>
                                  <span className="text-gold font-mono block">Line {step.line_number}</span>
                                </div>
                              )}
                            </div>

                            <div className="pt-2 flex flex-wrap gap-2.5">
                              {step.file_path && (
                                <a 
                                  href={`file:///${step.file_path}#L${step.line_number}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 hover:border-gold hover:text-gold transition-colors font-sans-ui"
                                >
                                  Jump To Entity <ExternalLink size={10} />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => onViewCallGraph(step.step_name)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 hover:border-gold hover:text-gold transition-colors font-sans-ui cursor-pointer"
                              >
                                View Related Call Graph <Activity size={10} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Interactions Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Database Access */}
                <div className="p-4 rounded-lg border border-zinc-900 bg-zinc-950/20 space-y-3.5">
                  <span className="text-[10px] text-zinc-500 font-mono font-medium uppercase tracking-wider block">Database Access</span>
                  {selectedFlow.database_interactions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedFlow.database_interactions.map((dbName, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-zinc-900 bg-zinc-950 text-xs font-mono text-cyan-400 font-medium">
                          <Database size={11} className="text-cyan-500" /> {dbName}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10.5px] text-zinc-600 italic">No direct database queries identified in this path.</p>
                  )}
                </div>

                {/* External Services */}
                <div className="p-4 rounded-lg border border-zinc-900 bg-zinc-950/20 space-y-3.5">
                  <span className="text-[10px] text-zinc-500 font-mono font-medium uppercase tracking-wider block">External Services</span>
                  {selectedFlow.external_services.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedFlow.external_services.map((svcName, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-zinc-900 bg-zinc-950 text-xs font-mono text-purple-400 font-medium">
                          <Cpu size={11} className="text-purple-500" /> {svcName}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10.5px] text-zinc-600 italic">No external APIs or services linked in this path.</p>
                  )}
                </div>

                {/* Components Involved (Col Span 2) */}
                <div className="p-4 rounded-lg border border-zinc-900 bg-zinc-950/20 space-y-3.5 sm:col-span-2">
                  <span className="text-[10px] text-zinc-500 font-mono font-medium uppercase tracking-wider block">Components Involved</span>
                  {selectedFlow.components_used.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedFlow.components_used.map((compName, idx) => (
                        <span key={idx} className="px-2.5 py-1 rounded border border-zinc-900 bg-zinc-950 text-xs font-mono text-zinc-400">
                          {compName}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10.5px] text-zinc-650 italic">No classes or components are specifically isolated in this path.</p>
                  )}
                </div>

              </div>

            </div>
          ) : (
            <div className="space-y-3">
              <Workflow size={24} className="mx-auto text-zinc-800 animate-pulse" />
              <p className="text-xs text-zinc-550 font-sans-ui">Select an execution flow from the list to view its detailed execution steps and interactive diagram.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}


