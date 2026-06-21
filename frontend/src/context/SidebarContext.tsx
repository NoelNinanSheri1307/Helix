"use client";

import React, { createContext, useContext, useState } from 'react';

interface SidebarContextType {
  isMobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  isCollapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ isMobileOpen, setMobileOpen, isCollapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};
