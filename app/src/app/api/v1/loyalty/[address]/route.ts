// src/app/api/v1/loyalty/[address]/route.ts
// GET /api/v1/loyalty/:address — On-chain loyalty data for a wallet
// Source: 4 parallel viem readContract() calls on Base Sepolia
// CRITICAL: Never returns fake data — 502 on chain failure

import { NextRequest } from 'next/server'
import {
  readUserLoyalty,
  readUserBalances,
  readUserFee,
  readIsVIP,
  TIER_LABELS,
  TIER_EMOJIS,
} from '@/lib/uniswap-v4/onchain'
import {
  HOOK_ADDRESS,
  FOODY_ADDRESS,
  USDC_ADDRESS,
  VIP_NFT_ADDRESS,
  ACTIVE_CHAIN_ID,
  BLOCK_EXPLORER_URL,
} from '@/lib/uniswap-v4/constants'
import {
  apiSuccess,
  apiError,
  handleOptions,
  applyRateLimit,
  getClientIp,
} from '../../_lib/response'

// Validate Ethereum address format
function isValidAddress(addr: string): addr is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(addr)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const startTime = Date.now()

  // Rate limit: 60 req/min for GET
  const rlResp = applyRateLimit(getClientIp(request), 60, startTime)
  if (rlResp) return rlResp

  const { address } = await params

  if (!isValidAddress(address)) {
    return apiError(
      `Invalid Ethereum address: "${address}". Must be a 0x-prefixed 40-hex-char string.`,
      400,
      startTime
    )
  }

  try {
    // 4 parallel on-chain reads — real data from Base Sepolia
    const [loyalty, balances, fee, isVIP] = await Promise.all([
      readUserLoyalty(address),
      readUserBalances(address),
      readUserFee(address),
      readIsVIP(address),
    ])

    return apiSuccess({
      address,
      loyalty: {
        tier: loyalty.tier,
        tier_label: loyalty.tierLabel,
        tier_emoji: loyalty.tierEmoji,
        total_spent_usdc: loyalty.totalSpentUSDC,
        total_spent_raw: loyalty.totalSpent.toString(),
        foody_earned: loyalty.foodyEarnedFormatted,
        foody_earned_raw: loyalty.foodyEarned.toString(),
        referral_earned_raw: loyalty.referralEarned.toString(),
        swap_count: Number(loyalty.swapCount),
        last_swap_time: Number(loyalty.lastSwapTime),
        referrer: loyalty.referrer,
      },
      balances: {
        foody: balances.foody,
        foody_raw: balances.foodyRaw.toString(),
        usdc: balances.usdc,
        usdc_raw: balances.usdcRaw.toString(),
      },
      vip: {
        is_vip: isVIP,
        nft_contract: VIP_NFT_ADDRESS,
      },
      fee: {
        current_fee_bps: fee,
        current_fee_percent: fee / 100,
      },
      contracts: {
        hook: HOOK_ADDRESS,
        foody_token: FOODY_ADDRESS,
        usdc: USDC_ADDRESS,
        vip_nft: VIP_NFT_ADDRESS,
        chain_id: ACTIVE_CHAIN_ID,
        explorer: BLOCK_EXPLORER_URL,
        profile_url: `${BLOCK_EXPLORER_URL}/address/${address}`,
      },
    }, startTime)

  } catch (err: any) {
    console.error(`[API v1/loyalty/${address}] On-chain read error:`, err)
    // Never return fake data — 502 on chain failure
    return apiError(
      'Failed to read on-chain loyalty data. The blockchain node may be temporarily unavailable.',
      502,
      startTime
    )
  }
}

export async function OPTIONS() {
  return handleOptions()
}
