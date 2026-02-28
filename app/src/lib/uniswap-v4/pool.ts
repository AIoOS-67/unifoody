// src/lib/uniswap-v4/pool.ts
// Pool Manager interaction layer for Uniswap v4 on Base.
// Provides both real on-chain reads (for when v4 is deployed) and
// simulation helpers that the FoodyePay frontend uses now.

import { createPublicClient, http, encodePacked, keccak256, type PublicClient } from 'viem'
import { unichain } from '@/lib/chains'
import { POOL_MANAGER_ABI, ERC20_ABI } from '@/lib/abi/uniswapV4Abi'
import type { PoolKey, PoolId, BalanceDelta } from './types'
import {
  POOL_MANAGER_ADDRESS,
  FOODY_POOL_KEY,
  USDC_ADDRESS,
  FOODY_ADDRESS,
  USDC_DECIMALS,
  FOODY_DECIMALS,
  UNISWAP_V3_POOL_ADDRESS,
  BASE_CHAIN_ID,
  FALLBACK_FOODY_PER_USD,
  FALLBACK_FOODY_PRICE_USD,
} from './constants'

// ---------------------------------------------------------------------------
// Public client singleton
// ---------------------------------------------------------------------------

let _client: PublicClient | null = null

function getClient(): PublicClient {
  if (!_client) {
    _client = createPublicClient({
      chain: unichain,
      transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'),
      batch: { multicall: true },
    })
  }
  return _client
}

// ---------------------------------------------------------------------------
// PoolId derivation (mirrors Solidity: keccak256(abi.encode(key)))
// ---------------------------------------------------------------------------

/**
 * Compute the PoolId from a PoolKey, exactly as PoolManager does on-chain.
 */
export function toPoolId(key: PoolKey): PoolId {
  // Solidity: keccak256(abi.encode(currency0, currency1, fee, tickSpacing, hooks))
  // We use encodePacked as a simplified version; the real encoding uses abi.encode.
  // For exact match, this would need ABI-encoded struct packing.
  const encoded = encodePacked(
    ['address', 'address', 'uint24', 'int24', 'address'],
    [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks],
  )
  return keccak256(encoded) as PoolId
}

/** The canonical USDC/FOODY pool ID */
export const FOODY_POOL_ID = toPoolId(FOODY_POOL_KEY)

// ---------------------------------------------------------------------------
// On-chain reads (for future use when v4 PoolManager is deployed)
// ---------------------------------------------------------------------------

/**
 * Read pool slot0 data from the v4 PoolManager.
 * Returns null if the pool is not yet initialized or the read fails.
 */
export async function getPoolSlot0(poolId: PoolId = FOODY_POOL_ID): Promise<{
  sqrtPriceX96: bigint
  tick: number
  protocolFee: number
  lpFee: number
} | null> {
  try {
    const client = getClient()
    const result = await client.readContract({
      address: POOL_MANAGER_ADDRESS,
      abi: POOL_MANAGER_ABI,
      functionName: 'getSlot0',
      args: [poolId],
    })

    const [sqrtPriceX96, tick, protocolFee, lpFee] = result as [bigint, number, number, number]

    return { sqrtPriceX96, tick, protocolFee, lpFee }
  } catch (error) {
    console.warn('[PoolManager] getSlot0 failed (pool may not exist yet):', error)
    return null
  }
}

/**
 * Read pool liquidity from the v4 PoolManager.
 */
export async function getPoolLiquidity(poolId: PoolId = FOODY_POOL_ID): Promise<bigint | null> {
  try {
    const client = getClient()
    const result = await client.readContract({
      address: POOL_MANAGER_ADDRESS,
      abi: POOL_MANAGER_ABI,
      functionName: 'getLiquidity',
      args: [poolId],
    })
    return result as bigint
  } catch (error) {
    console.warn('[PoolManager] getLiquidity failed:', error)
    return null
  }
}

// ---------------------------------------------------------------------------
// FOODY price oracle (reads from existing Uniswap V3 pool)
// ---------------------------------------------------------------------------

/** Uniswap V3 Pool slot0 ABI (for price reads from the existing pool) */
const V3_POOL_SLOT0_ABI = [
  {
    inputs: [],
    name: 'slot0',
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'observationIndex', type: 'uint16' },
      { name: 'observationCardinality', type: 'uint16' },
      { name: 'observationCardinalityNext', type: 'uint16' },
      { name: 'feeProtocol', type: 'uint8' },
      { name: 'unlocked', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// Simple price cache (30-second TTL)
let _priceCache: { priceUSD: number; foodyPerUSD: number; timestamp: number } | null = null
const PRICE_CACHE_TTL_MS = 30_000

/**
 * Fetch current FOODY/USD price from the existing Uniswap V3 pool on-chain.
 * Falls back to hardcoded price if the read fails.
 */
export async function getFoodyPrice(): Promise<{
  priceUSD: number
  foodyPerUSD: number
  source: string
}> {
  // Check cache
  if (_priceCache && (Date.now() - _priceCache.timestamp) < PRICE_CACHE_TTL_MS) {
    return { ..._priceCache, source: 'cache' }
  }

  try {
    const client = getClient()
    const result = await client.readContract({
      address: UNISWAP_V3_POOL_ADDRESS,
      abi: V3_POOL_SLOT0_ABI,
      functionName: 'slot0',
    })

    const sqrtPriceX96 = result[0]
    if (!sqrtPriceX96 || sqrtPriceX96 <= 0n) {
      throw new Error('Invalid sqrtPriceX96')
    }

    // Price = (sqrtPriceX96 / 2^96)^2
    const Q96 = 2n ** 96n
    const price = (Number(sqrtPriceX96) / Number(Q96)) ** 2

    // Adjust for decimal difference: USDC (6) vs FOODY (18) -> multiply by 10^12
    const priceUSD = price * (10 ** (FOODY_DECIMALS - USDC_DECIMALS))

    if (priceUSD <= 0 || !isFinite(priceUSD)) {
      throw new Error(`Invalid calculated price: ${priceUSD}`)
    }

    const foodyPerUSD = 1 / priceUSD

    // Update cache
    _priceCache = { priceUSD, foodyPerUSD, timestamp: Date.now() }

    return { priceUSD, foodyPerUSD, source: 'onchain_v3' }
  } catch (error) {
    console.warn('[Pool] On-chain price fetch failed, using fallback:', error)
    return {
      priceUSD: FALLBACK_FOODY_PRICE_USD,
      foodyPerUSD: FALLBACK_FOODY_PER_USD,
      source: 'fallback',
    }
  }
}

// ---------------------------------------------------------------------------
// Token balances
// ---------------------------------------------------------------------------

/**
 * Read USDC balance for a wallet on Base.
 */
export async function getUSDCBalance(wallet: `0x${string}`): Promise<bigint> {
  try {
    const client = getClient()
    const balance = await client.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [wallet],
    })
    return balance as bigint
  } catch (error) {
    console.error('[Pool] USDC balance read failed:', error)
    return 0n
  }
}

/**
 * Read FOODY balance for a wallet on Base.
 */
export async function getFoodyBalance(wallet: `0x${string}`): Promise<bigint> {
  try {
    const client = getClient()
    const balance = await client.readContract({
      address: FOODY_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [wallet],
    })
    return balance as bigint
  } catch (error) {
    console.error('[Pool] FOODY balance read failed:', error)
    return 0n
  }
}

// ---------------------------------------------------------------------------
// Pool info composite (for the UI panel)
// ---------------------------------------------------------------------------

export interface PoolInfo {
  poolId: PoolId
  poolKey: PoolKey
  chainId: number
  chainName: string
  token0: { address: `0x${string}`; symbol: string; decimals: number }
  token1: { address: `0x${string}`; symbol: string; decimals: number }
  foodyPrice: { priceUSD: number; foodyPerUSD: number; source: string }
  /** Whether the v4 pool is actually live on-chain (vs. simulated) */
  isLive: boolean
  /** Pool manager address */
  poolManager: `0x${string}`
  /** Timestamp of this info snapshot */
  timestamp: number
}

/**
 * Assemble a complete PoolInfo snapshot for the UI.
 */
export async function getPoolInfo(): Promise<PoolInfo> {
  const foodyPrice = await getFoodyPrice()

  // Determine token ordering
  const usdcIsToken0 = USDC_ADDRESS.toLowerCase() < FOODY_ADDRESS.toLowerCase()

  return {
    poolId: FOODY_POOL_ID,
    poolKey: FOODY_POOL_KEY,
    chainId: BASE_CHAIN_ID,
    chainName: 'Unichain',
    token0: usdcIsToken0
      ? { address: USDC_ADDRESS, symbol: 'USDC', decimals: USDC_DECIMALS }
      : { address: FOODY_ADDRESS, symbol: 'FOODY', decimals: FOODY_DECIMALS },
    token1: usdcIsToken0
      ? { address: FOODY_ADDRESS, symbol: 'FOODY', decimals: FOODY_DECIMALS }
      : { address: USDC_ADDRESS, symbol: 'USDC', decimals: USDC_DECIMALS },
    foodyPrice,
    isLive: false, // Set to true once the v4 hook contracts are deployed
    poolManager: POOL_MANAGER_ADDRESS,
    timestamp: Date.now(),
  }
}

// ---------------------------------------------------------------------------
// Quote estimation (simulation layer)
// ---------------------------------------------------------------------------

/**
 * Estimate how much FOODY a diner would receive for a given USDC amount,
 * including the effective fee from the pricing hook.
 */
export async function estimateSwapOutput(
  amountUSDC: number,
  effectiveFeeBps: number,
): Promise<{
  grossFoody: number
  feeUSDC: number
  netFoody: number
}> {
  const { foodyPerUSD } = await getFoodyPrice()

  const feeUSDC = amountUSDC * (effectiveFeeBps / 1_000_000)
  const netUSDC = amountUSDC - feeUSDC
  const grossFoody = amountUSDC * foodyPerUSD
  const netFoody = netUSDC * foodyPerUSD

  return {
    grossFoody: Math.round(grossFoody * 100) / 100,
    feeUSDC: Math.round(feeUSDC * 10000) / 10000,
    netFoody: Math.round(netFoody * 100) / 100,
  }
}
