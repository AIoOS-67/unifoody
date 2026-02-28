// src/lib/uniswap-v4/onchain.ts
// On-chain read functions for FoodySwapHook data on Unichain
// Uses viem readContract() — no wallet connection needed for reads

import { createPublicClient, http, type PublicClient } from 'viem'
import { unichain, unichainSepolia } from '@/lib/chains'
import { FOODY_SWAP_HOOK_ABI } from '../abi/foodySwapHookAbi'
import { ERC20_ABI } from '../abi/uniswapV4Abi'
import {
  HOOK_ADDRESS,
  VIP_NFT_ADDRESS,
  FOODY_ADDRESS,
  USDC_ADDRESS,
  ACTIVE_CHAIN_ID,
  FOODY_DECIMALS,
  USDC_DECIMALS,
} from './constants'

// ---------------------------------------------------------------------------
// Viem public client (read-only, no wallet needed)
// ---------------------------------------------------------------------------

const isTestnet = process.env.NEXT_PUBLIC_CHAIN_MODE === 'testnet'

const publicClient: PublicClient = createPublicClient({
  chain: isTestnet ? unichainSepolia : unichain,
  transport: http(isTestnet ? 'https://sepolia.unichain.org' : 'https://mainnet.unichain.org'),
})

// ---------------------------------------------------------------------------
// Loyalty tier enum (matches Solidity)
// ---------------------------------------------------------------------------

export enum OnChainTier {
  Bronze = 0,
  Silver = 1,
  Gold = 2,
  VIP = 3,
}

export const TIER_LABELS: Record<number, string> = {
  0: 'Bronze',
  1: 'Silver',
  2: 'Gold',
  3: 'VIP',
}

export const TIER_EMOJIS: Record<number, string> = {
  0: '🥉',
  1: '🥈',
  2: '🥇',
  3: '💎',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserLoyaltyData {
  totalSpent: bigint
  foodyEarned: bigint
  referralEarned: bigint
  tier: number
  referrer: `0x${string}`
  lastSwapTime: bigint
  swapCount: bigint
  // Derived fields
  tierLabel: string
  tierEmoji: string
  totalSpentUSDC: number
  foodyEarnedFormatted: number
}

export interface HookStats {
  totalVolume: bigint
  totalRewardsDistributed: bigint
  // Derived
  totalVolumeUSDC: number
  totalRewardsFormatted: number
}

// ---------------------------------------------------------------------------
// Read Functions
// ---------------------------------------------------------------------------

/** Get a user's complete loyalty information */
export async function readUserLoyalty(userAddress: `0x${string}`): Promise<UserLoyaltyData> {
  const data = await publicClient.readContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: FOODY_SWAP_HOOK_ABI,
    functionName: 'getUserLoyalty',
    args: [userAddress],
  }) as any

  const tier = Number(data.tier)
  const totalSpent = BigInt(data.totalSpent)
  const foodyEarned = BigInt(data.foodyEarned)

  return {
    totalSpent,
    foodyEarned,
    referralEarned: BigInt(data.referralEarned),
    tier,
    referrer: data.referrer as `0x${string}`,
    lastSwapTime: BigInt(data.lastSwapTime),
    swapCount: BigInt(data.swapCount),
    // Derived
    tierLabel: TIER_LABELS[tier] ?? 'Unknown',
    tierEmoji: TIER_EMOJIS[tier] ?? '❓',
    totalSpentUSDC: Number(totalSpent) / (10 ** USDC_DECIMALS),
    foodyEarnedFormatted: Number(foodyEarned) / (10 ** FOODY_DECIMALS),
  }
}

/** Get a user's current tier */
export async function readUserTier(userAddress: `0x${string}`): Promise<number> {
  const tier = await publicClient.readContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: FOODY_SWAP_HOOK_ABI,
    functionName: 'getUserTier',
    args: [userAddress],
  })
  return Number(tier)
}

/** Get a user's current fee (in basis points after discount) */
export async function readUserFee(userAddress: `0x${string}`): Promise<number> {
  const fee = await publicClient.readContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: FOODY_SWAP_HOOK_ABI,
    functionName: 'getCurrentFeeForUser',
    args: [userAddress],
  })
  return Number(fee)
}

/** Check if a user holds a VIP NFT */
export async function readIsVIP(userAddress: `0x${string}`): Promise<boolean> {
  const result = await publicClient.readContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: FOODY_SWAP_HOOK_ABI,
    functionName: 'isVIP',
    args: [userAddress],
  })
  return result as boolean
}

/** Get global hook statistics */
export async function readHookStats(): Promise<HookStats> {
  const [totalVolume, totalRewardsDistributed] = await Promise.all([
    publicClient.readContract({
      address: HOOK_ADDRESS as `0x${string}`,
      abi: FOODY_SWAP_HOOK_ABI,
      functionName: 'totalVolume',
    }),
    publicClient.readContract({
      address: HOOK_ADDRESS as `0x${string}`,
      abi: FOODY_SWAP_HOOK_ABI,
      functionName: 'totalRewardsDistributed',
    }),
  ])

  const vol = BigInt(totalVolume as bigint)
  const rewards = BigInt(totalRewardsDistributed as bigint)

  return {
    totalVolume: vol,
    totalRewardsDistributed: rewards,
    totalVolumeUSDC: Number(vol) / (10 ** USDC_DECIMALS),
    totalRewardsFormatted: Number(rewards) / (10 ** FOODY_DECIMALS),
  }
}

/** Get token balance (FOODY or USDC) */
export async function readTokenBalance(
  tokenAddress: `0x${string}`,
  userAddress: `0x${string}`
): Promise<bigint> {
  return publicClient.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [userAddress],
  }) as Promise<bigint>
}

/** Get both FOODY and USDC balances for a user */
export async function readUserBalances(userAddress: `0x${string}`) {
  const [foodyRaw, usdcRaw] = await Promise.all([
    readTokenBalance(FOODY_ADDRESS as `0x${string}`, userAddress),
    readTokenBalance(USDC_ADDRESS as `0x${string}`, userAddress),
  ])

  return {
    foodyRaw,
    usdcRaw,
    foody: Number(foodyRaw) / (10 ** FOODY_DECIMALS),
    usdc: Number(usdcRaw) / (10 ** USDC_DECIMALS),
  }
}

/** Check restaurant status on the hook */
export async function readRestaurant(restaurantId: `0x${string}`) {
  const data = await publicClient.readContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: FOODY_SWAP_HOOK_ABI,
    functionName: 'restaurants',
    args: [restaurantId],
  }) as any

  return {
    wallet: data.wallet as `0x${string}`,
    isActive: data.isActive as boolean,
    openHour: Number(data.openHour),
    closeHour: Number(data.closeHour),
    maxTxAmount: BigInt(data.maxTxAmount),
  }
}

// ---------------------------------------------------------------------------
// AI Agent Functions
// ---------------------------------------------------------------------------

/** Simulate a swap via quoteSwap() on-chain — preview fees, rewards, tier changes */
export async function readQuoteSwap(
  userAddress: `0x${string}`,
  restaurantId: `0x${string}`,
  amountUSDC: bigint
) {
  const data = await publicClient.readContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: FOODY_SWAP_HOOK_ABI,
    functionName: 'quoteSwap',
    args: [userAddress, restaurantId, amountUSDC],
  }) as any

  return {
    allowed: data.allowed as boolean,
    reason: data.reason as string,
    effectiveFee: Number(data.effectiveFee),
    expectedCashbackFOODY: BigInt(data.expectedCashbackFOODY),
    currentTier: Number(data.currentTier),
    projectedTier: Number(data.projectedTier),
    willMintVIP: data.willMintVIP as boolean,
    discountBps: Number(data.discountBps),
    rewardRateBps: Number(data.rewardRateBps),
  }
}

/** Get complete agent profile in one call — replaces 5+ separate reads */
export async function readAgentProfile(userAddress: `0x${string}`) {
  const data = await publicClient.readContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: FOODY_SWAP_HOOK_ABI,
    functionName: 'getAgentProfile',
    args: [userAddress],
  }) as any

  return {
    totalSpent: BigInt(data.totalSpent),
    foodyEarned: BigInt(data.foodyEarned),
    referralEarned: BigInt(data.referralEarned),
    tier: Number(data.tier),
    referrer: data.referrer as `0x${string}`,
    lastSwapTime: BigInt(data.lastSwapTime),
    swapCount: Number(data.swapCount),
    discountBps: Number(data.discountBps),
    rewardRateBps: Number(data.rewardRateBps),
    currentFee: Number(data.currentFee),
    isVIP: data.isVIP as boolean,
    nextTierThreshold: BigInt(data.nextTierThreshold),
    spentToNextTier: BigInt(data.spentToNextTier),
  }
}

export { publicClient }
