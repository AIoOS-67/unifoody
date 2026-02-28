//  /src/components/BuyFoodyInlinePanel.tsx


'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useSmartWallet } from '@/lib/useSmartWallet'

import getFoodyBalance from '@/lib/useFoodyBalance'
import getQuoteUSDCtoFOODY from '@/lib/getQuoteUSDCtoFOODY'
import getUSDCBalance from '@/lib/getUSDCBalance'
import approveUSDC from '@/lib/approveUSDC'
import swapUSDCtoFOODY from '@/lib/swapUSDCtoFOODY'
import insertFoodyOrder from '@/lib/insertFoodyOrder'

import { UNISWAP_ROUTER } from '@/lib/constants'
import { parseUnits, formatUnits } from 'viem'
import { unichain } from '@/lib/chains'

export function BuyFoodyInlinePanel() {
  const { walletAddress, smartWalletClient } = useSmartWallet()
const refreshBalance = getFoodyBalance(walletAddress as `0x${string}`)



  const [amountUSDC, setAmountUSDC] = useState(10)
  const [quoteFOODY, setQuoteFOODY] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'approving' | 'swapping' | 'error'>('idle')

  // 实时报价
  useEffect(() => {
    const fetchQuote = async () => {
      try {
        const quote = await getQuoteUSDCtoFOODY(amountUSDC)
        setQuoteFOODY(quote === 0n ? '~' : formatUnits(quote, 18))
      } catch (err) {
        console.warn('⚠️ Quote error:', err)
        setQuoteFOODY('~')
      }
    }
    fetchQuote()
  }, [amountUSDC])

  const handleBuy = async () => {
    try {
      if (!walletAddress || !smartWalletClient) {
        toast.error('Please connect wallet')
        return
      }

      const chainId = smartWalletClient.chain?.id
      if (chainId !== unichain.id) {
        toast.error('Please switch to Unichain network')
        return
      }

      if (amountUSDC > 100) {
        toast.error('Max limit: 100 USDC')
        return
      }

      setStatus('approving')
      toast.loading('Checking balance...')

      const balance = await getUSDCBalance(walletAddress as `0x${string}`)
      const required = parseUnits(amountUSDC.toFixed(6), 6)

      if (balance < required) {
        toast.dismiss()
        toast.error(`Insufficient USDC balance`)
        setStatus('idle')
        return
      }

      await approveUSDC({
        spender: UNISWAP_ROUTER,
        amount: parseUnits('1000', 6),
        smartWalletClient,
      })

      toast.dismiss()
      toast.success('Approved!')

      setStatus('swapping')
      toast.loading('Swapping onchain...')

      const quote = await getQuoteUSDCtoFOODY(amountUSDC)
      if (quote === 0n) {
        toast.dismiss()
        toast.error('No liquidity')
        setStatus('idle')
        return
      }

      await swapUSDCtoFOODY({
        amountInUSDC: amountUSDC,
        recipient: walletAddress as `0x${string}`, // ✅ 强制断言
        smartWalletClient,
      })

      await insertFoodyOrder({
        wallet_address: walletAddress,
        amount_usdt: amountUSDC,
        foody_amount: Number(formatUnits(quote, 18)),
      })

await refreshBalance.refreshBalance()

      toast.dismiss()
      toast.success('✅ FOODY purchased!')
    } catch (err) {
      console.error('❌ Swap failed:', err)
      toast.dismiss()
      toast.error('❌ Transaction failed')
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className="bg-zinc-900 p-6 rounded-xl shadow-md border border-zinc-800 space-y-4">
      <h2 className="text-base font-semibold">Buy FOODY</h2>

      <div className="flex space-x-2">
        {[10, 20, 100].map((amt) => (
          <button
            key={amt}
            onClick={() => setAmountUSDC(amt)}
            className={`px-4 py-2 rounded-md text-sm font-medium border transition-all ${
              amt === amountUSDC
                ? 'bg-[#333969] text-white'
                : 'bg-black border-zinc-700 text-gray-300 hover:border-white'
            }`}
          >
            {amt} USDC
          </button>
        ))}
      </div>

      <p className="text-sm text-gray-400">
        {quoteFOODY && quoteFOODY !== '~'
          ? `≈ ${Number(quoteFOODY).toLocaleString()} FOODY`
          : 'Quote unavailable'}
        <br />
        <span className="text-xs text-zinc-500">
          via <strong>Uniswap V3 + Smart Wallet</strong>
        </span>
      </p>

      <button
        onClick={handleBuy}
        disabled={status !== 'idle'}
        className={`w-full py-2 rounded-md text-sm font-medium ${
          status !== 'idle'
            ? 'bg-[#2a2f4a] text-gray-400 cursor-not-allowed'
            : 'bg-[#333969] text-white hover:bg-[#2b3162] transition'
        }`}
      >
        {status === 'approving'
          ? 'Authorizing...'
          : status === 'swapping'
          ? 'Swapping...'
          : `Buy ${amountUSDC} USDC = FOODY`}
      </button>
    </div>
  )
}

