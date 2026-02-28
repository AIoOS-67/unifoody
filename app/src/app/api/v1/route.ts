// src/app/api/v1/route.ts
// GET /api/v1 — Self-describing API documentation
// No external imports needed — pure static JSON

import { NextResponse } from 'next/server'
import { corsHeaders } from './_lib/cors'
import { API_VERSION, CHAIN_LABEL } from './_lib/response'

const isTestnet = process.env.NEXT_PUBLIC_CHAIN_MODE === 'testnet'

const API_DOCS = {
  name: 'FoodyePay AI Agent API',
  version: API_VERSION,
  description:
    'Public API for AI agents to interact with FoodyePay — the world\'s first AI-native restaurant payment platform. Browse menus, place orders via natural language, and query real on-chain loyalty data.',
  base_url: '/api/v1',
  chain: {
    name: CHAIN_LABEL,
    chain_id: isTestnet ? 1301 : 130,
    explorer: isTestnet ? 'https://sepolia.uniscan.xyz' : 'https://uniscan.xyz',
  },
  contracts: {
    foodyswap_hook: isTestnet
      ? '0x7f10f52a355E5574C02Eac81B93cAce904Cfd0C0'
      : null,
    foody_token: isTestnet
      ? '0x55aEcFfA2F2E4DDcc63B40bac01b939A9C23f91A'
      : '0x1022B1B028a2237C440DbAc51Dc6fC220D88C08F',
    usdc: isTestnet
      ? '0x83a42BF2f2830E3abEe6C8BCB2137947F15aBD45'
      : '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    vip_nft: isTestnet
      ? '0x2BCcD9ed70198AF8f7eAf4886431A27D9d10663C'
      : null,
  },
  endpoints: [
    {
      method: 'GET',
      path: '/api/v1',
      description: 'This documentation page',
    },
    {
      method: 'GET',
      path: '/api/v1/menu',
      description: 'Browse restaurant menu (112 items, grouped by category)',
      params: {
        restaurant_id: '(optional) UUID — defaults to Foody Restaurant',
        category: '(optional) Filter by category name',
      },
    },
    {
      method: 'POST',
      path: '/api/v1/order',
      description: 'Place an order via natural language (AI agent proxy)',
      body: {
        message: '(required) Natural language order, e.g. "I want kung pao chicken and fried rice"',
        restaurant_id: '(optional) UUID',
        session_id: '(optional) Continue existing conversation',
        language: '(optional) en | zh | es — default: en',
      },
    },
    {
      method: 'GET',
      path: '/api/v1/order/:sessionId',
      description: 'Check current cart / order status for a session',
    },
    {
      method: 'GET',
      path: '/api/v1/loyalty/:address',
      description: 'Query on-chain loyalty data for a wallet address (real blockchain reads)',
      returns: 'tier, totalSpent, foodyEarned, swapCount, balances, isVIP, fee discount',
    },
    {
      method: 'GET',
      path: '/api/v1/hook/stats',
      description: 'Global FoodySwap Hook statistics from Base Sepolia (on-chain)',
      returns: 'totalVolume (USDC), totalRewardsDistributed (FOODY)',
    },
    {
      method: 'GET',
      path: '/api/v1/restaurants',
      description: 'List registered restaurants (DB + on-chain status)',
    },
  ],
  rate_limits: {
    GET: '60 requests/minute per IP',
    POST: '20 requests/minute per IP',
  },
  source: 'https://github.com/AIoOS-67/foodyswap-hook',
  agent_profile: 'https://www.moltbook.com/u/foody-1',
}

export async function GET() {
  return NextResponse.json(API_DOCS, {
    status: 200,
    headers: {
      ...corsHeaders(),
      'Cache-Control': 'public, max-age=300',
    },
  })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}
