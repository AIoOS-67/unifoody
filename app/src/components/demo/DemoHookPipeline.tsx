'use client';

import { useState, useMemo } from 'react';
import { evaluateConstraints, calculateDynamicFee, getMarketConditions, buildDefaultLoyaltyProfile } from '@/lib/uniswap-v4/hooks';
import { LOYALTY_TIERS, FEE_CONFIG, DEMO_RESTAURANTS, FALLBACK_FOODY_PRICE_USD } from '@/lib/uniswap-v4/constants';
import type { LoyaltyTier, RestaurantConstraints } from '@/lib/uniswap-v4/types';
import { DEMO_WALLET, FEE_SPLIT } from '@/lib/uniswap-v4/demo-scenarios';

type ConstraintScenario = 'valid' | 'closed' | 'over_limit' | 'busy_low';

export default function DemoHookPipeline() {
  // Layer 1: Constraint toggles
  const [constraintScenario, setConstraintScenario] = useState<ConstraintScenario>('valid');

  // Layer 2: Pricing controls
  const [pricingTier, setPricingTier] = useState<LoyaltyTier>('none');
  const [isPeakHour, setIsPeakHour] = useState(false);

  // Layer 3: Settlement amount
  const [settlementAmount, setSettlementAmount] = useState(50);

  // --- Layer 1 computation ---
  const constraintResult = useMemo(() => {
    const scenarios: Record<ConstraintScenario, { amount: number; restaurant?: RestaurantConstraints }> = {
      valid: {
        amount: 25,
        restaurant: { restaurantId: 'rest_001', name: 'Sichuan Garden', status: 'open', busyMinimumUSDC: 5, acceptsFoody: true, openHour: 8, closeHour: 22, updatedAt: new Date().toISOString() },
      },
      closed: {
        amount: 25,
        restaurant: { restaurantId: 'rest_001', name: 'Sichuan Garden', status: 'closed', busyMinimumUSDC: 5, acceptsFoody: true, openHour: 8, closeHour: 22, updatedAt: new Date().toISOString() },
      },
      over_limit: {
        amount: 15000,
        restaurant: { restaurantId: 'rest_001', name: 'Sichuan Garden', status: 'open', busyMinimumUSDC: 5, acceptsFoody: true, openHour: 8, closeHour: 22, updatedAt: new Date().toISOString() },
      },
      busy_low: {
        amount: 3,
        restaurant: { restaurantId: 'rest_001', name: 'Sichuan Garden', status: 'busy', busyMinimumUSDC: 5, acceptsFoody: true, openHour: 8, closeHour: 22, updatedAt: new Date().toISOString() },
      },
    };
    const sc = scenarios[constraintScenario];
    return evaluateConstraints(sc.amount, sc.restaurant);
  }, [constraintScenario]);

  // --- Layer 2 computation ---
  const pricingResult = useMemo(() => {
    const market = getMarketConditions(FALLBACK_FOODY_PRICE_USD);
    // Override volatility to medium for demo consistency
    market.volatility = 'medium';
    market.swapsLastHour = 30;
    const loyalty = {
      ...buildDefaultLoyaltyProfile(DEMO_WALLET),
      tier: pricingTier,
      totalSwapVolumeUSDC: pricingTier === 'platinum' ? 1500 : pricingTier === 'gold' ? 600 : pricingTier === 'silver' ? 250 : 0,
      totalSwapCount: pricingTier === 'platinum' ? 60 : pricingTier === 'gold' ? 24 : pricingTier === 'silver' ? 10 : 0,
    };
    return calculateDynamicFee(50, market, loyalty);
  }, [pricingTier, isPeakHour]);

  // Base fee without hook for comparison
  const baseFeePercent = (FEE_CONFIG.BASE_FEE_BPS / 100).toFixed(2);
  const effectiveFeePercent = (pricingResult.effectiveFee / 100).toFixed(2);
  const savingsPercent = ((FEE_CONFIG.BASE_FEE_BPS - pricingResult.effectiveFee) / 100).toFixed(2);

  return (
    <section className="py-16 border-t border-zinc-800/50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-2">
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              The Hook Deep Dive
            </span>
          </h2>
          <p className="text-sm text-zinc-400">
            Explore each layer independently — toggle scenarios to see how the hook responds
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Layer 1: Constraints */}
          <div className="rounded-2xl border border-blue-800/30 bg-zinc-950/80 p-5">
            <div className="flex items-center space-x-2 mb-4">
              <span className="w-7 h-7 rounded-full bg-blue-900/50 border border-blue-700 flex items-center justify-center text-xs font-bold text-blue-400">1</span>
              <div>
                <h3 className="text-sm font-semibold text-blue-300">Constraints</h3>
                <p className="text-[10px] text-zinc-500 font-mono">beforeSwap &rarr; _checkConstraints()</p>
              </div>
            </div>

            <p className="text-xs text-zinc-400 mb-4">
              Validates restaurant is whitelisted, currently open, and swap amount is within limits.
            </p>

            {/* Scenario toggles */}
            <div className="space-y-2 mb-4">
              {([
                { id: 'valid' as ConstraintScenario, label: 'Valid Swap ($25)', emoji: '✅' },
                { id: 'closed' as ConstraintScenario, label: 'Restaurant Closed', emoji: '🔒' },
                { id: 'over_limit' as ConstraintScenario, label: 'Over Limit ($15K)', emoji: '⛔' },
                { id: 'busy_low' as ConstraintScenario, label: 'Busy + Low Amount ($3)', emoji: '⏳' },
              ]).map(sc => (
                <button
                  key={sc.id}
                  onClick={() => setConstraintScenario(sc.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all border ${
                    constraintScenario === sc.id
                      ? 'border-blue-600 bg-blue-950/40 text-blue-300'
                      : 'border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  {sc.emoji} {sc.label}
                </button>
              ))}
            </div>

            {/* Result */}
            <div className={`rounded-lg p-3 border ${
              constraintResult.allowed
                ? 'border-green-800/40 bg-green-950/20'
                : 'border-red-800/40 bg-red-950/20'
            }`}>
              <div className="flex items-center space-x-2 mb-1">
                <span className={constraintResult.allowed ? 'text-green-400' : 'text-red-400'}>
                  {constraintResult.allowed ? '✓ PASS' : '✗ BLOCKED'}
                </span>
              </div>
              <p className="text-xs text-zinc-400">{constraintResult.reason}</p>
              <div className="flex gap-4 mt-2 text-[10px] text-zinc-500">
                <span>Status: {constraintResult.restaurantStatus}</span>
                <span>Min: ${constraintResult.minimumSwapUSDC}</span>
                <span>Max: ${constraintResult.maximumSwapUSDC.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Layer 2: Pricing */}
          <div className="rounded-2xl border border-violet-800/30 bg-zinc-950/80 p-5">
            <div className="flex items-center space-x-2 mb-4">
              <span className="w-7 h-7 rounded-full bg-violet-900/50 border border-violet-700 flex items-center justify-center text-xs font-bold text-violet-400">2</span>
              <div>
                <h3 className="text-sm font-semibold text-violet-300">Dynamic Pricing</h3>
                <p className="text-[10px] text-zinc-500 font-mono">beforeSwap &rarr; _calculateDynamicFee()</p>
              </div>
            </div>

            <p className="text-xs text-zinc-400 mb-4">
              Adjusts fees based on loyalty tier, peak hours, and market conditions.
            </p>

            {/* Tier selector */}
            <div className="mb-3">
              <label className="text-[10px] text-zinc-500 block mb-1">Select Tier</label>
              <div className="grid grid-cols-4 gap-1">
                {(['none', 'silver', 'gold', 'platinum'] as LoyaltyTier[]).map(t => {
                  const cfg = LOYALTY_TIERS[t];
                  return (
                    <button
                      key={t}
                      onClick={() => setPricingTier(t)}
                      className={`px-1 py-1.5 rounded text-[10px] transition-all border ${
                        pricingTier === t
                          ? 'border-violet-500 bg-violet-950/40 text-violet-300'
                          : 'border-zinc-800 text-zinc-500 hover:border-zinc-700'
                      }`}
                    >
                      {cfg.emoji}{cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comparison */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-3 text-center">
                <div className="text-[10px] text-zinc-500 mb-1">Without Hook</div>
                <div className="text-lg font-bold text-zinc-400 font-mono">{baseFeePercent}%</div>
                <div className="text-[10px] text-zinc-600">Flat base fee</div>
              </div>
              <div className="rounded-lg border border-violet-700/50 bg-violet-950/20 p-3 text-center">
                <div className="text-[10px] text-violet-400 mb-1">With FoodySwap Hook</div>
                <div className="text-lg font-bold text-violet-300 font-mono">{effectiveFeePercent}%</div>
                <div className="text-[10px] text-green-400">Save {savingsPercent}%</div>
              </div>
            </div>

            {/* Fee breakdown */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
              <div className="text-[10px] text-zinc-500 mb-2">Fee Breakdown</div>
              <div className="space-y-1">
                {pricingResult.breakdown.map((line, i) => (
                  <div key={i} className="text-xs text-zinc-400 font-mono">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Layer 3: Settlement */}
          <div className="rounded-2xl border border-green-800/30 bg-zinc-950/80 p-5">
            <div className="flex items-center space-x-2 mb-4">
              <span className="w-7 h-7 rounded-full bg-green-900/50 border border-green-700 flex items-center justify-center text-xs font-bold text-green-400">3</span>
              <div>
                <h3 className="text-sm font-semibold text-green-300">Settlement + Rewards</h3>
                <p className="text-[10px] text-zinc-500 font-mono">afterSwap &rarr; _settleAndReward()</p>
              </div>
            </div>

            <p className="text-xs text-zinc-400 mb-4">
              Distributes fees, mints FOODY cashback, updates loyalty, and triggers VIP NFT.
            </p>

            {/* Fee split pie chart (CSS) */}
            <div className="mb-4">
              <div className="text-[10px] text-zinc-500 mb-2">Fee Split</div>
              <div className="flex rounded-lg overflow-hidden h-8 border border-zinc-700">
                <div className="bg-emerald-900/60 flex items-center justify-center flex-[90]">
                  <span className="text-[10px] text-emerald-300 font-mono">🏪 90%</span>
                </div>
                <div className="bg-blue-900/60 flex items-center justify-center flex-[5]">
                  <span className="text-[9px] text-blue-300">5%</span>
                </div>
                <div className="bg-violet-900/60 flex items-center justify-center flex-[5]">
                  <span className="text-[9px] text-violet-300">5%</span>
                </div>
              </div>
              <div className="flex justify-between mt-1 text-[9px] text-zinc-500">
                <span>Restaurant</span>
                <span>Platform + Reward Pool</span>
              </div>
            </div>

            {/* Cashback calculator */}
            <div className="mb-4">
              <div className="text-[10px] text-zinc-500 mb-2">FOODY Cashback by Tier (on ${settlementAmount} order)</div>
              <input
                type="range"
                min={5}
                max={200}
                value={settlementAmount}
                onChange={(e) => setSettlementAmount(Number(e.target.value))}
                className="w-full mb-2 accent-green-500"
              />
              <div className="text-xs text-zinc-400 text-center mb-2">Order: ${settlementAmount}</div>
              <div className="grid grid-cols-4 gap-1">
                {(['none', 'silver', 'gold', 'platinum'] as LoyaltyTier[]).map(t => {
                  const cfg = LOYALTY_TIERS[t];
                  const cashback = settlementAmount * (cfg.cashbackBps / 10000);
                  const foody = cashback * 1000; // 1 USD = 1000 FOODY
                  return (
                    <div key={t} className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-2 text-center">
                      <div className="text-xs">{cfg.emoji}</div>
                      <div className="text-[10px] text-zinc-500">{cfg.label}</div>
                      <div className="text-xs text-green-400 font-mono mt-1">+{foody.toFixed(0)}</div>
                      <div className="text-[9px] text-zinc-600">{(cfg.cashbackBps / 100).toFixed(0)}%</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* VIP NFT callout */}
            <div className="rounded-lg border border-indigo-800/40 bg-indigo-950/20 p-3">
              <div className="flex items-center space-x-2">
                <span className="text-xl">💎</span>
                <div>
                  <div className="text-xs text-indigo-300 font-semibold">VIP NFT Auto-Mint</div>
                  <div className="text-[10px] text-zinc-400">
                    Soulbound ERC-721 auto-minted when total spend reaches $1,000. Non-transferable proof of loyalty.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
