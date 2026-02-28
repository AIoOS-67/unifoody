// ✅ src/lib/useFoodyBalance.ts

import { useEffect, useState } from 'react'
import getPublicClient from './getPublicClient'
import { FOODY_ADDRESS } from './constants'
import { formatUnits } from 'viem'

export default function getFoodyBalance(address: `0x${string}`) {
  const [balance, setBalance] = useState('0.00')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!address) return

    const fetchBalance = async () => {
      try {
        setLoading(true)
        const client = await getPublicClient() // ✅ await 必须加
        const raw = await client.readContract({
          address: FOODY_ADDRESS,
          abi: [
            {
              name: 'balanceOf',
              type: 'function',
              stateMutability: 'view',
              inputs: [{ name: 'account', type: 'address' }],
              outputs: [{ name: '', type: 'uint256' }],
            },
          ],
          functionName: 'balanceOf',
          args: [address],
        })

        setBalance(formatUnits(raw as bigint, 18))
      } catch (err) {
        console.error('❌ Failed to fetch FOODY balance:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchBalance()
  }, [address])

  return { balance, loading, refreshBalance: () => {} }
}
