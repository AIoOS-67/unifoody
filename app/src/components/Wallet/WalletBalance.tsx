'use client';

import { EthBalance } from '@coinbase/onchainkit/identity';
import { useAccount, useBalance } from 'wagmi';

interface WalletBalanceProps {
  address?: string;
  className?: string;
}

// Custom USDC Balance component
function USDCBalance({ address }: { address: `0x${string}` }) {
  const usdcTokenAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  
  const { data: balance, isLoading } = useBalance({
    address,
    token: usdcTokenAddress,
  });

  if (isLoading) {
    return <div className="text-lg font-bold text-green-400">Loading...</div>;
  }

  if (!balance) {
    return <div className="text-lg font-bold text-green-400">0 USDC</div>;
  }

  return (
    <div className="text-lg font-bold text-green-400">
      {parseFloat(balance.formatted).toFixed(2)} USDC
    </div>
  );
}

export default function WalletBalance({ address: propAddress, className = '' }: WalletBalanceProps) {
  const { address: connectedAddress } = useAccount();
  
  // Use prop address or connected address
  const walletAddress = propAddress || connectedAddress;

  if (!walletAddress) {
    return (
      <div className={`text-center ${className}`}>
        <p className="text-gray-400">Connect wallet to see balance</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white mb-2">Wallet Balance</h3>
        <p className="text-sm text-gray-400 font-mono">
          {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
        </p>
      </div>

      {/* Balances Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* ETH Balance */}
        <div className="bg-zinc-800 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">Ξ</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-1">Ethereum</p>
          <EthBalance 
            address={walletAddress as `0x${string}`}
            className="text-lg font-bold text-blue-400"
          />
        </div>

        {/* USDC Balance */}
        <div className="bg-zinc-800 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xs">$</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-1">USD Coin</p>
          <USDCBalance address={walletAddress as `0x${string}`} />
        </div>

      </div>

      {/* Additional Info */}
      <div className="text-center">
        <p className="text-xs text-gray-500">
          🔐 Secured by Coinbase Smart Wallet
        </p>
      </div>
    </div>
  );
}

