// src/app/api/v1/swap/route.ts
// POST /api/v1/swap — Execute USDC→FOODY swap for AI agents (treasury-sponsored)
//
// Uses Universal Router execute() with V4_SWAP command encoding:
//   1. Approve USDC → Permit2 (one-time)
//   2. Permit2 approve USDC → Universal Router (per-swap)
//   3. execute(V4_SWAP): SWAP_EXACT_IN_SINGLE + SETTLE_ALL + TAKE_ALL
//   4. Transfer FOODY output from treasury to agent wallet
//
// hookData credits loyalty to the agent; cashback FOODY is minted directly to agent.

import { NextRequest } from 'next/server'
import {
  createWalletClient,
  createPublicClient,
  http,
  isAddress,
  encodeAbiParameters,
  parseAbiParameters,
  concat,
  toHex,
  maxUint256,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { unichainSepolia } from '@/lib/chains'
import { ERC20_ABI } from '@/lib/abi/uniswapV4Abi'
import {
  USDC_ADDRESS,
  FOODY_ADDRESS,
  SWAP_ROUTER_ADDRESS,
  FOODY_POOL_KEY,
  USDC_DECIMALS,
  BLOCK_EXPLORER_URL,
  RESTAURANT_IDS,
  PERMIT2_ADDRESS,
} from '@/lib/uniswap-v4/constants'
import { readQuoteSwap, TIER_LABELS, TIER_EMOJIS } from '@/lib/uniswap-v4/onchain'
import {
  apiSuccess,
  apiError,
  handleOptions,
  applyRateLimit,
  getClientIp,
} from '../_lib/response'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SWAP_USDC = 100 // Max 100 USDC per swap
const MIN_TREASURY_USDC = 10_000_000n // 10 USDC buffer (6 decimals)
const DEFAULT_RESTAURANT = RESTAURANT_IDS.SICHUAN_GARDEN

// V4 Universal Router command
const V4_SWAP_COMMAND = 0x10

// V4 Router actions (from Uniswap V4Router.sol)
const SWAP_EXACT_IN_SINGLE = 0x06
const SETTLE_ALL = 0x0c
const TAKE_ALL = 0x0f

// ---------------------------------------------------------------------------
// ABIs (minimal — only the functions we need)
// ---------------------------------------------------------------------------

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
// Lazy-initialized clients (same pattern as faucet)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _walletClient: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _publicClient: any = null

function getWalletClient() {
  if (!_walletClient) {
    const pk = process.env.SWAP_WALLET_PRIVATE_KEY
    if (!pk) throw new Error('SWAP_WALLET_PRIVATE_KEY not configured')
    const account = privateKeyToAccount(pk as `0x${string}`)
    _walletClient = createWalletClient({
      account,
      chain: unichainSepolia,
      transport: http(),
    })
  }
  return _walletClient
}

function getPublicClient() {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: unichainSepolia,
      transport: http('https://sepolia.unichain.org'),
    })
  }
  return _publicClient
}

// ---------------------------------------------------------------------------
// V4 Swap Encoding Helpers
// ---------------------------------------------------------------------------

function encodeV4SwapInput(
  amountIn: bigint,
  hookData: `0x${string}`,
): `0x${string}` {
  // Actions: SWAP_EXACT_IN_SINGLE + SETTLE_ALL + TAKE_ALL
  const actions = concat([
    toHex(SWAP_EXACT_IN_SINGLE, { size: 1 }),
    toHex(SETTLE_ALL, { size: 1 }),
    toHex(TAKE_ALL, { size: 1 }),
  ])

  // Param 1: ExactInputSingleParams
  // struct ExactInputSingleParams {
  //   PoolKey poolKey; bool zeroForOne; uint128 amountIn; uint128 amountOutMinimum; bytes hookData;
  // }
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
        zeroForOne: false, // USDC→FOODY: selling currency1 (USDC) for currency0 (FOODY)
        amountIn,
        amountOutMinimum: 0n, // No slippage for testnet
        hookData,
      },
    ],
  )

  // Param 2: SETTLE_ALL — (Currency inputToken, uint256 maxAmount)
  const settleParam = encodeAbiParameters(
    parseAbiParameters('address, uint256'),
    [USDC_ADDRESS as `0x${string}`, amountIn],
  )

  // Param 3: TAKE_ALL — (Currency outputToken, uint256 minAmount)
  const takeParam = encodeAbiParameters(
    parseAbiParameters('address, uint256'),
    [FOODY_ADDRESS as `0x${string}`, 0n],
  )

  // V4_SWAP input: abi.encode(bytes actions, bytes[] params)
  return encodeAbiParameters(
    parseAbiParameters('bytes, bytes[]'),
    [actions, [swapParam, settleParam, takeParam]],
  )
}

// ---------------------------------------------------------------------------
// POST /api/v1/swap
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  // ── Testnet guard ──────────────────────────────────────────────────────
  if (process.env.NEXT_PUBLIC_CHAIN_MODE !== 'testnet') {
    return apiError('Swap endpoint is only available on testnet.', 403, startTime)
  }

  // ── Rate limit: 5 req/min per IP ──────────────────────────────────────
  const rlResp = applyRateLimit(getClientIp(request), 5, startTime)
  if (rlResp) return rlResp

  // ── Parse body ─────────────────────────────────────────────────────────
  let body: { wallet?: string; restaurantId?: string; amountUSDC?: number }
  try {
    body = await request.json()
  } catch {
    return apiError(
      'Invalid JSON body. Expected: { "wallet": "0x...", "amountUSDC": 5.0 }',
      400,
      startTime,
    )
  }

  // ── Validate wallet ────────────────────────────────────────────────────
  const wallet = body.wallet?.trim().toLowerCase()
  if (!wallet || !isAddress(wallet)) {
    return apiError('Invalid or missing wallet address.', 400, startTime)
  }
  if (wallet === '0x0000000000000000000000000000000000000000') {
    return apiError('Cannot swap to zero address.', 400, startTime)
  }

  // ── Validate restaurantId (bytes32 hex) — default to Sichuan Garden ──
  const restaurantId = body.restaurantId || DEFAULT_RESTAURANT
  if (!/^0x[a-fA-F0-9]{64}$/.test(restaurantId)) {
    return apiError('Invalid `restaurantId` (bytes32 hex required)', 400, startTime)
  }

  // ── Validate amountUSDC ────────────────────────────────────────────────
  const amountUSDC = body.amountUSDC
  if (amountUSDC === undefined || typeof amountUSDC !== 'number' || amountUSDC <= 0) {
    return apiError(
      'Missing or invalid `amountUSDC` (positive number required, e.g. 5.0)',
      400,
      startTime,
    )
  }
  if (amountUSDC > MAX_SWAP_USDC) {
    return apiError(
      `amountUSDC exceeds maximum of ${MAX_SWAP_USDC} USDC per swap.`,
      400,
      startTime,
    )
  }

  const amountRaw = BigInt(Math.round(amountUSDC * 10 ** USDC_DECIMALS))

  try {
    // ── Step 1: Quote — validate constraints on-chain ──────────────────
    const quote = await readQuoteSwap(
      wallet as `0x${string}`,
      restaurantId as `0x${string}`,
      amountRaw,
    )

    if (!quote.allowed) {
      return apiError(`Swap denied by hook: ${quote.reason}`, 422, startTime)
    }

    const walletClient = getWalletClient()
    const publicClient = getPublicClient()
    const treasury = walletClient.account.address as `0x${string}`

    // ── Step 2: Check treasury USDC balance ────────────────────────────
    const treasuryUSDC = (await publicClient.readContract({
      address: USDC_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [treasury],
    })) as bigint

    if (treasuryUSDC < amountRaw + MIN_TREASURY_USDC) {
      return apiError('Treasury USDC balance too low for this swap.', 503, startTime)
    }

    // ── Step 3: Ensure USDC approved to Permit2 ────────────────────────
    const usdcPermit2Allowance = (await publicClient.readContract({
      address: USDC_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [treasury, PERMIT2_ADDRESS as `0x${string}`],
    })) as bigint

    if (usdcPermit2Allowance < amountRaw) {
      const approveTx = await walletClient.writeContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [PERMIT2_ADDRESS as `0x${string}`, maxUint256],
      })
      await publicClient.waitForTransactionReceipt({ hash: approveTx })
    }

    // ── Step 4: Set Permit2 allowance for Universal Router ─────────────
    const [permit2Amount] = (await publicClient.readContract({
      address: PERMIT2_ADDRESS as `0x${string}`,
      abi: PERMIT2_ABI,
      functionName: 'allowance',
      args: [treasury, USDC_ADDRESS as `0x${string}`, SWAP_ROUTER_ADDRESS as `0x${string}`],
    })) as [bigint, number, number]

    if (permit2Amount < amountRaw) {
      const permit2ApproveTx = await walletClient.writeContract({
        address: PERMIT2_ADDRESS as `0x${string}`,
        abi: PERMIT2_ABI,
        functionName: 'approve',
        args: [
          USDC_ADDRESS as `0x${string}`,
          SWAP_ROUTER_ADDRESS as `0x${string}`,
          BigInt('0xffffffffffffffffffffffffffffffffffffffff'), // uint160 max
          BigInt(Math.floor(Date.now() / 1000) + 86400), // 24h expiration
        ],
      })
      await publicClient.waitForTransactionReceipt({ hash: permit2ApproveTx })
    }

    // ── Step 5: Encode hookData + V4 swap commands ────────────────────
    const hookData = encodeAbiParameters(
      parseAbiParameters('address, bytes32'),
      [wallet as `0x${string}`, restaurantId as `0x${string}`],
    )

    const v4SwapInput = encodeV4SwapInput(amountRaw, hookData)
    const commands = toHex(V4_SWAP_COMMAND, { size: 1 })
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300) // 5 min

    // ── Step 7: Execute swap via Universal Router ──────────────────────
    const swapTx: `0x${string}` = await walletClient.writeContract({
      address: SWAP_ROUTER_ADDRESS as `0x${string}`,
      abi: UNIVERSAL_ROUTER_ABI,
      functionName: 'execute',
      args: [commands, [v4SwapInput], deadline],
    })

    const swapReceipt = await publicClient.waitForTransactionReceipt({ hash: swapTx })

    // ── Step 8: Parse FOODY received from Transfer events in receipt ───
    // Look for ERC20 Transfer(from, to, amount) where to = treasury
    const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
    const treasuryPadded = ('0x' + treasury.slice(2).toLowerCase().padStart(64, '0')) as `0x${string}`
    const foodyAddrLower = (FOODY_ADDRESS as string).toLowerCase()

    let foodyReceived = 0n
    for (const log of swapReceipt.logs) {
      if (
        log.address.toLowerCase() === foodyAddrLower &&
        log.topics[0] === TRANSFER_TOPIC &&
        log.topics[2]?.toLowerCase() === treasuryPadded
      ) {
        foodyReceived += BigInt(log.data)
      }
    }
    console.log(`[Swap] FOODY received by treasury from events: ${foodyReceived}`)
    let transferTx: `0x${string}` | null = null

    if (foodyReceived > 0n) {
      transferTx = await walletClient.writeContract({
        address: FOODY_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [wallet as `0x${string}`, foodyReceived],
      })
    }

    console.log(
      `[Swap] ${wallet} swapped ${amountUSDC} USDC → ${foodyReceived} FOODY — swap: ${swapTx}, transfer: ${transferTx}`,
    )

    // ── Return success ─────────────────────────────────────────────────
    return apiSuccess(
      {
        wallet,
        restaurantId,
        amountUSDC,
        direction: 'USDC_TO_FOODY',
        foodyReceived: foodyReceived.toString(),
        quote: {
          effectiveFee: quote.effectiveFee,
          expectedCashbackFOODY: quote.expectedCashbackFOODY.toString(),
          currentTier: {
            id: quote.currentTier,
            label: TIER_LABELS[quote.currentTier] ?? 'Unknown',
            emoji: TIER_EMOJIS[quote.currentTier] ?? '?',
          },
          projectedTier: {
            id: quote.projectedTier,
            label: TIER_LABELS[quote.projectedTier] ?? 'Unknown',
            emoji: TIER_EMOJIS[quote.projectedTier] ?? '?',
          },
          willMintVIP: quote.willMintVIP,
        },
        transactions: {
          swap_tx: swapTx,
          transfer_tx: transferTx,
          explorer: {
            swap: `${BLOCK_EXPLORER_URL}/tx/${swapTx}`,
            ...(transferTx ? { transfer: `${BLOCK_EXPLORER_URL}/tx/${transferTx}` } : {}),
          },
        },
        next_steps: {
          check_loyalty: `GET /api/v1/loyalty/${wallet}`,
          tip: 'FOODY tokens sent to your wallet. Hook tracked loyalty + cashback.',
        },
      },
      startTime,
    )
  } catch (err: unknown) {
    const error = err as { shortMessage?: string; message?: string }
    console.error('[Swap] Transaction error:', err)
    return apiError(
      `Swap failed: ${error?.shortMessage || error?.message || 'Unknown error'}`,
      502,
      startTime,
    )
  }
}

// ---------------------------------------------------------------------------
// OPTIONS — CORS preflight
// ---------------------------------------------------------------------------

export async function OPTIONS() {
  return handleOptions()
}
