// ✅ src/lib/getUSDCBalance.ts

import { readContract } from 'viem/actions'
import getPublicClient from './getPublicClient'
import { USDC_ADDRESS } from './constants'

const USDC_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export default async function getUSDCBalance(address: `0x${string}`): Promise<bigint> {
  const publicClient = getPublicClient()
  return await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: [address],
  })
}

