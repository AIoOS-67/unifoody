// src/app/api/hooks/constraints/route.ts
// API endpoint for the Constraints Hook (beforeSwap).
// Accepts restaurant context and swap amount, returns whether the swap is allowed.
//
// GET  ?restaurantId=rest_001&amountUSDC=10  — check constraints
// POST { restaurantId, amountUSDC, walletAddress }   — check constraints (richer payload)
// PUT  { restaurantId, status, ... }                  — update restaurant signals (keeper call)

import { NextRequest, NextResponse } from 'next/server'
import {
  evaluateConstraints,
  getRestaurantConstraints,
} from '@/lib/uniswap-v4/hooks'
import type { RestaurantConstraints, RestaurantStatus } from '@/lib/uniswap-v4/types'
import { DEMO_RESTAURANTS } from '@/lib/uniswap-v4/constants'

// In-memory restaurant state (simulates on-chain state updated by keepers).
// In production this would be an oracle contract or an off-chain DB replicated on-chain.
const restaurantOverrides: Map<string, Partial<RestaurantConstraints>> = new Map()

// ---------------------------------------------------------------------------
// GET — lightweight constraint check
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const restaurantId = searchParams.get('restaurantId') || undefined
    const amountUSDC = parseFloat(searchParams.get('amountUSDC') || '10')

    if (isNaN(amountUSDC) || amountUSDC <= 0) {
      return NextResponse.json(
        { error: 'Invalid amountUSDC parameter' },
        { status: 400 },
      )
    }

    // Build constraint context
    let restaurant = getRestaurantConstraints(restaurantId)

    // Apply any overrides from PUT calls
    if (restaurant && restaurantId && restaurantOverrides.has(restaurantId)) {
      restaurant = { ...restaurant, ...restaurantOverrides.get(restaurantId)! }
    }

    const result = evaluateConstraints(amountUSDC, restaurant)

    return NextResponse.json({
      hook: 'constraints',
      stage: 'beforeSwap',
      amountUSDC,
      restaurantId: restaurantId || null,
      restaurant: restaurant ? {
        name: restaurant.name,
        status: restaurant.status,
        acceptsFoody: restaurant.acceptsFoody,
      } : null,
      result,
    })
  } catch (error: any) {
    console.error('[Constraints Hook] GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// POST — full constraint check with wallet context
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { restaurantId, amountUSDC, walletAddress } = body

    if (!amountUSDC || amountUSDC <= 0) {
      return NextResponse.json(
        { error: 'amountUSDC is required and must be positive' },
        { status: 400 },
      )
    }

    // Build constraint context
    let restaurant = getRestaurantConstraints(restaurantId)
    if (restaurant && restaurantId && restaurantOverrides.has(restaurantId)) {
      restaurant = { ...restaurant, ...restaurantOverrides.get(restaurantId)! }
    }

    const result = evaluateConstraints(amountUSDC, restaurant)

    // Log the constraint check (simulates on-chain event emission)
    console.log(
      `[Constraints Hook] wallet=${walletAddress || 'unknown'} restaurant=${restaurantId || 'none'} ` +
      `amount=$${amountUSDC} allowed=${result.allowed} reason="${result.reason}"`,
    )

    return NextResponse.json({
      hook: 'constraints',
      stage: 'beforeSwap',
      walletAddress: walletAddress || null,
      amountUSDC,
      restaurantId: restaurantId || null,
      restaurant: restaurant ? {
        name: restaurant.name,
        status: restaurant.status,
        acceptsFoody: restaurant.acceptsFoody,
        busyMinimumUSDC: restaurant.busyMinimumUSDC,
      } : null,
      result,
      // For the UI pipeline visualization
      hookContract: '0x0000000000000000000000000000000000000080',
      callback: 'beforeSwap',
    })
  } catch (error: any) {
    console.error('[Constraints Hook] POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// PUT — update restaurant signals (simulates keeper/oracle updates)
// ---------------------------------------------------------------------------

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { restaurantId, status, acceptsFoody, busyMinimumUSDC } = body

    if (!restaurantId) {
      return NextResponse.json(
        { error: 'restaurantId is required' },
        { status: 400 },
      )
    }

    // Validate status if provided
    const validStatuses: RestaurantStatus[] = ['open', 'busy', 'closed']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 },
      )
    }

    // Store the override
    const existing = restaurantOverrides.get(restaurantId) || {}
    const updated: Partial<RestaurantConstraints> = {
      ...existing,
      ...(status !== undefined ? { status } : {}),
      ...(acceptsFoody !== undefined ? { acceptsFoody } : {}),
      ...(busyMinimumUSDC !== undefined ? { busyMinimumUSDC } : {}),
      updatedAt: new Date().toISOString(),
    }
    restaurantOverrides.set(restaurantId, updated)

    console.log(
      `[Constraints Hook] Restaurant signal updated: ${restaurantId} -> ${JSON.stringify(updated)}`,
    )

    // Return the full list of known restaurants with their current state
    const allRestaurants = Object.entries(DEMO_RESTAURANTS).map(([id, demo]) => {
      const overrides = restaurantOverrides.get(id) || {}
      return {
        id,
        name: demo.name,
        status: overrides.status || demo.status,
        acceptsFoody: overrides.acceptsFoody ?? true,
        busyMinimumUSDC: overrides.busyMinimumUSDC ?? 5,
      }
    })

    return NextResponse.json({
      success: true,
      updated: { restaurantId, ...updated },
      restaurants: allRestaurants,
    })
  } catch (error: any) {
    console.error('[Constraints Hook] PUT error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
