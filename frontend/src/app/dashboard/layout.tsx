"use client";

import React from "react";
import { useUserSync } from "@/hooks/useUserSync";
import { Sidebar } from "../../components/Sidebar";
import { TopBar } from "../../components/TopBar";
import AuthGuard from "../../components/AuthGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useUserSync();

  return (
    <AuthGuard>
      <div className="min-h-screen bg-black flex text-ivory">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />

          <main className="flex-1 overflow-y-auto bg-black p-8">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}