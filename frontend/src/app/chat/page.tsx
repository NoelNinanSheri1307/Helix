"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  MessageSquare, ArrowLeft, RefreshCw, Send, Sparkles, Brain, FileText,
  Workflow, Cpu, ShieldAlert, CheckCircle, Trash2, Zap, Hourglass, HelpCircle, Copy
} from 'lucide-react';
import {
  getRepositories, repositoryChat, ChatResponse, getRepositoryMemory, updateRepository
} from '../../lib/api';
import { Repository } from '../../types';
import { HelixResourceDialog } from '../../components/HelixResourceDialog';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  details?: {
    confidence: number;
    provider: string;
    model: string;
    referenced_files: string[];
    referenced_components: string[];
    referenced_flows: string[];
    response_time_ms: number;
  };
}

export default function ChatPage() {
  const { data: session } = useSession();
  const user = session?.user;
  const router = useRouter();

  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'explain' | 'analyze'>('explain');
  const [error, setError] = useState('');
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [limitDetail, setLimitDetail] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [atlasDialogOpen, setAtlasDialogOpen] = useState(false);

  const activeRepo = repositories.find(r => r.id === selectedRepoId);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleCopy = (msg: ChatMessage) => {
    let copyText = msg.text;
    if (msg.details) {
      const details = msg.details;
      let refSection = "\n\n---";
      if (details.referenced_files && details.referenced_files.length > 0) {
        refSection += `\nReferenced Files:\n${details.referenced_files.map(f => `- ${f}`).join('\n')}`;
      }
      if (details.referenced_components && details.referenced_components.length > 0) {
        refSection += `\nReferenced Components:\n${details.referenced_components.map(c => `- ${c}`).join('\n')}`;
      }
      if (details.referenced_flows && details.referenced_flows.length > 0) {
        refSection += `\nReferenced Execution Flows:\n${details.referenced_flows.map(f => `- ${f}`).join('\n')}`;
      }
      if (refSection !== "\n\n---") {
        copyText += refSection;
      }
    }
    navigator.clipboard.writeText(copyText).then(() => {
      setCopiedId(msg.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Load repositories on mount
  useEffect(() => {
    if (user?.email) {
      setLoadingRepos(true);
      getRepositories(user.email)
        .then(list => {
          setRepositories(list);
          if (list.length > 0) {
            setSelectedRepoId(list[0].id);
          }
        })
        .catch(err => {
          console.error(err);
          setError('Failed to fetch repositories.');
        })
        .finally(() => setLoadingRepos(false));
    }
  }, [user?.email]);

  // Poll repositories status if any of them is SYNCING, ANALYZING, or CLONING
  useEffect(() => {
    const activeSync = repositories.some(r => ['SYNCING', 'ANALYZING', 'CLONING'].includes(r.status));
    if (!activeSync || !user?.email) return;

    const interval = setInterval(async () => {
      try {
        const list = await getRepositories(user.email as string);
        setRepositories(list);
      } catch (err) {
        console.error('Failed to poll repository status:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [repositories, user?.email]);

  const handleUpdateRepo = async (id: string) => {
    if (!user?.email) return;
    setRepositories(prev => prev.map(repo => repo.id === id ? { ...repo, status: 'SYNCING' } : repo));
    const updated = await updateRepository(id, user.email as string);
    if (updated) {
      setRepositories(prev => prev.map(repo => repo.id === id ? updated : repo));
    } else {
      alert("Failed to update repository.");
    }
  };

  // Load chat history from localStorage for selected repository on change
  useEffect(() => {
    if (selectedRepoId) {
      const stored = localStorage.getItem(`helix_chat_history_${selectedRepoId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored).map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
          setMessages(parsed);
        } catch {
          setMessages([]);
        }
      } else {
        // Welcome message
        setMessages([
          {
            id: 'welcome',
            sender: 'assistant',
            text: `Hello! I am Helix. Ask me anything about the **${repositories.find(r => r.id === selectedRepoId)?.name || 'selected'
              }** codebase. I will answer based only on verified architectural intelligence and execution flows.`,
            timestamp: new Date()
          }
        ]);
      }
      setError('');
    } else {
      setMessages([]);
    }
  }, [selectedRepoId, repositories]);

  // Check if repository memory is generated, redirect to Code Atlas if not
  useEffect(() => {
    if (selectedRepoId && user?.email) {
      getRepositoryMemory(selectedRepoId, user.email)
        .then(memory => {
          if (!memory || memory.embedding_count === 0) {
            setAtlasDialogOpen(true);
          }
        })
        .catch(() => {
          setAtlasDialogOpen(true);
        });
    }
  }, [selectedRepoId, user?.email]);

  // Save to local storage on message changes
  const saveMessages = (msgs: ChatMessage[]) => {
    if (selectedRepoId) {
      localStorage.setItem(`helix_chat_history_${selectedRepoId}`, JSON.stringify(msgs));
    }
  };

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (e?: React.FormEvent, customText?: string) => {
    e?.preventDefault();
    const targetText = customText || inputText;
    if (!targetText.trim() || !selectedRepoId || !user?.email || loading) return;

    const queryText = targetText.trim();

    // Check 500 characters limit locally
    if (queryText.length > 500) {
      setLimitDetail(`Question length of ${queryText.length} characters exceeds the maximum allowed limit of 500 characters.`);
      setLimitDialogOpen(true);
      return;
    }

    setInputText('');
    setError('');

    // Add user message
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      text: queryText,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    saveMessages(updatedMessages);
    setLoading(true);

    try {
      const res: ChatResponse = await repositoryChat(selectedRepoId, user.email, queryText, mode);

      // Clean provider/model naming to align with proprietary branding requirement (no "Gemini" visible)
      const cleanProvider = res.provider.toLowerCase() === 'gemini' ? 'Helix Intelligence Engine' : res.provider;
      const cleanModel = res.model.toLowerCase().includes('gemini') ? 'Helix-2.5-Flash Core' : res.model;

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        sender: 'assistant',
        text: res.answer,
        timestamp: new Date(),
        details: {
          confidence: res.confidence,
          provider: cleanProvider,
          model: cleanModel,
          referenced_files: res.referenced_files,
          referenced_components: res.referenced_components,
          referenced_flows: res.referenced_flows,
          response_time_ms: res.response_time_ms
        }
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);
      saveMessages(finalMessages);
    } catch (err: any) {
      const errMsg = err.message || '';
      if (errMsg.includes('usage_limit_exceeded') || errMsg.includes('limit_type') || errMsg.includes('limit reached')) {
        let cleanDetail = 'Helix daily query limit exceeded.';
        try {
          const parsed = JSON.parse(errMsg);
          cleanDetail = parsed.detail || parsed.error || errMsg;
        } catch {
          cleanDetail = errMsg;
        }
        setLimitDetail(cleanDetail);
        setLimitDialogOpen(true);
      } else {
        setError(errMsg || 'An error occurred during chat retrieval.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    if (!selectedRepoId) return;
    localStorage.removeItem(`helix_chat_history_${selectedRepoId}`);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'assistant',
        text: `Conversation cleared. Ask me anything about the **${repositories.find(r => r.id === selectedRepoId)?.name || 'selected'
          }** codebase.`,
        timestamp: new Date()
      }
    ]);
  };

  const handleNewConversation = () => {
    handleClear();
  };

  const selectedRepo = repositories.find(r => r.id === selectedRepoId);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-5xl mx-auto space-y-4">
      {/* Top Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-zinc-550 hover:text-gold transition-colors select-none mr-2">
            <ArrowLeft size={13} /> Dashboard
          </Link>
          <h1 className="text-xl font-serif-display font-medium text-ivory tracking-tight flex items-center gap-2">
            <MessageSquare className="text-gold" size={20} /> Helix Chat
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Mode Switcher */}
          <div className="flex items-center border border-zinc-900 rounded bg-zinc-950/40 p-0.5">
            <button
              onClick={() => setMode('explain')}
              className={`px-3 py-1 text-[10.5px] font-sans-ui rounded transition-all cursor-pointer ${mode === 'explain'
                ? 'bg-gold/10 text-gold font-semibold border border-gold/15'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                }`}
            >
              Explain
            </button>
            <button
              onClick={() => setMode('analyze')}
              className={`px-3 py-1 text-[10.5px] font-sans-ui rounded transition-all cursor-pointer ${mode === 'analyze'
                ? 'bg-gold/10 text-gold font-semibold border border-gold/15'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                }`}
            >
              Deep Analysis
            </button>
          </div>

          <span className="text-xs text-zinc-550 font-mono">Repository:</span>
          <select
            value={selectedRepoId}
            onChange={(e) => setSelectedRepoId(e.target.value)}
            disabled={loadingRepos || loading}
            className="bg-zinc-950 border border-zinc-900 rounded px-2.5 py-1.5 text-xs text-zinc-350 focus:outline-none focus:border-gold transition-colors font-mono max-w-[200px]"
          >
            {loadingRepos && <option value="">Loading repos...</option>}
            {!loadingRepos && repositories.length === 0 && <option value="">No analyzed repos</option>}
            {repositories.map(repo => (
              <option key={repo.id} value={repo.id}>{repo.name}</option>
            ))}
          </select>

          {/* Action Buttons */}
          <button
            onClick={handleClear}
            disabled={loading || !selectedRepoId}
            className="px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-850 hover:border-red-500/20 hover:text-red-400 text-[10px] text-zinc-450 hover:bg-red-500/5 transition-all font-mono flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Clear Chat History"
          >
            <Trash2 size={11} /> Clear
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/5 border border-red-500/15 rounded px-3 py-2 font-mono shrink-0">
          {error}
        </div>
      )}

      {/* Messages Pane */}
      <div className="flex-1 bg-zinc-950/20 border border-zinc-900 rounded-lg overflow-hidden flex flex-col min-h-0">
        {activeRepo?.status === 'UPDATES_AVAILABLE' && (
          <div className="bg-gold/10 border-b border-gold/20 px-4 py-2.5 flex items-center justify-between text-xs text-gold">
            <div className="flex items-center gap-2">
              <ShieldAlert size={14} className="animate-pulse flex-shrink-0" />
              <span>This repository has newer commits available. Updating the repository will regenerate Code Atlas and improve response accuracy.</span>
            </div>
            <button
              onClick={() => handleUpdateRepo(activeRepo.id)}
              className="px-2.5 py-1 rounded bg-gold/10 hover:bg-gold/20 text-gold text-[10px] font-mono border border-gold/30 hover:border-gold transition-all flex-shrink-0 cursor-pointer"
            >
              Update Now
            </button>
          </div>
        )}
        {activeRepo?.status === 'SYNCING' && (
          <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-2.5 flex items-center gap-2 text-xs text-blue-400">
            <RefreshCw size={14} className="animate-spin flex-shrink-0" />
            <span>Updating repository... Fetching changes from GitHub and rebuilding codebase blueprints.</span>
          </div>
        )}
        {activeRepo?.status === 'ANALYZING' && (
          <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-2.5 flex items-center gap-2 text-xs text-blue-400">
            <Brain size={14} className="animate-pulse flex-shrink-0" />
            <span>Analyzing repository... Rebuilding Knowledge Graph, Call Graph and Code Atlas.</span>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-3.5 space-y-2 border transition-all ${msg.sender === 'user'
                  ? 'bg-zinc-900 border-zinc-850 text-ivory'
                  : 'bg-zinc-950/60 border-zinc-900 text-zinc-300'
                  }`}
              >
                {/* Sender Title / Timestamp / Copy */}
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono uppercase tracking-wider ${msg.sender === 'user' ? 'text-zinc-400' : 'text-gold'
                      }`}>
                      {msg.sender === 'user'
                        ? (session?.user?.name || session?.user?.email || 'Developer')
                        : 'Helix'}
                    </span>
                    <span className="text-[8.5px] font-mono text-zinc-600">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.sender === 'assistant' && msg.details && (
                      <span className={`text-[8.5px] font-mono uppercase px-1.5 py-0.5 rounded border ${msg.details.confidence >= 0.7
                        ? 'text-emerald-500 bg-emerald-500/5 border-emerald-500/10'
                        : msg.details.confidence >= 0.3
                          ? 'text-amber-500 bg-amber-500/5 border-amber-500/10'
                          : 'text-rose-500 bg-rose-500/5 border-rose-500/10'
                        }`}>
                        {msg.details.confidence >= 0.7
                          ? 'High Confidence'
                          : msg.details.confidence >= 0.3
                            ? 'Medium Confidence'
                            : 'Low Confidence'}
                      </span>
                    )}
                  </div>
                  {msg.sender === 'assistant' && (
                    <button
                      onClick={() => handleCopy(msg)}
                      className="text-zinc-500 hover:text-gold transition-colors p-1 rounded hover:bg-zinc-900 cursor-pointer flex items-center gap-1 text-[9px] font-mono select-none"
                      title="Copy Helix Response"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <CheckCircle size={10} className="text-emerald-500" />
                          <span className="text-[8px] text-emerald-500 font-semibold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={10} />
                          <span className="text-[8px]">Copy</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Formatted Text */}
                <div className="space-y-1">
                  {formatMarkdown(msg.text)}
                </div>

                {/* Evidence Metrics (Answer Details) */}
                {msg.sender === 'assistant' && msg.details && (
                  <div className="mt-3 pt-3 border-t border-zinc-900/60 space-y-2.5">
                    {/* Metrics Row */}
                    <div className="flex flex-wrap items-center gap-4 text-[9px] font-mono text-zinc-550">
                      <span>Engine: <span className="text-zinc-400 font-semibold">{msg.details.provider}</span></span>
                      <span>Model: <span className="text-zinc-400 font-semibold">{msg.details.model}</span></span>
                      <span>Time: <span className="text-zinc-400 font-semibold">{msg.details.response_time_ms}ms</span></span>
                    </div>

                    {/* Referenced Items Lists with Deep Links */}
                    {(msg.details.referenced_files.length > 0 ||
                      msg.details.referenced_components.length > 0 ||
                      msg.details.referenced_flows.length > 0 ||
                      msg.text.toLowerCase().includes('onboarding') ||
                      msg.text.toLowerCase().includes('get started') ||
                      msg.text.toLowerCase().includes('setup') ||
                      msg.text.toLowerCase().includes('install')) && (
                        <div className="space-y-1.5 bg-black/30 rounded p-2.5 border border-zinc-900/30">
                          {/* Files */}
                          {msg.details.referenced_files.length > 0 && (
                            <div className="flex items-start gap-1.5">
                              <span className="text-[8.5px] font-mono uppercase tracking-wider text-zinc-550 shrink-0 mt-0.5">Files:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {msg.details.referenced_files.map((file, fidx) => (
                                  <Link
                                    key={fidx}
                                    href={`/memory?repo=${selectedRepoId}&search=${encodeURIComponent(file)}`}
                                    className="text-[9px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-850 hover:border-gold hover:text-gold px-1.5 py-0.5 rounded break-all transition-colors inline-flex items-center gap-1 cursor-pointer"
                                    title="Open in Code Atlas"
                                  >
                                    {file} <span className="text-[7.5px] text-zinc-600 font-sans">→ Code Atlas</span>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Components */}
                          {msg.details.referenced_components.length > 0 && (
                            <div className="flex items-start gap-1.5">
                              <span className="text-[8.5px] font-mono uppercase tracking-wider text-zinc-550 shrink-0 mt-0.5">Components:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {msg.details.referenced_components.map((comp, cidx) => (
                                  <Link
                                    key={cidx}
                                    href={`/repositories/${selectedRepoId}?tab=architecture`}
                                    className="text-[9px] font-mono text-teal-400 bg-teal-500/5 border border-teal-500/10 hover:border-gold hover:text-gold px-1.5 py-0.5 rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
                                    title="Open in Architecture Intelligence"
                                  >
                                    {comp} <span className="text-[7.5px] text-teal-600/70 font-sans">→ Architecture</span>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Flows */}
                          {msg.details.referenced_flows.length > 0 && (
                            <div className="flex items-start gap-1.5">
                              <span className="text-[8.5px] font-mono uppercase tracking-wider text-zinc-550 shrink-0 mt-0.5">Flows:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {msg.details.referenced_flows.map((flow, flidx) => (
                                  <Link
                                    key={flidx}
                                    href={`/repositories/${selectedRepoId}?tab=flows`}
                                    className="text-[9px] font-mono text-purple-400 bg-purple-500/5 border border-purple-500/10 hover:border-gold hover:text-gold px-1.5 py-0.5 rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
                                    title="Open in Execution Flows"
                                  >
                                    {flow} <span className="text-[7.5px] text-purple-600/70 font-sans">→ Flows</span>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Onboarding Section Deep Link */}
                          {(msg.text.toLowerCase().includes('onboarding') ||
                            msg.text.toLowerCase().includes('get started') ||
                            msg.text.toLowerCase().includes('setup') ||
                            msg.text.toLowerCase().includes('install')) && (
                              <div className="flex items-start gap-1.5">
                                <span className="text-[8.5px] font-mono uppercase tracking-wider text-zinc-550 shrink-0 mt-0.5">Onboarding:</span>
                                <div className="flex flex-wrap gap-1.5">
                                  <Link
                                    href={`/onboarding?repo=${selectedRepoId}`}
                                    className="text-[9px] font-mono text-gold bg-gold/5 border border-gold/10 hover:border-gold hover:bg-gold/10 px-1.5 py-0.5 rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
                                    title="Open in Developer Onboarding"
                                  >
                                    Onboarding Section <span className="text-[7.5px] text-gold/60 font-sans">→ Developer Onboarding</span>
                                  </Link>
                                </div>
                              </div>
                            )}
                        </div>
                      )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Thinking / Loading Spinner */}
          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-lg px-4 py-3.5 bg-zinc-950/60 border border-zinc-900 space-y-2 flex items-center gap-3">
                <Hourglass className="animate-spin text-gold" size={14} />
                <span className="text-xs text-zinc-500 font-mono animate-pulse">
                  {mode === 'analyze' ? 'Running deep architectural analysis...' : 'Assembling context & retrieving answer...(may take a minute)'}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Related Questions - Follow-up Suggestions */}
      {messages.length > 0 && messages[messages.length - 1]?.sender === 'assistant' && !loading && (
        <div className="flex flex-wrap gap-2 shrink-0 justify-start items-center text-[10px] text-zinc-500 font-sans-ui select-none px-1">
          <span className="self-center font-semibold text-zinc-600 font-mono uppercase tracking-wider mr-1 flex items-center gap-1">
            <Sparkles size={10} className="text-gold" /> Follow-up:
          </span>
          {[
            'Where is this implemented?',
            'Show the execution flow.',
            'Which files should be modified?',
            'What dependencies are involved?',
            'Explain the architecture behind this feature.'
          ].map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(undefined, q)}
              className="px-2.5 py-1.5 rounded bg-zinc-950 border border-zinc-900 hover:border-zinc-800 text-zinc-450 hover:text-gold transition-colors cursor-pointer text-[10.5px]"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input Pane */}
      <form onSubmit={(e) => handleSend(e)} className="shrink-0 flex gap-3">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={loading || !selectedRepoId}
          placeholder={
            !selectedRepoId
              ? 'Select a repository to start chat...'
              : `Ask about '${selectedRepo?.name}'... (e.g. How does authentication work?)`
          }
          className="flex-1 bg-zinc-950 border border-zinc-900 rounded-lg px-4 py-3 text-xs text-ivory placeholder:text-zinc-650 focus:outline-none focus:border-gold/50 transition-colors font-sans-ui"
        />
        <button
          type="submit"
          disabled={loading || !selectedRepoId || !inputText.trim()}
          className="px-4 py-3 rounded-lg bg-gold/10 border border-gold/20 hover:bg-gold/15 text-gold font-semibold transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Send size={13} />
          <span className="text-xs">Ask</span>
        </button>
      </form>

      {/* Helper Prompt Quick suggestions (Initial View Only) */}
      {messages.length <= 1 && selectedRepoId && (
        <div className="flex flex-wrap gap-2 shrink-0 justify-center text-[10px] text-zinc-500 font-sans-ui select-none pb-2">
          <span className="self-center font-semibold text-zinc-600 font-mono uppercase tracking-wider mr-1">Suggested Queries:</span>
          {[
            'How does authentication work?',
            'What accesses the database?',
            'How are execution flows discovered?',
            'Explain the repository layout.'
          ].map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(undefined, q)}
              className="px-2.5 py-1.5 rounded bg-zinc-950 border border-zinc-900 hover:border-zinc-800 text-zinc-450 hover:text-gold transition-colors cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Usage/Resource Limit Dialog */}
      <HelixResourceDialog
        isOpen={limitDialogOpen}
        onClose={() => setLimitDialogOpen(false)}
        title="Helix Usage Dialog"
        detail={limitDetail}
      />

      {/* Code Atlas Index Warning Dialog */}
      {atlasDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setAtlasDialogOpen(false)}
          />

          {/* Dialog Card */}
          <div className="relative bg-zinc-950 border border-zinc-900 rounded-lg max-w-md w-full shadow-2xl overflow-hidden flex flex-col transform transition-all duration-300 z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 flex flex-col space-y-4">
              <div className="flex items-center gap-2 text-gold">
                <Brain size={20} className="text-gold" />
                <span className="text-[10px] font-mono uppercase tracking-widest">Helix Protocol</span>
              </div>

              <div className="space-y-2">
                <h2 className="text-base font-serif-display font-medium text-ivory tracking-tight">
                  Code Atlas Index Required
                </h2>
                <p className="text-xs text-zinc-450 leading-relaxed font-sans-ui">
                  This repository has not been indexed in Code Atlas yet. To use Helix Chat, you must generate its memory snapshot first.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  onClick={() => setAtlasDialogOpen(false)}
                  className="px-4 py-2 rounded bg-zinc-900 border border-zinc-800 text-[10.5px] font-mono text-zinc-400 hover:border-zinc-700 hover:text-zinc-300 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setAtlasDialogOpen(false);
                    router.push(`/memory?repo=${selectedRepoId}`);
                  }}
                  className="px-4 py-2 rounded bg-gold text-[10.5px] font-mono text-black font-semibold hover:bg-gold-hover transition-all cursor-pointer"
                >
                  Go to Code Atlas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Markdown Parser Helpers ───────────────────────────────────────────────────

function formatMarkdown(text: string) {
  if (!text) return null;

  // Clean markdown by separating code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const lines = part.slice(3, -3).trim().split('\n');
      let lang = '';
      let code = lines.join('\n');
      if (lines.length > 0 && /^[a-zA-Z0-9_\-+]+$/.test(lines[0])) {
        lang = lines[0];
        code = lines.slice(1).join('\n');
      }
      return (
        <pre key={idx} className="bg-zinc-950 border border-zinc-900 rounded p-3 my-2.5 text-[10.5px] font-mono overflow-x-auto text-zinc-300 max-w-full leading-normal">
          {lang && <div className="text-[8px] uppercase tracking-wider text-zinc-550 mb-1.5 font-sans font-bold select-none">{lang}</div>}
          <code>{code}</code>
        </pre>
      );
    }

    // Normal paragraph parsing line-by-line
    const lines = part.split('\n');
    return (
      <div key={idx} className="space-y-1">
        {lines.map((line, lIdx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={lIdx} className="h-1.5" />;

          // Check for bullet list
          if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            return (
              <div key={lIdx} className="flex items-start gap-2 ml-3 my-1">
                <span className="text-gold text-xs mt-0.5">•</span>
                <span className="text-xs text-zinc-350 leading-relaxed">{formatInlineStyles(trimmed.slice(2))}</span>
              </div>
            );
          }

          // Check for numbered list
          const olMatch = trimmed.match(/^(\d+)\.\s(.*)$/);
          if (olMatch) {
            return (
              <div key={lIdx} className="flex items-start gap-2 ml-3 my-1">
                <span className="text-gold font-mono text-[10.5px] font-semibold mt-0.5">{olMatch[1]}.</span>
                <span className="text-xs text-zinc-350 leading-relaxed">{formatInlineStyles(olMatch[2])}</span>
              </div>
            );
          }

          // Check for headers
          if (trimmed.startsWith('### ')) {
            return <h4 key={lIdx} className="text-xs font-bold text-ivory font-mono uppercase tracking-wider mt-3 mb-1.5">{formatInlineStyles(trimmed.slice(4))}</h4>;
          }
          if (trimmed.startsWith('## ')) {
            return <h3 key={lIdx} className="text-sm font-semibold text-ivory mt-4 mb-2">{formatInlineStyles(trimmed.slice(3))}</h3>;
          }
          if (trimmed.startsWith('# ')) {
            return <h2 key={lIdx} className="text-base font-bold text-ivory mt-4 mb-2">{formatInlineStyles(trimmed.slice(2))}</h2>;
          }

          // Normal line
          return (
            <p key={lIdx} className="text-xs text-zinc-350 leading-relaxed">
              {formatInlineStyles(line)}
            </p>
          );
        })}
      </div>
    );
  });
}

function formatInlineStyles(text: string) {
  // Split on bold (**text**) and code (`code`) patterns
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx} className="font-semibold text-ivory">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={idx} className="bg-zinc-900 border border-zinc-850 px-1 rounded text-[10px] font-mono text-zinc-350 select-all">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}
