// src/app/api/hooks/v4-stats/route.ts
// Aggregate V4 Hook statistics for the DemoHero dashboard.
// Reads from v4_rewards and v4_loyalty tables populated by the simulation engine.
//
// GET → { totalUSDCVolume, totalFoodyDistributed, totalRewards, uniqueWallets, tierDistribution, topWallets }
//
// Returns zeros gracefully if tables don't exist yet.

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

// In-memory cache (30 seconds) to avoid hammering DB on every page load
let _cache: { data: Record<string, unknown>; timestamp: number } | null = null
const CACHE_TTL_MS = 30_000

export async function GET(_req: NextRequest) {
  try {
    // Check cache
    if (_cache && Date.now() - _cache.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(_cache.data)
    }

    // Query 1: Totals from v4_rewards
    const rewardsResult = await pool.query(`
      SELECT
        COUNT(*)::int as total_rewards,
        COALESCE(SUM(foody_amount), 0)::float as total_foody_distributed,
        COALESCE(
          SUM(CASE WHEN reward_type = 'swap_bonus' THEN swap_amount_usdc ELSE 0 END), 0
        )::float as total_usdc_volume,
        COUNT(DISTINCT wallet_address)::int as unique_wallets
      FROM v4_rewards
    `)

    // Query 2: Tier distribution from v4_loyalty
    const tierResult = await pool.query(`
      SELECT tier, COUNT(*)::int as count
      FROM v4_loyalty
      GROUP BY tier
      ORDER BY count DESC
    `)

    // Query 3: Recent activity (last 24 hours of sim time)
    const recentResult = await pool.query(`
      SELECT
        COUNT(*)::int as recent_rewards,
        COALESCE(SUM(foody_amount), 0)::float as recent_foody
      FROM v4_rewards
      WHERE created_at > (
        SELECT (MAX(created_at)::timestamp - interval '24 hours')::text
        FROM v4_rewards
      )
    `)

    // Query 4: Top wallets by volume
    const topWalletsResult = await pool.query(`
      SELECT wallet_address, tier, total_swap_volume_usdc, total_swap_count
      FROM v4_loyalty
      ORDER BY total_swap_volume_usdc DESC
      LIMIT 5
    `)

    // Query 5: Registered restaurants count
    const restaurantResult = await pool.query(`
      SELECT COUNT(*)::int as count FROM restaurants
    `)

    const stats = rewardsResult.rows[0] || {
      total_rewards: 0,
      total_foody_distributed: 0,
      total_usdc_volume: 0,
      unique_wallets: 0,
    }
    const recent = recentResult.rows[0] || { recent_rewards: 0, recent_foody: 0 }

    const tierDistribution: Record<string, number> = {}
    for (const row of tierResult.rows) {
      tierDistribution[row.tier] = row.count
    }

    const topWallets = topWalletsResult.rows.map((r: Record<string, unknown>) => ({
      wallet: r.wallet_address as string,
      tier: r.tier as string,
      volume: parseFloat(String(r.total_swap_volume_usdc)),
      swaps: parseInt(String(r.total_swap_count), 10),
    }))

    const restaurantCount = restaurantResult.rows[0]?.count || 0

    const data = {
      totalUSDCVolume: Math.round(stats.total_usdc_volume * 100) / 100,
      totalFoodyDistributed: Math.round(stats.total_foody_distributed),
      totalRewards: stats.total_rewards,
      uniqueWallets: stats.unique_wallets,
      registeredRestaurants: restaurantCount,
      tierDistribution,
      recentActivity: {
        rewards24h: recent.recent_rewards,
        foody24h: Math.round(recent.recent_foody),
      },
      topWallets,
      timestamp: Date.now(),
    }

    // Update cache
    _cache = { data, timestamp: Date.now() }

    return NextResponse.json(data)
  } catch (error: unknown) {
    // Return zeros if tables don't exist yet (simulation not started)
    const msg = error instanceof Error ? error.message : String(error)
    console.warn('[V4 Stats] Query error (tables may not exist yet):', msg)

    return NextResponse.json({
      totalUSDCVolume: 0,
      totalFoodyDistributed: 0,
      totalRewards: 0,
      uniqueWallets: 0,
      registeredRestaurants: 0,
      tierDistribution: {},
      recentActivity: { rewards24h: 0, foody24h: 0 },
      topWallets: [],
      timestamp: Date.now(),
    })
  }
}
