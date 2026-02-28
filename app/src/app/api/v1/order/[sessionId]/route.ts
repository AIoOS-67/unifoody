// src/app/api/v1/order/[sessionId]/route.ts
// GET /api/v1/order/:sessionId — Check cart / order status
// Source: avos_sessions table (Cloud SQL) — JSONB state column

import { NextRequest } from 'next/server'
import {
  apiSuccess,
  apiError,
  handleOptions,
  applyRateLimit,
  getClientIp,
} from '../../_lib/response'

// Use pg Pool directly for the avos_sessions table
// (same approach as supabase.ts — lazy-init pool)
let _pool: any = null
function getPool() {
  if (!_pool) {
    const { Pool } = require('pg')
    _pool = new Pool({ connectionString: process.env.DATABASE_URL })
  }
  return _pool
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const startTime = Date.now()

  // Rate limit: 60 req/min for GET
  const rlResp = applyRateLimit(getClientIp(request), 60, startTime)
  if (rlResp) return rlResp

  const { sessionId } = await params

  if (!sessionId || sessionId.length < 5) {
    return apiError('Invalid session ID.', 400, startTime)
  }

  try {
    const pool = getPool()
    const result = await pool.query(
      `SELECT id, state, created_at, updated_at FROM avos_sessions WHERE id = $1 LIMIT 1`,
      [sessionId]
    )

    if (result.rows.length === 0) {
      return apiError(`Session not found: ${sessionId}`, 404, startTime)
    }

    const session = result.rows[0]
    const state = session.state || {}

    // Extract cart from session state (agent stores cart in state.cart or state)
    const cart = state.cart || state.order || null
    const items = cart?.items || []

    return apiSuccess({
      session_id: session.id,
      cart: cart ? {
        items: items.map((item: any) => ({
          name: item.name,
          quantity: item.quantity || 1,
          price: item.price,
          subtotal: (item.price || 0) * (item.quantity || 1),
        })),
        item_count: items.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0),
        subtotal: items.reduce((sum: number, i: any) => sum + (i.price || 0) * (i.quantity || 1), 0),
      } : null,
      created_at: session.created_at,
      updated_at: session.updated_at,
    }, startTime)

  } catch (err: any) {
    console.error(`[API v1/order/${sessionId}] DB error:`, err)
    return apiError('Failed to fetch session data.', 500, startTime)
  }
}

export async function OPTIONS() {
  return handleOptions()
}
