'use client';

import { useState, useCallback } from 'react';
import {
  executeHookPipeline,
  getRestaurantConstraints,
  buildDefaultLoyaltyProfile,
} from '@/lib/uniswap-v4/hooks';
import {
  DEMO_RESTAURANTS,
  FALLBACK_FOODY_PER_USD,
  FALLBACK_FOODY_PRICE_USD,
  LOYALTY_TIERS,
} from '@/lib/uniswap-v4/constants';
import type { HookPipelineResult, LoyaltyTier, RestaurantConstraints } from '@/lib/uniswap-v4/types';
import {
  DEMO_SCENARIOS,
  QUICK_AMOUNTS,
  buildScenarioLoyalty,
  DEMO_WALLET,
  FEE_SPLIT,
  type DemoScenario,
} from '@/lib/uniswap-v4/demo-scenarios';

type StageStatus = 'pending' | 'running' | 'done' | 'error' | 'blocked';

interface StageState {
  constraints: StageStatus;
  pricing: StageStatus;
  settlement: StageStatus;
}

export default function DemoInteractiveSwap() {
  // Inputs
  const [amount, setAmount] = useState(25);
  const [restaurantId, setRestaurantId] = useState('rest_001');
  const [selectedTier, setSelectedTier] = useState<LoyaltyTier>('none');
  const [selectedScenario, setSelectedScenario] = useState<string>('');

  // Pipeline state
  const [stages, setStages] = useState<StageState>({
    constraints: 'pending',
    pricing: 'pending',
    settlement: 'pending',
  });
  const [result, setResult] = useState<HookPipelineResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // Apply scenario
  const applyScenario = useCallback((scenario: DemoScenario) => {
    setSelectedScenario(scenario.id);
    setAmount(scenario.amountUSDC);
    setRestaurantId(scenario.restaurantId);
    setSelectedTier(scenario.tier);
    setResult(null);
    setStages({ constraints: 'pending', pricing: 'pending', settlement: 'pending' });
  }, []);

  // Run pipeline with staged animation
  const runPipeline = useCallback(async () => {
    setIsRunning(true);
    setResult(null);
    setStages({ constraints: 'pending', pricing: 'pending', settlement: 'pending' });

    // Build loyalty profile based on selected tier
    const scenario = DEMO_SCENARIOS.find(s => s.id === selectedScenario);
    const loyalty = scenario
      ? buildScenarioLoyalty(scenario)
      : {
          ...buildDefaultLoyaltyProfile(DEMO_WALLET),
          tier: selectedTier,
          totalSwapVolumeUSDC: selectedTier === 'platinum' ? 1500
            : selectedTier === 'gold' ? 600
            : selectedTier === 'silver' ? 250
            : 0,
          totalSwapCount: selectedTier === 'platinum' ? 60
            : selectedTier === 'gold' ? 24
            : selectedTier === 'silver' ? 10
            : 0,
        };

    // Stage 1: Constraints — show running
    setStages(s => ({ ...s, constraints: 'running' }));
    await sleep(500);

    // Compute the full pipeline result
    const pipelineResult = executeHookPipeline({
      walletAddress: DEMO_WALLET,
      amountUSDC: amount,
      restaurantId: scenario?.restaurantOverride?.status === 'closed' ? undefined : restaurantId,
      loyaltyProfile: loyalty,
      foodyPerUSD: FALLBACK_FOODY_PER_USD,
      foodyPriceUSD: FALLBACK_FOODY_PRICE_USD,
      isFirstSwap: scenario?.isFirstSwap ?? false,
    });

    // If scenario overrides restaurant (e.g. closed), manually block
    if (scenario?.restaurantOverride?.status === 'closed') {
      pipelineResult.success = false;
      pipelineResult.constraints.allowed = false;
      pipelineResult.constraints.reason = `${DEMO_RESTAURANTS[restaurantId]?.name || 'Restaurant'} is currently closed. Swaps are blocked until the restaurant reopens.`;
      pipelineResult.constraints.restaurantStatus = 'closed';
      pipelineResult.blockedBy = 'constraints';
      pipelineResult.blockReason = pipelineResult.constraints.reason;
    }

    // Stage 1 result
    const constraintOk = pipelineResult.constraints.allowed;
    setStages(s => ({ ...s, constraints: constraintOk ? 'done' : 'error' }));

    if (!constraintOk) {
      setStages(s => ({ ...s, pricing: 'blocked', settlement: 'blocked' }));
      setResult(pipelineResult);
      setIsRunning(false);
      return;
    }

    // Stage 2: Pricing
    await sleep(400);
    setStages(s => ({ ...s, pricing: 'running' }));
    await sleep(500);
    setStages(s => ({ ...s, pricing: 'done' }));

    // Stage 3: Settlement
    await sleep(300);
    setStages(s => ({ ...s, settlement: 'running' }));
    await sleep(500);
    setStages(s => ({ ...s, settlement: 'done' }));

    setResult(pipelineResult);
    setIsRunning(false);
  }, [amount, restaurantId, selectedTier, selectedScenario]);

  return (
    <section className="py-16 border-t border-zinc-800/50">
      <div className="max-w-7xl mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-2">
            <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
              Try a Swap
            </span>
          </h2>
          <p className="text-sm text-zinc-400">
            Select a scenario and watch the three-layer hook pipeline execute in real-time
          </p>
        </div>

        {/* Scenario presets */}
        <div className="mb-8">
          <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-3 text-center">Quick Scenarios</h3>
          <div className="flex flex-wrap justify-center gap-2">
            {DEMO_SCENARIOS.map((sc) => (
              <button
                key={sc.id}
                onClick={() => applyScenario(sc)}
                className={`px-3 py-2 rounded-lg text-xs transition-all border ${
                  selectedScenario === sc.id
                    ? 'border-violet-500 bg-violet-950/40 text-violet-300'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                }`}
              >
                <span className="mr-1">{sc.emoji}</span>
                {sc.label}
              </button>
            ))}
          </div>
          {selectedScenario && (
            <p className="text-xs text-zinc-500 text-center mt-2">
              {DEMO_SCENARIOS.find(s => s.id === selectedScenario)?.description}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Controls */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4">Swap Parameters</h3>

            {/* Amount */}
            <div className="mb-5">
              <label className="text-xs text-zinc-500 block mb-2">Amount (USDC)</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {QUICK_AMOUNTS.map((a) => (
                  <button
                    key={a}
                    onClick={() => { setAmount(a); setSelectedScenario(''); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all border ${
                      amount === a
                        ? 'border-violet-500 bg-violet-950/40 text-violet-300'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    ${a}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => { setAmount(Number(e.target.value)); setSelectedScenario(''); }}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                min={0}
                max={20000}
              />
            </div>

            {/* Restaurant */}
            <div className="mb-5">
              <label className="text-xs text-zinc-500 block mb-2">Restaurant</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(DEMO_RESTAURANTS).map(([id, r]) => (
                  <button
                    key={id}
                    onClick={() => { setRestaurantId(id); setSelectedScenario(''); }}
                    className={`px-3 py-2 rounded-lg text-xs transition-all border text-center ${
                      restaurantId === id
                        ? 'border-violet-500 bg-violet-950/40 text-violet-300'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    🏪 {r.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Tier override */}
            <div className="mb-5">
              <label className="text-xs text-zinc-500 block mb-2">Loyalty Tier</label>
              <div className="grid grid-cols-4 gap-2">
                {(['none', 'silver', 'gold', 'platinum'] as LoyaltyTier[]).map((t) => {
                  const cfg = LOYALTY_TIERS[t];
                  return (
                    <button
                      key={t}
                      onClick={() => { setSelectedTier(t); setSelectedScenario(''); }}
                      className={`px-2 py-2 rounded-lg text-xs transition-all border text-center ${
                        selectedTier === t
                          ? 'border-violet-500 bg-violet-950/40 text-violet-300'
                          : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      {cfg.emoji} {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Execute button */}
            <button
              onClick={runPipeline}
              disabled={isRunning || amount <= 0}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                isRunning
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-violet-600 to-blue-600 text-white hover:from-violet-500 hover:to-blue-500 shadow-lg shadow-violet-900/30'
              }`}
            >
              {isRunning ? 'Running Hook Pipeline...' : '🦄 Execute Hook Pipeline'}
            </button>
          </div>

          {/* Right: Pipeline Visualization */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4">Hook Pipeline</h3>

            {/* Three Stages */}
            <div className="space-y-4">
              <PipelineStage
                number={1}
                label="Constraints"
                hookFn="beforeSwap"
                status={stages.constraints}
                detail={result ? result.constraints.reason : 'Restaurant whitelist, operating hours, transaction limits'}
                latencyMs={result?.constraints.latencyMs}
              />

              {/* Connector */}
              <div className="flex justify-center">
                <div className={`w-0.5 h-6 ${stages.constraints === 'done' ? 'bg-green-800' : 'bg-zinc-800'} transition-colors duration-300`} />
              </div>

              <PipelineStage
                number={2}
                label="Dynamic Pricing"
                hookFn="beforeSwap"
                status={stages.pricing}
                detail={
                  result && result.success
                    ? `Effective fee: ${(result.pricing.effectiveFee / 100).toFixed(2)}% — ${result.pricing.breakdown.slice(0, 3).join(', ')}`
                    : 'Tier-based discount + peak hour bonus + volatility adjustment'
                }
                latencyMs={result?.pricing.latencyMs}
              />

              <div className="flex justify-center">
                <div className={`w-0.5 h-6 ${stages.pricing === 'done' ? 'bg-green-800' : 'bg-zinc-800'} transition-colors duration-300`} />
              </div>

              <PipelineStage
                number={3}
                label="Settlement + Rewards"
                hookFn="afterSwap"
                status={stages.settlement}
                detail={
                  result && result.success
                    ? `${result.settlement.rewards.length} rewards earned: ${result.settlement.totalFoodyRewarded.toLocaleString()} FOODY`
                    : 'Fee split, FOODY cashback, loyalty upgrade, referral bonus, VIP NFT'
                }
                latencyMs={result?.settlement.latencyMs}
              />
            </div>

            {/* Result Summary */}
            {result && (
              <div className={`mt-6 rounded-xl border p-4 ${
                result.success
                  ? 'border-green-800/40 bg-green-950/20'
                  : 'border-red-800/40 bg-red-950/20'
              }`}>
                {result.success ? (
                  <>
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="text-green-400 text-lg">✓</span>
                      <span className="text-sm font-semibold text-green-300">Swap Successful</span>
                      <span className="text-xs text-zinc-500 ml-auto">{result.totalLatencyMs}ms</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-lg bg-zinc-900/50 p-3">
                        <div className="text-zinc-500">You Pay</div>
                        <div className="text-white font-mono font-bold">${amount.toLocaleString()} USDC</div>
                      </div>
                      <div className="rounded-lg bg-zinc-900/50 p-3">
                        <div className="text-zinc-500">You Receive</div>
                        <div className="text-cyan-400 font-mono font-bold">{(amount * FALLBACK_FOODY_PER_USD).toLocaleString()} FOODY</div>
                      </div>
                      <div className="rounded-lg bg-zinc-900/50 p-3">
                        <div className="text-zinc-500">Effective Fee</div>
                        <div className="text-violet-400 font-mono font-bold">{(result.pricing.effectiveFee / 100).toFixed(2)}%</div>
                      </div>
                      <div className="rounded-lg bg-zinc-900/50 p-3">
                        <div className="text-zinc-500">Rewards Earned</div>
                        <div className="text-green-400 font-mono font-bold">+{result.settlement.totalFoodyRewarded.toLocaleString()} FOODY</div>
                      </div>
                    </div>

                    {/* Reward breakdown */}
                    {result.settlement.rewards.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {result.settlement.rewards.map((r, i) => (
                          <div key={i} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-zinc-900/30">
                            <span className="text-zinc-400">{r.description}</span>
                            <span className="text-green-400 font-mono">+{r.foodyAmount.toLocaleString()} FOODY</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tier info */}
                    {result.settlement.loyaltyProfile.tier !== result.settlement.loyaltyProfile.tier && (
                      <div className="mt-3 text-center text-sm text-yellow-400 font-semibold">
                        ⬆️ Tier Upgraded!
                      </div>
                    )}

                    {/* Fee split */}
                    <div className="mt-3 pt-3 border-t border-zinc-800">
                      <div className="text-xs text-zinc-500 mb-2">Fee Distribution</div>
                      <div className="flex gap-2">
                        <div className="flex-[9] rounded-lg bg-emerald-950/30 border border-emerald-900/30 p-2 text-center">
                          <div className="text-xs text-emerald-400 font-mono">${(amount * 0.9).toFixed(2)}</div>
                          <div className="text-[10px] text-zinc-500">Restaurant 90%</div>
                        </div>
                        <div className="flex-[0.5] rounded-lg bg-blue-950/30 border border-blue-900/30 p-2 text-center">
                          <div className="text-xs text-blue-400 font-mono">${(amount * 0.05).toFixed(2)}</div>
                          <div className="text-[10px] text-zinc-500">Platform 5%</div>
                        </div>
                        <div className="flex-[0.5] rounded-lg bg-violet-950/30 border border-violet-900/30 p-2 text-center">
                          <div className="text-xs text-violet-400 font-mono">${(amount * 0.05).toFixed(2)}</div>
                          <div className="text-[10px] text-zinc-500">Rewards 5%</div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-start space-x-2">
                    <span className="text-red-400 text-lg">✗</span>
                    <div>
                      <div className="text-sm font-semibold text-red-300">Swap Blocked</div>
                      <div className="text-xs text-zinc-400 mt-1">{result.blockReason}</div>
                      <div className="text-xs text-zinc-500 mt-1">Blocked by: <span className="text-red-400">{result.blockedBy}</span> hook</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PipelineStage({
  number,
  label,
  hookFn,
  status,
  detail,
  latencyMs,
}: {
  number: number;
  label: string;
  hookFn: string;
  status: StageStatus;
  detail: string;
  latencyMs?: number;
}) {
  const statusConfig = {
    pending:  { bg: 'bg-zinc-900',       border: 'border-zinc-700',   icon: '—', iconColor: 'text-zinc-500' },
    running:  { bg: 'bg-blue-950/30',    border: 'border-blue-700',   icon: '...', iconColor: 'text-blue-400 animate-pulse' },
    done:     { bg: 'bg-green-950/20',   border: 'border-green-700',  icon: '✓', iconColor: 'text-green-400' },
    error:    { bg: 'bg-red-950/20',     border: 'border-red-700',    icon: '✗', iconColor: 'text-red-400' },
    blocked:  { bg: 'bg-zinc-900/50',    border: 'border-zinc-700',   icon: '⛔', iconColor: 'text-zinc-500' },
  };

  const cfg = statusConfig[status];

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4 transition-all duration-300`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center space-x-2">
          <span className={`w-6 h-6 rounded-full border ${cfg.border} flex items-center justify-center text-xs font-mono ${cfg.iconColor}`}>
            {cfg.icon}
          </span>
          <span className="text-sm font-semibold text-zinc-200">Layer {number}: {label}</span>
          <span className="text-[10px] font-mono text-zinc-600">({hookFn})</span>
        </div>
        {latencyMs !== undefined && status === 'done' && (
          <span className="text-[10px] text-zinc-500">{latencyMs}ms</span>
        )}
      </div>
      <p className="text-xs text-zinc-400 pl-8">{detail}</p>
    </div>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
