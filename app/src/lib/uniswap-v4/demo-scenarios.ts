// src/lib/uniswap-v4/demo-scenarios.ts
// Predefined demo scenarios for the FoodySwap V4 Hook demo page.
// Used by DemoInteractiveSwap and DemoHookPipeline components.

import type { LoyaltyTier, LoyaltyProfile, RestaurantConstraints } from './types'
import { DEFAULT_CONSTRAINTS, LOYALTY_TIERS } from './constants'

// ---------------------------------------------------------------------------
// Demo wallet address (not a real wallet, just for display)
// ---------------------------------------------------------------------------
export const DEMO_WALLET = '0xDemoFoody000000000000000000000000DeM0' as const

// ---------------------------------------------------------------------------
// Scenario definitions
// ---------------------------------------------------------------------------

export interface DemoScenario {
  id: string
  label: string
  description: string
  amountUSDC: number
  restaurantId: string
  tier: LoyaltyTier
  currentSpend: number   // totalSwapVolumeUSDC to set in loyalty profile
  isFirstSwap: boolean
  streak: number
  /** If provided, overrides the restaurant constraints for this scenario */
  restaurantOverride?: Partial<RestaurantConstraints>
  /** Emoji for quick visual identification */
  emoji: string
  /** Which hook feature this scenario best demonstrates */
  highlights: string[]
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'normal_bronze',
    label: 'Normal Swap (Bronze)',
    description: 'A $25 swap at Sichuan Garden as a new Bronze customer.',
    amountUSDC: 25,
    restaurantId: 'rest_001',
    tier: 'none',
    currentSpend: 0,
    isFirstSwap: false,
    streak: 0,
    emoji: '🥉',
    highlights: ['Basic constraints check', 'Base fee calculation', 'Swap bonus reward'],
  },
  {
    id: 'first_swap',
    label: 'First Swap (Welcome Bonus)',
    description: 'New user\'s very first swap — gets 5% welcome bonus!',
    amountUSDC: 50,
    restaurantId: 'rest_003',
    tier: 'none',
    currentSpend: 0,
    isFirstSwap: true,
    streak: 0,
    emoji: '🎉',
    highlights: ['Welcome bonus (5%)', 'First swap detection', 'Multiple reward types'],
  },
  {
    id: 'silver_regular',
    label: 'Silver Regular',
    description: 'Silver tier diner with a 3-day streak. Gets loyalty + streak bonus.',
    amountUSDC: 35,
    restaurantId: 'rest_002',
    tier: 'silver',
    currentSpend: 250,
    isFirstSwap: false,
    streak: 3,
    emoji: '🥈',
    highlights: ['Silver tier discount (5%)', 'Streak bonus', 'Loyalty multiplier'],
  },
  {
    id: 'gold_peak',
    label: 'Gold at Peak Hour',
    description: 'Gold customer during dinner rush. Max discounts + peak hour bonus.',
    amountUSDC: 80,
    restaurantId: 'rest_001',
    tier: 'gold',
    currentSpend: 600,
    isFirstSwap: false,
    streak: 7,
    emoji: '🥇',
    highlights: ['Gold tier discount (8%)', 'Peak hour bonus', '7-day streak'],
  },
  {
    id: 'vip_whale',
    label: 'VIP Diamond',
    description: 'VIP customer with 12% discount + 10% cashback. Maximum rewards.',
    amountUSDC: 100,
    restaurantId: 'rest_002',
    tier: 'platinum',
    currentSpend: 1500,
    isFirstSwap: false,
    streak: 14,
    emoji: '💎',
    highlights: ['VIP discount (12%)', '10% cashback', 'VIP NFT holder'],
  },
  {
    id: 'tier_upgrade',
    label: 'Tier Upgrade Moment!',
    description: 'Silver customer at $480 spent — this $50 swap triggers Gold upgrade!',
    amountUSDC: 50,
    restaurantId: 'rest_001',
    tier: 'silver',
    currentSpend: 480,
    isFirstSwap: false,
    streak: 5,
    emoji: '⬆️',
    highlights: ['Auto tier upgrade', 'Silver → Gold transition', 'New benefits unlocked'],
  },
  {
    id: 'restaurant_closed',
    label: 'Restaurant Closed',
    description: 'Attempt to pay when restaurant is closed. Hook blocks the swap.',
    amountUSDC: 25,
    restaurantId: 'rest_001',
    tier: 'none',
    currentSpend: 0,
    isFirstSwap: false,
    streak: 0,
    restaurantOverride: { status: 'closed' },
    emoji: '🚫',
    highlights: ['Constraint enforcement', 'Operating hours check', 'Transaction blocked'],
  },
  {
    id: 'over_limit',
    label: 'Over Transaction Limit',
    description: 'Amount exceeds $10,000 max. Hook enforces transaction limits.',
    amountUSDC: 15000,
    restaurantId: 'rest_001',
    tier: 'gold',
    currentSpend: 800,
    isFirstSwap: false,
    streak: 0,
    emoji: '⛔',
    highlights: ['Max amount enforcement', 'Risk management', 'Transaction rejected'],
  },
]

// ---------------------------------------------------------------------------
// Helper: build a LoyaltyProfile from a scenario
// ---------------------------------------------------------------------------

export function buildScenarioLoyalty(scenario: DemoScenario): LoyaltyProfile {
  return {
    walletAddress: DEMO_WALLET,
    tier: scenario.tier,
    totalSwapVolumeUSDC: scenario.currentSpend,
    totalSwapCount: Math.floor(scenario.currentSpend / 25), // rough estimate
    streak: scenario.streak,
    joinedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days ago
  }
}

// ---------------------------------------------------------------------------
// Quick-pick amounts
// ---------------------------------------------------------------------------
export const QUICK_AMOUNTS = [5, 10, 25, 50, 100, 500] as const

// ---------------------------------------------------------------------------
// Fee split constants (matches Solidity)
// ---------------------------------------------------------------------------
export const FEE_SPLIT = {
  restaurant: { bps: 9000, percent: 90, label: 'Restaurant', emoji: '🏪', color: 'emerald' },
  platform:   { bps: 500,  percent: 5,  label: 'Platform',   emoji: '🔧', color: 'blue' },
  rewardPool: { bps: 500,  percent: 5,  label: 'Reward Pool', emoji: '🎁', color: 'violet' },
} as const

// ---------------------------------------------------------------------------
// Tier journey milestones for the slider
// ---------------------------------------------------------------------------
export const TIER_MILESTONES = [
  { tier: 'bronze' as LoyaltyTier,   spend: 0,    emoji: '🥉', label: 'Bronze',  discount: '2%',  cashback: '3%',  color: 'amber' },
  { tier: 'silver' as LoyaltyTier,   spend: 200,  emoji: '🥈', label: 'Silver',  discount: '5%',  cashback: '5%',  color: 'gray' },
  { tier: 'gold' as LoyaltyTier,     spend: 500,  emoji: '🥇', label: 'Gold',    discount: '8%',  cashback: '7%',  color: 'yellow' },
  { tier: 'platinum' as LoyaltyTier, spend: 1000, emoji: '💎', label: 'VIP',     discount: '12%', cashback: '10%', color: 'indigo' },
] as const

// ---------------------------------------------------------------------------
// Referral example data
// ---------------------------------------------------------------------------
export const REFERRAL_EXAMPLE = {
  referrer: { name: 'Alice', wallet: '0xAlice...1234', emoji: '👩' },
  referee:  { name: 'Bob',   wallet: '0xBob...5678',   emoji: '👨' },
  swapAmount: 50,
  referrerBonusPercent: 1,
  refereeBonusPercent: 2,
  foodyPerUSD: 1000,
} as const

// ---------------------------------------------------------------------------
// Settlement flow steps
// ---------------------------------------------------------------------------
export const SETTLEMENT_STEPS = [
  { id: 'customer',    label: 'Customer Wallet',     emoji: '👛', detail: 'Pays with FOODY tokens', color: 'violet' },
  { id: 'hook_before', label: 'beforeSwap Hook',     emoji: '🔍', detail: 'Constraints + Dynamic Fee', color: 'blue' },
  { id: 'pool_swap',   label: 'Uniswap V4 Pool',    emoji: '🦄', detail: 'Atomic FOODY → USDC swap', color: 'pink' },
  { id: 'hook_after',  label: 'afterSwap Hook',      emoji: '🎁', detail: 'Loyalty + Cashback + NFT', color: 'green' },
  { id: 'stripe',      label: 'Stripe Connect',      emoji: '💳', detail: 'USDC → USD off-ramp', color: 'indigo' },
  { id: 'bank',        label: 'Restaurant Bank',     emoji: '🏦', detail: 'Receives USD instantly', color: 'emerald' },
] as const
