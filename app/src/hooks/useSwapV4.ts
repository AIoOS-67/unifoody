// src/hooks/useSwapV4.ts
// React hook for executing V4 swaps through FoodySwapHook on Base Sepolia
// Uses wagmi writeContract + Permit2 approval flow

'use client'

import { useState, useCallback } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { encodePacked, encodeAbiParameters, parseAbiParameters } from 'viem'
import { V4_SWAP_ROUTER_ABI } from '@/lib/abi/v4SwapRouterAbi'
import { ERC20_ABI } from '@/lib/abi/uniswapV4Abi'
import {
  SWAP_ROUTER_ADDRESS,
  FOODY_POOL_KEY,
  FOODY_ADDRESS,
  USDC_ADDRESS,
  FOODY_DECIMALS,
  USDC_DECIMALS,
} from '@/lib/uniswap-v4/constants'
import { readUserLoyalty, type UserLoyaltyData } from '@/lib/uniswap-v4/onchain'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SwapDirection = 'FOODY_TO_USDC' | 'USDC_TO_FOODY'

export interface SwapResult {
  txHash: `0x${string}`
  loyaltyBefore?: UserLoyaltyData
  loyaltyAfter?: UserLoyaltyData
}

export type SwapStatus = 'idle' | 'approving' | 'swapping' | 'confirming' | 'success' | 'error'

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSwapV4() {
  const { address, isConnected } = useAccount()
  const { writeContractAsync } = useWriteContract()

  const [status, setStatus] = useState<SwapStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | null>(null)
  const [loyaltyData, setLoyaltyData] = useState<UserLoyaltyData | null>(null)

  /**
   * Execute a swap through the V4 SwapRouter with hookData
   * @param direction FOODY_TO_USDC or USDC_TO_FOODY
   * @param amount Human-readable amount (e.g., 100 for 100 FOODY)
   * @param restaurantId bytes32 restaurant ID for hookData
   * @param slippageBps Slippage tolerance in basis points (default 500 = 5%)
   */
  const executeSwap = useCallback(async (
    direction: SwapDirection,
    amount: number,
    restaurantId: `0x${string}`,
    slippageBps: number = 500,
  ): Promise<SwapResult | null> => {
    if (!address || !isConnected) {
      setError('Wallet not connected')
      return null
    }

    setStatus('idle')
    setError(null)

    try {
      // Determine swap parameters based on direction
      // Pool: currency0 = FOODY, currency1 = USDC (FOODY < USDC lexicographically)
      const isFoodyToUsdc = direction === 'FOODY_TO_USDC'
      const zeroForOne = isFoodyToUsdc // FOODY is currency0

      const inputToken = isFoodyToUsdc ? FOODY_ADDRESS : USDC_ADDRESS
      const inputDecimals = isFoodyToUsdc ? FOODY_DECIMALS : USDC_DECIMALS

      const amountIn = BigInt(Math.floor(amount * (10 ** inputDecimals)))
      const amountOutMin = BigInt(0) // For testnet, no slippage protection

      // Encode hookData: abi.encode(userAddress, restaurantId)
      const hookData = encodeAbiParameters(
        parseAbiParameters('address, bytes32'),
        [address, restaurantId]
      )

      // Read loyalty BEFORE swap
      let loyaltyBefore: UserLoyaltyData | undefined
      try {
        loyaltyBefore = await readUserLoyalty(address)
      } catch {
        // Ignore read errors
      }

      // Step 1: Approve input token to SwapRouter
      setStatus('approving')
      const approveTx = await writeContractAsync({
        address: inputToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [SWAP_ROUTER_ADDRESS as `0x${string}`, amountIn * BigInt(2)], // 2x for safety
      })

      // Step 2: Execute swap
      setStatus('swapping')
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300) // 5 min deadline

      const poolKeyTuple = {
        currency0: FOODY_POOL_KEY.currency0 as `0x${string}`,
        currency1: FOODY_POOL_KEY.currency1 as `0x${string}`,
        fee: FOODY_POOL_KEY.fee,
        tickSpacing: FOODY_POOL_KEY.tickSpacing,
        hooks: FOODY_POOL_KEY.hooks as `0x${string}`,
      }

      const swapTx = await writeContractAsync({
        address: SWAP_ROUTER_ADDRESS as `0x${string}`,
        abi: V4_SWAP_ROUTER_ABI,
        functionName: 'swapExactTokensForTokens',
        args: [
          amountIn,
          amountOutMin,
          zeroForOne,
          poolKeyTuple,
          hookData,
          address,
          deadline,
        ],
      })

      setLastTxHash(swapTx)
      setStatus('confirming')

      // Step 3: Read loyalty AFTER swap (with a short delay for chain to update)
      await new Promise(resolve => setTimeout(resolve, 3000))

      let loyaltyAfter: UserLoyaltyData | undefined
      try {
        loyaltyAfter = await readUserLoyalty(address)
        setLoyaltyData(loyaltyAfter)
      } catch {
        // Ignore read errors
      }

      setStatus('success')

      return {
        txHash: swapTx,
        loyaltyBefore,
        loyaltyAfter,
      }
    } catch (err: any) {
      console.error('Swap failed:', err)
      setError(err?.shortMessage ?? err?.message ?? 'Swap failed')
      setStatus('error')
      return null
    }
  }, [address, isConnected, writeContractAsync])

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setLastTxHash(null)
  }, [])

  return {
    executeSwap,
    reset,
    status,
    error,
    lastTxHash,
    loyaltyData,
    isConnected,
    userAddress: address,
  }
}
