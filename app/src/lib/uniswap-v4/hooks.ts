// src/lib/uniswap-v4/hooks.ts
// Core hook logic for the FoodyePay Uniswap v4 integration.
// Implements three composable hook stages:
//   1. Constraints (beforeSwap)  — real-world restaurant signals -> on-chain rules
//   2. Pricing     (beforeSwap)  — dynamic fee adjustment
//   3. Settlement  (afterSwap)   — post-swap reward distribution
//
// Each function here mirrors what the on-chain Solidity hook contract would do.
// The API routes call these functions. When real hook contracts are deployed,
// this logic will run on-chain; the simulation layer lets the UI work now.

import type {
  ConstraintCheckResult,
  DynamicFeeResult,
  SettlementResult,
  RestaurantConstraints,
  RestaurantStatus,
  MarketConditions,
  VolatilityLevel,
  LoyaltyProfile,
  LoyaltyTier,
  RewardEntry,
  RewardType,
  HookPipelineResult,
} from './types'

import {
  DEFAULT_CONSTRAINTS,
  FEE_CONFIG,
  LOYALTY_TIERS,
  REWARD_CONFIGS,
  DEMO_RESTAURANTS,
  FALLBACK_FOODY_PER_USD,
} from './constants'

// ---------------------------------------------------------------------------
// 1. CONSTRAINTS HOOK (beforeSwap)
// ---------------------------------------------------------------------------

/**
 * Evaluate whether a swap is allowed given the restaurant's current state.
 * On-chain, this would be the `beforeSwap` callback that reads an oracle
 * or state variable updated by an off-chain keeper with restaurant signals.
 */
export function evaluateConstraints(
  amountUSDC: number,
  restaurant?: RestaurantConstraints,
): ConstraintCheckResult {
  const start = performance.now()

  // If no restaurant context, apply minimal default constraints
  if (!restaurant) {
    const allowed = amountUSDC >= DEFAULT_CONSTRAINTS.MIN_SWAP_USDC_OPEN
      && amountUSDC <= DEFAULT_CONSTRAINTS.MAX_SWAP_USDC
    return {
      allowed,
      reason: allowed
        ? 'Swap within default limits (no restaurant context)'
        : `Swap amount $${amountUSDC} outside allowed range [$${DEFAULT_CONSTRAINTS.MIN_SWAP_USDC_OPEN} - $${DEFAULT_CONSTRAINTS.MAX_SWAP_USDC}]`,
      restaurantStatus: 'open',
      minimumSwapUSDC: DEFAULT_CONSTRAINTS.MIN_SWAP_USDC_OPEN,
      maximumSwapUSDC: DEFAULT_CONSTRAINTS.MAX_SWAP_USDC,
      latencyMs: Math.round(performance.now() - start),
    }
  }

  // Closed restaurant: block all swaps
  if (restaurant.status === 'closed') {
    return {
      allowed: false,
      reason: `${restaurant.name} is currently closed. Swaps are blocked until the restaurant reopens.`,
      restaurantStatus: 'closed',
      minimumSwapUSDC: 0,
      maximumSwapUSDC: 0,
      latencyMs: Math.round(performance.now() - start),
    }
  }

  // Restaurant does not accept FOODY
  if (!restaurant.acceptsFoody) {
    return {
      allowed: false,
      reason: `${restaurant.name} does not accept FOODY payments.`,
      restaurantStatus: restaurant.status,
      minimumSwapUSDC: 0,
      maximumSwapUSDC: 0,
      latencyMs: Math.round(performance.now() - start),
    }
  }

  // Busy restaurant: higher minimum
  const minSwap = restaurant.status === 'busy'
    ? restaurant.busyMinimumUSDC
    : DEFAULT_CONSTRAINTS.MIN_SWAP_USDC_OPEN
  const maxSwap = DEFAULT_CONSTRAINTS.MAX_SWAP_USDC

  if (amountUSDC < minSwap) {
    return {
      allowed: false,
      reason: `${restaurant.name} is busy. Minimum swap is $${minSwap} USDC during peak hours.`,
      restaurantStatus: 'busy',
      minimumSwapUSDC: minSwap,
      maximumSwapUSDC: maxSwap,
      latencyMs: Math.round(performance.now() - start),
    }
  }

  if (amountUSDC > maxSwap) {
    return {
      allowed: false,
      reason: `Swap exceeds maximum limit of $${maxSwap} USDC.`,
      restaurantStatus: restaurant.status,
      minimumSwapUSDC: minSwap,
      maximumSwapUSDC: maxSwap,
      latencyMs: Math.round(performance.now() - start),
    }
  }

  return {
    allowed: true,
    reason: `Swap approved by ${restaurant.name} (${restaurant.status}).`,
    restaurantStatus: restaurant.status,
    minimumSwapUSDC: minSwap,
    maximumSwapUSDC: maxSwap,
    latencyMs: Math.round(performance.now() - start),
  }
}

/**
 * Build a RestaurantConstraints object from the demo restaurants or a custom source.
 */
export function getRestaurantConstraints(restaurantId?: string): RestaurantConstraints | undefined {
  if (!restaurantId) return undefined

  const demo = DEMO_RESTAURANTS[restaurantId]
  if (!demo) return undefined

  const now = new Date()
  return {
    restaurantId,
    name: demo.name,
    status: demo.status,
    busyMinimumUSDC: DEFAULT_CONSTRAINTS.MIN_SWAP_USDC_BUSY,
    acceptsFoody: true,
    openHour: 8,
    closeHour: 22,
    updatedAt: now.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// 2. PRICING / RISK HOOK (beforeSwap + afterSwap)
// ---------------------------------------------------------------------------

/**
 * Determine the dynamic fee for a swap based on market conditions and loyalty.
 * On-chain this would override `lpFeeOverride` in the `beforeSwap` return value.
 */
export function calculateDynamicFee(
  amountUSDC: number,
  market: MarketConditions,
  loyalty: LoyaltyProfile,
): DynamicFeeResult {
  const start = performance.now()
  const breakdown: string[] = []
  let fee = FEE_CONFIG.BASE_FEE_BPS
  breakdown.push(`Base fee: ${(fee / 100).toFixed(2)}%`)

  // --- Volatility adjustment ---
  if (market.volatility === 'high') {
    fee += FEE_CONFIG.HIGH_VOLATILITY_SURCHARGE_BPS
    breakdown.push(`High volatility surcharge: +${(FEE_CONFIG.HIGH_VOLATILITY_SURCHARGE_BPS / 100).toFixed(2)}%`)
  } else if (market.volatility === 'low') {
    fee += FEE_CONFIG.LOW_VOLATILITY_DISCOUNT_BPS
    breakdown.push(`Low volatility discount: ${(FEE_CONFIG.LOW_VOLATILITY_DISCOUNT_BPS / 100).toFixed(2)}%`)
  }

  // --- Volume-based discount ---
  if (market.swapsLastHour >= FEE_CONFIG.HIGH_VOLUME_THRESHOLD) {
    fee += FEE_CONFIG.HIGH_VOLUME_DISCOUNT_BPS
    breakdown.push(`High volume discount: ${(FEE_CONFIG.HIGH_VOLUME_DISCOUNT_BPS / 100).toFixed(2)}%`)
  }

  // --- Loyalty tier discount ---
  const tierConfig = LOYALTY_TIERS[loyalty.tier]
  if (tierConfig.feeDiscountBps !== 0) {
    fee += tierConfig.feeDiscountBps
    breakdown.push(`${tierConfig.label} loyalty discount: ${(tierConfig.feeDiscountBps / 100).toFixed(2)}%`)
  }

  // --- Large swap risk premium ---
  if (amountUSDC > 1000) {
    const riskPremium = Math.min(Math.floor(amountUSDC / 500) * 50, 2000) // max +0.20%
    fee += riskPremium
    breakdown.push(`Large swap risk premium: +${(riskPremium / 100).toFixed(2)}%`)
  }

  // --- Clamp to min/max ---
  const effectiveFee = Math.max(FEE_CONFIG.MIN_FEE_BPS, Math.min(FEE_CONFIG.MAX_FEE_BPS, fee))
  if (effectiveFee !== fee) {
    breakdown.push(`Clamped to [${(FEE_CONFIG.MIN_FEE_BPS / 100).toFixed(2)}% - ${(FEE_CONFIG.MAX_FEE_BPS / 100).toFixed(2)}%]`)
  }
  breakdown.push(`Effective fee: ${(effectiveFee / 100).toFixed(2)}%`)

  return {
    baseFee: FEE_CONFIG.BASE_FEE_BPS,
    adjustment: effectiveFee - FEE_CONFIG.BASE_FEE_BPS,
    effectiveFee,
    breakdown,
    loyaltyTier: loyalty.tier,
    marketConditions: market,
    latencyMs: Math.round(performance.now() - start),
  }
}

/**
 * Derive the current loyalty tier from cumulative swap data.
 */
export function deriveLoyaltyTier(totalVolumeUSDC: number, totalSwapCount: number): LoyaltyTier {
  // Check tiers from highest to lowest
  const tiers: LoyaltyTier[] = ['platinum', 'gold', 'silver', 'bronze', 'none']
  for (const tier of tiers) {
    const config = LOYALTY_TIERS[tier]
    if (totalVolumeUSDC >= config.minVolumeUSDC && totalSwapCount >= config.minSwapCount) {
      return tier
    }
  }
  return 'none'
}

/**
 * Simulate fetching current market conditions. In production this would read
 * from on-chain oracles (TWAP, volume accumulators) or off-chain data feeds.
 */
export function getMarketConditions(foodyPriceUSD?: number): MarketConditions {
  const price = foodyPriceUSD ?? (1 / FALLBACK_FOODY_PER_USD)

  // Simulate volatility based on time-of-day patterns
  const hour = new Date().getUTCHours()
  let volatility: VolatilityLevel = 'medium'
  // Low volatility during off-peak hours (UTC 2-8)
  if (hour >= 2 && hour < 8) volatility = 'low'
  // High volatility around market opens (UTC 13-15, US market open)
  if (hour >= 13 && hour <= 15) volatility = 'high'

  // Simulate reasonable volume and swap counts
  const baseVolume = 15000
  const volumeMultiplier = volatility === 'high' ? 2.5 : volatility === 'low' ? 0.6 : 1.0
  const volume24h = Math.round(baseVolume * volumeMultiplier * (0.8 + Math.random() * 0.4))
  const swapsLastHour = Math.round(
    (volatility === 'high' ? 65 : volatility === 'low' ? 15 : 30) * (0.8 + Math.random() * 0.4)
  )

  return {
    volatility,
    volume24h,
    foodyPriceUSD: price,
    priceChange1h: Number(((Math.random() - 0.5) * 4).toFixed(2)), // -2% to +2%
    swapsLastHour,
    timestamp: Date.now(),
  }
}

// ---------------------------------------------------------------------------
// 3. SETTLEMENT / INCENTIVES HOOK (afterSwap)
// ---------------------------------------------------------------------------

/**
 * Calculate all rewards earned from a swap. This is the core logic that
 * replaces the old fixed 888 FOODY reward.
 *
 * On-chain, the `afterSwap` callback would:
 *   1. Calculate rewards based on swap size and user state
 *   2. Mint or transfer FOODY tokens to the swapper
 *   3. Optionally distribute cashback to the restaurant
 */
export function calculateRewards(
  walletAddress: string,
  amountUSDC: number,
  loyalty: LoyaltyProfile,
  foodyPerUSD: number,
  isFirstSwap: boolean = false,
  restaurantId?: string,
): SettlementResult {
  const start = performance.now()
  const rewards: RewardEntry[] = []
  const tierConfig = LOYALTY_TIERS[loyalty.tier]
  const now = new Date().toISOString()

  // Helper to create a reward entry
  function addReward(type: RewardType, foodyAmount: number, description: string) {
    if (foodyAmount <= 0) return
    const config = REWARD_CONFIGS[type]
    const cappedAmount = Math.min(foodyAmount, config.maxFoodyPerSwap)
    rewards.push({
      id: `reward_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      walletAddress,
      rewardType: type,
      foodyAmount: Math.round(cappedAmount * 100) / 100,
      swapAmountUSDC: amountUSDC,
      rewardRate: config.baseRatePercent,
      loyaltyTier: loyalty.tier,
      description,
      status: 'pending',
      createdAt: now,
    })
  }

  // 1. Swap bonus — everyone gets this
  const swapBonusFoody = amountUSDC * foodyPerUSD * (REWARD_CONFIGS.swap_bonus.baseRatePercent / 100)
  addReward(
    'swap_bonus',
    swapBonusFoody,
    `${REWARD_CONFIGS.swap_bonus.baseRatePercent}% swap bonus on $${amountUSDC} USDC`,
  )

  // 2. Loyalty bonus — scaled by tier multiplier
  if (loyalty.tier !== 'none') {
    const loyaltyBonusFoody =
      amountUSDC * foodyPerUSD
      * (REWARD_CONFIGS.loyalty_bonus.baseRatePercent / 100)
      * (tierConfig.rewardMultiplier - 1.0) // only the EXTRA multiplier
    addReward(
      'loyalty_bonus',
      loyaltyBonusFoody,
      `${tierConfig.label} loyalty bonus (${tierConfig.rewardMultiplier}x multiplier)`,
    )
  }

  // 3. Streak bonus — 0.5% per streak day, capped at 5% (10 day streak)
  if (loyalty.streak > 0) {
    const streakRate = Math.min(loyalty.streak * REWARD_CONFIGS.streak_bonus.baseRatePercent, 5.0)
    const streakBonusFoody = amountUSDC * foodyPerUSD * (streakRate / 100)
    addReward(
      'streak_bonus',
      streakBonusFoody,
      `${loyalty.streak}-day streak bonus (${streakRate.toFixed(1)}%)`,
    )
  }

  // 4. First-swap bonus
  if (isFirstSwap) {
    const firstBonusFoody = amountUSDC * foodyPerUSD * (REWARD_CONFIGS.first_swap_bonus.baseRatePercent / 100)
    addReward(
      'first_swap_bonus',
      firstBonusFoody,
      `Welcome bonus: ${REWARD_CONFIGS.first_swap_bonus.baseRatePercent}% on your first swap!`,
    )
  }

  // 5. Restaurant cashback (goes to the restaurant wallet, not the swapper)
  if (restaurantId) {
    const cashbackFoody = amountUSDC * foodyPerUSD * (REWARD_CONFIGS.cashback_restaurant.baseRatePercent / 100)
    addReward(
      'cashback_restaurant',
      cashbackFoody,
      `Restaurant cashback for order at ${restaurantId}`,
    )
  }

  // Calculate totals
  const totalFoodyRewarded = rewards.reduce((sum, r) => sum + r.foodyAmount, 0)

  // Update loyalty profile with new swap data
  const updatedLoyalty: LoyaltyProfile = {
    ...loyalty,
    totalSwapVolumeUSDC: loyalty.totalSwapVolumeUSDC + amountUSDC,
    totalSwapCount: loyalty.totalSwapCount + 1,
    tier: deriveLoyaltyTier(
      loyalty.totalSwapVolumeUSDC + amountUSDC,
      loyalty.totalSwapCount + 1,
    ),
  }

  return {
    rewards,
    totalFoodyRewarded: Math.round(totalFoodyRewarded * 100) / 100,
    loyaltyProfile: updatedLoyalty,
    latencyMs: Math.round(performance.now() - start),
  }
}

// ---------------------------------------------------------------------------
// FULL PIPELINE — run all three hooks in sequence
// ---------------------------------------------------------------------------

/**
 * Execute the full hook pipeline: constraints -> pricing -> settlement.
 * This is what the UI calls for a simulated "v4 swap with hooks".
 */
export function executeHookPipeline(params: {
  walletAddress: string
  amountUSDC: number
  restaurantId?: string
  loyaltyProfile: LoyaltyProfile
  foodyPerUSD: number
  foodyPriceUSD: number
  isFirstSwap?: boolean
}): HookPipelineResult {
  const pipelineStart = performance.now()

  // Stage 1: Constraints
  const restaurant = getRestaurantConstraints(params.restaurantId)
  const constraints = evaluateConstraints(params.amountUSDC, restaurant)

  if (!constraints.allowed) {
    // Pipeline blocked at constraints stage
    const market = getMarketConditions(params.foodyPriceUSD)
    return {
      success: false,
      totalLatencyMs: Math.round(performance.now() - pipelineStart),
      constraints,
      pricing: {
        baseFee: FEE_CONFIG.BASE_FEE_BPS,
        adjustment: 0,
        effectiveFee: FEE_CONFIG.BASE_FEE_BPS,
        breakdown: ['Pipeline blocked at constraints stage'],
        loyaltyTier: params.loyaltyProfile.tier,
        marketConditions: market,
        latencyMs: 0,
      },
      settlement: {
        rewards: [],
        totalFoodyRewarded: 0,
        loyaltyProfile: params.loyaltyProfile,
        latencyMs: 0,
      },
      blockedBy: 'constraints',
      blockReason: constraints.reason,
    }
  }

  // Stage 2: Pricing
  const market = getMarketConditions(params.foodyPriceUSD)
  const pricing = calculateDynamicFee(params.amountUSDC, market, params.loyaltyProfile)

  // Stage 3: Settlement
  const settlement = calculateRewards(
    params.walletAddress,
    params.amountUSDC,
    params.loyaltyProfile,
    params.foodyPerUSD,
    params.isFirstSwap ?? false,
    params.restaurantId,
  )

  return {
    success: true,
    totalLatencyMs: Math.round(performance.now() - pipelineStart),
    constraints,
    pricing,
    settlement,
  }
}

// ---------------------------------------------------------------------------
// Helper: build a default loyalty profile for a new wallet
// ---------------------------------------------------------------------------

export function buildDefaultLoyaltyProfile(walletAddress: string): LoyaltyProfile {
  return {
    walletAddress,
    tier: 'none',
    totalSwapVolumeUSDC: 0,
    totalSwapCount: 0,
    streak: 0,
    joinedAt: new Date().toISOString(),
  }
}
