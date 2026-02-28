'use client';

import { useAccount } from 'wagmi';
import { useState, useEffect } from 'react';
import { Shield, Search, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface WalletAnalysis {
  address: string;
  isContract: boolean;
  hasCode: boolean;
  connectorType: string;
  isSmartWallet: boolean;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
}

export function WalletAnalyzer() {
  const { address, connector } = useAccount();
  const [analysis, setAnalysis] = useState<WalletAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeWallet = async () => {
    if (!address || !connector) return;

    setIsAnalyzing(true);
    
    try {
      const reasons: string[] = [];
      let isSmartWallet = false;
      let confidence: 'high' | 'medium' | 'low' = 'low';
      let hasCode = false;
      let isContract = false;

      // 1. 检查连接器类型
      if (connector.id === 'coinbaseWalletSDK') {
        reasons.push('✅ 使用 Coinbase Wallet SDK');
        isSmartWallet = true;
        confidence = 'high';
      }

      if (connector.name?.toLowerCase().includes('smart')) {
        reasons.push('✅ 连接器名称包含 "Smart"');
        isSmartWallet = true;
        confidence = 'high';
      }

      // 2. 检查是否为合约地址 (通过 RPC 调用)
      try {
        const response = await fetch(`https://mainnet.base.org`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getCode',
            params: [address, 'latest'],
            id: 1,
          }),
        });

        const data = await response.json();
        const code = data.result;
        
        if (code && code !== '0x' && code.length > 2) {
          hasCode = true;
          isContract = true;
          reasons.push('✅ 地址包含智能合约代码');
          isSmartWallet = true;
          confidence = 'high';
        } else {
          reasons.push('❌ 地址不包含合约代码 (EOA)');
        }
      } catch (error) {
        console.error('Failed to check contract code:', error);
        reasons.push('⚠️ 无法检查合约代码');
      }

      // 3. 检查 Uniscan API (如果可用)
      try {
        // Note: This would require a real API key
        // const baseScanResponse = await fetch(
        //   `https://api.uniscan.xyz/api?module=account&action=balance&address=${address}&tag=latest&apikey=YourApiKeyToken`
        // );
        reasons.push('📊 Uniscan API 检查暂不可用');
      } catch (error) {
        console.error('Uniscan API error:', error);
        reasons.push('⚠️ Uniscan API 不可用');
      }

      // 4. 检查是否为已知的智能钱包工厂合约创建
      // const knownSmartWalletPatterns = [
      //   '0x4e1dcf7ad4e460cfd30791ccc4f9c8a4f820ec67', // Coinbase Smart Wallet Factory
      //   '0x0ba5ed0c6aa8c49038f819e587e2633c4a9f428a', // Another common factory
      // ];

      // 这里可以添加更多检查逻辑

      setAnalysis({
        address,
        isContract,
        hasCode,
        connectorType: `${connector.name} (${connector.id})`,
        isSmartWallet,
        confidence,
        reasons,
      });

    } catch (error) {
      console.error('Wallet analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (address && connector) {
      analyzeWallet();
    }
    // analyzeWallet 被包装在 useCallback 中，依赖于 address 和 connector
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, connector]);

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getConfidenceIcon = (confidence: string) => {
    switch (confidence) {
      case 'high': return <CheckCircle size={16} />;
      case 'medium': return <AlertTriangle size={16} />;
      case 'low': return <XCircle size={16} />;
      default: return <Search size={16} />;
    }
  };

  if (!address) {
    return (
      <div className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <Search size={16} className="text-gray-500" />
          <span className="text-gray-700 dark:text-gray-300 text-sm">Connect wallet to analyze</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-4 shadow-sm">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
          <Shield size={18} />
          <span>钱包深度分析</span>
        </h3>
        
        <button
          onClick={analyzeWallet}
          disabled={isAnalyzing}
          className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isAnalyzing ? '分析中...' : '重新分析'}
        </button>
      </div>

      {isAnalyzing ? (
        <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
          <Search size={16} className="animate-spin" />
          <span className="text-sm">正在分析钱包...</span>
        </div>
      ) : analysis ? (
        <div className="space-y-3">
          
          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">地址类型:</span>
              <div className="font-medium">
                {analysis.isContract ? '🔷 智能合约' : '👤 外部账户 (EOA)'}
              </div>
            </div>
            
            <div>
              <span className="text-gray-600 dark:text-gray-400">连接器:</span>
              <div className="font-medium text-xs">{analysis.connectorType}</div>
            </div>
          </div>

          {/* 智能钱包判断 */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">智能钱包判断:</span>
              <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
                analysis.isSmartWallet 
                  ? 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300'
                  : 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300'
              }`}>
                {analysis.isSmartWallet ? <CheckCircle size={14} /> : <XCircle size={14} />}
                <span>{analysis.isSmartWallet ? '是智能钱包' : '不是智能钱包'}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 mt-2">
              <span className="text-gray-600 dark:text-gray-400 text-sm">可信度:</span>
              <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(analysis.confidence)}`}>
                {getConfidenceIcon(analysis.confidence)}
                <span>{analysis.confidence.toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* 分析原因 */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">分析结果:</h4>
            <div className="space-y-1">
              {analysis.reasons.map((reason, index) => (
                <div key={index} className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded">
                  {reason}
                </div>
              ))}
            </div>
          </div>

          {/* Uniscan 链接 */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
            <a
              href={`https://uniscan.xyz/address/${analysis.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm"
            >
              <span>🔍 在 Uniscan 上查看</span>
            </a>
          </div>

        </div>
      ) : (
        <div className="text-gray-500 dark:text-gray-400 text-sm">
          无法获取分析结果
        </div>
      )}

    </div>
  );
}
