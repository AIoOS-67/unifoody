//  /src/components/diner/MyBalance.tsx

'use client'

import { useSmartWalletBalances } from '@/lib/useSmartWalletBalances'

export default function MyBalance() {
  const { eth, foody, usdc, loading } = useSmartWalletBalances()

  return (
    <div className="bg-[#121318] rounded-xl p-5 shadow border border-[#1e1e25] space-y-2">
      <div className="text-sm font-medium text-white">📊 Your Wallet Balances</div>
      <div className="space-y-1 pt-1 font-mono text-lg">
        <p className="text-yellow-400">
          ⛽ ETH: {loading ? 'Loading...' : `${parseFloat(eth ?? '0').toFixed(4)} ETH`}
        </p>
        <p className="text-emerald-400">
          🪙 FOODY: {loading ? 'Loading...' : `${parseFloat(foody ?? '0').toFixed(2)} FOODY`}
        </p>
        <p className="text-blue-400">
          💵 USDC: {loading ? 'Loading...' : `${parseFloat(usdc ?? '0').toFixed(2)} USDC`}
        </p>
      </div>
    </div>
  )
}
