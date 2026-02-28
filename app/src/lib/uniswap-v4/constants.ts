// src/lib/uniswap-v4/constants.ts
// Uniswap v4 contract addresses, pool configuration, and reward parameters
// Supports Unichain mainnet and Unichain Sepolia testnet via NEXT_PUBLIC_CHAIN_MODE

import type { PoolKey, Currency, LoyaltyTier, RewardType } from './types'

// ---------------------------------------------------------------------------
// Chain mode detection
// ---------------------------------------------------------------------------

const isTestnet = process.env.NEXT_PUBLIC_CHAIN_MODE === 'testnet'

// ---------------------------------------------------------------------------
// Contract addresses — Unichain Sepolia (testnet)
// ---------------------------------------------------------------------------

const SEPOLIA = {
  POOL_MANAGER: '0x1F98400000000000000000000000000000000004' as `0x${string}`,
  SWAP_ROUTER: '0xEf740bf23aCaE26f6492B10De645D6b98dC8Eaf3' as `0x${string}`,   // Universal Router
  POSITION_MANAGER: '0x4529A01c7A0410167c5740C487A8DE60232617bf' as `0x${string}`,
  QUOTER: '0x333e3C607B141b18fF6dE9f258Db6E77Fe7491E0' as `0x${string}`,
  STATE_VIEW: '0x86e8631a016f9068c3f085faf484ee3f5fdee8f2' as `0x${string}`,
  PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as `0x${string}`,
  FOODY_TOKEN: '0xf6f353078243c50eCca9af4D751A45816607Eb2a' as Currency,          // Deployed
  USDC_TOKEN: '0x078D782b760474a361dDA0AF3839290b0EF57AD6' as Currency,           // USDC on Unichain
  HOOK: '0xA25e61B83915D2e7E40167FB951C7Aa0a5b390C0' as `0x${string}`,            // Deployed
  VIP_NFT: '0x4d70E1D2A2828438a03ce93394EAFf875B923e61' as `0x${string}`,         // Deployed
  CHAIN_ID: 1301,
  BLOCK_EXPLORER: 'https://sepolia.uniscan.xyz',
} as const

// ---------------------------------------------------------------------------
// Contract addresses — Unichain mainnet
// ---------------------------------------------------------------------------

const MAINNET = {
  POOL_MANAGER: '0x1F98400000000000000000000000000000000004' as `0x${string}`,
  SWAP_ROUTER: '0xEf740bf23aCaE26f6492B10De645D6b98dC8Eaf3' as `0x${string}`,
  POSITION_MANAGER: '0x4529A01c7A0410167c5740C487A8DE60232617bf' as `0x${string}`,
  QUOTER: '0x333e3C607B141b18fF6dE9f258Db6E77Fe7491E0' as `0x${string}`,
  STATE_VIEW: '0x86e8631a016f9068c3f085faf484ee3f5fdee8f2' as `0x${string}`,
  PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as `0x${string}`,
  FOODY_TOKEN: '0x0000000000000000000000000000000000000000' as Currency,
  USDC_TOKEN: '0x078D782b760474a361dDA0AF3839290b0EF57AD6' as Currency,
  HOOK: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  VIP_NFT: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  CHAIN_ID: 130,
  BLOCK_EXPLORER: 'https://uniscan.xyz',
} as const

// ---------------------------------------------------------------------------
// Active addresses (based on chain mode)
// ---------------------------------------------------------------------------

const ACTIVE = isTestnet ? SEPOLIA : MAINNET

export const POOL_MANAGER_ADDRESS = ACTIVE.POOL_MANAGER
export const SWAP_ROUTER_ADDRESS = ACTIVE.SWAP_ROUTER
export const POSITION_MANAGER_ADDRESS = ACTIVE.POSITION_MANAGER
export const PERMIT2_ADDRESS = ACTIVE.PERMIT2
export const FOODY_ADDRESS = ACTIVE.FOODY_TOKEN
export const USDC_ADDRESS = ACTIVE.USDC_TOKEN
export const HOOK_ADDRESS = ACTIVE.HOOK
export const VIP_NFT_ADDRESS = ACTIVE.VIP_NFT
export const ACTIVE_CHAIN_ID = ACTIVE.CHAIN_ID
export const BLOCK_EXPLORER_URL = ACTIVE.BLOCK_EXPLORER
export const QUOTER_ADDRESS = ACTIVE.QUOTER
export const STATE_VIEW_ADDRESS = ACTIVE.STATE_VIEW

// Legacy exports for backwards compatibility
export const UNIVERSAL_ROUTER_V4 = ACTIVE.SWAP_ROUTER

// ---------------------------------------------------------------------------
// Pool configuration
// ---------------------------------------------------------------------------

/** The canonical FOODY/USDC pool key for Uniswap v4 */
export const FOODY_POOL_KEY: PoolKey = {
  // currency0 must be the lower address (sorted)
  currency0: FOODY_ADDRESS < USDC_ADDRESS ? FOODY_ADDRESS : USDC_ADDRESS,
  currency1: FOODY_ADDRESS < USDC_ADDRESS ? USDC_ADDRESS : FOODY_ADDRESS,
  fee: 0x800000,  // DYNAMIC_FEE_FLAG — hook controls fee
  tickSpacing: 60,
  hooks: HOOK_ADDRESS,
}

export const BASE_CHAIN_ID = ACTIVE_CHAIN_ID

// ---------------------------------------------------------------------------
// Restaurant IDs (bytes32 hashes, used in hookData)
// ---------------------------------------------------------------------------

export const RESTAURANT_IDS = {
  SICHUAN_GARDEN: '0x7e51c7f41531cde2898654d369fd09d3b5d2a39029d278858f88b37c748a04b9' as `0x${string}`,
  PEARL_DIM_SUM: '0x05c488028f71ff76efb60573c27c6b7509ecf63531e92e8fb57662e06ebfa306' as `0x${string}`,
  GOLDEN_PHO: '0xea762edab23d3e5c05d45f0e509ed7513b3536a3ef7a7598af98250915bd59bc' as `0x${string}`,
} as const

export const RESTAURANT_WALLETS: Record<string, `0x${string}`> = {
  [RESTAURANT_IDS.SICHUAN_GARDEN]: '0xcF5c56396128557eaD615d5B6BEED756159c0c13',
  [RESTAURANT_IDS.PEARL_DIM_SUM]: '0x7355048E9134CF7B641787E2061db87847E5d334',
  [RESTAURANT_IDS.GOLDEN_PHO]: '0x9c958328f273782FdDA6012fD28E556F466b118B',
}

// ---------------------------------------------------------------------------
// Token decimals
// ---------------------------------------------------------------------------

export const USDC_DECIMALS = 6
export const FOODY_DECIMALS = 18

// ---------------------------------------------------------------------------
// Loyalty tier thresholds (matches Hook Solidity constants)
// ---------------------------------------------------------------------------

export interface LoyaltyTierConfig {
  minVolumeUSDC: number
  feeDiscountBps: number
  cashbackBps: number
  label: string
  emoji: string
}

export const LOYALTY_TIERS: Record<LoyaltyTier, LoyaltyTierConfig> = {
  none: {
    minVolumeUSDC: 0,
    feeDiscountBps: 200,    // 2%
    cashbackBps: 300,        // 3%
    label: 'Bronze',
    emoji: '🥉',
  },
  bronze: {
    minVolumeUSDC: 0,
    feeDiscountBps: 200,
    cashbackBps: 300,
    label: 'Bronze',
    emoji: '🥉',
  },
  silver: {
    minVolumeUSDC: 200,
    feeDiscountBps: 500,     // 5%
    cashbackBps: 500,        // 5%
    label: 'Silver',
    emoji: '🥈',
  },
  gold: {
    minVolumeUSDC: 500,
    feeDiscountBps: 800,     // 8%
    cashbackBps: 700,        // 7%
    label: 'Gold',
    emoji: '🥇',
  },
  platinum: {
    minVolumeUSDC: 1000,
    feeDiscountBps: 1200,    // 12%
    cashbackBps: 1000,       // 10%
    label: 'VIP',
    emoji: '💎',
  },
}

// ---------------------------------------------------------------------------
// Dynamic fee parameters
// ---------------------------------------------------------------------------

export const FEE_CONFIG = {
  BASE_FEE_BPS: 3000,
  HIGH_VOLATILITY_SURCHARGE_BPS: 500,
  LOW_VOLATILITY_DISCOUNT_BPS: -1000,
  MIN_FEE_BPS: 500,
  MAX_FEE_BPS: 10000,
  HIGH_VOLUME_THRESHOLD: 50,
  HIGH_VOLUME_DISCOUNT_BPS: -500,
} as const

// ---------------------------------------------------------------------------
// Constraint defaults
// ---------------------------------------------------------------------------

export const DEFAULT_CONSTRAINTS = {
  MIN_SWAP_USDC_OPEN: 1,
  MIN_SWAP_USDC_BUSY: 5,
  MAX_SWAP_USDC: 10_000,
  BLOCK_WHEN_CLOSED: true,
} as const

// ---------------------------------------------------------------------------
// Reward parameters
// ---------------------------------------------------------------------------

export interface RewardConfig {
  type: RewardType
  baseRatePercent: number
  maxFoodyPerSwap: number
  description: string
}

export const REWARD_CONFIGS: Record<RewardType, RewardConfig> = {
  swap_bonus: {
    type: 'swap_bonus',
    baseRatePercent: 2.0,
    maxFoodyPerSwap: 50_000,
    description: 'Swap bonus: earn FOODY for every swap',
  },
  loyalty_bonus: {
    type: 'loyalty_bonus',
    baseRatePercent: 1.0,
    maxFoodyPerSwap: 25_000,
    description: 'Loyalty bonus: extra FOODY based on your tier',
  },
  streak_bonus: {
    type: 'streak_bonus',
    baseRatePercent: 0.5,
    maxFoodyPerSwap: 10_000,
    description: 'Streak bonus: reward for consecutive daily swaps',
  },
  cashback_restaurant: {
    type: 'cashback_restaurant',
    baseRatePercent: 1.5,
    maxFoodyPerSwap: 30_000,
    description: 'Restaurant cashback: merchants earn FOODY for accepting payments',
  },
  referral_reward: {
    type: 'referral_reward',
    baseRatePercent: 0.5,
    maxFoodyPerSwap: 15_000,
    description: 'Referral reward: earn when your referred diners swap',
  },
  first_swap_bonus: {
    type: 'first_swap_bonus',
    baseRatePercent: 5.0,
    maxFoodyPerSwap: 100_000,
    description: 'Welcome bonus: extra reward for your very first swap',
  },
}

// ---------------------------------------------------------------------------
// API route paths
// ---------------------------------------------------------------------------

export const HOOK_API_ROUTES = {
  constraints: '/api/hooks/constraints',
  pricing: '/api/hooks/pricing',
  settlement: '/api/hooks/settlement',
} as const

// ---------------------------------------------------------------------------
// Demo / simulation defaults
// ---------------------------------------------------------------------------

export const DEMO_RESTAURANTS: Record<string, { name: string; status: 'open' | 'busy' | 'closed'; restaurantId: `0x${string}` }> = {
  'rest_001': { name: 'Sichuan Garden', status: 'open', restaurantId: RESTAURANT_IDS.SICHUAN_GARDEN },
  'rest_002': { name: 'Pearl Dim Sum', status: 'open', restaurantId: RESTAURANT_IDS.PEARL_DIM_SUM },
  'rest_003': { name: 'Golden Pho', status: 'open', restaurantId: RESTAURANT_IDS.GOLDEN_PHO },
}

/** Default FOODY price used when the on-chain oracle is unavailable */
export const FALLBACK_FOODY_PRICE_USD = 0.001  // 1 FOODY = $0.001 (matches pool price)
export const FALLBACK_FOODY_PER_USD = 1000      // 1 USD = 1000 FOODY
