//   /diner/dashboard/page.tsx

'use client'

import { useEffect } from 'react'
import { useSmartWallet } from '@/lib/useSmartWallet'
import MyBalance from '@/components/diner/MyBalance'
import BuyFoodyPanel from '@/components/diner/BuyFoodyPanel'


import PayByScan from '@/components/diner/PayByScan'
import { useSmartWalletBalances } from '@/lib/useSmartWalletBalances'



export default function DinerDashboard() {
  const { walletAddress, isConnected, connectSmartWallet } = useSmartWallet()

  useEffect(() => {
    if (!walletAddress) {
      connectSmartWallet()
    }
  }, [walletAddress])

  return (
    <div className="min-h-screen bg-black text-white px-4 py-6 space-y-6">
      <div className="w-full max-w-md mx-auto space-y-6">

        {/* Header */}
        <h1 className="text-2xl font-bold text-emerald-400 text-center">
          👋 Welcome, {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Guest'}!
        </h1>

        {/* My Info */}
        <div className="bg-[#121318] rounded-xl p-4 border border-zinc-800 shadow space-y-2 text-sm font-mono">
          <p><span className="text-zinc-400">🔐 Wallet:</span> {walletAddress || 'Not connected'}</p>
          <p><span className="text-zinc-400">🌐 Status:</span> {isConnected ? 'Connected ✅' : 'Connecting...'}</p>
        </div>

        {/* Balance */}
        <MyBalance />

        {/* Buy FOODY */}
        <BuyFoodyPanel />

        {/* Pay */}
        <PayByScan />
      </div>
    </div>
  )
}
