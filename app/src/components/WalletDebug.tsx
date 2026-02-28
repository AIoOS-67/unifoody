'use client';

import { useAccount } from 'wagmi';
import { useEffect } from 'react';

export function WalletDebug() {
  const { address, connector, isConnected, chainId } = useAccount();

  useEffect(() => {
    if (isConnected && connector) {
      console.log('🔍 WALLET DEBUG INFO:');
      console.log('📍 Address:', address);
      console.log('🔗 Connector ID:', connector.id);
      console.log('📝 Connector Name:', connector.name);
      console.log('⛓️ Chain ID:', chainId);
      console.log('🔧 Connector Type:', typeof connector);
      console.log('📊 Full Connector:', connector);
      
      // 检查是否为智能钱包的指标
      const isSmartWallet = connector.id === 'coinbaseWalletSDK' && 
                           connector.name?.toLowerCase().includes('coinbase');
      
      console.log('🤖 Is Smart Wallet:', isSmartWallet);
      
      // 检查浏览器中是否有相关信息
      if (typeof window !== 'undefined') {
        console.log('🌐 Window Ethereum:', window.ethereum);
        console.log('🏪 LocalStorage Keys:', Object.keys(localStorage));
      }
    }
  }, [isConnected, connector, address, chainId]);

  if (!isConnected) {
    return (
      <div className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-4 text-sm">
        <p className="text-gray-600 dark:text-gray-400">🔌 No wallet connected</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-4 text-sm">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">🔍 Wallet Debug Info</h3>
      
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Address:</span>
          <span className="font-mono text-xs">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Connector ID:</span>
          <span className="font-mono text-xs">{connector?.id}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Connector Name:</span>
          <span className="font-mono text-xs">{connector?.name}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Chain ID:</span>
          <span className="font-mono text-xs">{chainId}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Smart Wallet:</span>
          <span className={`font-medium text-xs ${
            connector?.id === 'coinbaseWalletSDK' && connector?.name?.toLowerCase().includes('coinbase')
              ? 'text-green-600'
              : 'text-red-600'
          }`}>
            {connector?.id === 'coinbaseWalletSDK' && connector?.name?.toLowerCase().includes('coinbase') 
              ? '✅ YES' 
              : '❌ NO'
            }
          </span>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Check browser console for detailed logs
        </p>
      </div>
    </div>
  );
}
