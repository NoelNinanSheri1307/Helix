"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FolderGit, GraduationCap, Layers, Workflow,
  Settings, LogOut, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, GitBranch, Brain,
  MessageSquare, Wrench
} from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { useSidebar } from '../context/SidebarContext';
import { getRepositories } from '../lib/api';
import { Repository } from '../types';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;
  const [imgError, setImgError] = useState(false);
  const { isMobileOpen, setMobileOpen, isCollapsed, setCollapsed } = useSidebar();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [reposExpanded, setReposExpanded] = useState(true);
  const [aboutOpen, setAboutOpen] = useState(false);

  // Fetch repositories list on mount or email change
  useEffect(() => {
    if (user?.email) {
      getRepositories(user.email)
        .then(list => {
          setRepositories(list);
        })
        .catch(err => {
          console.error("Failed to load sidebar repositories", err);
        });
    }
  }, [user?.email]);

  const navItems = [
    {
      name: "Overview",
      href: "/dashboard",
      icon: LayoutDashboard
    },
    {
      name: "Repositories",
      href: "/repositories",
      icon: FolderGit,
      isRepos: true
    },
    {
      name: "Developer Onboarding",
      href: "/onboarding",
      icon: GraduationCap
    },
    {
      name: "Architecture Intelligence",
      href: "/architecture",
      icon: Layers
    },
    {
      name: "Execution Flows",
      href: "/flows",
      icon: Workflow
    },
    {
      name: "Code Atlas",
      href: "/memory",
      icon: Brain,
      devTag: true
    },
    {
      name: "Helix Chat",
      href: "/chat",
      icon: MessageSquare
    },
    {
      name: "Settings",
      href: "/settings",
      icon: Settings,
      disabled: true
    }
  ];

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`bg-black border-r border-zinc-900 flex flex-col h-screen transition-all duration-300 z-50
          fixed inset-y-0 left-0 transform ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:sticky md:top-0 md:translate-x-0
          ${isCollapsed ? 'w-64 md:w-16' : 'w-64 md:w-16 lg:w-64'}`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center px-4 md:px-3 lg:px-6 border-b border-zinc-900 justify-between">
          <Link href="/" className="flex items-center gap-2 overflow-hidden select-none">
            <img
              src="/assets/logo.png"
              alt="Helix Logo"
              className="h-12 w-auto flex-shrink-0"
            />
            <span className={`font-serif-display font-medium text-ivory tracking-tight text-lg truncate transition-all duration-200
              ${isCollapsed ? 'md:hidden lg:inline' : 'md:hidden lg:inline'}`}
            >
              Helix
            </span>
          </Link>

          {/* Collapse Toggle Button */}
          <button
            onClick={() => setCollapsed(!isCollapsed)}
            className="hidden md:flex items-center justify-center p-1 rounded border border-zinc-900 hover:border-zinc-800 text-zinc-500 hover:text-ivory bg-zinc-950/20 cursor-pointer transition-colors outline-none"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            if (item.disabled) {
              return (
                <div
                  key={item.name}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-650 cursor-not-allowed select-none rounded-md"
                  title="Coming soon"
                >
                  <Icon size={18} className="text-zinc-800 flex-shrink-0" />
                  <span className={`truncate transition-all duration-200 ${isCollapsed ? 'md:hidden lg:inline' : 'md:hidden lg:inline'
                    }`}>
                    {item.name}
                  </span>
                  <span className={`text-[9px] text-zinc-700 ml-auto border border-zinc-900 px-1 rounded transition-all duration-200 ${isCollapsed ? 'md:hidden lg:inline' : 'md:hidden lg:inline'
                    }`}>
                    Soon
                  </span>
                </div>
              );
            }

            return (
              <div key={item.name} className="flex flex-col">
                <div className="flex items-center justify-between w-full">
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)} // Close drawer on link click
                    className={`flex-1 flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${isActive
                      ? 'bg-zinc-950 text-gold border border-gold/10'
                      : 'text-zinc-400 hover:text-ivory hover:bg-zinc-950/50 border border-transparent'
                      }`}
                  >
                    <Icon size={18} className={`flex-shrink-0 ${isActive ? 'text-gold' : 'text-zinc-500'}`} />
                    <span className={`truncate transition-all duration-200 ${isCollapsed ? 'md:hidden lg:inline' : 'md:hidden lg:inline'
                      }`}>
                      {item.name}
                    </span>
                    {(item as any).devTag && (
                      <span className={`text-[8px] text-zinc-700 ml-auto border border-zinc-900 px-1 rounded font-mono uppercase tracking-wider transition-all duration-200 ${isCollapsed ? 'md:hidden lg:inline' : 'md:hidden lg:inline'
                        }`}>
                        Dev
                      </span>
                    )}
                  </Link>

                  {item.isRepos && !isCollapsed && repositories.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setReposExpanded(!reposExpanded)}
                      className="px-2 py-2 text-zinc-550 hover:text-ivory cursor-pointer outline-none transition-colors"
                      title={reposExpanded ? "Collapse Repository List" : "Expand Repository List"}
                    >
                      {reposExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}
                </div>

                {/* Collapsible tree of repositories */}
                {item.isRepos && reposExpanded && !isCollapsed && repositories.length > 0 && (
                  <div className="pl-4 mt-1 border-l border-zinc-900 ml-5 space-y-1">
                    {repositories.map(repo => {
                      const isRepoActive = pathname === `/repositories/${repo.id}`;
                      return (
                        <Link
                          key={repo.id}
                          href={`/repositories/${repo.id}`}
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium rounded transition-all duration-200 truncate ${isRepoActive
                            ? 'text-gold bg-zinc-950 border border-gold/10'
                            : 'text-zinc-500 hover:text-zinc-355 hover:bg-zinc-950/20 border border-transparent'
                            }`}
                        >
                          <GitBranch size={11} className={isRepoActive ? 'text-gold shrink-0' : 'text-zinc-700 shrink-0'} />
                          <span className="truncate">{repo.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="px-3 mb-2 shrink-0">
          <button
            onClick={() => setAboutOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-zinc-400 hover:text-gold hover:bg-zinc-950/50 border border-zinc-900 hover:border-zinc-800 rounded-md transition-all duration-200 cursor-pointer"
          >
            <Wrench size={16} className="text-zinc-500 flex-shrink-0" />
            <span className={`truncate transition-all duration-200 ${isCollapsed ? 'md:hidden lg:inline' : 'md:hidden lg:inline'
              }`}>
              About Creator
            </span>
          </button>
        </div>

        {/* User Section / Logout */}
        {user && (
          <div className="p-3 border-t border-zinc-900">
            <div className="flex items-center gap-3 mb-3 px-2">
              {user.image && !imgError ? (
                <img
                  src={user.image}
                  alt={user.name || "User Avatar"}
                  className="w-8 h-8 rounded-full border border-zinc-800 flex-shrink-0"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs text-zinc-400 flex-shrink-0 font-mono">
                  {(user.name || "U").charAt(0)}
                </div>
              )}
              <div className={`flex-1 min-w-0 transition-all duration-200 ${isCollapsed ? 'md:hidden lg:block' : 'md:hidden lg:block'
                }`}>
                <p className="text-sm font-medium text-ivory truncate">{user.name}</p>
                <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
              </div>
            </div>

            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-zinc-400 hover:text-red-400 hover:bg-zinc-950/50 border border-zinc-900 hover:border-red-950/20 rounded transition-all duration-200 cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={14} className="flex-shrink-0" />
              <span className={`truncate transition-all duration-200 ${isCollapsed ? 'md:hidden lg:inline' : 'md:hidden lg:inline'
                }`}>
                Sign Out
              </span>
            </button>
          </div>
        )}
      </aside>

      {aboutOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-3xl bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden shadow-2xl flex flex-col md:flex-row min-h-[420px]">

            {/* Left Side: Helix Panda Logo / Brand */}
            <div className="md:w-2/5 bg-zinc-900/40 p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-zinc-900 text-center">
              <img
                src="/assets/helixkoala.png"
                alt="Helix Koala Logo"
                className="w-28 h-28 rounded-full border border-zinc-800 object-cover mb-5 animate-float"
              />
              <h2 className="font-serif-display text-xl text-gold tracking-tight font-semibold">HELIX</h2>
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mt-1">Repository Intelligence</p>
            </div>

            {/* Right Side: Noel's Image & Creator POV info */}
            <div className="md:w-3/5 p-8 flex flex-col justify-between">
              <div>
                {/* Header Profile */}
                <div className="flex items-center gap-4 mb-6">
                  <img
                    src="/assets/noel.jpg"
                    alt="Noel Ninan Sheri"
                    className="w-16 h-16 rounded-full border border-gold/30 object-cover shadow-lg"
                  />
                  <div>
                    <h3 className="text-base font-serif-display font-medium text-ivory">Noel Ninan Sheri</h3>
                    <p className="text-[10px] text-zinc-500 font-mono-ui uppercase tracking-wider">Creator & Architect of Helix</p>
                  </div>
                </div>

                {/* Perspective from Helix's POV */}
                <div className="space-y-4">
                  <p className="text-xs text-zinc-300 leading-relaxed font-sans">"
                    <span className="text-gold font-semibold italic">Helix:  </span>
                    I was designed and built by Noel to serve as an autonomous repository intelligence engine.
                    Unlike traditional developer utilities, my goal is to help developers understand new and unfamiliar codebases, by parsing AST trees, tracing execution flows, and building structural call graphs to construct a complete, visual Code Atlas."
                  </p>
                  <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                    Noel: "My purpose through Helix is to eliminate the cognitive burden of software engineering. Helix was built so that developers can onboard instantly, understand complex architectures, and query their codebase with absolute, verified accuracy. I aim to turn code comprehension from a time-consuming manual trace into an instant, intelligent, and interactive experience."
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setAboutOpen(false)}
                  className="px-4 py-2 rounded text-xs font-mono border border-zinc-900 hover:border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-ivory transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Close Icon Top-Right */}
            <button
              onClick={() => setAboutOpen(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-ivory transition-colors cursor-pointer text-xs"
              title="Close modal"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
};
