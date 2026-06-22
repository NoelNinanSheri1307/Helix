// c:\Users\VICTUS\helix\frontend\src\components\KnowledgeGraph.tsx

import React, { useMemo, useState } from 'react';
import ReactFlow, { 
  MiniMap, 
  Controls, 
  Background, 
  MarkerType,
  Node,
  Edge
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Maximize2, Minimize2, FileDown, X } from 'lucide-react';
import { KnowledgeNode, KnowledgeEdge } from '../types';
import { EmptyState } from './EmptyState';

interface KnowledgeGraphProps {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  architectureHint: string | null;
  repositoryName: string;
  userEmail: string;
}

const COLUMN_MAPPING: Record<string, number> = {
  'DATABASE': 0,
  'REPOSITORY': 1,
  'SERVICE': 2,
  'PROVIDER': 2,
  'HOOK': 2,
  'CLASS': 3,
  'MODEL': 3,
  'ENTITY': 3,
  'DTO': 3,
  'INTERFACE': 3,
  'CONTROLLER': 4,
  'FUNCTION': 4,
  'METHOD': 4,
  'ENDPOINT': 5,
  'ROUTE': 5,
  'WIDGET': 5,
  'SCREEN': 5
};

const NODE_COLORS: Record<string, { border: string; text: string; bg: string }> = {
  'DATABASE': { border: 'border-cyan-500/30', text: 'text-cyan-400', bg: 'bg-cyan-500/5' },
  'REPOSITORY': { border: 'border-indigo-500/30', text: 'text-indigo-400', bg: 'bg-indigo-500/5' },
  'SERVICE': { border: 'border-teal-500/30', text: 'text-teal-400', bg: 'bg-teal-500/5' },
  'PROVIDER': { border: 'border-purple-500/30', text: 'text-purple-400', bg: 'bg-purple-500/5' },
  'CONTROLLER': { border: 'border-orange-500/30', text: 'text-orange-400', bg: 'bg-orange-500/5' },
  'ENDPOINT': { border: 'border-red-500/30', text: 'text-red-400', bg: 'bg-red-500/5' },
  'WIDGET': { border: 'border-green-500/30', text: 'text-green-400', bg: 'bg-green-500/5' },
  'SCREEN': { border: 'border-emerald-500/30', text: 'text-emerald-400', bg: 'bg-emerald-500/5' },
  'MODEL': { border: 'border-yellow-600/30', text: 'text-yellow-500', bg: 'bg-yellow-600/5' },
  'CLASS': { border: 'border-amber-500/30', text: 'text-amber-400', bg: 'bg-amber-500/5' },
  'FUNCTION': { border: 'border-blue-500/30', text: 'text-blue-400', bg: 'bg-blue-500/5' },
  'METHOD': { border: 'border-emerald-500/30', text: 'text-emerald-400', bg: 'bg-emerald-500/5' },
  'INTERFACE': { border: 'border-pink-500/30', text: 'text-pink-400', bg: 'bg-pink-500/5' }
};

export function KnowledgeGraph({ nodes, edges, architectureHint, repositoryName, userEmail }: KnowledgeGraphProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 1. Compute node layout coordinates
  const flowNodes = useMemo<Node[]>(() => {
    // Group nodes by their column index
    const colGroups: Record<number, typeof nodes> = {};
    nodes.forEach(node => {
      const col = COLUMN_MAPPING[node.node_type] ?? 3;
      if (!colGroups[col]) colGroups[col] = [];
      colGroups[col].push(node);
    });

    const output: Node[] = [];

    Object.entries(colGroups).forEach(([colStr, colNodes]) => {
      const col = parseInt(colStr, 10);
      const totalInCol = colNodes.length;
      
      colNodes.forEach((node, idx) => {
        // Vertical centering formula
        const x = col * 260 + 50;
        const y = (idx - (totalInCol - 1) / 2) * 110 + 260;

        const styling = NODE_COLORS[node.node_type] || { border: 'border-zinc-800', text: 'text-zinc-300', bg: 'bg-zinc-900/40' };

        output.push({
          id: String(node.id),
          position: { x, y },
          data: { 
            label: (
              <div className="flex flex-col text-left font-mono leading-tight">
                <span className="text-[9.5px] uppercase tracking-wider text-zinc-550 font-semibold mb-0.5">{node.node_type}</span>
                <span className={`text-[11px] font-bold ${styling.text} truncate max-w-[170px]`}>{node.node_name}</span>
              </div>
            )
          },
          style: {
            background: '#09090b',
            border: '1px solid',
            color: '#fff',
            borderRadius: '6px',
            padding: '8px 12px',
            width: 200,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)'
          },
          className: styling.border
        });
      });
    });

    return output;
  }, [nodes]);

  // 2. Format edges for React Flow
  const flowEdges = useMemo<Edge[]>(() => {
    return edges.map(edge => {
      return {
        id: `e-${edge.id}`,
        source: String(edge.source_node_id),
        target: String(edge.target_node_id),
        label: edge.relationship_type.replace(/_/g, ' '),
        type: 'smoothstep',
        animated: edge.relationship_type === 'CALLS' || edge.relationship_type === 'USES',
        style: { stroke: '#27272a', strokeWidth: 1.5 },
        labelStyle: { fill: '#71717a', fontSize: 8, fontFamily: 'monospace', fontWeight: 650 },
        labelBgStyle: { fill: '#09090b', fillOpacity: 0.9 },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 2,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#27272a',
          width: 14,
          height: 14
        }
      };
    });
  }, [edges]);

  // 3. Native print architecture document generator (PDF Export)
  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Filters all entity nodes that represent routes/endpoints
    const endpointsList = nodes.filter(n => n.node_type === 'ENDPOINT');
    const nonEndpointNodes = nodes.filter(n => n.node_type !== 'ENDPOINT');

    const nodesList = nonEndpointNodes.map(n => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e4e4e7; font-size: 11px;">${n.node_type}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e4e4e7; font-weight: bold; font-size: 12px;">${n.node_name}</td>
      </tr>
    `).join('');

    const edgesList = edges.map(e => {
      const srcNode = nodes.find(n => n.id === e.source_node_id);
      const tgtNode = nodes.find(n => n.id === e.target_node_id);
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e4e4e7; font-size: 12px;">${srcNode ? srcNode.node_name : e.source_node_id}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e4e4e7; font-size: 10px; color: #b78103; font-weight: bold; text-align: center;">${e.relationship_type.replace(/_/g, ' ')}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e4e4e7; font-size: 12px;">${tgtNode ? tgtNode.node_name : e.target_node_id}</td>
        </tr>
      `;
    }).join('');

    const endpointsHtml = endpointsList.length > 0
      ? endpointsList.map(n => {
          const parts = n.node_name.split(' ');
          const method = parts.length > 1 ? parts[0] : 'ROUTE';
          const path = parts.length > 1 ? parts.slice(1).join(' ') : n.node_name;
          
          let color = '#52525b';
          let bg = '#f4f4f5';
          const mUpper = method.toUpperCase();
          if (mUpper === 'GET') { color = '#15803d'; bg = '#f0fdf4'; }
          else if (mUpper === 'POST') { color = '#1d4ed8'; bg = '#eff6ff'; }
          else if (mUpper === 'PUT') { color = '#b78103'; bg = '#fef3c7'; }
          else if (mUpper === 'DELETE') { color = '#b91c1c'; bg = '#fef2f2'; }
          
          return `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e4e4e7; font-family: monospace; width: 100px;">
                <span style="display: inline-block; padding: 2px 6px; background: ${bg}; color: ${color}; border-radius: 4px; font-weight: bold; font-size: 11px;">${method}</span>
              </td>
              <td style="padding: 8px; border-bottom: 1px solid #e4e4e7; font-family: monospace; font-size: 12px; font-weight: bold;">${path}</td>
            </tr>
          `;
        }).join('')
      : `<tr><td colspan="2" style="padding: 12px; color: #71717a; text-align: center; font-style: italic; font-size: 12px;">No API endpoints identified in this repository codebase.</td></tr>`;

    const logoUrl = `${window.location.origin}/assets/Helix%20White.png`;

    printWindow.document.write(`
      <html>
        <head>
          <title>Helix's Knowledge Map of "${repositoryName}"</title>
          <style>
            body, table, th, td, h1, h2, div, span, p { 
              font-family: 'Times New Roman', Times, Georgia, serif !important; 
              color: #18181b; 
              line-height: 1.5; 
            }
            body { margin: 40px; }
            .header-container { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #18181b; padding-bottom: 10px; margin-bottom: 20px; }
            .logo-section { display: flex; align-items: center; gap: 8px; background: #09090b; padding: 4px 12px; border-radius: 4px; }
            .logo-img { height: 26px; width: auto; object-fit: contain; }
            .meta-section { text-align: right; font-size: 11px; color: #52525b; line-height: 1.3; }
            h1 { font-size: 20px; font-weight: bold; margin-top: 10px; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 0.02em; }
            h2 { font-size: 15px; font-weight: bold; margin-top: 32px; border-bottom: 1px solid #e4e4e7; padding-bottom: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th { background: #f4f4f5; text-align: left; padding: 8px; border-bottom: 2px solid #e4e4e7; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #52525b; font-weight: bold; }
            .summary-card { background: #fafafa; border: 1px solid #e4e4e7; padding: 16px; border-radius: 6px; margin: 20px 0; display: flex; gap: 40px; }
            .summary-label { font-size: 10px; text-transform: uppercase; color: #52525b; font-weight: bold; }
            .summary-value { font-size: 15px; font-weight: bold; color: #18181b; margin-top: 2px; }
            .badge { display: inline-block; padding: 2px 6px; background: #fef3c7; border: 1px solid #fde68a; border-radius: 4px; font-size: 11px; color: #b78103; font-weight: bold; }
            @media print {
              body { margin: 20px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div class="logo-section">
              <img src="${logoUrl}" alt="Helix Logo" class="logo-img" />
            </div>
            <div class="meta-section">
              <div>Helix Knowledge Map</div>
              <div style="font-weight: bold; margin-top: 2px;">${userEmail}</div>
            </div>
          </div>

          <h1>Helix's Knowledge Map of "${repositoryName}"</h1>

          <div class="summary-card">
            <div>
              <div class="summary-label">Architecture Pattern</div>
              <div class="summary-value" style="margin-top: 4px;"><span class="badge">${architectureHint || 'Standard Directory Layout'}</span></div>
            </div>
            <div>
              <div class="summary-label">Total Component Nodes</div>
              <div class="summary-value">${nodes.length}</div>
            </div>
            <div>
              <div class="summary-label">Relationships</div>
              <div class="summary-value">${edges.length}</div>
            </div>
          </div>
          
          <h2>Identified API Endpoints</h2>
          <table>
            <thead>
              <tr>
                <th style="width: 20%;">Method</th>
                <th>Route Path</th>
              </tr>
            </thead>
            <tbody>
              ${endpointsHtml}
            </tbody>
          </table>

          <h2>Architectural Inventory (Nodes)</h2>
          <table>
            <thead>
              <tr>
                <th style="width: 30%;">Node Type</th>
                <th>Node Name</th>
              </tr>
            </thead>
            <tbody>
              ${nodesList}
            </tbody>
          </table>

          <h2 style="page-break-before: always;">Relationship Map (Edges)</h2>
          <table>
            <thead>
              <tr>
                <th style="width: 45%;">Source Component</th>
                <th style="text-align: center; width: 10%;">Connection</th>
                <th style="width: 45%;">Target Component</th>
              </tr>
            </thead>
            <tbody>
              ${edgesList}
            </tbody>
          </table>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (nodes.length === 0) {
    return (
      <EmptyState message="I can't find any knowledge graph nodes generated for this repository." />
    );
  }

  return (
    <div 
      className={
        isExpanded 
          ? "fixed inset-0 z-50 bg-zinc-950 p-6 flex flex-col w-screen h-screen overflow-hidden animate-fade-in" 
          : "flex flex-col h-[520px]"
      }
    >
      {/* Header bar */}
      <div className="px-5 py-3 bg-zinc-950 border border-zinc-900 border-b-0 flex justify-between items-center text-xs shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span className="text-zinc-550 font-mono">Inferred Repository Architecture</span>
          <span className="text-gold font-mono font-semibold uppercase tracking-wider bg-gold/5 px-2 py-0.5 rounded border border-gold/15">{architectureHint || 'Standard Directory Layout'}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Export PDF Button */}
          <button
            type="button"
            onClick={handleExportPDF}
            title="Download Blueprint Report as PDF"
            className="p-1.5 rounded border border-zinc-900 bg-zinc-950 text-zinc-550 hover:text-gold hover:border-gold/30 hover:bg-gold/5 transition-all cursor-pointer flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider"
          >
            <FileDown size={14} />
            <span>PDF</span>
          </button>
          
          {/* Maximize / Minimize Button */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Collapse View" : "Expand Fullscreen Map"}
            className="p-1.5 rounded border border-zinc-900 bg-zinc-950 text-zinc-550 hover:text-gold hover:border-gold/30 hover:bg-gold/5 transition-all cursor-pointer flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider"
          >
            {isExpanded ? (
              <>
                <Minimize2 size={14} />
                <span>Collapse</span>
              </>
            ) : (
              <>
                <Maximize2 size={14} />
                <span>Fullscreen</span>
              </>
            )}
          </button>
          
          {/* Direct Close Button in Fullscreen Mode */}
          {isExpanded && (
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              title="Close Fullscreen Map"
              className="p-1.5 rounded border border-zinc-900 bg-zinc-950 text-zinc-550 hover:text-red-400 hover:border-red-400/30 hover:bg-red-500/5 transition-all cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* React Flow Workspace */}
      <div className="flex-1 w-full bg-zinc-950/20 border border-zinc-900 relative" style={{ height: '100%' }}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          fitView
          minZoom={0.1}
          maxZoom={2.0}
        >
          <Controls className="react-flow-controls-custom bg-zinc-950 border border-zinc-900 text-zinc-400 fill-zinc-400" />
          <MiniMap 
            nodeColor={() => '#18181b'}
            maskColor="rgba(9, 9, 11, 0.7)"
            className="react-flow-minimap-custom border border-zinc-900 !bg-zinc-950/90"
          />
          <Background color="#18181b" gap={16} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
}
