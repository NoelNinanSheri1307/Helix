"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { 
  GraduationCap, Copy, Download, FileText, RefreshCw, 
  ChevronDown, ChevronUp, Check, Play, HelpCircle, 
  Compass, ShieldAlert, Database, Cpu, Workflow, GitBranch, ArrowLeft
} from 'lucide-react';
import { 
  getRepositories, getRepositoryOnboarding, regenerateRepositoryOnboarding,
  OnboardingDocument, OnboardingSection,
  getRepositoryArchitecture, getRepositoryFlows, getRepositoryGraph,
  getRepositoryStructure, ExecutionFlow, CallGraphData, getRepositoryCallGraph
} from '../../lib/api';
import { Repository, RepositoryArchitecture, RepositoryGraph, RepositoryStructure } from '../../types';

export default function OnboardingPage() {
  const { data: session } = useSession();
  const user = session?.user;
  
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [regenerating, setRegenerating] = useState<boolean>(false);
  const [onboardingDocs, setOnboardingDocs] = useState<Record<string, OnboardingDocument> | null>(null);
  const [activeLevel, setActiveLevel] = useState<'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4'>('LEVEL_1');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [copiedSectionIndex, setCopiedSectionIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);

  // Supplementary data for rich PDF export
  const [architecture, setArchitecture] = useState<RepositoryArchitecture | null>(null);
  const [flows, setFlows] = useState<ExecutionFlow[]>([]);
  const [graph, setGraph] = useState<RepositoryGraph | null>(null);
  const [structure, setStructure] = useState<RepositoryStructure | null>(null);
  const [callGraph, setCallGraph] = useState<CallGraphData | null>(null);

  // Load repositories on mount
  useEffect(() => {
    if (user?.email) {
      getRepositories(user.email)
        .then(list => {
          // Only show cloned repositories as onboarding requires intelligence scanning
          const cloned = list.filter(r => r.status === 'CLONED');
          setRepositories(cloned);
          if (cloned.length > 0) {
            setSelectedRepoId(cloned[0].id);
          }
        })
        .catch(err => console.error("Error loading repositories", err));
    }
  }, [user?.email]);

  // Load onboarding documents + supplementary data when selected repository changes
  useEffect(() => {
    if (selectedRepoId && user?.email) {
      setLoading(true);

      // Load onboarding docs
      getRepositoryOnboarding(selectedRepoId, user.email)
        .then(docs => {
          setOnboardingDocs(docs);
          // Set all sections to expanded by default
          if (docs && docs[activeLevel]) {
            const initialExpanded: Record<string, boolean> = {};
            docs[activeLevel].generated_content.sections.forEach((_, idx) => {
              initialExpanded[`${activeLevel}-${idx}`] = true;
            });
            setExpandedSections(initialExpanded);
          }
        })
        .catch(err => console.error("Error loading onboarding documents", err))
        .finally(() => setLoading(false));

      // Load supplementary data for PDF enrichment (fire-and-forget, non-blocking)
      getRepositoryArchitecture(selectedRepoId, user.email)
        .then(data => setArchitecture(data))
        .catch(() => setArchitecture(null));

      getRepositoryFlows(selectedRepoId, user.email)
        .then(data => setFlows(data))
        .catch(() => setFlows([]));

      getRepositoryGraph(selectedRepoId, user.email)
        .then(data => setGraph(data))
        .catch(() => setGraph(null));

      getRepositoryStructure(selectedRepoId, user.email)
        .then(data => setStructure(data))
        .catch(() => setStructure(null));

      getRepositoryCallGraph(selectedRepoId, user.email)
        .then(data => setCallGraph(data))
        .catch(() => setCallGraph(null));

    } else {
      setOnboardingDocs(null);
      setArchitecture(null);
      setFlows([]);
      setGraph(null);
      setStructure(null);
      setCallGraph(null);
    }
  }, [selectedRepoId, user?.email]);

  // Update expanded sections default on level change
  useEffect(() => {
    if (onboardingDocs && onboardingDocs[activeLevel]) {
      const initialExpanded: Record<string, boolean> = {};
      onboardingDocs[activeLevel].generated_content.sections.forEach((_, idx) => {
        initialExpanded[`${activeLevel}-${idx}`] = true;
      });
      setExpandedSections(initialExpanded);
    }
  }, [activeLevel, onboardingDocs]);

  const handleRegenerate = async () => {
    if (!selectedRepoId || !user?.email) return;
    setRegenerating(true);
    try {
      const docs = await regenerateRepositoryOnboarding(selectedRepoId, user.email);
      setOnboardingDocs(docs);
    } catch (err) {
      console.error("Failed to regenerate onboarding content", err);
    } finally {
      setRegenerating(false);
    }
  };

  const toggleSection = (index: number) => {
    const key = `${activeLevel}-${index}`;
    setExpandedSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedSectionIndex(index);
    setTimeout(() => setCopiedSectionIndex(null), 2000);
  };

  const copyFullMarkdown = () => {
    if (!onboardingDocs || !onboardingDocs[activeLevel]) return;
    const doc = onboardingDocs[activeLevel];
    const markdown = `# ${doc.generated_content.title}\n\n` + 
      doc.generated_content.sections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n');
    
    navigator.clipboard.writeText(markdown);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const downloadMarkdown = () => {
    if (!onboardingDocs || !onboardingDocs[activeLevel]) return;
    const doc = onboardingDocs[activeLevel];
    const markdown = `# ${doc.generated_content.title}\n\n` + 
      doc.generated_content.sections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n');
    
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${selectedRepo?.name || 'repo'}_onboarding_${activeLevel.toLowerCase()}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── Professional PDF Export ───────────────────────────────────────────────────
  const exportPDF = () => {
    if (!onboardingDocs || !selectedRepo) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const logoUrl = `${window.location.origin}/assets/Helix%20White.png`;
    const repoName = selectedRepo.name || 'Repository';
    const generatedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    const generatedTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit'
    });

    // ── Helpers ──
    const escapeHtml = (text: string) =>
      text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const formatContent = (content: string): string => {
      return content.split('\n\n').map(paragraph => {
        // Bullet lists
        if (paragraph.startsWith('- ') || paragraph.startsWith('* ')) {
          const items = paragraph.split('\n').map(item => {
            const cleaned = item.replace(/^[-*]\s+/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
            return `<li>${cleaned}</li>`;
          }).join('');
          return `<ul>${items}</ul>`;
        }
        // Numbered lists
        if (/^\d+\.\s+/.test(paragraph)) {
          const items = paragraph.split('\n').map(item => {
            const cleaned = item.replace(/^\d+\.\s+/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
            return `<li>${cleaned}</li>`;
          }).join('');
          return `<ol>${items}</ol>`;
        }
        // Regular paragraph with bold + code formatting
        const formatted = paragraph
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/`([^`]+)`/g, '<code>$1</code>');
        return `<p>${formatted}</p>`;
      }).join('');
    };

    // ── Build All Levels Content ──
    const levelsHtml = Object.entries(onboardingDocs).map(([levelKey, doc]) => {
      const levelTitle = doc.generated_content.title;
      const sectionsHtml = doc.generated_content.sections.map((section, idx) => {
        return `
          <div class="section-card">
            <div class="section-header">
              <span class="section-number">${idx + 1}</span>
              <h3>${escapeHtml(section.heading)}</h3>
            </div>
            <div class="section-body">
              ${formatContent(section.content)}
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="level-block" style="page-break-before: always;">
          <div class="level-title-bar">
            <h2>${escapeHtml(levelTitle)}</h2>
          </div>
          ${sectionsHtml}
        </div>
      `;
    }).join('');

    // ── Architecture Section ──
    let architectureHtml = '';
    if (architecture) {
      const compsRows = architecture.components.map(c => `
        <tr>
          <td class="td-name">${escapeHtml(c.name)}</td>
          <td><span class="badge badge-blue">${escapeHtml(c.type)}</span></td>
          <td class="td-desc">${escapeHtml(c.description)}</td>
          <td class="td-tech">${c.technologies.map(t => `<span class="tech-tag">${escapeHtml(t)}</span>`).join(' ')}</td>
        </tr>
      `).join('');

      const healthSignals = architecture.architecture_summary?.health_signals;
      let healthHtml = '';
      if (healthSignals) {
        const godClassRows = (healthSignals.god_classes || []).map(gc => `
          <tr>
            <td class="td-name">${escapeHtml(gc.class_name)}</td>
            <td>${gc.method_count} Methods</td>
          </tr>
        `).join('');

        const circularDeps = (healthSignals.circular_dependencies || []).map(d => 
          `<li>${escapeHtml(d)}</li>`
        ).join('');

        const deadModules = (healthSignals.dead_modules || []).map(d => 
          `<li>${escapeHtml(d)}</li>`
        ).join('');

        healthHtml = `
          <div class="section-card">
            <div class="section-header">
              <span class="section-number">&#x2665;</span>
              <h3>Architecture Health Signals</h3>
            </div>
            <div class="section-body">
              <div class="metrics-grid">
                <div class="metric-card">
                  <div class="metric-label">Separation of Concerns</div>
                  <div class="metric-value">${healthSignals.separation_of_concerns_score ?? 'N/A'}<span class="metric-unit">/100</span></div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Coupling Score</div>
                  <div class="metric-value">${healthSignals.coupling_score ?? 'N/A'}<span class="metric-unit">%</span></div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">God Classes</div>
                  <div class="metric-value">${(healthSignals.god_classes || []).length}</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Dead Modules</div>
                  <div class="metric-value">${(healthSignals.dead_modules || []).length}</div>
                </div>
              </div>
              ${godClassRows ? `
                <h4 class="sub-heading">God Classes (High Complexity)</h4>
                <table class="data-table">
                  <thead><tr><th>Class Name</th><th>Complexity</th></tr></thead>
                  <tbody>${godClassRows}</tbody>
                </table>
              ` : ''}
              ${circularDeps ? `<h4 class="sub-heading">Circular Dependencies</h4><ul class="detail-list">${circularDeps}</ul>` : ''}
              ${deadModules ? `<h4 class="sub-heading">Dead Modules</h4><ul class="detail-list">${deadModules}</ul>` : ''}
            </div>
          </div>
        `;
      }

      architectureHtml = `
        <div class="level-block" style="page-break-before: always;">
          <div class="level-title-bar level-title-bar-arch">
            <h2>Architecture Intelligence Report</h2>
          </div>

          <div class="section-card">
            <div class="section-header">
              <span class="section-number">&#x2726;</span>
              <h3>Architecture Overview</h3>
            </div>
            <div class="section-body">
              <div class="metrics-grid">
                <div class="metric-card">
                  <div class="metric-label">Pattern</div>
                  <div class="metric-value-sm">${escapeHtml(architecture.architecture_type)}</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Project Type</div>
                  <div class="metric-value-sm">${escapeHtml(architecture.project_type)}</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Deployment</div>
                  <div class="metric-value-sm">${escapeHtml(architecture.deployment_model || 'Not Detected')}</div>
                </div>
                ${architecture.architecture_summary?.confidence_score !== undefined ? `
                  <div class="metric-card">
                    <div class="metric-label">Confidence</div>
                    <div class="metric-value">${architecture.architecture_summary.confidence_score}<span class="metric-unit">%</span></div>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>

          <div class="section-card">
            <div class="section-header">
              <span class="section-number">&#x2699;</span>
              <h3>System Components</h3>
            </div>
            <div class="section-body">
              <table class="data-table">
                <thead>
                  <tr>
                    <th style="width:25%;">Component</th>
                    <th style="width:15%;">Type</th>
                    <th style="width:35%;">Description</th>
                    <th style="width:25%;">Technologies</th>
                  </tr>
                </thead>
                <tbody>${compsRows}</tbody>
              </table>
            </div>
          </div>

          ${healthHtml}
        </div>
      `;
    }

    // ── Knowledge Map Section ──
    let knowledgeMapHtml = '';
    if (graph && (graph.nodes.length > 0 || graph.edges.length > 0)) {
      // Group nodes by type
      const nodesByType: Record<string, number> = {};
      graph.nodes.forEach(n => {
        nodesByType[n.node_type] = (nodesByType[n.node_type] || 0) + 1;
      });
      const nodeTypeRows = Object.entries(nodesByType).sort((a, b) => b[1] - a[1]).map(([type, count]) => `
        <tr><td><span class="badge badge-teal">${escapeHtml(type)}</span></td><td>${count}</td></tr>
      `).join('');

      // Group edges by relationship type
      const edgesByType: Record<string, number> = {};
      graph.edges.forEach(e => {
        edgesByType[e.relationship_type] = (edgesByType[e.relationship_type] || 0) + 1;
      });
      const edgeTypeRows = Object.entries(edgesByType).sort((a, b) => b[1] - a[1]).map(([type, count]) => `
        <tr><td><span class="badge badge-amber">${escapeHtml(type.replace(/_/g, ' '))}</span></td><td>${count}</td></tr>
      `).join('');

      // Endpoints
      const endpoints = graph.nodes.filter(n => n.node_type === 'ENDPOINT');
      let endpointsHtml = '';
      if (endpoints.length > 0) {
        const endpointRows = endpoints.map(ep => {
          const parts = ep.node_name.split(' ');
          const method = parts.length > 1 ? parts[0].toUpperCase() : 'ROUTE';
          const path = parts.length > 1 ? parts.slice(1).join(' ') : ep.node_name;
          let methodClass = 'method-default';
          if (method === 'GET') methodClass = 'method-get';
          else if (method === 'POST') methodClass = 'method-post';
          else if (method === 'PUT') methodClass = 'method-put';
          else if (method === 'DELETE') methodClass = 'method-delete';
          else if (method === 'PATCH') methodClass = 'method-patch';
          return `<tr><td><span class="method-badge ${methodClass}">${escapeHtml(method)}</span></td><td class="td-endpoint">${escapeHtml(path)}</td></tr>`;
        }).join('');
        endpointsHtml = `
          <div class="section-card">
            <div class="section-header">
              <span class="section-number">&#x2192;</span>
              <h3>API Endpoints</h3>
            </div>
            <div class="section-body">
              <table class="data-table">
                <thead><tr><th style="width:15%;">Method</th><th>Route Path</th></tr></thead>
                <tbody>${endpointRows}</tbody>
              </table>
            </div>
          </div>
        `;
      }

      knowledgeMapHtml = `
        <div class="level-block" style="page-break-before: always;">
          <div class="level-title-bar level-title-bar-graph">
            <h2>Knowledge Map Summary</h2>
          </div>
          
          <div class="section-card">
            <div class="section-header">
              <span class="section-number">&#x25C6;</span>
              <h3>Graph Metrics</h3>
            </div>
            <div class="section-body">
              <div class="metrics-grid">
                <div class="metric-card">
                  <div class="metric-label">Total Nodes</div>
                  <div class="metric-value">${graph.nodes.length}</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Total Edges</div>
                  <div class="metric-value">${graph.edges.length}</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Node Types</div>
                  <div class="metric-value">${Object.keys(nodesByType).length}</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Relationship Types</div>
                  <div class="metric-value">${Object.keys(edgesByType).length}</div>
                </div>
              </div>

              <div style="display:flex; gap:24px; margin-top:16px;">
                <div style="flex:1;">
                  <h4 class="sub-heading">Node Distribution</h4>
                  <table class="data-table compact">
                    <thead><tr><th>Type</th><th>Count</th></tr></thead>
                    <tbody>${nodeTypeRows}</tbody>
                  </table>
                </div>
                <div style="flex:1;">
                  <h4 class="sub-heading">Relationship Distribution</h4>
                  <table class="data-table compact">
                    <thead><tr><th>Relationship</th><th>Count</th></tr></thead>
                    <tbody>${edgeTypeRows}</tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          ${endpointsHtml}
        </div>
      `;
    }

    // ── Execution Flows Section ──
    let flowsHtml = '';
    if (flows.length > 0) {
      const flowCards = flows.map((flow, fIdx) => {
        const stepsHtml = flow.steps.map((step, sIdx) => `
          <tr>
            <td class="td-step-num">${sIdx + 1}</td>
            <td class="td-name">${escapeHtml(step.step_name)}</td>
            <td class="td-desc">${escapeHtml(step.description || '—')}</td>
            <td class="td-file">${step.file_path ? escapeHtml(step.file_path) : '—'}</td>
          </tr>
        `).join('');

        const componentsHtml = flow.components_used.length > 0
          ? flow.components_used.map(c => `<span class="tech-tag">${escapeHtml(c)}</span>`).join(' ')
          : '<span style="color:#71717a; font-style:italic;">None identified</span>';

        const dbInteractions = flow.database_interactions.length > 0
          ? flow.database_interactions.map(d => `<span class="tech-tag tag-db">${escapeHtml(d)}</span>`).join(' ')
          : '';

        const extServices = flow.external_services.length > 0
          ? flow.external_services.map(s => `<span class="tech-tag tag-ext">${escapeHtml(s)}</span>`).join(' ')
          : '';

        const confidenceColor = flow.confidence_score >= 0.7 ? '#15803d' : flow.confidence_score >= 0.4 ? '#b78103' : '#b91c1c';

        return `
          <div class="flow-card">
            <div class="flow-header">
              <div class="flow-title-row">
                <span class="flow-number">${fIdx + 1}</span>
                <h4 class="flow-name">${escapeHtml(flow.flow_name)}</h4>
                <span class="badge badge-purple">${escapeHtml(flow.flow_type.replace(/_/g, ' '))}</span>
              </div>
              <div class="flow-meta">
                ${flow.entry_point ? `<span class="flow-meta-item"><strong>Entry:</strong> ${escapeHtml(flow.entry_point)}</span>` : ''}
                <span class="flow-meta-item"><strong>Confidence:</strong> <span style="color:${confidenceColor}; font-weight:bold;">${Math.round(flow.confidence_score * 100)}%</span></span>
                <span class="flow-meta-item"><strong>Steps:</strong> ${flow.steps.length}</span>
              </div>
            </div>
            <div class="flow-body">
              <div class="flow-tags-row">
                <div class="flow-tag-group">
                  <span class="flow-tag-label">Components:</span>
                  ${componentsHtml}
                </div>
                ${dbInteractions ? `<div class="flow-tag-group"><span class="flow-tag-label">Database:</span>${dbInteractions}</div>` : ''}
                ${extServices ? `<div class="flow-tag-group"><span class="flow-tag-label">External:</span>${extServices}</div>` : ''}
              </div>
              ${stepsHtml ? `
                <table class="data-table steps-table">
                  <thead><tr><th style="width:6%;">#</th><th style="width:25%;">Step</th><th style="width:40%;">Description</th><th style="width:29%;">File</th></tr></thead>
                  <tbody>${stepsHtml}</tbody>
                </table>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');

      flowsHtml = `
        <div class="level-block" style="page-break-before: always;">
          <div class="level-title-bar level-title-bar-flow">
            <h2>Execution Flow Discovery</h2>
          </div>
          <p class="section-intro">${flows.length} execution flow${flows.length !== 1 ? 's' : ''} discovered across the repository codebase.</p>
          ${flowCards}
        </div>
      `;
    }

    // ── Call Graph Section ──
    let callGraphHtml = '';
    if (callGraph && callGraph.call_chains.length > 0) {
      const chainsHtml = callGraph.call_chains.slice(0, 20).map((chain, idx) => `
        <tr>
          <td class="td-step-num">${idx + 1}</td>
          <td class="td-chain">${chain.map(c => `<span class="chain-node">${escapeHtml(c)}</span>`).join(' <span class="chain-arrow">→</span> ')}</td>
        </tr>
      `).join('');

      callGraphHtml = `
        <div class="section-card" style="margin-top:16px;">
          <div class="section-header">
            <span class="section-number">&#x21C6;</span>
            <h3>Call Chains (Top ${Math.min(callGraph.call_chains.length, 20)})</h3>
          </div>
          <div class="section-body">
            <table class="data-table">
              <thead><tr><th style="width:6%;">#</th><th>Chain</th></tr></thead>
              <tbody>${chainsHtml}</tbody>
            </table>
          </div>
        </div>
      `;
    }

    // ── Structure Summary Section ──
    let structureHtml = '';
    if (structure) {
      const dirRows = (structure.top_level_directories || []).map(d => 
        `<li><code>/${d}</code></li>`
      ).join('');

      const depRows = (structure.dependencies || []).slice(0, 30).map(d => 
        `<span class="tech-tag">${escapeHtml(d)}</span>`
      ).join(' ');

      structureHtml = `
        <div class="section-card" style="margin-top:16px;">
          <div class="section-header">
            <span class="section-number">&#x1F4C2;</span>
            <h3>Repository Structure</h3>
          </div>
          <div class="section-body">
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-label">Total Files</div>
                <div class="metric-value">${structure.total_files}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Total Directories</div>
                <div class="metric-value">${structure.total_directories}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Languages</div>
                <div class="metric-value">${(structure.languages || []).length}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Frameworks</div>
                <div class="metric-value">${(structure.frameworks || []).length}</div>
              </div>
            </div>
            ${dirRows ? `<h4 class="sub-heading">Root Directories</h4><ul class="detail-list dir-list">${dirRows}</ul>` : ''}
            ${depRows ? `<h4 class="sub-heading">Dependencies (${(structure.dependencies || []).length} Total)</h4><div class="deps-wrap">${depRows}</div>` : ''}
          </div>
        </div>
      `;
    }

    // ── Assemble Final HTML ──
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Helix Onboarding Report — ${escapeHtml(repoName)}</title>
          <style>
            /* ──── Reset & Base ──── */
            *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
            
            body {
              font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
              color: #1a1a2e;
              line-height: 1.65;
              margin: 0;
              padding: 0;
              background: #ffffff;
              font-size: 11px;
            }

            .page-container {
              max-width: 800px;
              margin: 0 auto;
              padding: 32px 40px;
            }

            /* ──── Cover Page ──── */
            .cover-page {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 92vh;
              text-align: center;
              page-break-after: always;
            }

            .cover-logo {
              width: 64px;
              height: auto;
              margin-bottom: 20px;
              border-radius: 8px;
              padding: 8px;
              background: #09090b;
            }

            .cover-title {
              font-size: 28px;
              font-weight: 800;
              letter-spacing: -0.02em;
              color: #09090b;
              margin-bottom: 6px;
              text-transform: uppercase;
            }

            .cover-subtitle {
              font-size: 15px;
              color: #52525b;
              font-weight: 400;
              margin-bottom: 28px;
            }

            .cover-repo-name {
              font-size: 22px;
              font-weight: 700;
              color: #b78103;
              border: 2px solid #fde68a;
              background: #fffbeb;
              padding: 10px 32px;
              border-radius: 8px;
              margin-bottom: 28px;
              letter-spacing: 0.01em;
            }

            .cover-meta {
              display: flex;
              gap: 32px;
              font-size: 10px;
              color: #71717a;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              font-weight: 600;
            }

            .cover-meta-item span {
              display: block;
              font-size: 12px;
              color: #18181b;
              font-weight: 700;
              margin-top: 3px;
              text-transform: none;
              letter-spacing: 0;
            }

            .cover-divider {
              width: 120px;
              height: 2px;
              background: linear-gradient(90deg, transparent, #b78103, transparent);
              margin: 24px auto;
            }

            .cover-footer {
              font-size: 9px;
              color: #a1a1aa;
              margin-top: 24px;
              letter-spacing: 0.06em;
              text-transform: uppercase;
            }

            /* ──── Level Blocks ──── */
            .level-block {
              margin-bottom: 24px;
            }

            .level-title-bar {
              background: linear-gradient(135deg, #09090b, #1a1a2e);
              color: #ffffff;
              padding: 14px 20px;
              border-radius: 8px 8px 0 0;
              margin-bottom: 0;
            }

            .level-title-bar-arch {
              background: linear-gradient(135deg, #1e3a5f, #0d2137);
            }

            .level-title-bar-graph {
              background: linear-gradient(135deg, #134e4a, #042f2e);
            }

            .level-title-bar-flow {
              background: linear-gradient(135deg, #4a1d6a, #2e1042);
            }

            .level-title-bar h2 {
              font-size: 16px;
              font-weight: 800;
              letter-spacing: 0.02em;
              text-transform: uppercase;
              margin: 0;
            }

            .section-intro {
              font-size: 11px;
              color: #52525b;
              padding: 8px 0 4px;
              font-style: italic;
            }

            /* ──── Section Cards ──── */
            .section-card {
              border: 1px solid #e4e4e7;
              border-radius: 0 0 6px 6px;
              margin-bottom: 12px;
              overflow: hidden;
              page-break-inside: avoid;
            }

            .section-card + .section-card {
              border-radius: 6px;
            }

            .section-header {
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 10px 16px;
              background: #fafafa;
              border-bottom: 1px solid #e4e4e7;
            }

            .section-number {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 22px;
              height: 22px;
              border-radius: 50%;
              background: #18181b;
              color: #ffffff;
              font-size: 10px;
              font-weight: 800;
              flex-shrink: 0;
            }

            .section-header h3 {
              font-size: 12.5px;
              font-weight: 700;
              color: #18181b;
              margin: 0;
              text-transform: capitalize;
            }

            .section-body {
              padding: 14px 16px;
            }

            .section-body p {
              margin-bottom: 8px;
              font-size: 11px;
              line-height: 1.7;
              color: #27272a;
            }

            .section-body p:last-child {
              margin-bottom: 0;
            }

            .section-body strong {
              color: #09090b;
              font-weight: 700;
            }

            .section-body code {
              background: #f4f4f5;
              color: #b78103;
              padding: 1px 5px;
              border-radius: 3px;
              font-family: 'Consolas', 'Fira Code', monospace;
              font-size: 10px;
              font-weight: 600;
            }

            .section-body ul, .section-body ol {
              padding-left: 20px;
              margin: 6px 0;
            }

            .section-body li {
              font-size: 11px;
              color: #27272a;
              margin-bottom: 4px;
              line-height: 1.6;
            }

            /* ──── Sub Headings ──── */
            .sub-heading {
              font-size: 11px;
              font-weight: 700;
              color: #18181b;
              margin: 14px 0 6px;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              border-bottom: 1px solid #f4f4f5;
              padding-bottom: 4px;
            }

            /* ──── Metrics Grid ──── */
            .metrics-grid {
              display: flex;
              gap: 12px;
              flex-wrap: wrap;
              margin-bottom: 8px;
            }

            .metric-card {
              flex: 1;
              min-width: 100px;
              background: #fafafa;
              border: 1px solid #e4e4e7;
              border-radius: 6px;
              padding: 10px 14px;
              text-align: center;
            }

            .metric-label {
              font-size: 9px;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              color: #71717a;
              font-weight: 700;
              margin-bottom: 3px;
            }

            .metric-value {
              font-size: 22px;
              font-weight: 800;
              color: #18181b;
            }

            .metric-value-sm {
              font-size: 13px;
              font-weight: 700;
              color: #18181b;
              word-break: break-word;
            }

            .metric-unit {
              font-size: 11px;
              font-weight: 600;
              color: #71717a;
            }

            /* ──── Data Tables ──── */
            .data-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 6px;
              font-size: 10.5px;
            }

            .data-table thead th {
              background: #f4f4f5;
              text-align: left;
              padding: 7px 10px;
              font-size: 9.5px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #52525b;
              font-weight: 700;
              border-bottom: 2px solid #e4e4e7;
            }

            .data-table tbody td {
              padding: 6px 10px;
              border-bottom: 1px solid #f4f4f5;
              vertical-align: top;
              word-break: break-word;
            }

            .data-table.compact td,
            .data-table.compact th {
              padding: 4px 8px;
              font-size: 10px;
            }

            .td-name { font-weight: 700; color: #09090b; }
            .td-desc { color: #3f3f46; font-size: 10px; }
            .td-tech { font-size: 9px; }
            .td-file { font-family: 'Consolas', monospace; font-size: 9px; color: #71717a; word-break: break-all; }
            .td-step-num { text-align: center; font-weight: 700; color: #71717a; font-size: 10px; }
            .td-endpoint { font-family: 'Consolas', monospace; font-weight: 700; font-size: 11px; }
            .td-chain { font-size: 10px; line-height: 1.8; }

            /* ──── Badges ──── */
            .badge {
              display: inline-block;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.04em;
            }

            .badge-blue { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
            .badge-teal { background: #f0fdfa; color: #0d9488; border: 1px solid #99f6e4; }
            .badge-amber { background: #fffbeb; color: #b78103; border: 1px solid #fde68a; }
            .badge-purple { background: #faf5ff; color: #7c3aed; border: 1px solid #ddd6fe; }

            /* ──── Tech Tags ──── */
            .tech-tag {
              display: inline-block;
              padding: 2px 7px;
              background: #f4f4f5;
              border: 1px solid #e4e4e7;
              border-radius: 3px;
              font-size: 9px;
              font-weight: 600;
              color: #3f3f46;
              margin: 1px 2px;
            }

            .tag-db { background: #ecfdf5; border-color: #a7f3d0; color: #065f46; }
            .tag-ext { background: #eff6ff; border-color: #bfdbfe; color: #1e40af; }

            /* ──── Method Badges ──── */
            .method-badge {
              display: inline-block;
              padding: 2px 8px;
              border-radius: 3px;
              font-size: 10px;
              font-weight: 800;
              font-family: 'Consolas', monospace;
              letter-spacing: 0.03em;
            }

            .method-get { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
            .method-post { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
            .method-put { background: #fffbeb; color: #b78103; border: 1px solid #fde68a; }
            .method-delete { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
            .method-patch { background: #faf5ff; color: #7c3aed; border: 1px solid #ddd6fe; }
            .method-default { background: #f4f4f5; color: #52525b; border: 1px solid #e4e4e7; }

            /* ──── Flow Cards ──── */
            .flow-card {
              border: 1px solid #e4e4e7;
              border-radius: 6px;
              margin-bottom: 14px;
              overflow: hidden;
              page-break-inside: avoid;
            }

            .flow-header {
              background: #fafafa;
              padding: 10px 14px;
              border-bottom: 1px solid #e4e4e7;
            }

            .flow-title-row {
              display: flex;
              align-items: center;
              gap: 8px;
            }

            .flow-number {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: #7c3aed;
              color: #ffffff;
              font-size: 9px;
              font-weight: 800;
              flex-shrink: 0;
            }

            .flow-name {
              font-size: 12px;
              font-weight: 700;
              color: #09090b;
              margin: 0;
              flex: 1;
            }

            .flow-meta {
              display: flex;
              gap: 16px;
              margin-top: 6px;
              padding-left: 28px;
            }

            .flow-meta-item {
              font-size: 9.5px;
              color: #52525b;
            }

            .flow-meta-item strong {
              color: #3f3f46;
            }

            .flow-body {
              padding: 10px 14px;
            }

            .flow-tags-row {
              display: flex;
              flex-wrap: wrap;
              gap: 12px;
              margin-bottom: 8px;
            }

            .flow-tag-group {
              display: flex;
              align-items: center;
              gap: 4px;
              flex-wrap: wrap;
            }

            .flow-tag-label {
              font-size: 9px;
              font-weight: 700;
              color: #71717a;
              text-transform: uppercase;
              letter-spacing: 0.04em;
            }

            .steps-table {
              margin-top: 6px;
            }

            /* ──── Call Chain ──── */
            .chain-node {
              display: inline-block;
              padding: 1px 6px;
              background: #f4f4f5;
              border: 1px solid #e4e4e7;
              border-radius: 3px;
              font-family: 'Consolas', monospace;
              font-size: 9px;
              font-weight: 600;
              color: #18181b;
            }

            .chain-arrow {
              color: #b78103;
              font-weight: 800;
              font-size: 11px;
              margin: 0 2px;
            }

            /* ──── Detail Lists ──── */
            .detail-list {
              padding-left: 18px;
              margin: 4px 0;
            }

            .detail-list li {
              font-size: 10px;
              color: #3f3f46;
              margin-bottom: 3px;
            }

            .dir-list li code {
              font-size: 10px;
            }

            .deps-wrap {
              display: flex;
              flex-wrap: wrap;
              gap: 3px;
              margin-top: 4px;
            }

            /* ──── Page Footer ──── */
            .page-footer {
              margin-top: 40px;
              padding-top: 12px;
              border-top: 1px solid #e4e4e7;
              text-align: center;
              font-size: 8.5px;
              color: #a1a1aa;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              page-break-inside: avoid;
            }

            /* ──── Print Overrides ──── */
            @media print {
              body { margin: 0; padding: 0; }
              .page-container { padding: 20px 28px; max-width: none; }
              .level-block { page-break-before: always; }
              .level-block:first-child { page-break-before: auto; }
              .section-card { page-break-inside: avoid; }
              .flow-card { page-break-inside: avoid; }
              button { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="page-container">

            <!-- ═══ Cover Page ═══ -->
            <div class="cover-page">
              <img src="${logoUrl}" alt="Helix Logo" class="cover-logo" />
              <div class="cover-title">Developer Onboarding Report</div>
              <div class="cover-subtitle">Comprehensive Repository Intelligence Document</div>
              <div class="cover-divider"></div>
              <div class="cover-repo-name">${escapeHtml(repoName)}</div>
              <div class="cover-meta">
                <div class="cover-meta-item">
                  Generated
                  <span>${generatedDate}</span>
                </div>
                <div class="cover-meta-item">
                  Time
                  <span>${generatedTime}</span>
                </div>
                <div class="cover-meta-item">
                  Platform
                  <span>Helix Intelligence</span>
                </div>
                <div class="cover-meta-item">
                  Author
                  <span>${escapeHtml(user?.name || user?.email || 'Developer')}</span>
                </div>
              </div>
              <div class="cover-footer">
                Powered by Helix — AST Analysis · Knowledge Graphs · Architecture Intelligence · Execution Flows
              </div>
            </div>

            <!-- ═══ Onboarding Levels ═══ -->
            ${levelsHtml}

            <!-- ═══ Architecture Intelligence ═══ -->
            ${architectureHtml}

            <!-- ═══ Knowledge Map ═══ -->
            ${knowledgeMapHtml}

            ${callGraphHtml ? `
              <div class="level-block" style="page-break-before: always;">
                <div class="level-title-bar level-title-bar-graph">
                  <h2>Call Graph Analysis</h2>
                </div>
                ${callGraphHtml}
              </div>
            ` : ''}

            <!-- ═══ Execution Flows ═══ -->
            ${flowsHtml}

            <!-- ═══ Repository Structure ═══ -->
            ${structureHtml ? `
              <div class="level-block" style="page-break-before: always;">
                <div class="level-title-bar">
                  <h2>Repository Structure Overview</h2>
                </div>
                ${structureHtml}
              </div>
            ` : ''}

            <!-- ═══ Footer ═══ -->
            <div class="page-footer">
              Generated by Helix Platform &middot; ${generatedDate} &middot; ${escapeHtml(repoName)} &middot; All Data Derived from Static Analysis
            </div>

          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 800);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const selectedRepo = repositories.find(r => r.id === selectedRepoId);
  const currentDoc = onboardingDocs ? onboardingDocs[activeLevel] : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-xs text-zinc-550 hover:text-gold transition-colors select-none">
        <ArrowLeft size={14} /> Back to Dashboard
      </Link>
      
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono block">Onboarding Platform</span>
          <h1 className="text-2xl font-serif-display font-medium text-ivory tracking-tight mt-1 flex items-center gap-2">
            <GraduationCap className="text-gold" size={24} /> Developer Onboarding
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
            Translate raw static code analysis, relationships, and call graph behavior into structured, levels of human-friendly documentation.
          </p>
        </div>
        
        {/* Repository selector */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-zinc-500 font-mono">Select Codebase:</span>
          <select
            value={selectedRepoId}
            onChange={(e) => setSelectedRepoId(e.target.value)}
            className="bg-zinc-950 border border-zinc-900 rounded px-3 py-1.5 text-xs text-zinc-350 focus:outline-none focus:border-gold transition-colors font-mono max-w-[220px]"
          >
            {repositories.length === 0 && (
              <option value="">No analyzed repositories</option>
            )}
            {repositories.map(repo => (
              <option key={repo.id} value={repo.id}>
                {repo.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center text-xs text-zinc-500 animate-pulse font-mono">
          Generating onboarding guide from repository intelligence (AST + Graph + Flows)...
        </div>
      ) : !selectedRepoId ? (
        <div className="py-16 text-center rounded-lg border border-zinc-900 bg-zinc-950/40">
          <GraduationCap size={36} className="mx-auto text-zinc-800 mb-3" />
          <p className="text-sm text-zinc-400">No scanned repositories found.</p>
          <p className="text-xs text-zinc-650 mt-1">Please clone and analyze a repository to generate onboarding guides.</p>
        </div>
      ) : !currentDoc ? (
        <div className="py-16 text-center rounded-lg border border-zinc-900 bg-zinc-950/40">
          <RefreshCw size={28} className="mx-auto text-zinc-700 mb-3 animate-spin" />
          <p className="text-sm text-zinc-400">Preparing Onboarding Docs...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Navigation levels sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <span className="text-[9.5px] uppercase tracking-wider text-zinc-600 font-mono block">Onboarding Levels</span>
            
            <div className="flex flex-col gap-1.5">
              {[
                { id: 'LEVEL_1', title: 'Executive Summary', desc: 'Purpose, tech stack, architecture' },
                { id: 'LEVEL_2', title: 'Developer Overview', desc: 'Folders, db layer, auth, flows' },
                { id: 'LEVEL_3', title: 'Deep Technical Guide', desc: 'Architecture, graphs, packages' },
                { id: 'LEVEL_4', title: 'First Contribution Guide', desc: 'Starting files, risks, quick tasks' }
              ].map((lvl, index) => {
                const isActive = activeLevel === lvl.id;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setActiveLevel(lvl.id as any)}
                    className={`w-full text-left p-3.5 rounded border transition-all cursor-pointer flex flex-col gap-1.5 ${
                      isActive
                        ? 'border-gold bg-gold/5 text-gold'
                        : 'border-zinc-900 bg-zinc-950/30 hover:border-zinc-850 text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full border text-[10px] font-mono flex items-center justify-center ${
                        isActive ? 'border-gold bg-gold/10' : 'border-zinc-800 bg-zinc-950'
                      }`}>
                        {index + 1}
                      </span>
                      <span className="text-xs font-semibold text-ivory font-mono-ui">{lvl.title}</span>
                    </div>
                    <span className="text-[10px] text-zinc-550 pl-7 leading-normal">{lvl.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* Document Controls */}
            <div className="p-4 rounded-lg border border-zinc-900 bg-zinc-950/20 space-y-3.5">
              <span className="text-[9.5px] uppercase tracking-wider text-zinc-600 font-mono block">Metadata</span>
              
              <div className="text-[10.5px] font-mono space-y-1.5 text-zinc-500">
                <div className="flex justify-between">
                  <span>Version:</span>
                  <span className="text-zinc-350">v{currentDoc.version}</span>
                </div>
                <div className="flex justify-between">
                  <span>Generated:</span>
                  <span className="text-zinc-350 truncate max-w-[110px]" title={currentDoc.generated_at || 'Never'}>
                    {currentDoc.generated_at ? new Date(currentDoc.generated_at).toLocaleDateString() : 'Never'}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-900/60 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="w-full py-1.5 rounded bg-zinc-900 border border-zinc-800 text-[10.5px] font-mono-ui text-zinc-400 hover:border-gold hover:text-gold hover:bg-gold/5 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={11} className={regenerating ? 'animate-spin' : ''} />
                  {regenerating ? 'Regenerating...' : 'Regenerate Doc'}
                </button>
              </div>
            </div>
          </div>

          {/* Document Content View */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Action Bar */}
            <div className="px-4.5 py-3 rounded-lg border border-zinc-900 bg-zinc-950 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <GraduationCap size={15} className="text-gold" />
                <span className="text-xs font-semibold text-ivory font-mono-ui">{currentDoc.generated_content.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyFullMarkdown}
                  className="px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-850 hover:border-zinc-750 text-[10px] text-zinc-400 hover:text-gold transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Copy full document in Markdown"
                >
                  {copiedAll ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  {copiedAll ? 'Copied!' : 'Copy MD'}
                </button>
                <button
                  type="button"
                  onClick={downloadMarkdown}
                  className="px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-850 hover:border-zinc-750 text-[10px] text-zinc-400 hover:text-gold transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Download Markdown file"
                >
                  <Download size={11} /> Download
                </button>
                <button
                  type="button"
                  onClick={exportPDF}
                  className="px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-850 hover:border-zinc-750 text-[10px] text-zinc-400 hover:text-gold transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Export comprehensive PDF report"
                >
                  <FileText size={11} /> Export PDF
                </button>
              </div>
            </div>

            {/* Document Render */}
            <div className="space-y-4">
              {currentDoc.generated_content.sections.map((section, idx) => {
                const key = `${activeLevel}-${idx}`;
                const isExpanded = expandedSections[key] ?? true;
                
                // Formatted content renderer
                const formattedContent = section.content.split('\n\n').map((paragraph, pIdx) => {
                  if (paragraph.startsWith('- ') || paragraph.startsWith('* ')) {
                    return (
                      <ul key={pIdx} className="list-disc pl-5 space-y-1.5 text-zinc-350 font-sans-ui leading-relaxed text-xs">
                        {paragraph.split('\n').map((item, iIdx) => (
                          <li key={iIdx} className="pl-1">
                            {item.replace(/^[-*]\s+/, '').replace(/\*\*(.*?)\*\*/g, '$1')}
                          </li>
                        ))}
                      </ul>
                    );
                  }
                  if (/^\d+\.\s+/.test(paragraph)) {
                    return (
                      <ol key={pIdx} className="list-decimal pl-5 space-y-1.5 text-zinc-350 font-sans-ui leading-relaxed text-xs">
                        {paragraph.split('\n').map((item, iIdx) => (
                          <li key={iIdx} className="pl-1">
                            {item.replace(/^\d+\.\s+/, '').replace(/\*\*(.*?)\*\*/g, '$1')}
                          </li>
                        ))}
                      </ol>
                    );
                  }
                  
                  // Handle inline bold formatting
                  const parts = paragraph.split(/(\*\*.*?\*\*)/g);
                  return (
                    <p key={pIdx} className="text-zinc-350 font-sans-ui leading-relaxed text-xs">
                      {parts.map((part, partIdx) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                          return <strong key={partIdx} className="text-ivory font-semibold">{part.slice(2, -2)}</strong>;
                        }
                        return part;
                      })}
                    </p>
                  );
                });

                return (
                  <div key={idx} className="rounded-lg border border-zinc-900 bg-zinc-950/30 overflow-hidden">
                    {/* Section Header */}
                    <div className="px-4.5 py-3.5 bg-zinc-950/80 border-b border-zinc-900/60 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => toggleSection(idx)}
                        className="flex items-center gap-2 text-left cursor-pointer outline-none"
                      >
                        <span>
                          {isExpanded ? <ChevronUp size={14} className="text-gold" /> : <ChevronDown size={14} className="text-gold" />}
                        </span>
                        <h3 className="text-xs font-bold font-mono text-ivory">{section.heading}</h3>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => copyToClipboard(`## ${section.heading}\n\n${section.content}`, idx)}
                        className="p-1 rounded text-zinc-550 hover:text-gold hover:bg-zinc-950 transition-colors cursor-pointer"
                        title="Copy section content"
                      >
                        {copiedSectionIndex === idx ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    </div>

                    {/* Section Content */}
                    {isExpanded && (
                      <div className="p-5 space-y-3.5 bg-zinc-950/10">
                        {formattedContent}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
