import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import { AppProvider } from "../context/AppContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Helix - Repository Intelligence & Developer Onboarding",
  description: "Understand any codebase in minutes. Premium codebase blueprints, dependency structures, and onboarding guidance.",
  keywords: ["codebase", "repository intelligence", "developer onboarding", "code architecture", "dependency intelligence"],
  authors: [{ name: "Helix Dev Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-black text-ivory animate-page-fade" suppressHydrationWarning>
        <Providers>
          <AppProvider>
            {children}
          </AppProvider>
        </Providers>
      </body>
    </html>
  );
}
