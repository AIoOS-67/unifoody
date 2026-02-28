// src/app/api/v1/route.ts
// GET /api/v1 — Self-describing API documentation for AI agents
// No external imports needed — pure static JSON

import { NextResponse } from 'next/server'
import { corsHeaders } from './_lib/cors'
import { API_VERSION, CHAIN_LABEL } from './_lib/response'

const isTestnet = process.env.NEXT_PUBLIC_CHAIN_MODE === 'testnet'

const API_DOCS = {
  name: 'UniFoody AI Agent API',
  version: API_VERSION,
  description:
    'AI-Agent-Friendly API for UniFoody — the first Uniswap V4 Hook designed for autonomous AI agent interaction. Simulate swaps, read user profiles in one call, browse menus, and place orders via natural language. Deployed natively on Unichain.',
  base_url: '/api/v1',
  chain: {
    name: CHAIN_LABEL,
    chain_id: isTestnet ? 1301 : 130,
    rpc: isTestnet ? 'https://sepolia.unichain.org' : 'https://mainnet.unichain.org',
    explorer: isTestnet ? 'https://sepolia.uniscan.xyz' : 'https://uniscan.xyz',
  },
  contracts: {
    foodyswap_hook: isTestnet
      ? '0x4F0Be128768E33c402B7D5Df04Fd7923b1ba50C0'
      : '0x0000000000000000000000000000000000000000',
    foody_token: isTestnet
      ? '0xf6f353078243c50eCca9af4D751A45816607Eb2a'
      : '0x0000000000000000000000000000000000000000',
    usdc: '0x31d0220469e10c4E71834a79b1f276d740d3768F',
    vip_nft: isTestnet
      ? '0xc7415f2986e58a6158BbF30780E393C54622e54e'
      : '0x0000000000000000000000000000000000000000',
    pool_manager: '0x00B036B58a818B1BC34d502D3fE730Db729e62AC',
    universal_router: '0xf70536b3bcc1bd1a972dc186a2cf84cc6da6be5d',
  },
  endpoints: [
    {
      method: 'GET',
      path: '/api/v1',
      description: 'This documentation page (self-describing API)',
    },
    {
      method: 'POST',
      path: '/api/v1/quote',
      description: 'Simulate a swap before executing — preview fees, cashback, tier changes (on-chain)',
      body: {
        wallet: '(required) 0x… user address',
        restaurantId: '(required) bytes32 restaurant ID',
        amountUSDC: '(required) amount in USD, e.g. 25.50',
      },
      returns: 'allowed, reason, effectiveFee, expectedCashback, currentTier, projectedTier, willMintVIP, profile',
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
      description: 'Query on-chain loyalty data for a wallet address (Unichain)',
      returns: 'tier, totalSpent, foodyEarned, swapCount, balances, isVIP, fee discount',
    },
    {
      method: 'GET',
      path: '/api/v1/hook/stats',
      description: 'Global FoodySwap Hook statistics from Unichain (on-chain)',
      returns: 'totalVolume (USDC), totalRewardsDistributed (FOODY)',
    },
    {
      method: 'GET',
      path: '/api/v1/restaurants',
      description: 'List registered restaurants (DB + on-chain status)',
    },
  ],
  agent_features: {
    on_chain_functions: [
      'quoteSwap(address,bytes32,uint256) — simulate swap outcomes without executing',
      'getAgentProfile(address) — complete user profile in ONE call (replaces 5+ reads)',
    ],
    api_quote: 'POST /api/v1/quote — REST wrapper for quoteSwap + getAgentProfile',
    workflow: [
      '1. DISCOVER — GET /api/v1/restaurants',
      '2. QUOTE   — POST /api/v1/quote { wallet, restaurantId, amountUSDC }',
      '3. EXECUTE — swap() via Universal Router with hookData',
      '4. MONITOR — GET /api/v1/loyalty/:address',
    ],
    self_describing: 'GET /api/v1 returns this full schema — zero-config agent onboarding',
  },
  rate_limits: {
    GET: '60 requests/minute per IP',
    POST: '20 requests/minute per IP',
  },
  source: 'https://github.com/AIoOS-67/unifoody',
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
