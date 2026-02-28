'use client';

import { useRef } from 'react';
import DemoHero from '@/components/demo/DemoHero';
import DemoInteractiveSwap from '@/components/demo/DemoInteractiveSwap';
import DemoHookPipeline from '@/components/demo/DemoHookPipeline';
import DemoLoyaltyRewards from '@/components/demo/DemoLoyaltyRewards';
import DemoRestaurantSettlement from '@/components/demo/DemoRestaurantSettlement';
import DemoTechnicalDetails from '@/components/demo/DemoTechnicalDetails';

const NAV_SECTIONS = [
  { id: 'hero', label: 'Overview', emoji: '🦄' },
  { id: 'swap', label: 'Try a Swap', emoji: '🔄' },
  { id: 'pipeline', label: 'Hook Pipeline', emoji: '🔗' },
  { id: 'loyalty', label: 'Loyalty', emoji: '💎' },
  { id: 'settlement', label: 'Settlement', emoji: '🏦' },
  { id: 'tech', label: 'Technical', emoji: '⚙️' },
] as const;

export default function FoodySwapDemoPage() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* Sticky Navigation */}
      <nav className="sticky top-0 z-50 bg-black/90 backdrop-blur-md border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg">🦄</span>
            <span className="text-sm font-bold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
              FoodySwap V4 Demo
            </span>
          </div>
          <div className="flex items-center space-x-1 overflow-x-auto">
            {NAV_SECTIONS.map((sec) => (
              <button
                key={sec.id}
                onClick={() => scrollTo(sec.id)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-colors whitespace-nowrap"
              >
                <span className="mr-1">{sec.emoji}</span>
                {sec.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Sections */}
      <div id="hero">
        <DemoHero />
      </div>

      <div id="swap">
        <DemoInteractiveSwap />
      </div>

      <div id="pipeline">
        <DemoHookPipeline />
      </div>

      <div id="loyalty">
        <DemoLoyaltyRewards />
      </div>

      <div id="settlement">
        <DemoRestaurantSettlement />
      </div>

      <div id="tech">
        <DemoTechnicalDetails />
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8 text-center">
        <p className="text-sm text-zinc-500">
          FoodySwap Hook &middot; Uniswap V4 &middot; UHI Hookathon 8 &middot; Base Chain
        </p>
        <p className="text-xs text-zinc-600 mt-2">
          Built with Foundry &middot; Deployed on Base Sepolia &middot; 29 tests passing
        </p>
      </footer>
    </div>
  );
}
