// src/app/api/v1/_lib/response.ts
// Standard API response envelope for the FoodyePay AI Agent API

import { NextResponse } from 'next/server'
import { corsHeaders, checkRateLimit, rateLimitHeaders } from './cors'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiEnvelope<T = unknown> {
  ok: boolean
  data: T | null
  error: string | null
  meta: {
    timestamp: string
    version: string
    chain: string
    latency_ms: number
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const API_VERSION = '1.0.0'
export const CHAIN_LABEL = process.env.NEXT_PUBLIC_CHAIN_MODE === 'testnet' ? 'base-sepolia' : 'base'
export const DEFAULT_RESTAURANT_ID = '785e4179-5dc6-4d46-83d1-3c75c126fbf1'

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

export function apiSuccess<T>(data: T, startTime: number, status = 200): NextResponse {
  const body: ApiEnvelope<T> = {
    ok: true,
    data,
    error: null,
    meta: {
      timestamp: new Date().toISOString(),
      version: API_VERSION,
      chain: CHAIN_LABEL,
      latency_ms: Date.now() - startTime,
    },
  }

  return NextResponse.json(body, {
    status,
    headers: corsHeaders(),
  })
}

export function apiError(message: string, status: number, startTime: number): NextResponse {
  const body: ApiEnvelope<null> = {
    ok: false,
    data: null,
    error: message,
    meta: {
      timestamp: new Date().toISOString(),
      version: API_VERSION,
      chain: CHAIN_LABEL,
      latency_ms: Date.now() - startTime,
    },
  }

  return NextResponse.json(body, {
    status,
    headers: corsHeaders(),
  })
}

/** CORS preflight handler */
export function handleOptions(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  })
}

/**
 * Apply rate limiting. Returns a 429 response if limit exceeded, or null if OK.
 */
export function applyRateLimit(ip: string, limit: number, startTime: number): NextResponse | null {
  const rl = checkRateLimit(ip, limit)
  if (!rl.allowed) {
    const resp = apiError('Rate limit exceeded. Please slow down.', 429, startTime)
    const headers = rateLimitHeaders(rl.remaining, rl.limit, rl.resetAt)
    for (const [k, v] of Object.entries(headers)) {
      resp.headers.set(k, v)
    }
    return resp
  }
  return null
}

/** Extract client IP from request */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return '127.0.0.1'
}
