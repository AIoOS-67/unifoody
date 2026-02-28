// src/components/UniswapV4Panel.tsx
// Main UI panel for the Uniswap v4 Hook pipeline.
// Supports both simulation mode (mock APIs) and live mode (real on-chain swaps).

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import type {
  HookStageStatus,
  ConstraintCheckResult,
  DynamicFeeResult,
  SettlementResult,
  LoyaltyTier,
  V4SwapQuote,
} from '@/lib/uniswap-v4/types'
import {
  HOOK_API_ROUTES,
  DEMO_RESTAURANTS,
  LOYALTY_TIERS,
  BLOCK_EXPLORER_URL,
  FOODY_ADDRESS,
  USDC_ADDRESS,
  HOOK_ADDRESS,
  RESTAURANT_IDS,
} from '@/lib/uniswap-v4/constants'
import { useSwapV4, type SwapDirection } from '@/hooks/useSwapV4'
import {
  readUserLoyalty,
  readUserBalances,
  readHookStats,
  TIER_LABELS,
  TIER_EMOJIS,
  type UserLoyaltyData,
  type HookStats,
} from '@/lib/uniswap-v4/onchain'

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StageIndicator({
  stage,
  status,
}: {
  stage: HookStageStatus
  status: 'pending' | 'running' | 'done' | 'error' | 'blocked'
}) {
  const colors = {
    pending: 'border-zinc-600 text-zinc-500',
    running: 'border-blue-500 text-blue-400 animate-pulse',
    done: 'border-green-500 text-green-400',
    error: 'border-red-500 text-red-400',
    blocked: 'border-orange-500 text-orange-400',
  }

  const icons = {
    pending: '--',
    running: '...',
    done: 'OK',
    error: '!!',
    blocked: 'X',
  }

  return (
    <div className={`flex items-center space-x-3 p-3 rounded-lg border ${colors[status]} bg-zinc-900/50`}>
      <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-mono font-bold ${colors[status]}`}>
        {icons[status]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white">{stage.label}</span>
          {stage.latencyMs > 0 && (
            <span className="text-xs text-zinc-500">{stage.latencyMs}ms</span>
          )}
        </div>
        <p className="text-xs text-zinc-400 truncate">{stage.detail}</p>
      </div>
    </div>
  )
}

function TierBadge({ tier }: { tier: LoyaltyTier | number }) {
  const tierNum = typeof tier === 'number' ? tier : (['none', 'bronze', 'silver', 'gold', 'platinum'].indexOf(tier))
  const label = TIER_LABELS[tierNum] ?? (typeof tier === 'string' ? LOYALTY_TIERS[tier]?.label : 'Unknown')
  const emoji = TIER_EMOJIS[tierNum] ?? ''

  const tierColors: Record<number, string> = {
    0: 'bg-amber-900/50 text-amber-400 border border-amber-700',
    1: 'bg-gray-600/50 text-gray-200 border border-gray-500',
    2: 'bg-yellow-900/50 text-yellow-300 border border-yellow-600',
    3: 'bg-indigo-900/50 text-indigo-300 border border-indigo-500',
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tierColors[tierNum] ?? 'bg-zinc-700 text-zinc-300'}`}>
      {emoji} {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const isTestnet = process.env.NEXT_PUBLIC_CHAIN_MODE === 'testnet'

interface UniswapV4PanelProps {
  walletAddress?: string | null
  className?: string
}

export default function UniswapV4Panel({ walletAddress, className = '' }: UniswapV4PanelProps) {
  const { address, isConnected } = useAccount()
  const swap = useSwapV4()

  // Tab state
  const [mode, setMode] = useState<'live' | 'simulate'>(isTestnet ? 'live' : 'simulate')

  // Swap input state
  const [amountUSDC, setAmountUSDC] = useState(10)
  const [swapAmountFoody, setSwapAmountFoody] = useState('1000')
  const [swapDirection, setSwapDirection] = useState<SwapDirection>('FOODY_TO_USDC')
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>('rest_001')

  // On-chain data
  const [loyalty, setLoyalty] = useState<UserLoyaltyData | null>(null)
  const [balances, setBalances] = useState<{ foody: number; usdc: number } | null>(null)
  const [hookStats, setHookStats] = useState<HookStats | null>(null)
  const [loadingOnchain, setLoadingOnchain] = useState(false)

  // Hook pipeline state (simulation)
  const [restaurantId, setRestaurantId] = useState<string>('rest_001')
  const [stages, setStages] = useState<HookStageStatus[]>([
    { stage: 'constraints', label: '1. Constraints Hook (beforeSwap)', status: 'active', detail: 'Awaiting swap...', latencyMs: 0 },
    { stage: 'pricing', label: '2. Pricing Hook (beforeSwap)', status: 'active', detail: 'Awaiting swap...', latencyMs: 0 },
    { stage: 'settlement', label: '3. Settlement Hook (afterSwap)', status: 'active', detail: 'Awaiting swap...', latencyMs: 0 },
  ])
  const [stageStatuses, setStageStatuses] = useState<Array<'pending' | 'running' | 'done' | 'error' | 'blocked'>>([
    'pending', 'pending', 'pending',
  ])
  const [quote, setQuote] = useState<V4SwapQuote | null>(null)
  const [constraintResult, setConstraintResult] = useState<any>(null)
  const [pricingResult, setPricingResult] = useState<any>(null)
  const [settlementResult, setSettlementResult] = useState<any>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [pipelineError, setPipelineError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Load on-chain data
  // ---------------------------------------------------------------------------

  const loadOnchainData = useCallback(async () => {
    if (!address) return
    setLoadingOnchain(true)
    try {
      const [loyaltyData, balanceData, stats] = await Promise.all([
        readUserLoyalty(address).catch(() => null),
        readUserBalances(address).catch(() => null),
        readHookStats().catch(() => null),
      ])
      if (loyaltyData) setLoyalty(loyaltyData)
      if (balanceData) setBalances({ foody: balanceData.foody, usdc: balanceData.usdc })
      if (stats) setHookStats(stats)
    } catch (err) {
      console.error('Failed to load on-chain data:', err)
    } finally {
      setLoadingOnchain(false)
    }
  }, [address])

  useEffect(() => {
    if (isConnected && address && mode === 'live') {
      loadOnchainData()
    }
  }, [isConnected, address, mode, loadOnchainData])

  // ---------------------------------------------------------------------------
  // Live swap execution
  // ---------------------------------------------------------------------------

  const handleLiveSwap = useCallback(async () => {
    const restaurant = DEMO_RESTAURANTS[selectedRestaurant]
    if (!restaurant) return

    const amount = parseFloat(swapAmountFoody)
    if (isNaN(amount) || amount <= 0) return

    const result = await swap.executeSwap(
      swapDirection,
      amount,
      restaurant.restaurantId,
    )

    if (result) {
      // Refresh on-chain data after successful swap
      setTimeout(() => loadOnchainData(), 5000)
    }
  }, [swap, swapDirection, swapAmountFoody, selectedRestaurant, loadOnchainData])

  // ---------------------------------------------------------------------------
  // Run the simulation pipeline
  // ---------------------------------------------------------------------------

  const runPipeline = useCallback(async () => {
    if (isRunning) return
    setIsRunning(true)
    setPipelineError(null)
    setQuote(null)

    const wallet = walletAddress || address || '0x0000000000000000000000000000000000000000'

    try {
      setStageStatuses(['running', 'pending', 'pending'])
      setStages(prev => prev.map((s, i) =>
        i === 0 ? { ...s, detail: `Checking constraints for ${DEMO_RESTAURANTS[restaurantId]?.name || 'restaurant'}...`, latencyMs: 0 } : s
      ))

      const constraintRes = await fetch(HOOK_API_ROUTES.constraints, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, amountUSDC, walletAddress: wallet }),
      })
      const constraintData = await constraintRes.json()
      setConstraintResult(constraintData)

      const cResult: ConstraintCheckResult = constraintData.result
      setStages(prev => prev.map((s, i) =>
        i === 0 ? { ...s, detail: cResult.reason, latencyMs: cResult.latencyMs, status: cResult.allowed ? 'active' : 'blocked' } : s
      ))

      if (!cResult.allowed) {
        setStageStatuses(['blocked', 'pending', 'pending'])
        setPipelineError(cResult.reason)
        setIsRunning(false)
        return
      }
      setStageStatuses(['done', 'running', 'pending'])

      const pricingRes = await fetch(HOOK_API_ROUTES.pricing, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountUSDC, walletAddress: wallet }),
      })
      const pricingData = await pricingRes.json()
      setPricingResult(pricingData)

      const feeResult: DynamicFeeResult = pricingData.fee
      setStages(prev => prev.map((s, i) =>
        i === 1 ? { ...s, detail: `Fee: ${(feeResult.effectiveFee / 100).toFixed(2)}% | ${pricingData.fee.marketConditions.volatility} volatility`, latencyMs: feeResult.latencyMs } : s
      ))
      setStageStatuses(['done', 'done', 'running'])

      const settlementRes = await fetch(HOOK_API_ROUTES.settlement, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: wallet, amountUSDC, restaurantId }),
      })
      const settlementData = await settlementRes.json()
      setSettlementResult(settlementData)

      const totalReward = settlementData.settlement.totalFoodyRewarded
      setStages(prev => prev.map((s, i) =>
        i === 2 ? { ...s, detail: `+${totalReward.toLocaleString()} FOODY rewards (${settlementData.settlement.rewardCount} types)`, latencyMs: settlementData.latencyMs || 0 } : s
      ))
      setStageStatuses(['done', 'done', 'done'])

      const estimatedFoody = pricingData.swapEstimate?.netFoody || (amountUSDC * pricingData.foodyPerUSD)
      setQuote({
        amountUSDC,
        estimatedFoody: Math.round(estimatedFoody * 100) / 100,
        effectiveFee: feeResult.effectiveFee,
        estimatedReward: Math.round(totalReward * 100) / 100,
        netFoody: Math.round((estimatedFoody + totalReward) * 100) / 100,
        loyaltyTier: feeResult.loyaltyTier,
        pipeline: {
          success: true,
          totalLatencyMs: (cResult.latencyMs || 0) + (feeResult.latencyMs || 0) + (settlementData.latencyMs || 0),
          constraints: cResult,
          pricing: feeResult,
          settlement: {
            rewards: settlementData.settlement.rewards,
            totalFoodyRewarded: totalReward,
            loyaltyProfile: settlementData.loyalty?.current || { walletAddress: wallet, tier: 'none', totalSwapVolumeUSDC: 0, totalSwapCount: 0, streak: 0, joinedAt: '' },
            latencyMs: settlementData.latencyMs || 0,
          },
        },
      })
    } catch (error: any) {
      console.error('[V4 Pipeline] Error:', error)
      setPipelineError(error.message || 'Pipeline execution failed')
      setStageStatuses(prev => prev.map(s => s === 'running' ? 'error' : s))
    } finally {
      setIsRunning(false)
    }
  }, [amountUSDC, restaurantId, walletAddress, address, isRunning])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className={`bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 bg-gradient-to-r from-violet-950/30 to-blue-950/30">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">FoodySwap V4 Hook</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              FOODY / USDC on {isTestnet ? 'Unichain Sepolia' : 'Unichain'} &middot; 3-stage programmable liquidity
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-violet-900/40 text-violet-300 border border-violet-700/50">
              v4
            </span>
            {isTestnet && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-900/40 text-yellow-300 border border-yellow-700/50">
                Testnet
              </span>
            )}
          </div>
        </div>

        {/* Mode tabs */}
        {isTestnet && (
          <div className="flex mt-3 space-x-1 bg-zinc-900 rounded-lg p-1">
            <button
              onClick={() => setMode('live')}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                mode === 'live' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Live Swap
            </button>
            <button
              onClick={() => setMode('simulate')}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                mode === 'simulate' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Simulate
            </button>
          </div>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* ================================================================= */}
        {/* LIVE MODE */}
        {/* ================================================================= */}
        {mode === 'live' && (
          <>
            {/* Wallet & Balance Info */}
            {isConnected && balances && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="text-xs text-zinc-500">FOODY Balance</div>
                  <div className="text-lg font-bold text-violet-300">
                    {balances.foody.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="text-xs text-zinc-500">USDC Balance</div>
                  <div className="text-lg font-bold text-green-300">
                    {balances.usdc.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            )}

            {/* On-chain Loyalty */}
            {loyalty && (
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">On-Chain Loyalty</span>
                  <TierBadge tier={loyalty.tier} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-zinc-500">Total Spent</span>
                    <div className="text-white font-medium">${loyalty.totalSpentUSDC.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-zinc-500">FOODY Earned</span>
                    <div className="text-green-400 font-medium">{loyalty.foodyEarnedFormatted.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-zinc-500">Swap Count</span>
                    <div className="text-white font-medium">{loyalty.swapCount.toString()}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Hook Stats */}
            {hookStats && (
              <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                <div className="text-xs text-zinc-500 mb-2">Hook Global Stats</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-zinc-500">Total Volume</span>
                    <div className="text-white">${hookStats.totalVolumeUSDC.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-zinc-500">Rewards Distributed</span>
                    <div className="text-green-400">{hookStats.totalRewardsFormatted.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Swap Form */}
            <div className="space-y-3">
              {/* Direction */}
              <div className="flex space-x-2">
                <button
                  onClick={() => setSwapDirection('FOODY_TO_USDC')}
                  className={`flex-1 py-2 rounded text-sm font-medium transition-all ${
                    swapDirection === 'FOODY_TO_USDC'
                      ? 'bg-violet-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
                  }`}
                >
                  FOODY &rarr; USDC
                </button>
                <button
                  onClick={() => setSwapDirection('USDC_TO_FOODY')}
                  className={`flex-1 py-2 rounded text-sm font-medium transition-all ${
                    swapDirection === 'USDC_TO_FOODY'
                      ? 'bg-violet-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
                  }`}
                >
                  USDC &rarr; FOODY
                </button>
              </div>

              {/* Amount input */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-400">
                  Amount ({swapDirection === 'FOODY_TO_USDC' ? 'FOODY' : 'USDC'})
                </label>
                <input
                  type="number"
                  value={swapAmountFoody}
                  onChange={(e) => setSwapAmountFoody(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-zinc-800 text-white text-sm border border-zinc-700 focus:border-violet-500 focus:outline-none"
                  placeholder={swapDirection === 'FOODY_TO_USDC' ? '1000' : '1'}
                />
              </div>

              {/* Restaurant */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-400">Restaurant</label>
                <select
                  value={selectedRestaurant}
                  onChange={(e) => setSelectedRestaurant(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-zinc-800 text-white text-sm border border-zinc-700 focus:border-violet-500 focus:outline-none"
                >
                  {Object.entries(DEMO_RESTAURANTS).map(([id, rest]) => (
                    <option key={id} value={id}>
                      {rest.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Swap Status */}
            {swap.status !== 'idle' && (
              <div className={`p-3 rounded-lg border text-sm ${
                swap.status === 'success'
                  ? 'bg-green-950/30 border-green-800/50 text-green-300'
                  : swap.status === 'error'
                  ? 'bg-red-950/30 border-red-800/50 text-red-300'
                  : 'bg-blue-950/30 border-blue-800/50 text-blue-300'
              }`}>
                {swap.status === 'approving' && 'Approving token...'}
                {swap.status === 'swapping' && 'Executing swap through V4 Hook...'}
                {swap.status === 'confirming' && 'Confirming transaction...'}
                {swap.status === 'success' && (
                  <div>
                    Swap successful!
                    {swap.lastTxHash && (
                      <a
                        href={`${BLOCK_EXPLORER_URL}/tx/${swap.lastTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 underline hover:text-green-200"
                      >
                        View on Uniscan &rarr;
                      </a>
                    )}
                  </div>
                )}
                {swap.status === 'error' && `Error: ${swap.error}`}
              </div>
            )}

            {/* Execute button */}
            {!isConnected ? (
              <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 text-center text-sm text-zinc-400">
                Connect your wallet to execute live swaps
              </div>
            ) : (
              <button
                onClick={handleLiveSwap}
                disabled={swap.status === 'approving' || swap.status === 'swapping' || swap.status === 'confirming'}
                className={`w-full py-3 rounded-lg text-sm font-medium transition-all ${
                  swap.status === 'approving' || swap.status === 'swapping' || swap.status === 'confirming'
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-violet-600 to-blue-600 text-white hover:from-violet-500 hover:to-blue-500'
                }`}
              >
                {swap.status === 'approving' || swap.status === 'swapping' || swap.status === 'confirming'
                  ? 'Processing...'
                  : `Swap ${swapAmountFoody} ${swapDirection === 'FOODY_TO_USDC' ? 'FOODY' : 'USDC'} via Hook`}
              </button>
            )}

            {/* Contract links */}
            <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
              <a href={`${BLOCK_EXPLORER_URL}/address/${HOOK_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="hover:text-violet-400 transition-colors">
                Hook Contract &rarr;
              </a>
              <a href={`${BLOCK_EXPLORER_URL}/address/${FOODY_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="hover:text-violet-400 transition-colors">
                FOODY Token &rarr;
              </a>
              <a href={`${BLOCK_EXPLORER_URL}/address/${USDC_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="hover:text-violet-400 transition-colors">
                MockUSDC &rarr;
              </a>
            </div>
          </>
        )}

        {/* ================================================================= */}
        {/* SIMULATE MODE */}
        {/* ================================================================= */}
        {mode === 'simulate' && (
          <>
            {/* Swap Input Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-zinc-400">Swap Amount (USDC)</label>
                <div className="flex space-x-2">
                  {[5, 10, 25, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setAmountUSDC(amt)}
                      className={`flex-1 px-2 py-2 rounded text-sm font-medium transition-all ${
                        amt === amountUSDC
                          ? 'bg-violet-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-zinc-400">Restaurant Context</label>
                <select
                  value={restaurantId}
                  onChange={(e) => setRestaurantId(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-zinc-800 text-white text-sm border border-zinc-700 focus:border-violet-500 focus:outline-none"
                >
                  <option value="">No restaurant (default)</option>
                  {Object.entries(DEMO_RESTAURANTS).map(([id, rest]) => (
                    <option key={id} value={id}>
                      {rest.name} ({rest.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Hook Pipeline Visualization */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-300">Hook Pipeline</h3>
                {quote && (
                  <span className="text-xs text-zinc-500">
                    Total: {quote.pipeline.totalLatencyMs}ms
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {stages.map((stage, i) => (
                  <StageIndicator key={stage.stage} stage={stage} status={stageStatuses[i]} />
                ))}
              </div>
              <div className="flex justify-center py-1">
                <div className="flex items-center space-x-1 text-xs text-zinc-600">
                  <span>beforeSwap</span>
                  <span className="text-zinc-700">&rarr;</span>
                  <span>swap</span>
                  <span className="text-zinc-700">&rarr;</span>
                  <span>afterSwap</span>
                </div>
              </div>
            </div>

            {/* Error display */}
            {pipelineError && (
              <div className="p-3 rounded-lg bg-red-950/30 border border-red-800/50 text-red-300 text-sm">
                <span className="font-medium">Pipeline blocked:</span> {pipelineError}
              </div>
            )}

            {/* Quote Result */}
            {quote && (
              <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 space-y-3">
                <h4 className="text-sm font-medium text-zinc-300">Swap Quote</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-zinc-500 text-xs">You Pay</div>
                    <div className="text-white font-medium">${quote.amountUSDC} USDC</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 text-xs">You Receive</div>
                    <div className="text-white font-medium">{quote.estimatedFoody.toLocaleString()} FOODY</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 text-xs">Effective Fee</div>
                    <div className="text-white font-medium">{(quote.effectiveFee / 100).toFixed(2)}%</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 text-xs">Rewards Earned</div>
                    <div className="text-green-400 font-medium">+{quote.estimatedReward.toLocaleString()} FOODY</div>
                  </div>
                </div>
                <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="text-zinc-500 text-xs">Net FOODY (swap + rewards)</div>
                    <div className="text-lg font-bold text-violet-300">{quote.netFoody.toLocaleString()} FOODY</div>
                  </div>
                  <TierBadge tier={quote.loyaltyTier} />
                </div>
              </div>
            )}

            {/* Run pipeline button */}
            <button
              onClick={runPipeline}
              disabled={isRunning}
              className={`w-full py-3 rounded-lg text-sm font-medium transition-all ${
                isRunning
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-violet-600 to-blue-600 text-white hover:from-violet-500 hover:to-blue-500'
              }`}
            >
              {isRunning ? 'Running Hook Pipeline...' : `Simulate v4 Swap: $${amountUSDC} USDC -> FOODY`}
            </button>

            {/* Architecture note */}
            <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
              <p className="text-xs text-zinc-500 leading-relaxed">
                <span className="text-zinc-400 font-medium">Architecture:</span>{' '}
                This pipeline simulates three composable Uniswap v4 hook contracts around the FOODY/USDC pool.
                Constraints (beforeSwap) enforce restaurant availability. Pricing (beforeSwap) adjusts fees
                dynamically based on loyalty tier. Settlement (afterSwap) distributes FOODY cashback rewards.
                {isTestnet && ' Switch to "Live Swap" tab to execute real on-chain swaps.'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
