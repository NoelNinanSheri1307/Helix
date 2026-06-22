"use client";

import React, { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Search, ChevronDown, User, LogOut, Settings, Menu } from 'lucide-react';
import { useSession, signOut } from "next-auth/react";
import { useSidebar } from '../context/SidebarContext';

export const TopBar: React.FC = () => {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { setMobileOpen } = useSidebar();

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format breadcrumbs from pathname
  const getBreadcrumbs = () => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return 'Home';
    return parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' / ');
  };

  return (
    <header className="h-16 bg-black border-b border-zinc-900 px-4 md:px-8 flex items-center justify-between z-10 sticky top-0">
      {/* Breadcrumbs / Page Title */}
      <div className="flex items-center gap-3 text-sm">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded border border-zinc-900 text-zinc-550 hover:text-ivory hover:bg-zinc-900/50 md:hidden cursor-pointer flex items-center justify-center transition-colors outline-none"
          title="Open Menu"
        >
          <Menu size={16} />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 hidden sm:inline">Workspace</span>
          <span className="text-zinc-755 hidden sm:inline">/</span>
          <span className="font-serif-display font-medium text-ivory tracking-tight truncate max-w-[140px] sm:max-w-none">{getBreadcrumbs()}</span>
        </div>
      </div>

      {/* Global Actions */}
      <div className="flex items-center gap-6">
        {/* Mock Search Bar */}
        <div className="relative w-64 max-md:hidden">
          <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-550">
            <Search size={15} />
          </span>
          <input
            type="text"
            placeholder="Search repositories..."
            className="w-full bg-zinc-950 border border-zinc-900 rounded-md py-1.5 pl-10 pr-4 text-xs text-ivory placeholder-zinc-500 focus:outline-none focus:border-zinc-800 transition-colors"
          />
        </div>

        {/* User Dropdown */}
        {user && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 hover:bg-zinc-950 p-1.5 rounded-md transition-colors border border-transparent hover:border-zinc-900"
            >
              {user.image && !imgError ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={user.image}
                  alt={user.name || "User Avatar"}
                  className="w-6 h-6 rounded-full border border-zinc-800"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-300">
                  {(user.name || "U").charAt(0)}
                </div>
              )}
              <ChevronDown size={14} className={`text-zinc-500 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-md bg-zinc-950 border border-zinc-850 shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-4 py-2 border-b border-zinc-900">
                  <p className="text-xs text-zinc-500">Signed in as</p>
                  <p className="text-sm font-medium text-ivory truncate">{user.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      signOut({ callbackUrl: "/" });
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-zinc-900 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <LogOut size={13} />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
