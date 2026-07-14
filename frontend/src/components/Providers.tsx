"use client";

import { SessionProvider } from "next-auth/react";
import { SidebarProvider } from "../context/SidebarContext";
import { DemoNoticeProvider } from "../context/DemoNoticeContext";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <SidebarProvider>
        <DemoNoticeProvider>
          {children}
        </DemoNoticeProvider>
      </SidebarProvider>
    </SessionProvider>
  );
}