// src/app/api/hooks/settlement/route.ts
// API endpoint for the Settlement/Incentives Hook (afterSwap).
// Calculates and stores rewards after a successful swap.
//
// GET  ?wallet=0x...                           — get reward history for a wallet
// POST { walletAddress, amountUSDC, restaurantId? } — process settlement after a swap

import { NextRequest, NextResponse } from 'next/server'
import {
  calculateRewards,
  deriveLoyaltyTier,
  buildDefaultLoyaltyProfile,
} from '@/lib/uniswap-v4/hooks'
import { getFoodyPrice } from '@/lib/uniswap-v4/pool'
import { updateLoyaltyProfile } from '@/app/api/hooks/pricing/route'
import type { LoyaltyProfile, RewardEntry, SettlementResult } from '@/lib/uniswap-v4/types'
import { LOYALTY_TIERS } from '@/lib/uniswap-v4/constants'
import pool from '@/lib/db'

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

/**
 * Ensure the v4_rewards table exists. Called lazily on first request.
 */
let _tableReady = false

async function ensureTable(): Promise<void> {
  if (_tableReady) return
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS v4_rewards (
        id TEXT PRIMARY KEY,
        wallet_address TEXT NOT NULL,
        reward_type TEXT NOT NULL,
        foody_amount REAL NOT NULL,
        swap_amount_usdc REAL NOT NULL,
        reward_rate REAL NOT NULL,
        loyalty_tier TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        transaction_hash TEXT,
        created_at TEXT NOT NULL,
        settled_at TEXT
      )
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_v4_rewards_wallet
        ON v4_rewards (wallet_address)
    `)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS v4_loyalty (
        wallet_address TEXT PRIMARY KEY,
        tier TEXT NOT NULL DEFAULT 'none',
        total_swap_volume_usdc REAL NOT NULL DEFAULT 0,
        total_swap_count INTEGER NOT NULL DEFAULT 0,
        streak INTEGER NOT NULL DEFAULT 0,
        joined_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
    _tableReady = true
  } catch (error) {
    console.error('[Settlement] Table creation error:', error)
    // Continue anyway — the tables might already exist or DB may be unavailable
    _tableReady = true
  }
}

/**
 * Save reward entries to the database.
 */
async function saveRewards(rewards: RewardEntry[]): Promise<void> {
  for (const reward of rewards) {
    try {
      await pool.query(
        `INSERT INTO v4_rewards
          (id, wallet_address, reward_type, foody_amount, swap_amount_usdc,
           reward_rate, loyalty_tier, description, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          reward.id,
          reward.walletAddress.toLowerCase(),
          reward.rewardType,
          reward.foodyAmount,
          reward.swapAmountUSDC,
          reward.rewardRate,
          reward.loyaltyTier,
          reward.description,
          reward.status,
          reward.createdAt,
        ],
      )
    } catch (error) {
      console.error(`[Settlement] Failed to save reward ${reward.id}:`, error)
    }
  }
}

/**
 * Save or update a loyalty profile in the database.
 */
async function saveLoyaltyProfile(profile: LoyaltyProfile): Promise<void> {
  try {
    const now = new Date().toISOString()
    await pool.query(
      `INSERT INTO v4_loyalty
        (wallet_address, tier, total_swap_volume_usdc, total_swap_count, streak, joined_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (wallet_address) DO UPDATE SET
         tier = EXCLUDED.tier,
         total_swap_volume_usdc = EXCLUDED.total_swap_volume_usdc,
         total_swap_count = EXCLUDED.total_swap_count,
         streak = EXCLUDED.streak,
         updated_at = EXCLUDED.updated_at`,
      [
        profile.walletAddress.toLowerCase(),
        profile.tier,
        profile.totalSwapVolumeUSDC,
        profile.totalSwapCount,
        profile.streak,
        profile.joinedAt,
        now,
      ],
    )
  } catch (error) {
    console.error('[Settlement] Failed to save loyalty profile:', error)
  }
}

/**
 * Load a loyalty profile from the database.
 */
async function loadLoyaltyProfile(walletAddress: string): Promise<LoyaltyProfile | null> {
  try {
    const result = await pool.query(
      `SELECT * FROM v4_loyalty WHERE wallet_address = $1`,
      [walletAddress.toLowerCase()],
    )
    if (result.rows.length === 0) return null
    const row = result.rows[0]
    return {
      walletAddress: row.wallet_address,
      tier: row.tier,
      totalSwapVolumeUSDC: row.total_swap_volume_usdc,
      totalSwapCount: row.total_swap_count,
      streak: row.streak,
      joinedAt: row.joined_at,
    }
  } catch (error) {
    console.warn('[Settlement] Failed to load loyalty profile:', error)
    return null
  }
}

/**
 * Load reward history for a wallet.
 */
async function loadRewards(walletAddress: string, limit: number = 50): Promise<RewardEntry[]> {
  try {
    const result = await pool.query(
      `SELECT * FROM v4_rewards
       WHERE wallet_address = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [walletAddress.toLowerCase(), limit],
    )
    return result.rows.map((row: any) => ({
      id: row.id,
      walletAddress: row.wallet_address,
      rewardType: row.reward_type,
      foodyAmount: row.foody_amount,
      swapAmountUSDC: row.swap_amount_usdc,
      rewardRate: row.reward_rate,
      loyaltyTier: row.loyalty_tier,
      description: row.description,
      status: row.status,
      transactionHash: row.transaction_hash,
      createdAt: row.created_at,
      settledAt: row.settled_at,
    }))
  } catch (error) {
    console.warn('[Settlement] Failed to load rewards:', error)
    return []
  }
}

/**
 * Get aggregate reward stats for a wallet.
 */
async function getRewardStats(walletAddress: string): Promise<{
  totalRewards: number
  totalFoody: number
  rewardsByType: Record<string, { count: number; totalFoody: number }>
}> {
  try {
    const result = await pool.query(
      `SELECT reward_type, COUNT(*) as count, SUM(foody_amount) as total_foody
       FROM v4_rewards
       WHERE wallet_address = $1
       GROUP BY reward_type`,
      [walletAddress.toLowerCase()],
    )

    let totalRewards = 0
    let totalFoody = 0
    const rewardsByType: Record<string, { count: number; totalFoody: number }> = {}

    for (const row of result.rows) {
      const count = parseInt(row.count, 10)
      const foody = parseFloat(row.total_foody)
      totalRewards += count
      totalFoody += foody
      rewardsByType[row.reward_type] = { count, totalFoody: Math.round(foody * 100) / 100 }
    }

    return {
      totalRewards,
      totalFoody: Math.round(totalFoody * 100) / 100,
      rewardsByType,
    }
  } catch (error) {
    console.warn('[Settlement] Failed to get reward stats:', error)
    return { totalRewards: 0, totalFoody: 0, rewardsByType: {} }
  }
}

// ---------------------------------------------------------------------------
// GET — reward history and stats
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    await ensureTable()

    const { searchParams } = new URL(req.url)
    const wallet = searchParams.get('wallet')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    if (!wallet) {
      return NextResponse.json(
        { error: 'wallet query parameter is required' },
        { status: 400 },
      )
    }

    const [rewards, stats, loyaltyProfile] = await Promise.all([
      loadRewards(wallet, limit),
      getRewardStats(wallet),
      loadLoyaltyProfile(wallet),
    ])

    const profile = loyaltyProfile || buildDefaultLoyaltyProfile(wallet)

    return NextResponse.json({
      hook: 'settlement',
      stage: 'afterSwap',
      walletAddress: wallet,
      rewards,
      stats,
      loyalty: {
        tier: profile.tier,
        label: LOYALTY_TIERS[profile.tier].label,
        totalVolume: profile.totalSwapVolumeUSDC,
        totalSwaps: profile.totalSwapCount,
        streak: profile.streak,
        multiplier: LOYALTY_TIERS[profile.tier].rewardMultiplier,
        joinedAt: profile.joinedAt,
      },
    })
  } catch (error: any) {
    console.error('[Settlement Hook] GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// POST — process settlement after a swap
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    await ensureTable()

    const body = await req.json()
    const { walletAddress, amountUSDC, restaurantId, transactionHash } = body

    if (!walletAddress || !amountUSDC || amountUSDC <= 0) {
      return NextResponse.json(
        { error: 'walletAddress and amountUSDC are required' },
        { status: 400 },
      )
    }

    // Get current FOODY price
    const { priceUSD, foodyPerUSD } = await getFoodyPrice()

    // Load existing loyalty profile from DB
    let loyalty = await loadLoyaltyProfile(walletAddress)
    const isFirstSwap = !loyalty
    if (!loyalty) {
      loyalty = buildDefaultLoyaltyProfile(walletAddress)
    }

    // Calculate rewards
    const settlement = calculateRewards(
      walletAddress,
      amountUSDC,
      loyalty,
      foodyPerUSD,
      isFirstSwap,
      restaurantId,
    )

    // If a transaction hash was provided, mark rewards as settled
    if (transactionHash) {
      for (const reward of settlement.rewards) {
        reward.status = 'settled'
        reward.transactionHash = transactionHash
        reward.settledAt = new Date().toISOString()
      }
    }

    // Persist rewards to database
    await saveRewards(settlement.rewards)

    // Update loyalty profile in both in-memory store and database
    const updatedLoyalty = updateLoyaltyProfile(walletAddress, amountUSDC)
    await saveLoyaltyProfile(settlement.loyaltyProfile)

    // Get updated aggregate stats
    const stats = await getRewardStats(walletAddress)

    console.log(
      `[Settlement Hook] wallet=${walletAddress} swap=$${amountUSDC} ` +
      `rewards=${settlement.rewards.length} total_foody=${settlement.totalFoodyRewarded.toFixed(2)} ` +
      `tier=${settlement.loyaltyProfile.tier} first_swap=${isFirstSwap}`,
    )

    return NextResponse.json({
      hook: 'settlement',
      stage: 'afterSwap',
      walletAddress,
      amountUSDC,
      restaurantId: restaurantId || null,
      transactionHash: transactionHash || null,
      isFirstSwap,
      foodyPriceUSD: priceUSD,
      foodyPerUSD,
      settlement: {
        rewards: settlement.rewards,
        totalFoodyRewarded: settlement.totalFoodyRewarded,
        rewardCount: settlement.rewards.length,
      },
      loyalty: {
        previous: {
          tier: loyalty.tier,
          label: LOYALTY_TIERS[loyalty.tier].label,
        },
        current: {
          tier: settlement.loyaltyProfile.tier,
          label: LOYALTY_TIERS[settlement.loyaltyProfile.tier].label,
          totalVolume: settlement.loyaltyProfile.totalSwapVolumeUSDC,
          totalSwaps: settlement.loyaltyProfile.totalSwapCount,
          streak: settlement.loyaltyProfile.streak,
          multiplier: LOYALTY_TIERS[settlement.loyaltyProfile.tier].rewardMultiplier,
        },
        tierChanged: loyalty.tier !== settlement.loyaltyProfile.tier,
      },
      stats,
      hookContract: '0x0000000000000000000000000000000000000040',
      callback: 'afterSwap',
      latencyMs: settlement.latencyMs,
    })
  } catch (error: any) {
    console.error('[Settlement Hook] POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
