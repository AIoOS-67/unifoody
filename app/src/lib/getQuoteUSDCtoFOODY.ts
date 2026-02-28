// ✅ src/lib/getQuoteUSDCtoFOODY.ts

import { UNISWAP_QUOTER_V3, USDC_ADDRESS, FOODY_ADDRESS } from './constants'
import { quoterAbi } from './abi/quoter'
import getPublicClient from './getPublicClient'
import { parseUnits } from 'viem'

export default async function getQuoteUSDCtoFOODY(amountInUSDC: number): Promise<bigint> {
  const amountIn = parseUnits(amountInUSDC.toFixed(6), 6)
  const client = getPublicClient()

  const quote = await client.readContract({
    address: UNISWAP_QUOTER_V3,
    abi: quoterAbi,
    functionName: 'quoteExactInputSingle',
    args: [USDC_ADDRESS, FOODY_ADDRESS, 3000, amountIn, 0],
  })

  return quote as bigint
}

