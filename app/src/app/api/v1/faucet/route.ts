// src/app/api/v1/faucet/route.ts
// POST /api/v1/faucet — Testnet faucet for AI agent onboarding
// Sends USDC + gas ETH to new agent wallets so they can swap for FOODY

import { NextRequest } from 'next/server'
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  isAddress,
  formatEther,
  formatUnits,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { unichainSepolia } from '@/lib/chains'
import { ERC20_ABI } from '@/lib/abi/uniswapV4Abi'
import { USDC_ADDRESS } from '@/lib/uniswap-v4/constants'
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

const DRIP_USDC = 1_000_000n // 1 USDC (6 decimals)
const DRIP_ETH = parseEther('0.001') // 0.001 ETH for gas (~50+ L2 txns)
const COOLDOWN_MS = 60 * 60 * 1000 // 1 hour per address

// Minimum treasury balances before we refuse to drip
const MIN_TREASURY_USDC = 2_000_000n // 2 USDC buffer
const MIN_TREASURY_ETH = parseEther('0.005') // 0.005 ETH buffer

// ---------------------------------------------------------------------------
// In-memory cooldown tracker (address → last drip timestamp)
// ---------------------------------------------------------------------------

const cooldowns = new Map<string, number>()

// Clean up expired entries every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [addr, ts] of cooldowns) {
    if (now - ts > COOLDOWN_MS) cooldowns.delete(addr)
  }
}, 10 * 60 * 1000)

// ---------------------------------------------------------------------------
// Lazy-initialized clients (only created when first request arrives)
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
// POST /api/v1/faucet
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  // ── Testnet guard ──────────────────────────────────────────────────────
  if (process.env.NEXT_PUBLIC_CHAIN_MODE !== 'testnet') {
    return apiError('Faucet is only available on testnet.', 403, startTime)
  }

  // ── Rate limit: 2 req/min per IP ──────────────────────────────────────
  const rlResp = applyRateLimit(getClientIp(request), 2, startTime)
  if (rlResp) return rlResp

  // ── Parse body ─────────────────────────────────────────────────────────
  let body: { wallet?: string }
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON body. Expected: { "wallet": "0x..." }', 400, startTime)
  }

  const wallet = body.wallet?.trim().toLowerCase()

  if (!wallet || !isAddress(wallet)) {
    return apiError('Invalid or missing wallet address.', 400, startTime)
  }

  if (wallet === '0x0000000000000000000000000000000000000000') {
    return apiError('Cannot drip to zero address.', 400, startTime)
  }

  // ── Per-address cooldown ───────────────────────────────────────────────
  const lastDrip = cooldowns.get(wallet)
  if (lastDrip) {
    const elapsed = Date.now() - lastDrip
    if (elapsed < COOLDOWN_MS) {
      const remainingMin = Math.ceil((COOLDOWN_MS - elapsed) / 60_000)
      return apiError(
        `Cooldown active. Try again in ${remainingMin} minute(s). Each address can request once per hour.`,
        429,
        startTime,
      )
    }
  }

  try {
    const walletClient = getWalletClient()
    const publicClient = getPublicClient()!
    const treasury = walletClient.account.address as `0x${string}`

    // ── Check treasury balances ──────────────────────────────────────────
    const [treasuryUSDC, treasuryETH] = await Promise.all([
      publicClient.readContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [treasury],
      }) as Promise<bigint>,
      publicClient.getBalance({ address: treasury }),
    ])

    if (treasuryUSDC < MIN_TREASURY_USDC) {
      console.error(`[Faucet] Treasury USDC too low: ${formatUnits(treasuryUSDC, 6)}`)
      return apiError(
        'Faucet treasury is low on USDC. Please try again later or use faucet.circle.com.',
        503,
        startTime,
      )
    }

    if (treasuryETH < MIN_TREASURY_ETH) {
      console.error(`[Faucet] Treasury ETH too low: ${formatEther(treasuryETH)}`)
      return apiError(
        'Faucet treasury is low on ETH. Please try again later.',
        503,
        startTime,
      )
    }

    // ── Send USDC ────────────────────────────────────────────────────────
    const usdcTx: `0x${string}` = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [wallet as `0x${string}`, DRIP_USDC],
    })

    // ── Send ETH (gas) ───────────────────────────────────────────────────
    const ethTx: `0x${string}` = await walletClient.sendTransaction({
      to: wallet as `0x${string}`,
      value: DRIP_ETH,
    })

    // ── Record cooldown ──────────────────────────────────────────────────
    cooldowns.set(wallet, Date.now())

    console.log(`[Faucet] Dripped to ${wallet} — USDC tx: ${usdcTx}, ETH tx: ${ethTx}`)

    return apiSuccess(
      {
        wallet,
        usdc_tx: usdcTx,
        eth_tx: ethTx,
        usdc_amount: '1.0',
        eth_amount: '0.001',
        explorer: {
          usdc: `https://sepolia.uniscan.xyz/tx/${usdcTx}`,
          eth: `https://sepolia.uniscan.xyz/tx/${ethTx}`,
        },
        next_available_in: '1 hour',
        tip: 'Use the USDC to swap for FOODY via Universal Router. POST /api/v1/quote to simulate first.',
      },
      startTime,
    )
  } catch (err: unknown) {
    const error = err as { shortMessage?: string; message?: string }
    console.error('[Faucet] Transaction error:', err)
    return apiError(
      `Faucet transaction failed: ${error?.shortMessage || error?.message || 'Unknown error'}`,
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
