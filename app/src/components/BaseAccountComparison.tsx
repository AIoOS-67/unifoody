// components/BaseAccountComparison.tsx
// 对比我们的数据与 Base Account 风格的数据显示

'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { getFoodyeTokenData } from '@/lib/baseAccountDataFetcher';

interface TokenData {
  symbol: string;
  name: string;
  balance: string;
  balanceFormatted: string;
  displayBalance: string;
  usdValue: number;
  displayUsdValue: string;
  price: number;
}

export function BaseAccountComparison() {
  const { address } = useAccount();
  const [foodyeData, setFoodyeData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('🔄 Fetching Base Account style data for:', address);
        
        // 获取 FOODYE 数据
        const data = await getFoodyeTokenData(address);
        setFoodyeData(data);
        
        console.log('✅ Base Account style data:', data);
      } catch (err) {
        console.error('❌ Failed to fetch data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [address]);

  if (!address) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-gray-500 dark:text-gray-400 text-center">
          请先连接钱包查看 Base Account 风格的数据
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
          <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-800 dark:text-red-200 text-sm">
          ❌ 获取数据失败: {error}
        </p>
      </div>
    );
  }

  if (!foodyeData) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-gray-500 dark:text-gray-400 text-center">
          未找到 FOODYE 代币数据
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 标题 */}
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">🔍 Base Account 风格数据对比</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          直接从区块链获取的原始数据
        </p>
      </div>

      {/* Base Account 风格的余额显示 */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-4 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-bold text-sm">F</span>
            </div>
            <div>
              <h4 className="font-semibold">{foodyeData.name}</h4>
              <p className="text-xs text-blue-100">{foodyeData.symbol}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-blue-100">Token Price</p>
            <p className="text-sm font-semibold">
              ${foodyeData.price.toFixed(7)}
            </p>
          </div>
        </div>
        
        <div className="space-y-1">
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold">
              {foodyeData.displayBalance}
            </span>
            <span className="text-blue-200 font-medium">{foodyeData.symbol}</span>
          </div>
          
          <div className="flex items-baseline space-x-2">
            <span className="text-lg font-semibold text-blue-100">
              {foodyeData.displayUsdValue}
            </span>
            <span className="text-xs text-blue-200">USD</span>
          </div>
        </div>
      </div>

      {/* 详细数据对比 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h4 className="font-semibold mb-3">📊 详细数据</h4>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">原始余额:</span>
            <span className="font-mono">{foodyeData.balance}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">格式化余额:</span>
            <span className="font-mono">{foodyeData.balanceFormatted}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">显示余额:</span>
            <span className="font-mono">{foodyeData.displayBalance}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">USD 价值:</span>
            <span className="font-mono">{foodyeData.displayUsdValue}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">单价:</span>
            <span className="font-mono">${foodyeData.price.toFixed(7)}</span>
          </div>
        </div>
      </div>

      {/* 数据来源说明 */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <div className="text-blue-800 dark:text-blue-200 text-sm">
          <div className="font-medium mb-1">💡 数据来源</div>
          <div className="text-xs space-y-1">
            <div>• 区块链数据: 直接从 Base 链读取</div>
            <div>• 价格计算: 基于实际 Swap 汇率 ($0.0001030)</div>
            <div>• 格式化: 模拟 Base Account 显示风格</div>
          </div>
        </div>
      </div>
    </div>
  );
}
