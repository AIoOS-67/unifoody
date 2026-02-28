// src/lib/uniswap-v4/types.ts
// Uniswap v4 type definitions for the FoodyePay hook system
// These types mirror the on-chain Solidity structs used by PoolManager and hook contracts.

// ---------------------------------------------------------------------------
// Core Uniswap v4 primitives
// ---------------------------------------------------------------------------

/** Represents a token's ERC-20 address. address(0) means native ETH. */
export type Currency = `0x${string}`

/**
 * PoolKey uniquely identifies a Uniswap v4 pool.
 * In v4 every pool lives inside the singleton PoolManager; it is not a separate
 * contract. The PoolKey is hashed to produce a PoolId.
 */
export interface PoolKey {
  currency0: Currency
  currency1: Currency
  fee: number          // uint24 — basis-point fee tier (e.g. 3000 = 0.30%)
  tickSpacing: number  // int24 — minimum tick movement between initialised ticks
  hooks: `0x${string}` // address of the hook contract (address(0) = no hooks)
}

/** PoolId is the keccak256 hash of the encoded PoolKey. */
export type PoolId = `0x${string}`

/**
 * BalanceDelta encodes two signed 128-bit deltas (amount0, amount1) packed
 * into a single int256 on-chain. Here we keep them separate for readability.
 */
export interface BalanceDelta {
  amount0: bigint
  amount1: bigint
}

/** Parameters that the PoolManager passes to beforeSwap / afterSwap hooks. */
export interface SwapParams {
  zeroForOne: boolean  // true = sell currency0 for currency1
  amountSpecified: bigint // positive = exactInput, negative = exactOutput
  sqrtPriceLimitX96: bigint
}

/** Result of a modify-liquidity operation. */
export interface ModifyLiquidityParams {
  tickLower: number
  tickUpper: number
  liquidityDelta: bigint
  salt: `0x${string}`
}

// ---------------------------------------------------------------------------
// Hook permission flags (Uniswap v4 standard)
// The hook address encodes which callbacks it implements via the lowest 14 bits.
// ---------------------------------------------------------------------------

export enum HookPermission {
  BEFORE_INITIALIZE      = 1 << 13,
  AFTER_INITIALIZE       = 1 << 12,
  BEFORE_ADD_LIQUIDITY   = 1 << 11,
  AFTER_ADD_LIQUIDITY    = 1 << 10,
  BEFORE_REMOVE_LIQUIDITY = 1 << 9,
  AFTER_REMOVE_LIQUIDITY = 1 << 8,
  BEFORE_SWAP            = 1 << 7,
  AFTER_SWAP             = 1 << 6,
  BEFORE_DONATE          = 1 << 5,
  AFTER_DONATE           = 1 << 4,
  BEFORE_SWAP_RETURNS_DELTA = 1 << 3,
  AFTER_SWAP_RETURNS_DELTA  = 1 << 2,
  AFTER_ADD_LIQUIDITY_RETURNS_DELTA    = 1 << 1,
  AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA = 1 << 0,
}

// ---------------------------------------------------------------------------
// FoodyePay hook-specific types
// ---------------------------------------------------------------------------

/**
 * The three hook stages that compose around the USDC/FOODY pool.
 * Each swap passes through constraints -> pricing -> settlement in sequence.
 */
export type HookStage = 'constraints' | 'pricing' | 'settlement'

/** Overall status of a hook evaluation. */
export type HookStatus = 'active' | 'bypassed' | 'blocked' | 'error'

// -- Constraints Hook types --------------------------------------------------

export type RestaurantStatus = 'open' | 'busy' | 'closed'

export interface RestaurantConstraints {
  restaurantId: string
  name: string
  status: RestaurantStatus
  /** Minimum swap amount in USDC when the restaurant is busy */
  busyMinimumUSDC: number
  /** Whether this restaurant currently accepts FOODY */
  acceptsFoody: boolean
  /** Operating hours in UTC (24-hour format) */
  openHour: number
  closeHour: number
  /** Optional: menu item IDs that are currently available */
  availableMenuItems?: string[]
  updatedAt: string
}

export interface ConstraintCheckResult {
  allowed: boolean
  reason: string
  restaurantStatus: RestaurantStatus
  minimumSwapUSDC: number
  maximumSwapUSDC: number
  /** Hook execution time in ms */
  latencyMs: number
}

// -- Pricing / Risk Hook types -----------------------------------------------

export type VolatilityLevel = 'low' | 'medium' | 'high'

export interface MarketConditions {
  volatility: VolatilityLevel
  /** 24-hour trading volume in USDC */
  volume24h: number
  /** Current FOODY price in USDC */
  foodyPriceUSD: number
  /** Price change percentage in the last hour */
  priceChange1h: number
  /** Number of swaps in the last hour */
  swapsLastHour: number
  /** Timestamp of last price fetch */
  timestamp: number
}

export type LoyaltyTier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum'

export interface LoyaltyProfile {
  walletAddress: string
  tier: LoyaltyTier
  totalSwapVolumeUSDC: number
  totalSwapCount: number
  /** Consecutive days with at least one swap */
  streak: number
  joinedAt: string
}

export interface DynamicFeeResult {
  /** Base fee in basis points (e.g. 3000 = 0.30%) */
  baseFee: number
  /** Adjustment in basis points — negative means a discount */
  adjustment: number
  /** Final effective fee */
  effectiveFee: number
  /** Human-readable explanation of the fee calculation */
  breakdown: string[]
  /** Loyalty tier of the swapper */
  loyaltyTier: LoyaltyTier
  /** Market conditions snapshot used for pricing */
  marketConditions: MarketConditions
  latencyMs: number
}

// -- Settlement / Incentives Hook types --------------------------------------

export type RewardType =
  | 'swap_bonus'
  | 'loyalty_bonus'
  | 'streak_bonus'
  | 'cashback_restaurant'
  | 'referral_reward'
  | 'first_swap_bonus'

export interface RewardEntry {
  id: string
  walletAddress: string
  rewardType: RewardType
  /** FOODY amount rewarded */
  foodyAmount: number
  /** The swap that triggered this reward */
  swapAmountUSDC: number
  /** Percentage rate applied */
  rewardRate: number
  loyaltyTier: LoyaltyTier
  description: string
  /** Pending until on-chain settlement, or simulated completion */
  status: 'pending' | 'settled' | 'failed'
  transactionHash?: string
  createdAt: string
  settledAt?: string
}

export interface SettlementResult {
  rewards: RewardEntry[]
  totalFoodyRewarded: number
  /** Updated loyalty profile after this settlement */
  loyaltyProfile: LoyaltyProfile
  latencyMs: number
}

// -- Composite pipeline result -----------------------------------------------

export interface HookPipelineResult {
  /** Did the swap pass all three hook stages? */
  success: boolean
  /** Overall pipeline execution time */
  totalLatencyMs: number
  constraints: ConstraintCheckResult
  pricing: DynamicFeeResult
  settlement: SettlementResult
  /** If the swap was blocked, which stage blocked it? */
  blockedBy?: HookStage
  blockReason?: string
}

// -- UI state types ----------------------------------------------------------

export interface HookStageStatus {
  stage: HookStage
  label: string
  status: HookStatus
  detail: string
  latencyMs: number
}

export interface V4SwapRequest {
  walletAddress: string
  amountUSDC: number
  restaurantId?: string
  menuItemId?: string
}

export interface V4SwapQuote {
  amountUSDC: number
  estimatedFoody: number
  effectiveFee: number
  estimatedReward: number
  netFoody: number // estimatedFoody + estimatedReward
  loyaltyTier: LoyaltyTier
  pipeline: HookPipelineResult
}
