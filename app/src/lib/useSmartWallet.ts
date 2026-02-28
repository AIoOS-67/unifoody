//   /src/lib/useSmartWallet.ts


'use client'

import { useEffect, useState } from 'react'
import { createWalletClient, custom } from 'viem'
import { unichain } from '@/lib/chains'

export function useSmartWallet() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [smartWalletClient, setSmartWalletClient] = useState<any>(null)
  const [isConnected, setIsConnected] = useState(false)

  const connectSmartWallet = async () => {
    try {
      if (typeof window === 'undefined') return
      const provider = (window as any)?.smartWalletProvider || (window as any)?.ethereum
      if (!provider) {
        console.warn('Coinbase Smart Wallet not found')
        return
      }

      const client = createWalletClient({
        account: null,
        chain: unichain,
        transport: custom(provider),
      })

      const [address] = await client.requestAddresses()
      setWalletAddress(address)
      setSmartWalletClient(client)
      setIsConnected(true)
    } catch (err) {
      console.error('❌ Failed to connect Smart Wallet:', err)
    }
  }

  useEffect(() => {
    connectSmartWallet()
  }, [])

  return {
    walletAddress,
    smartWalletClient,
    isConnected,
    connectSmartWallet,
  }
}
