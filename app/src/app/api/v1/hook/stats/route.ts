// src/app/api/v1/hook/stats/route.ts
// GET /api/v1/hook/stats — On-chain FoodySwap Hook global statistics
// Source: Real blockchain reads via viem (Base Sepolia)

import { NextRequest } from 'next/server'
import { readHookStats } from '@/lib/uniswap-v4/onchain'
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

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  // Rate limit: 60 req/min for GET
  const rlResp = applyRateLimit(getClientIp(request), 60, startTime)
  if (rlResp) return rlResp

  try {
    const stats = await readHookStats()

    return apiSuccess({
      hook: {
        address: HOOK_ADDRESS,
        explorer_url: `${BLOCK_EXPLORER_URL}/address/${HOOK_ADDRESS}`,
      },
      stats: {
        total_volume_usdc: stats.totalVolumeUSDC,
        total_volume_raw: stats.totalVolume.toString(),
        total_rewards_foody: stats.totalRewardsFormatted,
        total_rewards_raw: stats.totalRewardsDistributed.toString(),
      },
      contracts: {
        hook: HOOK_ADDRESS,
        foody_token: FOODY_ADDRESS,
        usdc: USDC_ADDRESS,
        vip_nft: VIP_NFT_ADDRESS,
        chain_id: ACTIVE_CHAIN_ID,
        explorer: BLOCK_EXPLORER_URL,
      },
    }, startTime)

  } catch (err: any) {
    console.error('[API v1/hook/stats] On-chain read error:', err)
    // Never return fake data — 502 on chain failure
    return apiError(
      'Failed to read on-chain data. The blockchain node may be temporarily unavailable.',
      502,
      startTime
    )
  }
}

export async function OPTIONS() {
  return handleOptions()
}
