// src/app/api/hooks/pricing/route.ts
// API endpoint for the Pricing/Risk Hook (beforeSwap + afterSwap).
// Calculates dynamic fees based on market conditions and loyalty tier.
//
// GET  ?amountUSDC=10&wallet=0x...  — get fee quote
// POST { amountUSDC, walletAddress } — get fee quote with full loyalty lookup

import { NextRequest, NextResponse } from 'next/server'
import {
  calculateDynamicFee,
  getMarketConditions,
  deriveLoyaltyTier,
  buildDefaultLoyaltyProfile,
} from '@/lib/uniswap-v4/hooks'
import { getFoodyPrice, estimateSwapOutput } from '@/lib/uniswap-v4/pool'
import type { LoyaltyProfile } from '@/lib/uniswap-v4/types'
import { LOYALTY_TIERS } from '@/lib/uniswap-v4/constants'

// In-memory loyalty store (simulates on-chain or DB state).
// In production, loyalty data lives in the database or on-chain via a storage hook.
const loyaltyStore: Map<string, LoyaltyProfile> = new Map()

/**
 * Retrieve or create a loyalty profile for a wallet.
 */
function getLoyaltyProfile(walletAddress: string): LoyaltyProfile {
  const key = walletAddress.toLowerCase()
  if (loyaltyStore.has(key)) {
    return loyaltyStore.get(key)!
  }
  const profile = buildDefaultLoyaltyProfile(key)
  loyaltyStore.set(key, profile)
  return profile
}

/**
 * Update loyalty profile after a swap.
 */
export function updateLoyaltyProfile(walletAddress: string, amountUSDC: number): LoyaltyProfile {
  const key = walletAddress.toLowerCase()
  const existing = getLoyaltyProfile(key)

  const updated: LoyaltyProfile = {
    ...existing,
    totalSwapVolumeUSDC: existing.totalSwapVolumeUSDC + amountUSDC,
    totalSwapCount: existing.totalSwapCount + 1,
    streak: existing.streak + 1, // simplified: each swap extends streak
    tier: deriveLoyaltyTier(
      existing.totalSwapVolumeUSDC + amountUSDC,
      existing.totalSwapCount + 1,
    ),
  }
  loyaltyStore.set(key, updated)
  return updated
}

// ---------------------------------------------------------------------------
// GET — lightweight fee quote
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const amountUSDC = parseFloat(searchParams.get('amountUSDC') || '10')
    const wallet = searchParams.get('wallet') || undefined

    if (isNaN(amountUSDC) || amountUSDC <= 0) {
      return NextResponse.json(
        { error: 'Invalid amountUSDC parameter' },
        { status: 400 },
      )
    }

    // Get price data
    const { priceUSD, foodyPerUSD, source: priceSource } = await getFoodyPrice()

    // Get market conditions
    const market = getMarketConditions(priceUSD)

    // Get loyalty profile
    const loyalty = wallet ? getLoyaltyProfile(wallet) : buildDefaultLoyaltyProfile('0x0000000000000000000000000000000000000000')

    // Calculate dynamic fee
    const feeResult = calculateDynamicFee(amountUSDC, market, loyalty)

    // Estimate swap output
    const swapEstimate = await estimateSwapOutput(amountUSDC, feeResult.effectiveFee)

    return NextResponse.json({
      hook: 'pricing',
      stage: 'beforeSwap',
      amountUSDC,
      walletAddress: wallet || null,
      priceSource,
      foodyPriceUSD: priceUSD,
      foodyPerUSD,
      fee: feeResult,
      swapEstimate,
      // Loyalty tier info for the UI
      loyalty: {
        tier: loyalty.tier,
        label: LOYALTY_TIERS[loyalty.tier].label,
        totalVolume: loyalty.totalSwapVolumeUSDC,
        totalSwaps: loyalty.totalSwapCount,
        streak: loyalty.streak,
        nextTier: getNextTier(loyalty),
      },
    })
  } catch (error: any) {
    console.error('[Pricing Hook] GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// POST — full fee quote with detailed loyalty lookup
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { amountUSDC, walletAddress } = body

    if (!amountUSDC || amountUSDC <= 0) {
      return NextResponse.json(
        { error: 'amountUSDC is required and must be positive' },
        { status: 400 },
      )
    }

    // Get price data
    const { priceUSD, foodyPerUSD, source: priceSource } = await getFoodyPrice()

    // Get market conditions
    const market = getMarketConditions(priceUSD)

    // Get loyalty profile
    const loyalty = walletAddress
      ? getLoyaltyProfile(walletAddress)
      : buildDefaultLoyaltyProfile('0x0000000000000000000000000000000000000000')

    // Calculate dynamic fee
    const feeResult = calculateDynamicFee(amountUSDC, market, loyalty)

    // Estimate swap output with fee applied
    const swapEstimate = await estimateSwapOutput(amountUSDC, feeResult.effectiveFee)

    console.log(
      `[Pricing Hook] wallet=${walletAddress || 'unknown'} amount=$${amountUSDC} ` +
      `fee=${(feeResult.effectiveFee / 100).toFixed(2)}% tier=${loyalty.tier} ` +
      `volatility=${market.volatility}`,
    )

    return NextResponse.json({
      hook: 'pricing',
      stage: 'beforeSwap',
      walletAddress: walletAddress || null,
      amountUSDC,
      priceSource,
      foodyPriceUSD: priceUSD,
      foodyPerUSD,
      fee: feeResult,
      swapEstimate,
      loyalty: {
        tier: loyalty.tier,
        label: LOYALTY_TIERS[loyalty.tier].label,
        totalVolume: loyalty.totalSwapVolumeUSDC,
        totalSwaps: loyalty.totalSwapCount,
        streak: loyalty.streak,
        multiplier: LOYALTY_TIERS[loyalty.tier].rewardMultiplier,
        nextTier: getNextTier(loyalty),
      },
      hookContract: '0x00000000000000000000000000000000000000C0',
      callback: 'beforeSwap + afterSwap',
    })
  } catch (error: any) {
    console.error('[Pricing Hook] POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// Helper: determine progress toward next loyalty tier
// ---------------------------------------------------------------------------

function getNextTier(profile: LoyaltyProfile): {
  tier: string
  label: string
  volumeNeeded: number
  swapsNeeded: number
  progress: number
} | null {
  const tierOrder: Array<'none' | 'bronze' | 'silver' | 'gold' | 'platinum'> = [
    'none', 'bronze', 'silver', 'gold', 'platinum',
  ]
  const currentIdx = tierOrder.indexOf(profile.tier)

  // Already at max tier
  if (currentIdx >= tierOrder.length - 1) {
    return null
  }

  const nextTierKey = tierOrder[currentIdx + 1]
  const nextConfig = LOYALTY_TIERS[nextTierKey]

  const volumeNeeded = Math.max(0, nextConfig.minVolumeUSDC - profile.totalSwapVolumeUSDC)
  const swapsNeeded = Math.max(0, nextConfig.minSwapCount - profile.totalSwapCount)

  // Progress is the average of volume and swap progress
  const volumeProgress = nextConfig.minVolumeUSDC > 0
    ? Math.min(1, profile.totalSwapVolumeUSDC / nextConfig.minVolumeUSDC)
    : 1
  const swapProgress = nextConfig.minSwapCount > 0
    ? Math.min(1, profile.totalSwapCount / nextConfig.minSwapCount)
    : 1
  const progress = Math.round(((volumeProgress + swapProgress) / 2) * 100)

  return {
    tier: nextTierKey,
    label: nextConfig.label,
    volumeNeeded: Math.round(volumeNeeded * 100) / 100,
    swapsNeeded,
    progress,
  }
}
