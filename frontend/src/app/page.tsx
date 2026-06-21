"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Code, Database, Compass, ArrowUpRight } from 'lucide-react';

export default function LandingPage() {
  // Intersection Observer and Smooth Scrolling
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('opacity-100', 'translate-y-0');
          entry.target.classList.remove('opacity-0', 'translate-y-8');
          // Unobserve once revealed
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.02 // trigger as soon as 2% of the element is visible
    });

    const elements = document.querySelectorAll('.scroll-reveal');
    elements.forEach((el) => {
      // Check if the element is already inside the viewport on load
      const rect = el.getBoundingClientRect();
      const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;

      // If it's not visible yet, hide it programmatically to prepare for the fade-in
      if (!isInViewport) {
        el.classList.add('opacity-0', 'translate-y-8');
      }
      observer.observe(el);
    });

    // Smooth scroll handler for anchor links
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.currentTarget as HTMLAnchorElement;
      const href = target.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const id = href.substring(1);
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
          // Update URL hash without jump
          if (window.history.pushState) {
            window.history.pushState(null, '', href);
          } else {
            window.location.hash = href;
          }
        }
      }
    };

    const links = document.querySelectorAll('a[href^="#"]');
    links.forEach((link) => {
      link.addEventListener('click', handleAnchorClick as EventListener);
    });

    return () => {
      observer.disconnect();
      links.forEach((link) => {
        link.removeEventListener('click', handleAnchorClick as EventListener);
      });
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-ivory flex flex-col font-sans select-none selection:bg-gold/20 selection:text-gold">

      {/* Header */}
      <header className="h-20 border-b border-zinc-900 px-8 lg:px-16 flex items-center justify-between z-10 bg-black/50 backdrop-blur-md sticky top-0">
        <Link href="/" className="flex items-center gap-2" id="lnk-header-logo">
          <img src="/assets/logo.png" alt="Helix Logo" className="h-16 w-auto" />
        </Link>

        <nav className="flex items-center gap-8 text-sm text-silverish">
          <a href="#features" className="hover:text-gold transition-colors duration-300">Features</a>
          <a href="#workflow" className="hover:text-gold transition-colors duration-300">Workflow</a>
          <Link
            href="/login"
            className="px-4 py-2 border border-zinc-800 hover:border-gold hover:shadow-[0_0_12px_rgba(223,181,59,0.35)] rounded bg-zinc-950 text-ivory transition-all duration-300 text-xs font-medium"
            id="btn-header-login"
          >
            Sign In
          </Link>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">

        {/* Subtle Git-Branching Background Network (spans the entire landing page) */}
        <div className="absolute inset-0 w-full h-full pointer-events-none opacity-85 z-0">
          <svg
            className="w-full h-full"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1200 3200"
            preserveAspectRatio="xMidYMin slice"
          >
            {/* Main Trunk Group */}
            <g className="drift-trunk-grp">
              <path
                d="M 600,0 C 600,200 600,250 600,300 C 600,500 450,550 450,700 C 450,900 750,950 750,1100 C 750,1350 500,1400 500,1600 C 500,1850 700,1900 700,2100 C 700,2400 600,2500 600,2700 L 600,3200"
                fill="none"
                stroke="#dfb53b"
                strokeOpacity="0.45"
                strokeWidth="3.5"
              />

              {/* Commit Nodes along Trunk */}
              <circle cx="600" cy="150" r="7" fill="#dfb53b" opacity="1.0" />
              <circle cx="600" cy="150" r="15" fill="#dfb53b" opacity="0.4" />

              <circle cx="450" cy="700" r="7" fill="#dfb53b" opacity="1.0" />
              <circle cx="450" cy="700" r="15" fill="#dfb53b" opacity="0.4" />

              <circle cx="750" cy="1100" r="7" fill="#dfb53b" opacity="1.0" />
              <circle cx="750" cy="1100" r="15" fill="#dfb53b" opacity="0.4" />

              <circle cx="500" cy="1600" r="7" fill="#dfb53b" opacity="1.0" />
              <circle cx="500" cy="1600" r="15" fill="#dfb53b" opacity="0.4" />

              <circle cx="700" cy="2100" r="7" fill="#dfb53b" opacity="1.0" />
              <circle cx="700" cy="2100" r="15" fill="#dfb53b" opacity="0.4" />

              <circle cx="600" cy="2850" r="7" fill="#dfb53b" opacity="1.0" />
              <circle cx="600" cy="2850" r="15" fill="#dfb53b" opacity="0.4" />
            </g>

            {/* Left Branch Group */}
            <g className="drift-l-grp">
              <path
                d="M 600,300 C 500,300 250,450 250,600 C 250,900 250,950 250,1200 C 250,1400 650,1450 750,1500"
                fill="none"
                stroke="#dfb53b"
                strokeOpacity="0.45"
                strokeWidth="2.2"
                strokeDasharray="6,8"
                className="animate-flow-dash"
              />

              {/* Commit Nodes along Left Branch */}
              <circle cx="250" cy="500" r="5.5" fill="#dfb53b" opacity="1.0" />
              <circle cx="250" cy="500" r="12" fill="#dfb53b" opacity="0.4" />

              <circle cx="250" cy="850" r="5.5" fill="#dfb53b" opacity="1.0" />
              <circle cx="250" cy="850" r="12" fill="#dfb53b" opacity="0.4" />

              <circle cx="250" cy="1100" r="5.5" fill="#dfb53b" opacity="1.0" />
              <circle cx="250" cy="1100" r="12" fill="#dfb53b" opacity="0.4" />
            </g>

            {/* Right Branch Group */}
            <g className="drift-r-grp">
              <path
                d="M 750,1100 C 850,1100 950,1250 950,1400 C 950,1700 950,1750 950,2000 C 950,2250 800,2350 700,2400"
                fill="none"
                stroke="#dfb53b"
                strokeOpacity="0.45"
                strokeWidth="2.2"
              />

              {/* Commit Nodes along Right Branch */}
              <circle cx="950" cy="1300" r="5.5" fill="#dfb53b" opacity="1.0" />
              <circle cx="950" cy="1300" r="12" fill="#dfb53b" opacity="0.4" />

              <circle cx="950" cy="1650" r="5.5" fill="#dfb53b" opacity="1.0" />
              <circle cx="950" cy="1650" r="12" fill="#dfb53b" opacity="0.4" />

              <circle cx="950" cy="1900" r="5.5" fill="#dfb53b" opacity="1.0" />
              <circle cx="950" cy="1900" r="12" fill="#dfb53b" opacity="0.4" />
            </g>

            {/* Workflow Branch Group */}
            <g className="drift-l-grp" style={{ animationDelay: '-4s' }}>
              <path
                d="M 500,1600 C 400,1600 300,1750 300,1900 C 300,2150 300,2200 300,2400 C 300,2550 500,2650 600,2700"
                fill="none"
                stroke="#dfb53b"
                strokeOpacity="0.45"
                strokeWidth="2.2"
                strokeDasharray="4,6"
              />

              {/* Commit Nodes along Workflow Branch */}
              <circle cx="300" cy="1800" r="5.5" fill="#dfb53b" opacity="1.0" />
              <circle cx="300" cy="1800" r="12" fill="#dfb53b" opacity="0.4" />

              <circle cx="300" cy="2050" r="5.5" fill="#dfb53b" opacity="1.0" />
              <circle cx="300" cy="2050" r="12" fill="#dfb53b" opacity="0.4" />

              <circle cx="300" cy="2300" r="5.5" fill="#dfb53b" opacity="1.0" />
              <circle cx="300" cy="2300" r="12" fill="#dfb53b" opacity="0.4" />
            </g>

            <style>{`
              @keyframes drift-trunk {
                0%, 100% { transform: translate(0, 0); }
                50% { transform: translate(15px, -20px); }
              }
              @keyframes drift-l-branch {
                0%, 100% { transform: translate(0, 0); }
                50% { transform: translate(-25px, 20px); }
              }
              @keyframes drift-r-branch {
                0%, 100% { transform: translate(25px, 15px); }
              }
              @keyframes flow-dash-offset {
                to { stroke-dashoffset: -100; }
              }
              .drift-trunk-grp {
                animation: drift-trunk 24s infinite ease-in-out;
                transform-origin: center;
              }
              .drift-l-grp {
                animation: drift-l-branch 18s infinite ease-in-out;
                transform-origin: center;
              }
              .drift-r-grp {
                animation: drift-r-branch 21s infinite ease-in-out;
                transform-origin: center;
              }
              .animate-flow-dash {
                animation: flow-dash-offset 8s infinite linear;
              }
            `}</style>
          </svg>
        </div>

        {/* Hero Section */}
        <section className="relative pt-16 pb-24 md:pt-20 md:pb-28 px-8 lg:px-16 flex flex-col items-center text-center overflow-hidden">

          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10 text-left">

            {/* Left Column: Mascot Container */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center w-full order-2 lg:order-1 relative">
              {/* Mascot container for hover grouping (no overflow-hidden here) */}
              <div className="w-full max-w-[360px] md:max-w-[460px] relative group/mascot">
                {/* Visual image box with shadow and overflow-hidden to crop zoom scale */}
                <div className="w-full p-1 bg-black rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] flex items-center justify-center overflow-hidden">
                  <img
                    src="/assets/helixkoala.png"
                    alt="Helix Koala Mascot"
                    className="w-full h-auto object-contain transition-transform duration-500 group-hover/mascot:scale-105"
                  />
                </div>
                {/* Hover Dialog Box (positioned to the right on desktop, above on mobile) */}
                <div className="absolute z-20 w-[260px] p-4 bg-zinc-950/95 border border-gold rounded-lg shadow-[0_0_20px_rgba(223,181,59,0.15)] pointer-events-none opacity-0 transition-all duration-550 ease-out left-1/2 -translate-x-1/2 bottom-[calc(100%+1rem)] translate-y-4 group-hover/mascot:opacity-100 group-hover/mascot:translate-y-0 lg:left-[calc(100%+1.5rem)] lg:right-auto lg:top-1/2 lg:-translate-y-1/2 lg:bottom-auto lg:-translate-x-4 lg:translate-y-0 lg:group-hover/mascot:translate-x-0 lg:group-hover/mascot:-translate-y-1/2">
                  <p className="font-serif-display text-sm font-medium text-gold mb-1 text-left">Hi, my name is Helix!</p>
                  <p className="font-sans text-xs text-silverish leading-relaxed text-left">
                    I&apos;m here to help you understand codebase architectures, visualize dependencies, and help new project collaborators!
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Copy */}
            <div className="lg:col-span-7 space-y-8 text-center lg:text-left flex flex-col items-center lg:items-start order-1 lg:order-2">
              {/* Heading with technical typing animation and custom cursive style */}
              <div className="animate-typing-container lg:justify-start lg:w-fit py-2" id="hero-heading">
                <h1 className="text-3xl md:text-5xl lg:text-5xl font-cursive font-bold text-gold leading-tight tracking-tight animate-typing-effect">
                  Understand Any Codebase in Minutes
                </h1>
              </div>

              {/* Subheading */}
              <p className="text-lg md:text-xl text-silverish max-w-2xl font-sans leading-relaxed">
                AI-powered repository intelligence, architecture visualization, and developer onboarding.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 w-full justify-center lg:justify-start items-center pt-2">
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-8 py-3.5 bg-gold hover:bg-gold-hover text-black rounded text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 border border-gold/25"
                  id="btn-hero-get-started"
                >
                  Get Started
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-8 py-3.5 bg-zinc-950 hover:bg-zinc-900 text-ivory border border-zinc-800 hover:border-zinc-500 rounded text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2"
                  id="btn-hero-view-demo"
                >
                  View Demo
                  <ArrowUpRight size={16} className="text-zinc-500" />
                </Link>
              </div>
            </div>

          </div>

          {/* Visual Showcase Card with Gold Border */}
          <div className="max-w-3xl mx-auto w-full mt-20 p-2 rounded-xl bg-zinc-950/40 border border-gold/10 card-radial-glow relative group">
            <div className="absolute inset-0 bg-gradient-to-tr from-accent-purple/5 via-transparent to-accent-blue/5 rounded-xl pointer-events-none" />
            <div className="border border-zinc-900 rounded-lg p-6 bg-black text-left">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-zinc-800" />
                  <span className="w-3 h-3 rounded-full bg-zinc-800" />
                  <span className="w-3 h-3 rounded-full bg-zinc-800" />
                  <span className="text-xs text-zinc-500 font-mono-ui ml-4">repository-blueprint-analysis.json</span>
                </div>
              </div>
              <div className="space-y-1 font-mono-ui text-xs text-zinc-400">
                <p className="text-zinc-650">{"{"}</p>
                <p className="pl-4"><span className="text-purple-400">{"\"repository\""}</span>: {"{"}</p>
                <p className="pl-8"><span className="text-purple-400">{"\"name\""}</span>: <span className="text-gold">{"\"facebook/react\""}</span>,</p>
                <p className="pl-8"><span className="text-purple-400">{"\"size\""}</span>: <span className="text-gold">{"\"12.4 MB\""}</span>,</p>
                <p className="pl-8"><span className="text-purple-400">{"\"type\""}</span>: <span className="text-gold">{"\"Library\""}</span></p>
                <p className="pl-4">{"},"}</p>
                <p className="pl-4"><span className="text-purple-400">{"\"analysis\""}</span>: {"{"}</p>
                <p className="pl-8"><span className="text-purple-400">{"\"mainLanguage\""}</span>: <span className="text-gold">{"\"JavaScript\""}</span>,</p>
                <p className="pl-8"><span className="text-purple-400">{"\"modules\""}</span>: <span className="text-blue-400">24</span>,</p>
                <p className="pl-8"><span className="text-purple-400">{"\"dependencies\""}</span>: <span className="text-zinc-550">{"[\"loose-envify\", \"object-assign\"]"}</span></p>
                <p className="pl-4">{"},"}</p>
                <p className="pl-4"><span className="text-purple-400">{"\"onboarding\""}</span>: {"{"}</p>
                <p className="pl-8"><span className="text-purple-400">{"\"learningPath\""}</span>: [</p>
                <p className="pl-12"><span className="text-gold">{"\"1. Ingest core exports at /packages/react/index.js\""}</span>,</p>
                <p className="pl-12"><span className="text-gold">{"\"2. Understand reconciler loops at /packages/react-reconciler\""}</span>,</p>
                <p className="pl-12"><span className="text-gold">{"\"3. Verify renderer bridge interfaces in react-dom\""}</span></p>
                <p className="pl-8">]</p>
                <p className="pl-4">{"}"}</p>
                <p className="text-zinc-650">{"}"}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section - Scroll Reveal */}
        <section id="features" className="py-24 px-8 lg:px-16 relative scroll-reveal transition-all duration-1000 ease-out">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
              <h2 className="text-3xl md:text-4xl font-serif-display font-bold text-ivory tracking-tight">
                Designed for Technical Clarity
              </h2>
              <p className="text-sm text-silverish font-sans">
                A professional codebase utility designed to eliminate onboarding friction and map repository logic.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Feature 1 - Gold Border */}
              <div className="p-6 rounded-lg bg-zinc-950 border-gold-subtle space-y-4 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded border border-gold/25 bg-gold/5 flex items-center justify-center text-gold mb-6">
                    <Code size={18} />
                  </div>
                  <h3 className="text-xl font-serif-display font-medium text-ivory mb-2">Architecture Mapping</h3>
                  <p className="text-xs text-silverish font-sans leading-relaxed">
                    View structural layouts of your folders and modules. Identify core interfaces and trace execution loops instantly.
                  </p>
                </div>
              </div>

              {/* Feature 2 - Blue Border */}
              <div className="p-6 rounded-lg bg-zinc-950 border-blue-subtle space-y-4 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded border border-accent-blue/25 bg-accent-blue/5 flex items-center justify-center text-blue-400 mb-6">
                    <Database size={18} />
                  </div>
                  <h3 className="text-xl font-serif-display font-medium text-ivory mb-2">Dependency Intelligence</h3>
                  <p className="text-xs text-silverish font-sans leading-relaxed">
                    Locate imports and verify system structures. Spot redundant package structures and verify configuration setups.
                  </p>
                </div>
              </div>

              {/* Feature 3 - Purple Border */}
              <div className="p-6 rounded-lg bg-zinc-950 border-purple-subtle space-y-4 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded border border-accent-purple/25 bg-accent-purple/5 flex items-center justify-center text-purple-400 mb-6">
                    <Compass size={18} />
                  </div>
                  <h3 className="text-xl font-serif-display font-medium text-ivory mb-2">Workspace Navigation</h3>
                  <p className="text-xs text-silverish font-sans leading-relaxed">
                    Clarify workspace layout for newly added engineers. Provide interactive files walkthroughs and onboarding blueprints.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* How Helix Works Section - Scroll Reveal */}
        <section id="workflow" className="py-24 px-8 lg:px-16 bg-zinc-950/20 scroll-reveal transition-all duration-1000 ease-out">
          <div className="max-w-5xl mx-auto">
            <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
              <h2 className="text-3xl md:text-4xl font-serif-display font-bold text-ivory tracking-tight">
                How Helix Works
              </h2>
              <p className="text-sm text-silverish font-sans">
                A simple three-step sequence to process repository intelligence.
              </p>
            </div>

            <div className="relative border-l border-zinc-900 pl-8 ml-4 md:ml-8 space-y-12">
              {/* Step 1 */}
              <div className="relative">
                <span className="absolute -left-[45px] top-0.5 flex items-center justify-center w-8 h-8 rounded-full border border-gold/20 bg-zinc-950 text-gold text-xs font-semibold">
                  1
                </span>
                <h3 className="text-lg font-serif-display font-medium text-ivory mb-2">Ingestion & Processing</h3>
                <p className="text-xs text-silverish max-w-2xl">
                  Provide your public or private GitHub repository URL. The intelligence dashboard runs a parser to map files, code modules, and configs.
                </p>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <span className="absolute -left-[45px] top-0.5 flex items-center justify-center w-8 h-8 rounded-full border border-blue-900/30 bg-zinc-950 text-blue-400 text-xs font-semibold">
                  2
                </span>
                <h3 className="text-lg font-serif-display font-medium text-ivory mb-2">Blueprint Mapping</h3>
                <p className="text-xs text-silverish max-w-2xl">
                  The parser constructs a structured visual map of internal modules and dependency cycles, isolating component relations.
                </p>
              </div>

              {/* Step 3 */}
              <div className="relative">
                <span className="absolute -left-[45px] top-0.5 flex items-center justify-center w-8 h-8 rounded-full border border-purple-900/30 bg-zinc-950 text-purple-400 text-xs font-semibold">
                  3
                </span>
                <h3 className="text-lg font-serif-display font-medium text-ivory mb-2">Interactive Onboarding</h3>
                <p className="text-xs text-silverish max-w-2xl">
                  Query codebase features, read detailed auto-generated guides, and examine structured blueprints designed to guide developers.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Call To Action Section - Scroll Reveal */}
        <section className="py-24 px-8 lg:px-16 text-center relative scroll-reveal transition-all duration-1000 ease-out">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-950/80 pointer-events-none" />

          <div className="max-w-4xl mx-auto p-12 rounded-xl border border-zinc-800 bg-zinc-950/40 relative z-10 card-radial-glow">
            <h2 className="text-3xl md:text-5xl font-serif-display font-bold text-ivory mb-6 tracking-tight">
              Ready to Standardize Developer Onboarding?
            </h2>
            <p className="text-sm text-silverish max-w-xl mx-auto mb-8 font-sans leading-relaxed">
              Create an account now to start analyzing your team&apos;s code repos and simplify code understanding.
            </p>
            <div className="flex justify-center">
              <Link
                href="/login"
                className="px-8 py-3.5 bg-gold hover:bg-gold-hover text-black rounded text-sm font-semibold transition-all duration-300 flex items-center gap-2 border border-gold/25"
                id="btn-cta-action"
              >
                Sign In & Get Started
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="py-12 px-8 lg:px-16 border-t border-zinc-900 bg-black text-xs text-zinc-500">
        <div className="max-w-6xl mx-auto flex flex-col items-center justify-center gap-4 text-center">
          <Link href="/" className="flex justify-center mb-1">
            <img src="/assets/logo.png" alt="Helix Logo" className="h-16 w-auto" />
          </Link>
          <span className="text-[11px] text-zinc-500">
            © 2026 Noel Ninan Sheri. All rights reserved.
          </span>
        </div>
      </footer>

    </div>
  );
}
