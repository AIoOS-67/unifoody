// src/app/api/v1/restaurants/route.ts
// GET /api/v1/restaurants — List restaurants (DB + on-chain status)
// Source: Cloud SQL restaurants table + optional on-chain readRestaurant()

import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { readRestaurant } from '@/lib/uniswap-v4/onchain'
import { RESTAURANT_IDS, BLOCK_EXPLORER_URL } from '@/lib/uniswap-v4/constants'
import {
  apiSuccess,
  apiError,
  handleOptions,
  applyRateLimit,
  getClientIp,
} from '../_lib/response'

// Map DB restaurant IDs to on-chain bytes32 IDs (if known)
const DB_TO_CHAIN_MAP: Record<string, `0x${string}`> = {
  '785e4179-5dc6-4d46-83d1-3c75c126fbf1': RESTAURANT_IDS.SICHUAN_GARDEN,
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  // Rate limit: 60 req/min for GET
  const rlResp = applyRateLimit(getClientIp(request), 60, startTime)
  if (rlResp) return rlResp

  try {
    // Fetch restaurants from DB
    const { data: restaurants, error } = await supabase
      .from('restaurants')
      .select('id, name, address, phone, email, description, wallet_address')
      .order('name')

    if (error) {
      console.error('[API v1/restaurants] DB error:', error.message)
      return apiError('Failed to fetch restaurants: ' + error.message, 500, startTime)
    }

    // Enrich with on-chain data where available
    const enriched = await Promise.all(
      (restaurants || []).map(async (r: any) => {
        const chainId = DB_TO_CHAIN_MAP[r.id]
        let onChain = null

        if (chainId) {
          try {
            const chainData = await readRestaurant(chainId)
            onChain = {
              restaurant_id_bytes32: chainId,
              wallet: chainData.wallet,
              is_active: chainData.isActive,
              open_hour: chainData.openHour,
              close_hour: chainData.closeHour,
              max_tx_amount_raw: chainData.maxTxAmount.toString(),
              explorer_url: `${BLOCK_EXPLORER_URL}/address/${chainData.wallet}`,
            }
          } catch (err: any) {
            // Chain failure — still return DB data with on_chain: null
            console.warn(`[API v1/restaurants] On-chain read failed for ${r.name}:`, err.message)
          }
        }

        return {
          id: r.id,
          name: r.name,
          address: r.address,
          phone: r.phone,
          description: r.description,
          wallet_address: r.wallet_address,
          on_chain: onChain,
        }
      })
    )

    return apiSuccess({
      restaurants: enriched,
      total: enriched.length,
    }, startTime)

  } catch (err: any) {
    console.error('[API v1/restaurants] Unexpected error:', err)
    return apiError('Internal server error', 500, startTime)
  }
}

export async function OPTIONS() {
  return handleOptions()
}
