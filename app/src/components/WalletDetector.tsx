'use client';

import { useAccount } from 'wagmi';
import { useState, useEffect } from 'react';
import { Shield, AlertCircle, CheckCircle, Wallet } from 'lucide-react';

interface WalletInfo {
  isSmartWallet: boolean;
  connectorName: string;
  connectorId: string;
  walletAddress: string;
  chainId: number;
}

export function WalletDetector() {
  const { address, connector, chainId } = useAccount();
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);

  useEffect(() => {
    if (address && connector) {
      const info: WalletInfo = {
        isSmartWallet: isSmartWalletDetected(connector),
        connectorName: connector.name,
        connectorId: connector.id,
        walletAddress: address,
        chainId: chainId || 0
      };
      setWalletInfo(info);
      
      // Check if in test mode
      const testMode = localStorage.getItem('foodyepay_test_mode') === 'true';
      setIsTestMode(testMode);
    }
  }, [address, connector, chainId]);

  const isSmartWalletDetected = (connector: unknown) => {
    if (!connector || typeof connector !== 'object') return false;
    
    const conn = connector as Record<string, unknown>;
    
    // Multiple ways to detect smart wallet
    const smartWalletIndicators = [
      conn.id === 'coinbaseWalletSDK',
      typeof conn.name === 'string' && conn.name.toLowerCase().includes('smart'),
      typeof conn.name === 'string' && conn.name.toLowerCase().includes('coinbase'),
      // Check if it's using account abstraction
      conn.type === 'smartAccount',
      // Check for specific features
      typeof conn.getAccount === 'function'
    ];

    return smartWalletIndicators.some(indicator => indicator);
  };

  const toggleTestMode = () => {
    const newTestMode = !isTestMode;
    setIsTestMode(newTestMode);
    localStorage.setItem('foodyepay_test_mode', newTestMode.toString());
    
    if (newTestMode) {
      // In test mode, treat any wallet as smart wallet
      localStorage.setItem('foodyepay_force_smart_wallet', 'true');
      alert('🧪 Test Mode Enabled: Any connected wallet will be treated as Smart Wallet');
    } else {
      localStorage.removeItem('foodyepay_force_smart_wallet');
      alert('✅ Test Mode Disabled: Using real wallet detection');
    }
    
    // Refresh the page to apply changes
    window.location.reload();
  };

  const getWalletTypeColor = (isSmartWallet: boolean) => {
    return isSmartWallet 
      ? 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300'
      : 'text-orange-600 bg-orange-100 dark:bg-orange-900 dark:text-orange-300';
  };

  const getWalletTypeIcon = (isSmartWallet: boolean) => {
    return isSmartWallet ? <Shield size={16} /> : <Wallet size={16} />;
  };

  if (!walletInfo) {
    return (
      <div className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <AlertCircle size={16} className="text-gray-500" />
          <span className="text-gray-700 dark:text-gray-300 text-sm">No wallet connected</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-4 shadow-sm">
      
      {/* Wallet Info Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-white">Wallet Information</h3>
        
        {/* Test Mode Toggle */}
        <button
          onClick={toggleTestMode}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            isTestMode 
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          {isTestMode ? '🧪 Test Mode ON' : '🔧 Test Mode OFF'}
        </button>
      </div>

      {/* Wallet Details */}
      <div className="space-y-2 text-sm">
        
        {/* Wallet Type */}
        <div className="flex items-center justify-between">
          <span className="text-gray-600 dark:text-gray-400">Type:</span>
          <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getWalletTypeColor(walletInfo.isSmartWallet)}`}>
            {getWalletTypeIcon(walletInfo.isSmartWallet)}
            <span>{walletInfo.isSmartWallet ? 'Smart Wallet' : 'EOA Wallet'}</span>
          </div>
        </div>

        {/* Connector */}
        <div className="flex items-center justify-between">
          <span className="text-gray-600 dark:text-gray-400">Connector:</span>
          <span className="font-mono text-gray-900 dark:text-white">
            {walletInfo.connectorName} ({walletInfo.connectorId})
          </span>
        </div>

        {/* Address */}
        <div className="flex items-center justify-between">
          <span className="text-gray-600 dark:text-gray-400">Address:</span>
          <span className="font-mono text-gray-900 dark:text-white text-xs">
            {walletInfo.walletAddress.slice(0, 6)}...{walletInfo.walletAddress.slice(-4)}
          </span>
        </div>

        {/* Chain */}
        <div className="flex items-center justify-between">
          <span className="text-gray-600 dark:text-gray-400">Chain:</span>
          <span className="text-gray-900 dark:text-white">
            {walletInfo.chainId === 130 ? 'Unichain' : `Chain ${walletInfo.chainId}`}
          </span>
        </div>
      </div>

      {/* Test Mode Notice */}
      {isTestMode && (
        <div className="mt-3 p-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
          <div className="flex items-center space-x-2">
            <CheckCircle size={14} className="text-purple-600 dark:text-purple-400" />
            <span className="text-purple-700 dark:text-purple-300 text-xs">
              Test Mode: This wallet is treated as Smart Wallet for testing purposes
            </span>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {!walletInfo.isSmartWallet && !isTestMode && (
        <div className="mt-3 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle size={14} className="text-orange-600 dark:text-orange-400 mt-0.5" />
            <div className="text-orange-700 dark:text-orange-300 text-xs">
              <p className="font-medium">Recommendation:</p>
              <p>For best experience, use Coinbase Smart Wallet or enable Test Mode for development</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
