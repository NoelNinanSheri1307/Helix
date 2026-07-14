"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Mail } from 'lucide-react';

const LinkedInIcon = ({ size = 16, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

interface DemoNoticeContextType {
  showDemoNotice: () => void;
}

const DemoNoticeContext = createContext<DemoNoticeContextType | undefined>(undefined);

export const DemoNoticeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const showDemoNotice = () => setIsOpen(true);
  const closeNotice = () => setIsOpen(false);

  // Hook into the global window.fetch to capture network failures or 5xx backend errors
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        // Intercept standard gateway timeouts/server crashes (500, 502, 503, 504)
        if ([500, 502, 503, 504].includes(response.status)) {
          const urlStr = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
          // Verify request is to our repository backend service routes
          if (
            urlStr.includes('/repository/') || 
            urlStr.includes('/repositories/') || 
            urlStr.includes('/chat') || 
            urlStr.includes('/users/')
          ) {
            showDemoNotice();
          }
        }
        return response;
      } catch (error: any) {
        // Intercept offline connection exceptions / timeouts
        const isNetworkError = 
          error instanceof TypeError || 
          error.message?.includes('Failed to fetch') || 
          error.message?.includes('NetworkError') || 
          error.message?.includes('timeout') ||
          error.message?.includes('network');

        if (isNetworkError) {
          const urlStr = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
          if (
            urlStr.includes('/repository/') || 
            urlStr.includes('/repositories/') || 
            urlStr.includes('/chat') || 
            urlStr.includes('/users/')
          ) {
            showDemoNotice();
          }
        }
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <DemoNoticeContext.Provider value={{ showDemoNotice }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden shadow-2xl flex flex-col md:flex-row min-h-[380px] transition-all transform scale-100 duration-300">
            
            {/* Left Side: Mascot Brand */}
            <div className="md:w-1/3 bg-zinc-900/40 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-zinc-900 text-center">
              <img 
                src="/assets/helixkoala.png" 
                alt="Helix Mascot" 
                className="w-24 h-24 rounded-full border border-zinc-800 object-cover mb-4 animate-float"
              />
              <h2 className="font-serif-display text-lg text-gold font-semibold tracking-tight">HELIX</h2>
              <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mt-1">Demo Version</span>
            </div>

            {/* Right Side: Message details */}
            <div className="md:w-2/3 p-8 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-serif-display font-medium text-ivory mb-4">Demo Environment Notice</h3>
                <div className="space-y-4 text-xs text-zinc-350 leading-relaxed font-sans">
                  <p>
                    Helix is currently hosted on free-tier cloud infrastructure for demonstration purposes. Large repositories or deep analyses may occasionally take longer to process or be interrupted due to temporary resource limits. These limitations are specific to the demo environment and not to Helix itself.
                  </p>
                  <p>
                    For an unrestricted demonstration or production deployment, please contact the creator, Noel Ninan Sheri.
                  </p>
                </div>
              </div>

              {/* Contact section & Close actions */}
              <div className="mt-8 flex flex-col gap-4">
                <div className="flex flex-wrap gap-2.5 items-center">
                  <a
                    href="https://www.linkedin.com/in/noel-ninan-sheri/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 rounded border border-zinc-900 hover:border-zinc-850 hover:bg-zinc-900/50 text-[11px] text-zinc-400 hover:text-gold transition-all"
                  >
                    <LinkedInIcon size={13} className="text-zinc-500" />
                    <span>LinkedIn</span>
                  </a>
                  <a
                    href="mailto:noelninansheri@gmail.com"
                    className="flex items-center gap-2 px-3 py-1.5 rounded border border-zinc-900 hover:border-zinc-850 hover:bg-zinc-900/50 text-[11px] text-zinc-400 hover:text-gold transition-all"
                  >
                    <Mail size={13} className="text-zinc-500" />
                    <span>Email: noelninansheri@gmail.com</span>
                  </a>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={closeNotice}
                    className="px-4 py-2 rounded text-xs font-mono border border-zinc-900 hover:border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-ivory transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
            
            {/* Close Cross icon */}
            <button 
              onClick={closeNotice}
              className="absolute top-4 right-4 text-zinc-500 hover:text-ivory transition-colors cursor-pointer text-xs"
              title="Close modal"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </DemoNoticeContext.Provider>
  );
};

export const useDemoNotice = () => {
  const context = useContext(DemoNoticeContext);
  if (!context) {
    throw new Error('useDemoNotice must be used within a DemoNoticeProvider');
  }
  return context;
};
