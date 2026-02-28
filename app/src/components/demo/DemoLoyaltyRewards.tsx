'use client';

import { useState, useMemo } from 'react';
import { LOYALTY_TIERS } from '@/lib/uniswap-v4/constants';
import { TIER_MILESTONES, REFERRAL_EXAMPLE } from '@/lib/uniswap-v4/demo-scenarios';
import type { LoyaltyTier } from '@/lib/uniswap-v4/types';

export default function DemoLoyaltyRewards() {
  // Spending journey slider
  const [spending, setSpending] = useState(0);

  // Determine current tier from spending
  const currentTier = useMemo(() => {
    if (spending >= 1000) return 'platinum';
    if (spending >= 500) return 'gold';
    if (spending >= 200) return 'silver';
    return 'none';
  }, [spending]);

  const currentMilestone = TIER_MILESTONES.find(m => m.tier === (currentTier === 'none' ? 'bronze' : currentTier))!;

  // Calculate next tier
  const nextTier = useMemo(() => {
    if (currentTier === 'platinum') return null;
    const idx = TIER_MILESTONES.findIndex(m => m.tier === (currentTier === 'none' ? 'bronze' : currentTier));
    return idx < TIER_MILESTONES.length - 1 ? TIER_MILESTONES[idx + 1] : null;
  }, [currentTier]);

  const progressToNext = nextTier
    ? Math.min(100, ((spending - currentMilestone.spend) / (nextTier.spend - currentMilestone.spend)) * 100)
    : 100;

  // Estimated total FOODY earned (rough calculation)
  const estimatedFoody = useMemo(() => {
    // Simplified: average cashback rate across spending journey
    let total = 0;
    if (spending > 0) total += Math.min(spending, 200) * 0.03 * 1000; // Bronze 3%
    if (spending > 200) total += Math.min(spending - 200, 300) * 0.05 * 1000; // Silver 5%
    if (spending > 500) total += Math.min(spending - 500, 500) * 0.07 * 1000; // Gold 7%
    if (spending > 1000) total += (spending - 1000) * 0.10 * 1000; // VIP 10%
    return Math.round(total);
  }, [spending]);

  // Referral calc
  const refSwap = REFERRAL_EXAMPLE.swapAmount;
  const referrerBonus = refSwap * (REFERRAL_EXAMPLE.referrerBonusPercent / 100) * REFERRAL_EXAMPLE.foodyPerUSD;
  const refereeBonus = refSwap * (REFERRAL_EXAMPLE.refereeBonusPercent / 100) * REFERRAL_EXAMPLE.foodyPerUSD;

  return (
    <section className="py-16 border-t border-zinc-800/50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-2">
            <span className="bg-gradient-to-r from-amber-400 via-yellow-400 to-indigo-400 bg-clip-text text-transparent">
              Loyalty &amp; Rewards
            </span>
          </h2>
          <p className="text-sm text-zinc-400">
            On-chain loyalty program — transparent, automatic, and rewarding
          </p>
        </div>

        {/* 4-Tier Progression */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TIER_MILESTONES.map((tier) => {
              const isActive = (currentTier === 'none' && tier.tier === 'bronze') ||
                               currentTier === tier.tier ||
                               (currentTier === 'platinum' && tier.tier === 'platinum');
              const isPast = spending >= tier.spend;

              const colorMap: Record<string, string> = {
                amber: 'border-amber-700 bg-amber-950/30',
                gray: 'border-gray-600 bg-gray-900/30',
                yellow: 'border-yellow-700 bg-yellow-950/30',
                indigo: 'border-indigo-700 bg-indigo-950/30',
              };
              const activeColor = colorMap[tier.color] || colorMap.amber;

              return (
                <div
                  key={tier.tier}
                  className={`rounded-xl border p-4 text-center transition-all duration-500 ${
                    isActive
                      ? `${activeColor} scale-105 shadow-lg`
                      : isPast
                        ? `${activeColor} opacity-70`
                        : 'border-zinc-800 bg-zinc-950 opacity-40'
                  }`}
                  style={isActive ? { transform: 'scale(1.05)' } : undefined}
                >
                  <div className="text-3xl mb-2">{tier.emoji}</div>
                  <div className="text-sm font-bold text-zinc-200">{tier.label}</div>
                  <div className="text-[10px] text-zinc-500 mt-1">
                    {tier.spend === 0 ? 'Starting tier' : `$${tier.spend}+ spent`}
                  </div>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="text-violet-400">Fee discount: {tier.discount}</div>
                    <div className="text-green-400">Cashback: {tier.cashback}</div>
                  </div>
                  {tier.tier === 'platinum' && (
                    <div className="mt-2 px-2 py-1 rounded-full bg-indigo-900/40 border border-indigo-700/40">
                      <span className="text-[10px] text-indigo-300">+ VIP NFT</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Connecting arrows */}
          <div className="hidden md:flex justify-center mt-2">
            <div className="flex items-center text-zinc-600 text-xs space-x-16">
              <span>$0</span>
              <span>→</span>
              <span>$200</span>
              <span>→</span>
              <span>$500</span>
              <span>→</span>
              <span>$1,000</span>
            </div>
          </div>
        </div>

        {/* Simulate Your Journey */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4 text-center">Simulate Your Loyalty Journey</h3>

            {/* Slider */}
            <div className="mb-4">
              <input
                type="range"
                min={0}
                max={1500}
                step={10}
                value={spending}
                onChange={(e) => setSpending(Number(e.target.value))}
                className="w-full accent-violet-500"
              />
              <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                <span>$0</span>
                <span>$200</span>
                <span>$500</span>
                <span>$1,000</span>
                <span>$1,500</span>
              </div>
            </div>

            {/* Current state */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-3 text-center">
                <div className="text-xs text-zinc-500">Total Spent</div>
                <div className="text-lg font-bold text-white font-mono">${spending.toLocaleString()}</div>
              </div>
              <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-3 text-center">
                <div className="text-xs text-zinc-500">Current Tier</div>
                <div className="text-lg font-bold">
                  {currentMilestone.emoji} {currentMilestone.label}
                </div>
              </div>
              <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-3 text-center">
                <div className="text-xs text-zinc-500">Est. FOODY Earned</div>
                <div className="text-lg font-bold text-green-400 font-mono">{estimatedFoody.toLocaleString()}</div>
              </div>
            </div>

            {/* Progress to next tier */}
            {nextTier ? (
              <div>
                <div className="flex justify-between text-xs text-zinc-500 mb-1">
                  <span>{currentMilestone.emoji} {currentMilestone.label}</span>
                  <span>{nextTier.emoji} {nextTier.label} (${nextTier.spend})</span>
                </div>
                <div className="h-3 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-600 to-blue-500 transition-all duration-500"
                    style={{ width: `${progressToNext}%` }}
                  />
                </div>
                <div className="text-[10px] text-zinc-600 text-center mt-1">
                  ${(nextTier.spend - spending > 0 ? nextTier.spend - spending : 0).toLocaleString()} more to {nextTier.label}
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl border border-indigo-700/40 bg-indigo-950/30">
                  <span className="text-xl">💎</span>
                  <span className="text-sm text-indigo-300 font-semibold">VIP Status Achieved!</span>
                  <span className="text-xs text-indigo-400">+ Soulbound NFT</span>
                </div>
              </div>
            )}

            {/* VIP NFT animation trigger */}
            {spending >= 1000 && (
              <div className="mt-4 rounded-xl border border-indigo-600/50 bg-gradient-to-r from-indigo-950/40 to-violet-950/40 p-4 text-center animate-pulse">
                <div className="text-3xl mb-2">💎</div>
                <div className="text-sm font-bold text-indigo-300">VIP NFT Minted!</div>
                <div className="text-xs text-zinc-400 mt-1">
                  Soulbound ERC-721 &middot; Non-transferable &middot; Permanent 12% fee discount
                </div>
                <div className="text-[10px] text-zinc-600 mt-1 font-mono">
                  FoodyVIPNFT &middot; Token ID: #42
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Referral System */}
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4 text-center">Referral System</h3>
            <p className="text-xs text-zinc-400 text-center mb-6">
              Refer a friend — both earn FOODY bonuses on-chain. Set once, earn forever.
            </p>

            {/* Visual flow */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-4">
              {/* Alice (referrer) */}
              <div className="rounded-xl border border-violet-800/30 bg-violet-950/10 p-4 text-center w-full md:w-48">
                <div className="text-3xl mb-2">{REFERRAL_EXAMPLE.referrer.emoji}</div>
                <div className="text-sm font-semibold text-violet-300">{REFERRAL_EXAMPLE.referrer.name}</div>
                <div className="text-[10px] text-zinc-500">Referrer</div>
                <div className="mt-2 px-2 py-1 rounded-lg bg-green-950/30 border border-green-800/30">
                  <div className="text-xs text-green-400 font-mono">+{referrerBonus.toLocaleString()} FOODY</div>
                  <div className="text-[10px] text-zinc-500">{REFERRAL_EXAMPLE.referrerBonusPercent}% of referee&apos;s swaps</div>
                </div>
              </div>

              {/* Arrow + action */}
              <div className="text-center">
                <div className="text-zinc-600 text-2xl hidden md:block">→</div>
                <div className="text-zinc-600 text-2xl md:hidden">↓</div>
                <div className="text-[10px] text-zinc-500 mt-1">refers</div>
              </div>

              {/* Bob (referee) */}
              <div className="rounded-xl border border-blue-800/30 bg-blue-950/10 p-4 text-center w-full md:w-48">
                <div className="text-3xl mb-2">{REFERRAL_EXAMPLE.referee.emoji}</div>
                <div className="text-sm font-semibold text-blue-300">{REFERRAL_EXAMPLE.referee.name}</div>
                <div className="text-[10px] text-zinc-500">Referee &middot; First swap: ${refSwap}</div>
                <div className="mt-2 px-2 py-1 rounded-lg bg-green-950/30 border border-green-800/30">
                  <div className="text-xs text-green-400 font-mono">+{refereeBonus.toLocaleString()} FOODY</div>
                  <div className="text-[10px] text-zinc-500">{REFERRAL_EXAMPLE.refereeBonusPercent}% extra first-swap bonus</div>
                </div>
              </div>
            </div>

            <div className="text-center mt-4 text-[10px] text-zinc-600">
              Referral relationship stored on-chain &middot; Set once via <span className="font-mono text-zinc-500">setReferrer()</span> &middot; Cannot be changed
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
