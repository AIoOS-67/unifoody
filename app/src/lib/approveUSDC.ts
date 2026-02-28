// ✅ src/lib/approveUSDC.ts

import { USDC_ADDRESS } from './constants'

const USDC_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
] as const

type ApproveParams = {
  spender: `0x${string}`
  amount: bigint
  smartWalletClient: {
    writeContract: Function
    account?: any
  }
}

export default async function approveUSDC({
  spender,
  amount,
  smartWalletClient,
}: ApproveParams) {
  if (!smartWalletClient?.writeContract) {
    throw new Error('❌ Smart Wallet not connected.')
  }

  console.log('🟢 Approving USDC via Smart Wallet:', {
    spender,
    amount: amount.toString(),
  })

  return await smartWalletClient.writeContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'approve',
    args: [spender, amount],
  })
}
