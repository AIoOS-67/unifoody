// ✅ src/lib/swapUSDCtoFOODY.ts

import { UNISWAP_ROUTER, USDC_ADDRESS, FOODY_ADDRESS } from './constants'
import { UNISWAP_ABI } from './abi/uniswapAbi'
import { parseUnits } from 'viem'

type SwapParams = {
  amountInUSDC: number
  recipient: `0x${string}`
  smartWalletClient: {
    writeContract: Function
    account?: any
  }
}

export default async function swapUSDCtoFOODY({
  amountInUSDC,
  recipient,
  smartWalletClient,
}: SwapParams) {
  if (!smartWalletClient?.writeContract) {
    throw new Error('❌ Smart Wallet not connected.')
  }

  const amountIn = parseUnits(amountInUSDC.toFixed(6), 6)

  console.log('🔁 Swapping USDC → FOODY', {
    amountIn: amountIn.toString(),
    recipient,
  })

  return await smartWalletClient.writeContract({
    address: UNISWAP_ROUTER,
    abi: UNISWAP_ABI,
    functionName: 'exactInputSingle',
    args: [{
      tokenIn: USDC_ADDRESS,
      tokenOut: FOODY_ADDRESS,
      fee: 3000,
      recipient,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 60 * 10), // +10 minutes
      amountIn,
      amountOutMinimum: 0n,
      sqrtPriceLimitX96: 0n,
    }],
  })
}

