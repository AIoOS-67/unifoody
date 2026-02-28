// src/app/api/v1/quote/route.ts
// POST /api/v1/quote — AI Agent swap simulation endpoint
// Calls quoteSwap() + getAgentProfile() on-chain in parallel

import { NextRequest } from 'next/server'
import {
  apiSuccess,
  apiError,
  handleOptions,
  applyRateLimit,
  getClientIp,
  DEFAULT_RESTAURANT_ID,
} from '../_lib/response'
import { readQuoteSwap, readAgentProfile, TIER_LABELS, TIER_EMOJIS } from '@/lib/uniswap-v4/onchain'
import { USDC_DECIMALS } from '@/lib/uniswap-v4/constants'

// ---------------------------------------------------------------------------
// POST /api/v1/quote
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  // Rate limit: 20 req/min
  const ip = getClientIp(request)
  const limited = applyRateLimit(ip, 20, startTime)
  if (limited) return limited

  // Parse body
  let body: { wallet?: string; restaurantId?: string; amountUSDC?: number }
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON body', 400, startTime)
  }

  // Validate wallet
  const wallet = body.wallet
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return apiError('Missing or invalid `wallet` (0x… address required)', 400, startTime)
  }

  // Validate restaurantId (bytes32 hex)
  const restaurantId = body.restaurantId || DEFAULT_RESTAURANT_ID
  if (!/^0x[a-fA-F0-9]{64}$/.test(restaurantId)) {
    return apiError('Invalid `restaurantId` (bytes32 hex required)', 400, startTime)
  }

  // Validate amount
  const amountUSDC = body.amountUSDC
  if (amountUSDC === undefined || typeof amountUSDC !== 'number' || amountUSDC <= 0) {
    return apiError('Missing or invalid `amountUSDC` (positive number required, e.g. 25.50)', 400, startTime)
  }

  // Convert dollars to USDC wei (6 decimals)
  const amountRaw = BigInt(Math.round(amountUSDC * 10 ** USDC_DECIMALS))

  try {
    // Call both on-chain functions in parallel
    const [quote, profile] = await Promise.all([
      readQuoteSwap(
        wallet as `0x${string}`,
        restaurantId as `0x${string}`,
        amountRaw
      ),
      readAgentProfile(wallet as `0x${string}`),
    ])

    return apiSuccess(
      {
        quote: {
          allowed: quote.allowed,
          reason: quote.reason,
          effectiveFee: quote.effectiveFee,
          expectedCashbackFOODY: quote.expectedCashbackFOODY.toString(),
          currentTier: {
            id: quote.currentTier,
            label: TIER_LABELS[quote.currentTier] ?? 'Unknown',
            emoji: TIER_EMOJIS[quote.currentTier] ?? '?',
          },
          projectedTier: {
            id: quote.projectedTier,
            label: TIER_LABELS[quote.projectedTier] ?? 'Unknown',
            emoji: TIER_EMOJIS[quote.projectedTier] ?? '?',
          },
          willMintVIP: quote.willMintVIP,
          discountBps: quote.discountBps,
          rewardRateBps: quote.rewardRateBps,
        },
        profile: {
          totalSpentUSDC: Number(profile.totalSpent) / 10 ** USDC_DECIMALS,
          foodyEarned: profile.foodyEarned.toString(),
          referralEarned: profile.referralEarned.toString(),
          tier: {
            id: profile.tier,
            label: TIER_LABELS[profile.tier] ?? 'Unknown',
            emoji: TIER_EMOJIS[profile.tier] ?? '?',
          },
          swapCount: profile.swapCount,
          isVIP: profile.isVIP,
          currentFee: profile.currentFee,
          discountBps: profile.discountBps,
          rewardRateBps: profile.rewardRateBps,
          nextTierThreshold: profile.nextTierThreshold.toString(),
          spentToNextTier: profile.spentToNextTier.toString(),
        },
        input: {
          wallet,
          restaurantId,
          amountUSDC,
          amountRaw: amountRaw.toString(),
        },
      },
      startTime
    )
  } catch (err: any) {
    console.error('[/api/v1/quote] On-chain read failed:', err.message)
    return apiError(
      `On-chain read failed: ${err.shortMessage || err.message || 'Unknown error'}`,
      502,
      startTime
    )
  }
}

export async function OPTIONS() {
  return handleOptions()
}
