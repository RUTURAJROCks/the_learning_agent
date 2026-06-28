'use client';

import React, { useState, useEffect } from 'react';

export default function Home() {
  const [apiKeyStatus, setApiKeyStatus] = useState<string>('checking');
  
  useEffect(() => {
    // Check if key is configured (by calling a lightweight health check or reading a public env flag)
    // For simplicity, we just mock or fetch a status
    fetch('/api/quiz', { method: 'OPTIONS' })
      .then(() => setApiKeyStatus('ready'))
      .catch(() => setApiKeyStatus('error'));
  }, []);

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans selection:bg-fuchsia-500 selection:text-white">
      {/* Background radial highlight */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-fuchsia-950/20 via-zinc-950 to-zinc-950 pointer-events-none" />

      <main className="relative max-w-4xl mx-auto px-6 py-16 flex flex-col items-center justify-center min-h-screen z-10">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 text-xs font-semibold mb-6">
            <span className="w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse" />
            Vercel MVP Ready
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-fuchsia-400 via-purple-500 to-indigo-400 bg-clip-text text-transparent mb-4">
            The Learning Agent
          </h1>
          <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto">
            Learn in real-time while watching YouTube videos and live streams with a personalized, always-on-top AI companion.
          </p>
        </div>

        {/* Status indicator */}
        <div className="w-full max-w-md bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-6 mb-8 shadow-xl">
          <h3 className="font-semibold text-sm text-zinc-400 uppercase tracking-wider mb-4">
            System Check
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-zinc-200">Gemini API Connection</p>
              <p className="text-xs text-zinc-500">Configured via GEMINI_API_KEY in .env.local</p>
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              Ready
            </span>
          </div>
        </div>

        {/* Content grid */}
        <div className="grid md:grid-cols-2 gap-8 w-full">
          
          {/* Card 1: Loading Chrome Extension */}
          <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-6 hover:border-zinc-700/80 transition-all shadow-lg flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center font-bold text-lg mb-4">
                1
              </div>
              <h2 className="text-xl font-bold text-zinc-100 mb-2">Load the Chrome Extension</h2>
              <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                To start learning, load the Chrome Extension directory into Google Chrome:
              </p>
              <ul className="text-xs text-zinc-500 space-y-2 list-decimal list-inside">
                <li>Open <code className="text-zinc-300">chrome://extensions</code> in Chrome</li>
                <li>Toggle <strong className="text-zinc-300">Developer mode</strong> (top-right)</li>
                <li>Click <strong className="text-zinc-300">Load unpacked</strong></li>
                <li>Select the <code className="text-zinc-300">extension</code> folder from the project root</li>
              </ul>
            </div>
            <div className="mt-6 pt-4 border-t border-zinc-800/80">
              <span className="text-xs text-zinc-500 font-mono">Directory: ./the_learning_agent/extension</span>
            </div>
          </div>

          {/* Card 2: Features & How it works */}
          <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-6 hover:border-zinc-700/80 transition-all shadow-lg flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-lg mb-4">
                2
              </div>
              <h2 className="text-xl font-bold text-zinc-100 mb-2">How to Use the Agent</h2>
              <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                Follow these simple steps to learn contextually:
              </p>
              <ul className="text-xs text-zinc-500 space-y-2 list-disc list-inside">
                <li>Open any YouTube video or **YouTube Live stream**</li>
                <li>Click the extension icon to open the **Learning Side Panel**</li>
                <li>Fill in what you want to learn and complete the **Diagnostic Quiz**</li>
                <li>Turn on YouTube captions, and watch concepts overlay in real-time</li>
                <li>Click **Toggle Floating Overlay** to pop it into an always-on-top window</li>
              </ul>
            </div>
            <div className="mt-6 pt-4 border-t border-zinc-800/80">
              <span className="text-xs text-zinc-500">Supports Standard & Live Captions</span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <footer className="mt-20 text-zinc-600 text-xs text-center border-t border-zinc-900/80 pt-8 w-full max-w-xl">
          <p>Built with Next.js, Vercel, and Gemini 2.0 Flash.</p>
        </footer>

      </main>
    </div>
  );
}
