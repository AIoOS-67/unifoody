// src/app/api/v1/_lib/cors.ts
// CORS headers and rate limiting for the public AI Agent API

/** Standard CORS headers — allow any origin (public API) */
export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Max-Age': '86400',
  }
}

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter (per IP, per minute)
// ---------------------------------------------------------------------------

interface RateBucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateBucket>()

// Cleanup stale buckets every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key)
  }
}, 5 * 60 * 1000)

/**
 * Check rate limit for a given IP.
 * @returns `null` if allowed, or `{ remaining, limit, resetAt }` if blocked
 */
export function checkRateLimit(
  ip: string,
  limit: number = 60,
): { allowed: boolean; remaining: number; limit: number; resetAt: number } {
  const now = Date.now()
  const key = `${ip}:${limit}`
  let bucket = buckets.get(key)

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + 60_000 }
    buckets.set(key, bucket)
  }

  bucket.count++

  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    limit,
    resetAt: bucket.resetAt,
  }
}

/** Rate limit response headers */
export function rateLimitHeaders(remaining: number, limit: number, resetAt: number): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
  }
}
