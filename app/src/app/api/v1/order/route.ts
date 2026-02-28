// src/app/api/v1/order/route.ts
// POST /api/v1/order — AI Agent ordering via natural language
// Proxies to Python agent service (Cloud Run) using identity token auth

import { NextRequest } from 'next/server'
import {
  apiSuccess,
  apiError,
  handleOptions,
  applyRateLimit,
  getClientIp,
  DEFAULT_RESTAURANT_ID,
} from '../_lib/response'

const AGENT_URL = process.env.AGENT_SERVICE_URL || 'https://foodyepay-agent-443906211776.us-east1.run.app'

// ---------------------------------------------------------------------------
// Identity token cache (reuse pattern from /api/agent/chat)
// ---------------------------------------------------------------------------

let cachedToken: string | null = null
let tokenExpiry = 0

async function getIdentityToken(): Promise<string | null> {
  const now = Date.now()
  if (cachedToken && now < tokenExpiry) return cachedToken

  // Cloud Run metadata server
  const metadataUrl = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${AGENT_URL}`
  try {
    const resp = await fetch(metadataUrl, {
      headers: { 'Metadata-Flavor': 'Google' },
    })
    if (resp.ok) {
      cachedToken = await resp.text()
      tokenExpiry = now + 50 * 60 * 1000
      return cachedToken
    }
  } catch {
    // Not on GCP — local dev
  }

  // Local dev fallback
  if (process.env.AGENT_ID_TOKEN) return process.env.AGENT_ID_TOKEN

  return null
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  // Rate limit: 20 req/min for POST
  const rlResp = applyRateLimit(getClientIp(request), 20, startTime)
  if (rlResp) return rlResp

  try {
    const body = await request.json()

    // Validate required field
    if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
      return apiError(
        'Missing required field: "message". Provide a natural language order, e.g. "I want kung pao chicken and fried rice".',
        400,
        startTime
      )
    }

    // Build request to agent service
    const agentBody = {
      message: body.message.trim(),
      restaurant_id: body.restaurant_id || DEFAULT_RESTAURANT_ID,
      session_id: body.session_id || undefined,
      language: body.language || 'en',
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    const token = await getIdentityToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const agentResp = await fetch(`${AGENT_URL}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(agentBody),
    })

    if (!agentResp.ok) {
      const text = await agentResp.text()
      console.error(`[API v1/order] Agent service error ${agentResp.status}: ${text}`)
      return apiError(
        `AI agent service returned ${agentResp.status}. Please try again.`,
        502,
        startTime
      )
    }

    const agentData = await agentResp.json()

    return apiSuccess({
      response: agentData.response || agentData.message,
      session_id: agentData.session_id,
      cart: agentData.cart || null,
      language: agentBody.language,
    }, startTime)

  } catch (err: any) {
    console.error('[API v1/order] Unexpected error:', err)
    return apiError('Failed to process order. Please try again.', 500, startTime)
  }
}

export async function OPTIONS() {
  return handleOptions()
}
