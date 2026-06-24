import React, { useState, useMemo } from 'react';
import { 
  Search, ArrowRight, GitBranch, Play, FileText, 
  ChevronDown, ChevronUp, Maximize2, Activity, Code, Zap
} from 'lucide-react';

interface KnowledgeNode {
  id: number;
  node_name: string;
  node_type: string;
  entity_id: number | null;
}

interface KnowledgeEdge {
  id: number;
  source_node_id: number;
  target_node_id: number | null;
  relationship_type: string;
  caller_name?: string | null;
  callee_name?: string | null;
  line_number?: number | null;
  file_path?: string | null;
  confidence_score?: number | null;
}

function srcNameOfNode(n: KnowledgeNode | null | undefined): string {
  return n?.node_name || 'Unknown';
}

function tgtNameOfNode(n: KnowledgeNode | null | undefined): string {
  return n?.node_name || 'External';
}

interface CallGraphProps {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  callChains: string[][];
  repositoryName: string;
  initialNodeName?: string;
}

export function CallGraph({ nodes, edges, callChains, repositoryName, initialNodeName }: CallGraphProps) {
  const [activeSubTab, setActiveSubTab] = useState<'chains' | 'directory' | 'crossfile'>('chains');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeName, setSelectedNodeName] = useState<string | null>(null);
  const [expandedChains, setExpandedChains] = useState<Record<number, boolean>>({});

  React.useEffect(() => {
    if (initialNodeName) {
      setSelectedNodeName(initialNodeName);
      setActiveSubTab('directory');
    }
  }, [initialNodeName]);

  // Clean and prepare nodes/edges
  const nodesMap = useMemo(() => {
    const map = new Map<number, KnowledgeNode>();
    nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [nodes]);

  const nodesByName = useMemo(() => {
    const map = new Map<string, KnowledgeNode>();
    nodes.forEach(n => map.set(n.node_name, n));
    return map;
  }, [nodes]);

  // Outgoing and Incoming calls list for all nodes
  const callConnections = useMemo(() => {
    const outgoing: Record<string, KnowledgeEdge[]> = Object.create(null);
    const incoming: Record<string, KnowledgeEdge[]> = Object.create(null);

    edges.forEach(edge => {
      const srcNode = nodesMap.get(edge.source_node_id);
      const tgtNode = edge.target_node_id ? nodesMap.get(edge.target_node_id) : null;
      
      const srcName = srcNode?.node_name || edge.caller_name || `Unknown-${edge.source_node_id}`;
      const tgtName = tgtNode?.node_name || edge.callee_name || 'External Call';

      if (!outgoing[srcName]) outgoing[srcName] = [];
      outgoing[srcName].push(edge);

      if (!incoming[tgtName]) incoming[tgtName] = [];
      incoming[tgtName].push(edge);
    });

    return { outgoing, incoming };
  }, [edges, nodesMap]);

  // Cross-file call edges
  const crossFileEdges = useMemo(() => {
    return edges.filter(edge => {
      const srcNode = nodesMap.get(edge.source_node_id);
      const tgtNode = edge.target_node_id ? nodesMap.get(edge.target_node_id) : null;
      
      // If we don't have file details, it is likely cross-file or external
      if (!edge.file_path) return false;
      
      // Look up target node's file path if it exists
      // If target node is in database, let's find its CodeEntity file path.
      // Wait, we don't have entities in props, but we can look at node's name/type.
      // Let's assume if it is external (tgtNode is null), it is a cross-file/cross-module integration.
      if (!tgtNode) return true;
      
      // Simple heuristic: if caller class prefix or name differs, let's look at caller vs callee name
      const callerClass = srcNameOfNode(srcNode).split('.')[0];
      const calleeClass = tgtNameOfNode(tgtNode).split('.')[0];
      
      return callerClass !== calleeClass;
    });
  }, [edges, nodesMap]);

  const confidenceBadge = (score: number | undefined | null) => {
    const s = score !== undefined && score !== null ? score * 100 : 100;
    let color = 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400';
    let label = 'High';
    if (s < 70) {
      color = 'border-amber-500/20 bg-amber-500/5 text-amber-400';
      label = 'Medium';
    } else if (s < 55) {
      color = 'border-orange-550/20 bg-orange-555/5 text-orange-400';
      label = 'Low';
    }
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono border ${color}`}>
        {label} ({s.toFixed(0)}%)
      </span>
    );
  };

  // Toggle chain expansion
  const toggleChain = (index: number) => {
    setExpandedChains(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Filtered chains based on search
  const filteredChains = useMemo(() => {
    if (!searchQuery) return callChains;
    const query = searchQuery.toLowerCase();
    return callChains.filter(chain => 
      chain.some(node => node.toLowerCase().includes(query))
    );
  }, [callChains, searchQuery]);

  // Filtered nodes directory based on search
  const filteredNodes = useMemo(() => {
    // Only search nodes that participate in call edges
    const activeNodeNames = new Set([
      ...edges.map(e => nodesMap.get(e.source_node_id)?.node_name).filter(Boolean),
      ...edges.map(e => e.target_node_id ? nodesMap.get(e.target_node_id)?.node_name : null).filter(Boolean)
    ]) as Set<string>;

    const list = nodes.filter(n => activeNodeNames.has(n.node_name));
    if (!searchQuery) return list;
    const query = searchQuery.toLowerCase();
    return list.filter(n => n.node_name.toLowerCase().includes(query));
  }, [nodes, edges, nodesMap, searchQuery]);

  return (
    <div className="flex flex-col h-[600px] border border-zinc-900 bg-zinc-950 rounded-lg overflow-hidden font-mono-ui text-zinc-300">
      
      {/* Tab bar header */}
      <div className="px-5 py-3 border-b border-zinc-900 bg-zinc-950 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex gap-2 bg-zinc-950 p-0.5 rounded border border-zinc-900 self-start">
          <button
            type="button"
            onClick={() => { setActiveSubTab('chains'); setSelectedNodeName(null); }}
            className={`px-3 py-1 text-[10.5px] uppercase tracking-wider font-semibold rounded transition-colors cursor-pointer ${
              activeSubTab === 'chains' ? 'bg-gold/15 text-gold font-medium' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Call Chains ({callChains.length})
          </button>
          <button
            type="button"
            onClick={() => { setActiveSubTab('directory'); }}
            className={`px-3 py-1 text-[10.5px] uppercase tracking-wider font-semibold rounded transition-colors cursor-pointer ${
              activeSubTab === 'directory' ? 'bg-gold/15 text-gold font-medium' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Behavior Directory
          </button>
          <button
            type="button"
            onClick={() => { setActiveSubTab('crossfile'); setSelectedNodeName(null); }}
            className={`px-3 py-1 text-[10.5px] uppercase tracking-wider font-semibold rounded transition-colors cursor-pointer ${
              activeSubTab === 'crossfile' ? 'bg-gold/15 text-gold font-medium' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Cross-File Invocations ({crossFileEdges.length})
          </button>
        </div>

        {activeSubTab !== 'crossfile' && (
          <div className="relative flex-1 max-w-[260px] sm:self-end">
            <Search size={13} className="absolute left-3 top-2.5 text-zinc-650" />
            <input
              type="text"
              placeholder={activeSubTab === 'chains' ? 'Search chains...' : 'Search function/methods...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-900 rounded pl-8 pr-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-gold transition-colors font-mono"
            />
          </div>
        )}
      </div>

      {/* Main panel body */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Side: List of Chains or Nodes Directory */}
        <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${selectedNodeName ? 'hidden md:block md:w-1/2 md:border-r md:border-zinc-900' : 'w-full'}`}>
          
          {activeSubTab === 'chains' && (
            <>
              {filteredChains.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-600">No invocation paths match the filter query.</div>
              ) : (
                filteredChains.map((chain, index) => {
                  const isExpanded = expandedChains[index];
                  return (
                    <div key={index} className="p-3.5 rounded border border-zinc-900 bg-zinc-950/40 hover:border-zinc-800 transition-all flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] text-zinc-550 font-mono font-medium uppercase tracking-wider flex items-center gap-1.5">
                          <Zap size={10} className="text-gold" /> Execution Chain #{index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleChain(index)}
                          className="text-[10px] text-zinc-500 hover:text-gold flex items-center gap-1 cursor-pointer font-sans-ui"
                        >
                          {isExpanded ? (
                            <>Collapse <ChevronUp size={12} /></>
                          ) : (
                            <>Expand Chain <ChevronDown size={12} /></>
                          )}
                        </button>
                      </div>

                      {/* Path Sequence Row */}
                      <div className="flex flex-wrap items-center gap-2">
                        {chain.map((nodeName, nIdx) => (
                          <React.Fragment key={nIdx}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedNodeName(nodeName);
                                setActiveSubTab('directory');
                              }}
                              className="px-2 py-1.5 rounded border border-zinc-900 bg-zinc-950 text-xs font-mono text-zinc-350 hover:border-gold hover:text-gold transition-colors text-left"
                            >
                              {nodeName.includes('.') ? (
                                <span>
                                  <span className="text-zinc-600 font-normal">{nodeName.split('.')[0]}.</span>
                                  <span className="font-semibold">{nodeName.split('.')[1]}()</span>
                                </span>
                              ) : (
                                <span className="font-semibold">{nodeName}()</span>
                              )}
                            </button>
                            {nIdx < chain.length - 1 && (
                              <ArrowRight size={11} className="text-zinc-700 shrink-0" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>

                      {/* Expanded Hops list */}
                      {isExpanded && (
                        <div className="mt-2 pt-3 border-t border-zinc-900/60 space-y-2">
                          <span className="text-[9px] uppercase tracking-wider text-zinc-600 block mb-1">Detailed Hops</span>
                          {chain.slice(0, -1).map((nodeName, nIdx) => {
                            const calleeName = chain[nIdx + 1];
                            const source = nodesByName.get(nodeName);
                            const target = nodesByName.get(calleeName);
                            
                            // Find corresponding edge
                            const edge = edges.find(e => 
                              e.source_node_id === source?.id && 
                              (e.target_node_id === (target?.id || null) || e.callee_name === calleeName)
                            );

                            return (
                              <div key={nIdx} className="p-2 rounded border border-zinc-950 bg-zinc-950/20 text-xs font-mono-ui flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                                <div className="space-y-1">
                                  <p className="text-[11px] text-zinc-400">
                                    <span className="text-gold font-bold">{nodeName}</span> calls <span className="text-emerald-400 font-semibold">{calleeName}</span>
                                  </p>
                                  {edge?.file_path && (
                                    <p className="text-[9.5px] text-zinc-550 select-all truncate max-w-[320px]" title={edge.file_path}>
                                      File: {edge.file_path}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                  {edge && confidenceBadge(edge.confidence_score)}
                                  {edge?.line_number && (
                                    <span className="text-[10px] text-gold bg-gold/5 border border-gold/10 px-1.5 py-0.5 rounded font-mono">
                                      L{edge.line_number}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {activeSubTab === 'directory' && (
            <div className="space-y-2.5">
              <span className="text-[10px] text-zinc-500 font-mono font-medium uppercase tracking-wider block mb-1">Participating Behaviors Directory</span>
              {filteredNodes.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-650">No behaviors match the filter query.</div>
              ) : (
                filteredNodes.map((n) => {
                  const outCalls = callConnections.outgoing[n.node_name] || [];
                  const inCalls = callConnections.incoming[n.node_name] || [];
                  
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => setSelectedNodeName(n.node_name)}
                      className={`w-full text-left p-3 rounded border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        selectedNodeName === n.node_name
                          ? 'border-gold bg-gold/5 text-gold'
                          : 'border-zinc-900 bg-zinc-950/40 hover:border-zinc-800'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-bold font-mono text-ivory block truncate">{n.node_name}()</span>
                        <span className="text-[9.5px] text-zinc-500 uppercase font-mono mt-1 block">{n.node_type}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded border border-zinc-850 bg-zinc-900/60 text-zinc-400">
                          {inCalls.length} In
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded border border-zinc-850 bg-zinc-900/60 text-zinc-400">
                          {outCalls.length} Out
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {activeSubTab === 'crossfile' && (
            <div className="space-y-2.5">
              <span className="text-[10px] text-zinc-550 font-mono font-medium uppercase tracking-wider block mb-1">Cross-File Boundary Invocations</span>
              {crossFileEdges.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-650">No cross-file boundaries detected yet.</div>
              ) : (
                crossFileEdges.map((edge) => {
                  const srcNode = nodesMap.get(edge.source_node_id);
                  const tgtNode = edge.target_node_id ? nodesMap.get(edge.target_node_id) : null;
                  
                  const srcName = srcNode?.node_name || edge.caller_name || `Unknown-${edge.source_node_id}`;
                  const tgtName = tgtNode?.node_name || edge.callee_name || 'External Call';

                  return (
                    <div key={edge.id} className="p-3.5 rounded border border-zinc-900 bg-zinc-950/40 hover:border-zinc-850 flex flex-col gap-2 font-mono-ui">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[9.5px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-amber-500/5 text-amber-400 border border-amber-500/10">
                          Boundary Cross
                        </span>
                        {confidenceBadge(edge.confidence_score)}
                      </div>
                      
                      <p className="text-xs text-zinc-300 font-mono">
                        <span className="text-gold font-semibold">{srcName}</span> calls <span className="text-cyan-400 font-semibold">{tgtName}</span>
                      </p>
                      
                      {edge.file_path && (
                        <div className="mt-1 pt-2 border-t border-zinc-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[9.5px] text-zinc-550">
                          <span className="truncate max-w-[280px]" title={edge.file_path}>File: {edge.file_path}</span>
                          <span className="font-mono text-gold bg-gold/5 border border-gold/10 px-1.5 py-0.5 rounded shrink-0">Line {edge.line_number}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

        </div>

        {/* Right Side: Detailed Node Inspector (Callers, Callees, Chains Tracing) */}
        <div className={`flex-1 md:w-1/2 overflow-y-auto p-5 bg-zinc-950/20 ${selectedNodeName ? 'block' : 'hidden md:flex md:flex-col md:items-center md:justify-center md:text-center p-12'}`}>
          {selectedNodeName ? (
            <div className="space-y-6">
              
              {/* Target info card */}
              <div className="p-4 rounded-lg border border-zinc-900 bg-zinc-950 relative overflow-hidden flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Behavior Inspector</span>
                  <button 
                    type="button"
                    onClick={() => setSelectedNodeName(null)}
                    className="text-[10px] text-zinc-500 hover:text-gold cursor-pointer md:hidden font-sans-ui"
                  >
                    Back to List
                  </button>
                </div>
                <h3 className="text-base font-bold text-gold font-mono">{selectedNodeName}()</h3>
                
                {(() => {
                  const nodeObj = nodesByName.get(selectedNodeName);
                  if (nodeObj) {
                    return (
                      <p className="text-[9.5px] text-zinc-500 uppercase font-mono">
                        Node ID: #{nodeObj.id} · Type: {nodeObj.node_type}
                      </p>
                    );
                  }
                  return (
                    <p className="text-[9.5px] text-zinc-500 uppercase font-mono">
                      External SDK or Library API
                    </p>
                  );
                })()}
              </div>

              {/* Incoming Callers */}
              <div className="space-y-3">
                <span className="text-[10px] text-zinc-500 font-mono font-medium uppercase tracking-wider block">Incoming Callers (Who Invokes This)</span>
                {(() => {
                  const list = callConnections.incoming[selectedNodeName] || [];
                  if (list.length === 0) {
                    return <div className="p-3 text-xs text-zinc-600 italic border border-zinc-900 rounded bg-zinc-950/20">No callers found in this repository.</div>;
                  }
                  return (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                      {list.map(edge => {
                        const callerNode = nodesMap.get(edge.source_node_id);
                        const callerName = callerNode?.node_name || edge.caller_name || 'Unknown';
                        return (
                          <div key={edge.id} className="p-3 rounded border border-zinc-900 bg-zinc-950/40 hover:border-zinc-800 transition-colors flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => setSelectedNodeName(callerName)}
                                className="text-xs text-cyan-400 hover:underline text-left block font-mono font-semibold truncate"
                              >
                                {callerName}()
                              </button>
                              {edge.file_path && (
                                <span className="text-[9px] text-zinc-550 truncate block mt-0.5" title={edge.file_path}>
                                  {edge.file_path}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {confidenceBadge(edge.confidence_score)}
                              {edge.line_number && (
                                <span className="text-[9px] text-gold bg-gold/5 border border-gold/10 px-1 rounded font-mono">L{edge.line_number}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Outgoing Callees */}
              <div className="space-y-3">
                <span className="text-[10px] text-zinc-500 font-mono font-medium uppercase tracking-wider block">Outgoing Callees (What This Executes)</span>
                {(() => {
                  const list = callConnections.outgoing[selectedNodeName] || [];
                  if (list.length === 0) {
                    return <div className="p-3 text-xs text-zinc-600 italic border border-zinc-900 rounded bg-zinc-950/20">Does not make any outgoing calls.</div>;
                  }
                  return (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                      {list.map(edge => {
                        const calleeNode = edge.target_node_id ? nodesMap.get(edge.target_node_id) : null;
                        const calleeName = calleeNode?.node_name || edge.callee_name || 'External';
                        return (
                          <div key={edge.id} className="p-3 rounded border border-zinc-900 bg-zinc-950/40 hover:border-zinc-800 transition-colors flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => setSelectedNodeName(calleeName)}
                                className="text-xs text-cyan-400 hover:underline text-left block font-mono font-semibold truncate"
                              >
                                {calleeName}()
                              </button>
                              {edge.file_path && (
                                <span className="text-[9px] text-zinc-550 truncate block mt-0.5" title={edge.file_path}>
                                  {edge.file_path}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {confidenceBadge(edge.confidence_score)}
                              {edge.line_number && (
                                <span className="text-[9px] text-gold bg-gold/5 border border-gold/10 px-1 rounded font-mono">L{edge.line_number}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Traced Call Chains */}
              <div className="space-y-3">
                <span className="text-[10px] text-zinc-500 font-mono font-medium uppercase tracking-wider block">Containing Call Chains</span>
                {(() => {
                  const containing = callChains.filter(chain => chain.includes(selectedNodeName));
                  if (containing.length === 0) {
                    return <div className="p-3 text-xs text-zinc-650 italic">No execution chain paths trace through this node.</div>;
                  }
                  return (
                    <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                      {containing.map((chain, index) => (
                        <div key={index} className="p-2.5 rounded border border-zinc-900 bg-zinc-950/30 text-[10.5px] leading-relaxed font-mono">
                          <span className="text-[9.5px] text-zinc-600 block mb-1">Path Trace #{index + 1}</span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {chain.map((name, idx) => (
                              <React.Fragment key={idx}>
                                <span className={name === selectedNodeName ? 'text-gold font-bold underline' : 'text-zinc-400'}>
                                  {name}
                                </span>
                                {idx < chain.length - 1 && <span className="text-zinc-700">➔</span>}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

            </div>
          ) : (
            <div className="space-y-3">
              <Activity size={24} className="mx-auto text-zinc-800 animate-pulse" />
              <p className="text-xs text-zinc-550 font-sans-ui">Select a behavior from the list to inspect callers, callees, and trace its path inside the call graph.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
