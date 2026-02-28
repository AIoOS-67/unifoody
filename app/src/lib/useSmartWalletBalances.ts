//  /src/lib/useSmartWalletBalances.ts

'use client'

import { useEffect, useState } from 'react'
import getUSDCBalance from './getUSDCBalance'
import { getPublicClient } from './getPublicClient'
import { FOODY_ADDRESS } from './constants'
import { useSmartWallet } from './useSmartWallet'
import { formatUnits } from 'viem'

export function useSmartWalletBalances() {
  const { walletAddress } = useSmartWallet()
  const [eth, setEth] = useState<string | null>(null)
  const [foody, setFoody] = useState<string | null>(null)
  const [usdc, setUsdc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!walletAddress) return
    const fetch = async () => {
      setLoading(true)
      const client = getPublicClient()
      const [ethBal, foodyBal, usdcBal] = await Promise.all([
client.getBalance({ address: walletAddress as `0x${string}` }),
        client.readContract({
          address: FOODY_ADDRESS,
          abi: [{
            name: 'balanceOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }],
          }],
          functionName: 'balanceOf',
args: [walletAddress as `0x${string}`],
        }),
getUSDCBalance(walletAddress as `0x${string}`),
      ])
      setEth(formatUnits(ethBal, 18))
      setFoody(formatUnits(foodyBal, 18))
      setUsdc(formatUnits(usdcBal, 6))
      setLoading(false)
    }
    fetch()
  }, [walletAddress])

  return { eth, foody, usdc, loading }
}


