// src/hooks/useSwapV4.ts
// React hook for executing V4 swaps through Universal Router on Unichain
// Uses wagmi writeContract + Permit2 approval flow + V4_SWAP command encoding

'use client'

import { useState, useCallback } from 'react'
import { useAccount, useWriteContract, usePublicClient } from 'wagmi'
import {
  encodeAbiParameters,
  parseAbiParameters,
  concat,
  toHex,
  maxUint256,
} from 'viem'
import { ERC20_ABI } from '@/lib/abi/uniswapV4Abi'
import {
  SWAP_ROUTER_ADDRESS,
  FOODY_POOL_KEY,
  FOODY_ADDRESS,
  USDC_ADDRESS,
  FOODY_DECIMALS,
  USDC_DECIMALS,
  PERMIT2_ADDRESS,
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

export type SwapStatus = 'idle' | 'approving' | 'permit2' | 'swapping' | 'confirming' | 'success' | 'error'

// ---------------------------------------------------------------------------
// V4 Universal Router Constants & ABIs
// ---------------------------------------------------------------------------

const V4_SWAP_COMMAND = 0x10

// V4 Router actions (from Actions.sol)
const SWAP_EXACT_IN_SINGLE = 0x06
const SETTLE_ALL = 0x0c
const TAKE_ALL = 0x0f

const UNIVERSAL_ROUTER_ABI = [
  {
    name: 'execute',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'commands', type: 'bytes' },
      { name: 'inputs', type: 'bytes[]' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

const PERMIT2_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
    ],
    outputs: [],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
      { name: 'nonce', type: 'uint48' },
    ],
  },
] as const

// ---------------------------------------------------------------------------
// V4 Swap Encoding Helper
// ---------------------------------------------------------------------------

function encodeV4SwapInput(
  zeroForOne: boolean,
  amountIn: bigint,
  hookData: `0x${string}`,
): `0x${string}` {
  // Actions: SWAP_EXACT_IN_SINGLE + SETTLE_ALL + TAKE_ALL
  const actions = concat([
    toHex(SWAP_EXACT_IN_SINGLE, { size: 1 }),
    toHex(SETTLE_ALL, { size: 1 }),
    toHex(TAKE_ALL, { size: 1 }),
  ])

  const inputCurrency = zeroForOne
    ? FOODY_POOL_KEY.currency0
    : FOODY_POOL_KEY.currency1
  const outputCurrency = zeroForOne
    ? FOODY_POOL_KEY.currency1
    : FOODY_POOL_KEY.currency0

  // Param 1: ExactInputSingleParams
  const swapParam = encodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          {
            type: 'tuple',
            name: 'poolKey',
            components: [
              { type: 'address', name: 'currency0' },
              { type: 'address', name: 'currency1' },
              { type: 'uint24', name: 'fee' },
              { type: 'int24', name: 'tickSpacing' },
              { type: 'address', name: 'hooks' },
            ],
          },
          { type: 'bool', name: 'zeroForOne' },
          { type: 'uint128', name: 'amountIn' },
          { type: 'uint128', name: 'amountOutMinimum' },
          { type: 'bytes', name: 'hookData' },
        ],
      },
    ],
    [
      {
        poolKey: {
          currency0: FOODY_POOL_KEY.currency0 as `0x${string}`,
          currency1: FOODY_POOL_KEY.currency1 as `0x${string}`,
          fee: FOODY_POOL_KEY.fee,
          tickSpacing: FOODY_POOL_KEY.tickSpacing,
          hooks: FOODY_POOL_KEY.hooks as `0x${string}`,
        },
        zeroForOne,
        amountIn,
        amountOutMinimum: 0n, // No slippage for testnet
        hookData,
      },
    ],
  )

  // Param 2: SETTLE_ALL — (Currency inputToken, uint256 maxAmount)
  const settleParam = encodeAbiParameters(
    parseAbiParameters('address, uint256'),
    [inputCurrency as `0x${string}`, amountIn],
  )

  // Param 3: TAKE_ALL — (Currency outputToken, uint256 minAmount)
  const takeParam = encodeAbiParameters(
    parseAbiParameters('address, uint256'),
    [outputCurrency as `0x${string}`, 0n],
  )

  // V4_SWAP input: abi.encode(bytes actions, bytes[] params)
  return encodeAbiParameters(
    parseAbiParameters('bytes, bytes[]'),
    [actions, [swapParam, settleParam, takeParam]],
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSwapV4() {
  const { address, isConnected } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()

  const [status, setStatus] = useState<SwapStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | null>(null)
  const [loyaltyData, setLoyaltyData] = useState<UserLoyaltyData | null>(null)

  /**
   * Execute a swap through the Universal Router with V4_SWAP command
   * @param direction FOODY_TO_USDC or USDC_TO_FOODY
   * @param amount Human-readable amount (e.g., 100 for 100 FOODY)
   * @param restaurantId bytes32 restaurant ID for hookData
   * @param slippageBps Slippage tolerance in basis points (unused on testnet)
   */
  const executeSwap = useCallback(async (
    direction: SwapDirection,
    amount: number,
    restaurantId: `0x${string}`,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

      // Step 1: Approve input token to Permit2
      setStatus('approving')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentAllowance = (await (publicClient as any)?.readContract({
        address: inputToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, PERMIT2_ADDRESS as `0x${string}`],
      })) as bigint ?? 0n

      if (currentAllowance < amountIn) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (writeContractAsync as any)({
          address: inputToken as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [PERMIT2_ADDRESS as `0x${string}`, maxUint256],
        })
      }

      // Step 2: Set Permit2 allowance for Universal Router
      setStatus('permit2')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [permit2Amount] = (await (publicClient as any)?.readContract({
        address: PERMIT2_ADDRESS as `0x${string}`,
        abi: PERMIT2_ABI,
        functionName: 'allowance',
        args: [address, inputToken as `0x${string}`, SWAP_ROUTER_ADDRESS as `0x${string}`],
      })) as [bigint, number, number] ?? [0n, 0, 0]

      if (permit2Amount < amountIn) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (writeContractAsync as any)({
          address: PERMIT2_ADDRESS as `0x${string}`,
          abi: PERMIT2_ABI,
          functionName: 'approve',
          args: [
            inputToken as `0x${string}`,
            SWAP_ROUTER_ADDRESS as `0x${string}`,
            BigInt('0xffffffffffffffffffffffffffffffffffffffff'), // uint160 max
            Number(Math.floor(Date.now() / 1000) + 86400), // 24h uint48
          ],
        })
      }

      // Step 3: Execute V4_SWAP via Universal Router
      setStatus('swapping')
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300) // 5 min

      const v4SwapInput = encodeV4SwapInput(zeroForOne, amountIn, hookData)
      const commands = toHex(V4_SWAP_COMMAND, { size: 1 })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const swapTx = await (writeContractAsync as any)({
        address: SWAP_ROUTER_ADDRESS as `0x${string}`,
        abi: UNIVERSAL_ROUTER_ABI,
        functionName: 'execute',
        args: [commands, [v4SwapInput], deadline],
      })

      setLastTxHash(swapTx)
      setStatus('confirming')

      // Step 4: Read loyalty AFTER swap (with a short delay for chain to update)
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
    } catch (err: unknown) {
      const e = err as { shortMessage?: string; message?: string }
      console.error('Swap failed:', err)
      setError(e?.shortMessage ?? e?.message ?? 'Swap failed')
      setStatus('error')
      return null
    }
  }, [address, isConnected, writeContractAsync, publicClient])

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
