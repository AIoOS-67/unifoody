'use client';

import { useState, useEffect, useRef } from 'react';
import { HOOK_ADDRESS, VIP_NFT_ADDRESS, BLOCK_EXPLORER_URL } from '@/lib/uniswap-v4/constants';

interface V4Stats {
  totalUSDCVolume: number;
  totalFoodyDistributed: number;
  uniqueWallets: number;
  registeredRestaurants: number;
}

export default function DemoHero() {
  // Live stats from V4 API
  const [stats, setStats] = useState<V4Stats>({
    totalUSDCVolume: 0,
    totalFoodyDistributed: 0,
    uniqueWallets: 0,
    registeredRestaurants: 0,
  });
  const [animatedVolume, setAnimatedVolume] = useState(0);
  const [animatedRewards, setAnimatedRewards] = useState(0);
  const [animatedWallets, setAnimatedWallets] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Track previous values for smooth animation on refresh
  const prevRef = useRef({ volume: 0, rewards: 0, wallets: 0 });

  // Fetch live stats from V4 API
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/hooks/v4-stats');
        if (res.ok) {
          const data = await res.json();
          setStats({
            totalUSDCVolume: data.totalUSDCVolume || 0,
            totalFoodyDistributed: data.totalFoodyDistributed || 0,
            uniqueWallets: data.uniqueWallets || 0,
            registeredRestaurants: data.registeredRestaurants || 0,
          });
          setHasLoaded(true);
        }
      } catch {
        // Silently fail — stats will show 0 until API is available
      }
    }
    fetchStats();
    // Poll every 60 seconds (stats grow as simulation runs!)
    const interval = setInterval(fetchStats, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Animate counters toward live values
  useEffect(() => {
    if (!hasLoaded) return;

    const startVolume = prevRef.current.volume;
    const startRewards = prevRef.current.rewards;
    const startWallets = prevRef.current.wallets;
    const targetVolume = stats.totalUSDCVolume;
    const targetRewards = stats.totalFoodyDistributed;
    const targetWallets = stats.uniqueWallets;

    const duration = 2000;
    const steps = 60;
    const interval = duration / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setAnimatedVolume(Math.round(startVolume + (targetVolume - startVolume) * eased));
      setAnimatedRewards(Math.round(startRewards + (targetRewards - startRewards) * eased));
      setAnimatedWallets(Math.round(startWallets + (targetWallets - startWallets) * eased));
      if (step >= steps) {
        clearInterval(timer);
        prevRef.current = { volume: targetVolume, rewards: targetRewards, wallets: targetWallets };
      }
    }, interval);
    return () => clearInterval(timer);
  }, [stats, hasLoaded]);

  return (
    <section className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-violet-950/30 via-black to-black pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 pt-16 pb-12">
        {/* Title */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full border border-violet-800/40 bg-violet-950/20 mb-6">
            <span className="text-sm">🦄</span>
            <span className="text-xs text-violet-300 font-medium">Uniswap V4 Hook &middot; UHI Hookathon 8</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              FoodySwap Hook
            </span>
          </h1>
          <p className="text-xl text-zinc-300 max-w-2xl mx-auto mb-3">
            Restaurant Payments Meet DeFi
          </p>
          <p className="text-sm text-zinc-500 max-w-xl mx-auto">
            A single Uniswap V4 Hook with three composable layers — powering loyalty rewards,
            dynamic pricing, and instant restaurant settlements on Base Chain.
          </p>
        </div>

        {/* Key Differentiator Badge */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center space-x-3 px-6 py-3 rounded-2xl border border-emerald-800/40 bg-emerald-950/20">
            <span className="text-2xl">🏪</span>
            <div>
              <p className="text-sm font-semibold text-emerald-300">Restaurants Never Touch Crypto</p>
              <p className="text-xs text-zinc-400">FOODY → Hook Swap → USDC → Stripe → USD to Bank Account</p>
            </div>
          </div>
        </div>

        {/* Architecture Diagram */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6">
            <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-4 text-center">Three-Layer Hook Architecture</h3>

            {/* Pipeline flow */}
            <div className="flex flex-col md:flex-row items-stretch gap-3">
              {/* beforeSwap */}
              <div className="flex-1 rounded-xl border border-blue-800/40 bg-blue-950/20 p-4">
                <div className="text-xs text-blue-400 font-mono mb-2">beforeSwap()</div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="w-5 h-5 rounded bg-blue-900/50 flex items-center justify-center text-xs">1</span>
                    <span className="text-zinc-300">Constraints</span>
                  </div>
                  <p className="text-xs text-zinc-500 pl-7">Restaurant whitelist, hours, limits</p>
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="w-5 h-5 rounded bg-blue-900/50 flex items-center justify-center text-xs">2</span>
                    <span className="text-zinc-300">Dynamic Pricing</span>
                  </div>
                  <p className="text-xs text-zinc-500 pl-7">Tier discount + peak hour bonus</p>
                </div>
              </div>

              {/* Arrow */}
              <div className="hidden md:flex items-center text-zinc-600 text-2xl">→</div>
              <div className="md:hidden flex justify-center text-zinc-600 text-2xl">↓</div>

              {/* Uniswap Swap */}
              <div className="flex-shrink-0 rounded-xl border border-pink-800/40 bg-pink-950/20 p-4 md:w-40 flex flex-col items-center justify-center">
                <span className="text-3xl mb-2">🦄</span>
                <div className="text-xs text-pink-400 font-mono">V4 Pool</div>
                <div className="text-xs text-zinc-400 mt-1">FOODY → USDC</div>
              </div>

              {/* Arrow */}
              <div className="hidden md:flex items-center text-zinc-600 text-2xl">→</div>
              <div className="md:hidden flex justify-center text-zinc-600 text-2xl">↓</div>

              {/* afterSwap */}
              <div className="flex-1 rounded-xl border border-green-800/40 bg-green-950/20 p-4">
                <div className="text-xs text-green-400 font-mono mb-2">afterSwap()</div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="w-5 h-5 rounded bg-green-900/50 flex items-center justify-center text-xs">3</span>
                    <span className="text-zinc-300">Settlement + Rewards</span>
                  </div>
                  <p className="text-xs text-zinc-500 pl-7">Fee split (90/5/5)</p>
                  <p className="text-xs text-zinc-500 pl-7">FOODY cashback mint</p>
                  <p className="text-xs text-zinc-500 pl-7">Tier upgrade + VIP NFT</p>
                  <p className="text-xs text-zinc-500 pl-7">Referral bonuses</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards — Live from V4 API, refreshes every 60s */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-center">
            <div className="text-2xl font-bold text-violet-400 font-mono">${animatedVolume.toLocaleString()}</div>
            <div className="text-xs text-zinc-500 mt-1">Total USDC Volume</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-center">
            <div className="text-2xl font-bold text-cyan-400 font-mono">{animatedRewards.toLocaleString()}</div>
            <div className="text-xs text-zinc-500 mt-1">FOODY Rewards Distributed</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400 font-mono">{animatedWallets > 0 ? animatedWallets.toLocaleString() : (stats.registeredRestaurants || 251)}</div>
            <div className="text-xs text-zinc-500 mt-1">{animatedWallets > 0 ? 'Active Wallets' : 'Registered Restaurants'}</div>
          </div>
        </div>

        {/* Live indicator */}
        {hasLoaded && stats.totalUSDCVolume > 0 && (
          <div className="flex justify-center mt-4">
            <div className="inline-flex items-center space-x-2 text-xs text-zinc-600">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>Live data from simulation — refreshes every 60s</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
