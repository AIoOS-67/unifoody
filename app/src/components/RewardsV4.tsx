// src/components/RewardsV4.tsx
// Rewards & Loyalty component for the Uniswap v4 FoodySwap Hook.
// Supports two modes:
//   - Live: reads on-chain loyalty data from FoodySwapHook contract
//   - Simulate: calls mock API routes (legacy)

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import type { LoyaltyTier, RewardType, RewardEntry } from '@/lib/uniswap-v4/types'
import {
  LOYALTY_TIERS,
  REWARD_CONFIGS,
  HOOK_API_ROUTES,
  BLOCK_EXPLORER_URL,
  HOOK_ADDRESS,
  FOODY_ADDRESS,
  USDC_ADDRESS,
  VIP_NFT_ADDRESS,
} from '@/lib/uniswap-v4/constants'
import {
  readUserLoyalty,
  readUserBalances,
  readUserFee,
  readIsVIP,
  readHookStats,
  TIER_LABELS,
  TIER_EMOJIS,
  type UserLoyaltyData,
  type HookStats,
} from '@/lib/uniswap-v4/onchain'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = 'live' | 'simulate'

interface OnChainLoyalty {
  tier: number
  tierLabel: string
  tierEmoji: string
  totalSpentUSDC: number
  foodyEarned: number
  swapCount: number
  referralEarned: number
  lastSwapTime: number
  currentFeeBps: number
  isVIP: boolean
}

// ---------------------------------------------------------------------------
// Tier Progress sub-component
// ---------------------------------------------------------------------------

function TierProgressCard({ loyalty, isVIP }: { loyalty: OnChainLoyalty; isVIP: boolean }) {
  // Map on-chain tier (0-3) to display info
  const tierConfig = [
    { label: 'Bronze', emoji: '\u{1F949}', bg: 'from-amber-950 to-amber-900/50', border: 'border-amber-700', text: 'text-amber-300', threshold: 0 },
    { label: 'Silver', emoji: '\u{1F948}', bg: 'from-gray-700 to-gray-800', border: 'border-gray-500', text: 'text-gray-200', threshold: 200 },
    { label: 'Gold', emoji: '\u{1F947}', bg: 'from-yellow-900 to-yellow-950', border: 'border-yellow-600', text: 'text-yellow-300', threshold: 500 },
    { label: 'VIP', emoji: '\u{1F48E}', bg: 'from-indigo-900 to-indigo-950', border: 'border-indigo-500', text: 'text-indigo-300', threshold: 1000 },
  ]

  const cfg = tierConfig[loyalty.tier] ?? tierConfig[0]
  const nextTier = loyalty.tier < 3 ? tierConfig[loyalty.tier + 1] : null
  const progressToNext = nextTier
    ? Math.min(100, (loyalty.totalSpentUSDC / nextTier.threshold) * 100)
    : 100

  return (
    <div className={`rounded-xl bg-gradient-to-br ${cfg.bg} border ${cfg.border} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className={`w-12 h-12 rounded-full bg-zinc-950/50 flex items-center justify-center text-2xl`}>
            {cfg.emoji}
          </div>
          <div>
            <div className={`text-sm font-semibold ${cfg.text} flex items-center space-x-2`}>
              <span>{cfg.label} Tier</span>
              {isVIP && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/30 text-indigo-300 border border-indigo-500/50">
                  VIP NFT
                </span>
              )}
            </div>
            <div className="text-xs text-zinc-400">
              Fee discount: {(loyalty.currentFeeBps / 100).toFixed(1)}% off
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-white">{loyalty.swapCount}</div>
          <div className="text-xs text-zinc-500">swaps</div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-zinc-950/30 rounded-lg p-2 text-center">
          <div className="text-sm font-medium text-white">${loyalty.totalSpentUSDC.toLocaleString()}</div>
          <div className="text-[10px] text-zinc-500">Total Spent</div>
        </div>
        <div className="bg-zinc-950/30 rounded-lg p-2 text-center">
          <div className="text-sm font-medium text-green-400">{loyalty.foodyEarned.toLocaleString()}</div>
          <div className="text-[10px] text-zinc-500">FOODY Earned</div>
        </div>
        <div className="bg-zinc-950/30 rounded-lg p-2 text-center">
          <div className="text-sm font-medium text-pink-400">{loyalty.referralEarned.toLocaleString()}</div>
          <div className="text-[10px] text-zinc-500">Referral</div>
        </div>
      </div>

      {/* Progress to next tier */}
      {nextTier ? (
        <div>
          <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
            <span>Progress to {nextTier.label}</span>
            <span>${loyalty.totalSpentUSDC.toFixed(0)} / ${nextTier.threshold}</span>
          </div>
          <div className="h-1.5 bg-zinc-950/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${progressToNext}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="text-center text-xs text-indigo-300">
          Max tier reached! You&apos;re a VIP
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Balances sub-component
// ---------------------------------------------------------------------------

function BalancesCard({ foody, usdc }: { foody: number; usdc: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
        <div className="text-xs text-zinc-500 mb-1">FOODY Balance</div>
        <div className="text-lg font-bold text-violet-400">{foody.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
        <div className="text-xs text-zinc-500 mb-1">USDC Balance</div>
        <div className="text-lg font-bold text-blue-400">{usdc.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hook Stats sub-component
// ---------------------------------------------------------------------------

function HookStatsCard({ stats }: { stats: HookStats }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-zinc-400">Hook Global Stats</h4>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-center">
          <div className="text-sm font-medium text-white">${stats.totalVolumeUSDC.toLocaleString()}</div>
          <div className="text-[10px] text-zinc-500">Total Volume</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-center">
          <div className="text-sm font-medium text-green-400">{stats.totalRewardsFormatted.toLocaleString()}</div>
          <div className="text-[10px] text-zinc-500">Rewards Distributed</div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tier Table sub-component
// ---------------------------------------------------------------------------

function TierTable({ currentTier }: { currentTier: number }) {
  const tiers = [
    { tier: 0, name: 'Bronze', emoji: '\u{1F949}', volume: '$0+', discount: '2%', cashback: '3%' },
    { tier: 1, name: 'Silver', emoji: '\u{1F948}', volume: '$200+', discount: '5%', cashback: '5%' },
    { tier: 2, name: 'Gold', emoji: '\u{1F947}', volume: '$500+', discount: '8%', cashback: '7%' },
    { tier: 3, name: 'VIP', emoji: '\u{1F48E}', volume: '$1,000+', discount: '12%', cashback: '10%' },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-zinc-500 border-b border-zinc-800">
            <th className="text-left py-2 pr-3">Tier</th>
            <th className="text-right py-2 px-2">Volume</th>
            <th className="text-right py-2 px-2">Fee Disc.</th>
            <th className="text-right py-2 pl-2">Cashback</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((t) => {
            const isActive = currentTier === t.tier
            return (
              <tr
                key={t.tier}
                className={`border-b border-zinc-800/50 ${isActive ? 'text-white font-medium bg-zinc-800/30' : 'text-zinc-400'}`}
              >
                <td className="py-2 pr-3">
                  {t.emoji} {t.name}
                  {isActive && <span className="ml-1 text-green-400 text-[10px]">(you)</span>}
                </td>
                <td className="text-right py-2 px-2">{t.volume}</td>
                <td className="text-right py-2 px-2">{t.discount}</td>
                <td className="text-right py-2 pl-2">{t.cashback}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Simulation sub-components (legacy)
// ---------------------------------------------------------------------------

function RewardTypeIcon({ type }: { type: RewardType }) {
  const icons: Record<RewardType, { symbol: string; color: string }> = {
    swap_bonus:          { symbol: 'SB', color: 'bg-green-900/50 text-green-400 border-green-700' },
    loyalty_bonus:       { symbol: 'LB', color: 'bg-violet-900/50 text-violet-400 border-violet-700' },
    streak_bonus:        { symbol: 'SK', color: 'bg-orange-900/50 text-orange-400 border-orange-700' },
    cashback_restaurant: { symbol: 'CB', color: 'bg-blue-900/50 text-blue-400 border-blue-700' },
    referral_reward:     { symbol: 'RF', color: 'bg-pink-900/50 text-pink-400 border-pink-700' },
    first_swap_bonus:    { symbol: 'FS', color: 'bg-yellow-900/50 text-yellow-400 border-yellow-700' },
  }
  const { symbol, color } = icons[type] || icons.swap_bonus
  return (
    <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold ${color}`}>
      {symbol}
    </div>
  )
}

function RewardRow({ reward }: { reward: RewardEntry }) {
  const statusColors = {
    pending: 'text-yellow-400',
    settled: 'text-green-400',
    failed: 'text-red-400',
  }

  return (
    <div className="flex items-center space-x-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
      <RewardTypeIcon type={reward.rewardType} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">{reward.description}</div>
        <div className="flex items-center space-x-2 text-xs text-zinc-500">
          <span>${reward.swapAmountUSDC} swap</span>
          <span className="text-zinc-700">|</span>
          <span className={statusColors[reward.status]}>{reward.status}</span>
          <span className="text-zinc-700">|</span>
          <span>{new Date(reward.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold text-green-400">
          +{reward.foodyAmount.toLocaleString()}
        </div>
        <div className="text-xs text-zinc-500">FOODY</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface RewardsV4Props {
  walletAddress?: string | null
  className?: string
}

export default function RewardsV4({ walletAddress, className = '' }: RewardsV4Props) {
  const { address: connectedAddress } = useAccount()
  const effectiveAddress = walletAddress ?? connectedAddress

  const [mode, setMode] = useState<ViewMode>('live')

  // -- Live mode state --
  const [loyalty, setLoyalty] = useState<OnChainLoyalty | null>(null)
  const [balances, setBalances] = useState<{ foody: number; usdc: number } | null>(null)
  const [hookStats, setHookStats] = useState<HookStats | null>(null)
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)

  // -- Simulate mode state (legacy) --
  const [rewards, setRewards] = useState<RewardEntry[]>([])
  const [simStats, setSimStats] = useState<{
    totalRewards: number
    totalFoody: number
    rewardsByType: Record<string, { count: number; totalFoody: number }>
  } | null>(null)
  const [simLoyalty, setSimLoyalty] = useState<{
    tier: LoyaltyTier
    label: string
    totalVolume: number
    totalSwaps: number
    streak: number
    multiplier: number
  } | null>(null)
  const [simLoading, setSimLoading] = useState(false)
  const [simError, setSimError] = useState<string | null>(null)
  const [showAllRewards, setShowAllRewards] = useState(false)

  // -- Live mode: fetch on-chain data --
  const fetchLiveData = useCallback(async () => {
    if (!effectiveAddress) return

    setLiveLoading(true)
    setLiveError(null)

    try {
      const userAddr = effectiveAddress as `0x${string}`

      // Parallel reads
      const [loyaltyData, balanceData, feeBps, vipStatus, stats] = await Promise.all([
        readUserLoyalty(userAddr),
        readUserBalances(userAddr),
        readUserFee(userAddr),
        readIsVIP(userAddr),
        readHookStats(),
      ])

      setLoyalty({
        tier: loyaltyData.tier,
        tierLabel: loyaltyData.tierLabel,
        tierEmoji: loyaltyData.tierEmoji,
        totalSpentUSDC: loyaltyData.totalSpentUSDC,
        foodyEarned: loyaltyData.foodyEarnedFormatted,
        swapCount: Number(loyaltyData.swapCount),
        referralEarned: Number(loyaltyData.referralEarned) / 1e18,
        lastSwapTime: Number(loyaltyData.lastSwapTime),
        currentFeeBps: feeBps,
        isVIP: vipStatus,
      })

      setBalances({
        foody: balanceData.foody,
        usdc: balanceData.usdc,
      })

      setHookStats(stats)
    } catch (err: any) {
      console.error('[RewardsV4] Live fetch error:', err)
      setLiveError(err?.shortMessage ?? err?.message ?? 'Failed to read on-chain data')
    } finally {
      setLiveLoading(false)
    }
  }, [effectiveAddress])

  // -- Simulate mode: fetch from API (legacy) --
  const fetchSimData = useCallback(async () => {
    if (!effectiveAddress) return

    setSimLoading(true)
    setSimError(null)

    try {
      const response = await fetch(
        `${HOOK_API_ROUTES.settlement}?wallet=${effectiveAddress}`,
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch rewards: ${response.statusText}`)
      }

      const data = await response.json()
      setRewards(data.rewards || [])
      setSimStats(data.stats || null)
      if (data.loyalty) {
        setSimLoyalty({
          tier: data.loyalty.tier || 'none',
          label: data.loyalty.label || 'New Diner',
          totalVolume: data.loyalty.totalVolume || 0,
          totalSwaps: data.loyalty.totalSwaps || 0,
          streak: data.loyalty.streak || 0,
          multiplier: data.loyalty.multiplier || 1.0,
        })
      }
    } catch (err: any) {
      console.error('[RewardsV4] Sim fetch error:', err)
      setSimError(err.message || 'Failed to load rewards')
    } finally {
      setSimLoading(false)
    }
  }, [effectiveAddress])

  // Auto-fetch on mode change or wallet connect
  useEffect(() => {
    if (mode === 'live') {
      fetchLiveData()
    } else {
      fetchSimData()
    }
  }, [mode, fetchLiveData, fetchSimData])

  // ---------------------------------------------------------------------------
  // Render — No wallet
  // ---------------------------------------------------------------------------

  if (!effectiveAddress) {
    return (
      <div className={`bg-zinc-950 rounded-xl border border-zinc-800 p-6 text-center ${className}`}>
        <div className="text-3xl mb-2">--</div>
        <p className="text-sm text-zinc-400">Connect your wallet to view v4 rewards</p>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render — Live Mode
  // ---------------------------------------------------------------------------

  const renderLiveMode = () => {
    if (liveLoading) {
      return (
        <div className="flex items-center justify-center space-x-2 py-12">
          <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-violet-300">Reading on-chain data...</span>
        </div>
      )
    }

    if (liveError) {
      return (
        <div className="text-center py-8">
          <p className="text-sm text-red-400 mb-2">{liveError}</p>
          <button
            onClick={fetchLiveData}
            className="text-xs text-violet-400 hover:text-violet-300 underline"
          >
            Retry
          </button>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {/* Loyalty Tier */}
        {loyalty && (
          <TierProgressCard loyalty={loyalty} isVIP={loyalty.isVIP} />
        )}

        {/* Balances */}
        {balances && (
          <BalancesCard foody={balances.foody} usdc={balances.usdc} />
        )}

        {/* Hook global stats */}
        {hookStats && <HookStatsCard stats={hookStats} />}

        {/* Last swap info */}
        {loyalty && loyalty.lastSwapTime > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Last Swap</span>
              <span className="text-xs text-zinc-300">
                {new Date(loyalty.lastSwapTime * 1000).toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Tier progression table */}
        <details className="group">
          <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors">
            Loyalty tier requirements
          </summary>
          <div className="mt-3">
            <TierTable currentTier={loyalty?.tier ?? 0} />
          </div>
        </details>

        {/* How it works */}
        <details className="group">
          <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors">
            How on-chain rewards work
          </summary>
          <div className="mt-3 space-y-2 text-xs text-zinc-400">
            <p>
              FoodySwap Hook rewards are calculated
              <span className="text-white font-medium"> on-chain in the afterSwap callback</span>:
            </p>
            <ul className="space-y-1.5 pl-3">
              <li className="list-disc">
                <span className="text-amber-400 font-medium">Tier-based Fee Discount:</span>{' '}
                Bronze 2% &rarr; Silver 5% &rarr; Gold 8% &rarr; VIP 12%
              </li>
              <li className="list-disc">
                <span className="text-green-400 font-medium">FOODY Cashback:</span>{' '}
                Bronze 3% &rarr; Silver 5% &rarr; Gold 7% &rarr; VIP 10%
              </li>
              <li className="list-disc">
                <span className="text-violet-400 font-medium">Auto Tier Upgrade:</span>{' '}
                Spend $200/$500/$1000 USDC to unlock higher tiers
              </li>
              <li className="list-disc">
                <span className="text-indigo-400 font-medium">VIP NFT:</span>{' '}
                Auto-minted when you reach VIP tier ($1,000+ spent)
              </li>
              <li className="list-disc">
                <span className="text-pink-400 font-medium">Referral Bonus:</span>{' '}
                Earn when a referred diner makes a swap
              </li>
            </ul>
            <p className="text-zinc-500 mt-2">
              All rewards are minted as FOODY tokens directly by the Hook contract.
              Fee splits: Restaurant 90% + Platform 5% + Reward Pool 5%.
            </p>
          </div>
        </details>

        {/* Contract links */}
        <div className="pt-2 border-t border-zinc-800 flex flex-wrap gap-3 text-[10px] text-zinc-600">
          <a
            href={`${BLOCK_EXPLORER_URL}/address/${HOOK_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-400 transition-colors"
          >
            Hook Contract &rarr;
          </a>
          <a
            href={`${BLOCK_EXPLORER_URL}/address/${VIP_NFT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-400 transition-colors"
          >
            VIP NFT &rarr;
          </a>
          <a
            href={`${BLOCK_EXPLORER_URL}/address/${effectiveAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-400 transition-colors"
          >
            Your Wallet &rarr;
          </a>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render — Simulate Mode (legacy)
  // ---------------------------------------------------------------------------

  const renderSimulateMode = () => {
    if (simLoading) {
      return (
        <div className="flex items-center justify-center space-x-2 py-12">
          <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-violet-300">Loading simulation data...</span>
        </div>
      )
    }

    if (simError) {
      return (
        <div className="text-center py-8">
          <p className="text-sm text-red-400 mb-2">{simError}</p>
          <button
            onClick={fetchSimData}
            className="text-xs text-violet-400 hover:text-violet-300 underline"
          >
            Retry
          </button>
        </div>
      )
    }

    const displayRewards = showAllRewards ? rewards : rewards.slice(0, 5)

    return (
      <div className="space-y-4">
        {/* Simulation loyalty summary */}
        {simLoyalty && (
          <div className="rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-zinc-950/50 flex items-center justify-center text-lg font-bold text-zinc-300">
                  {simLoyalty.tier.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold text-zinc-300">{simLoyalty.label}</div>
                  <div className="text-xs text-zinc-400">{simLoyalty.multiplier}x multiplier</div>
                </div>
              </div>
              {simLoyalty.streak > 0 && (
                <div className="text-right">
                  <div className="text-lg font-bold text-orange-400">{simLoyalty.streak}</div>
                  <div className="text-xs text-zinc-500">day streak</div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-950/30 rounded-lg p-2 text-center">
                <div className="text-sm font-medium text-white">${simLoyalty.totalVolume.toLocaleString()}</div>
                <div className="text-xs text-zinc-500">Total Volume</div>
              </div>
              <div className="bg-zinc-950/30 rounded-lg p-2 text-center">
                <div className="text-sm font-medium text-white">{simLoyalty.totalSwaps}</div>
                <div className="text-xs text-zinc-500">Total Swaps</div>
              </div>
            </div>
          </div>
        )}

        {/* Earnings by type */}
        {simStats && Object.keys(simStats.rewardsByType).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-zinc-400">Earnings by Type</h4>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(simStats.rewardsByType).map(([type, data]) => {
                const config = REWARD_CONFIGS[type as RewardType]
                return (
                  <div key={type} className="flex items-center space-x-2 p-2 rounded bg-zinc-900 border border-zinc-800">
                    <RewardTypeIcon type={type as RewardType} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-zinc-300 truncate">
                        {config?.type?.replace(/_/g, ' ') || type}
                      </div>
                      <div className="text-xs text-zinc-500">{data.count}x</div>
                    </div>
                    <div className="text-xs font-medium text-green-400">
                      {data.totalFoody.toLocaleString()}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Reward history */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-zinc-400">Reward History</h4>
            <button
              onClick={fetchSimData}
              className="text-xs text-violet-400 hover:text-violet-300"
            >
              Refresh
            </button>
          </div>

          {rewards.length > 0 ? (
            <>
              <div className="space-y-2">
                {displayRewards.map((reward) => (
                  <RewardRow key={reward.id} reward={reward} />
                ))}
              </div>
              {rewards.length > 5 && (
                <button
                  onClick={() => setShowAllRewards(!showAllRewards)}
                  className="w-full py-2 text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
                >
                  {showAllRewards ? 'Show less' : `Show all ${rewards.length} rewards`}
                </button>
              )}
            </>
          ) : (
            <div className="text-center py-6">
              <div className="text-2xl mb-2">--</div>
              <p className="text-sm text-zinc-400">No simulated rewards yet</p>
              <p className="text-xs text-zinc-500 mt-1">
                Swap USDC to FOODY through the v4 pipeline to earn dynamic rewards
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className={`bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden ${className}`}>
      {/* Header with mode toggle */}
      <div className="px-6 py-4 border-b border-zinc-800 bg-gradient-to-r from-green-950/30 to-emerald-950/30">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">v4 Hook Rewards</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              {mode === 'live'
                ? 'On-chain loyalty from FoodySwapHook'
                : 'Powered by Settlement Hook (afterSwap)'}
            </p>
          </div>
          <div className="flex items-center space-x-1">
            {/* Mode toggle */}
            <div className="flex bg-zinc-800 rounded-lg p-0.5">
              <button
                onClick={() => setMode('live')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  mode === 'live'
                    ? 'bg-green-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                Live
              </button>
              <button
                onClick={() => setMode('simulate')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  mode === 'simulate'
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                Simulate
              </button>
            </div>
            {/* Refresh button (live mode only) */}
            {mode === 'live' && (
              <button
                onClick={fetchLiveData}
                className="ml-2 p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                title="Refresh on-chain data"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </div>
        {/* Total FOODY earned badge (live mode) */}
        {mode === 'live' && loyalty && (
          <div className="mt-2 flex items-center space-x-2">
            <span className="text-xs text-zinc-500">Total earned:</span>
            <span className="text-sm font-bold text-green-400">
              {loyalty.foodyEarned.toLocaleString()} FOODY
            </span>
          </div>
        )}
        {/* Total FOODY badge (sim mode) */}
        {mode === 'simulate' && simStats && (
          <div className="mt-2 flex items-center space-x-2">
            <span className="text-xs text-zinc-500">Total earned:</span>
            <span className="text-sm font-bold text-green-400">
              {simStats.totalFoody.toLocaleString()} FOODY
            </span>
          </div>
        )}
      </div>

      <div className="p-6">
        {mode === 'live' ? renderLiveMode() : renderSimulateMode()}
      </div>
    </div>
  )
}
