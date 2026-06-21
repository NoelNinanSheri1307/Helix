"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderGit, BookOpen, Settings, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { useSidebar } from '../context/SidebarContext';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;
  const [imgError, setImgError] = useState(false);
  const { isMobileOpen, setMobileOpen, isCollapsed, setCollapsed } = useSidebar();

  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard
    },
    {
      name: "Repositories",
      href: "/repositories",
      icon: FolderGit
    },
    {
      name: "Documentation",
      href: "#documentation",
      icon: BookOpen,
      disabled: true
    },
    {
      name: "Settings",
      href: "#settings",
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
          
          {/* Collapse Toggle Button (visible only on desktop/tablet) */}
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
                  <span className={`truncate transition-all duration-200 ${
                    isCollapsed ? 'md:hidden lg:inline' : 'md:hidden lg:inline'
                  }`}>
                    {item.name}
                  </span>
                  <span className={`text-[9px] text-zinc-700 ml-auto border border-zinc-900 px-1 rounded transition-all duration-200 ${
                    isCollapsed ? 'md:hidden lg:inline' : 'md:hidden lg:inline'
                  }`}>
                    Soon
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)} // Close drawer on link click
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${isActive
                  ? 'bg-zinc-950 text-gold border border-gold/10'
                  : 'text-zinc-400 hover:text-ivory hover:bg-zinc-950/50 border border-transparent'
                  }`}
              >
                <Icon size={18} className={`flex-shrink-0 ${isActive ? 'text-gold' : 'text-zinc-500'}`} />
                <span className={`truncate transition-all duration-200 ${
                  isCollapsed ? 'md:hidden lg:inline' : 'md:hidden lg:inline'
                }`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

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
              <div className={`flex-1 min-w-0 transition-all duration-200 ${
                isCollapsed ? 'md:hidden lg:block' : 'md:hidden lg:block'
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
              <span className={`truncate transition-all duration-200 ${
                isCollapsed ? 'md:hidden lg:inline' : 'md:hidden lg:inline'
              }`}>
                Sign Out
              </span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
};
