'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import Image from 'next/image';

// FOODY Token ABI (只需要 balanceOf 函数)
const FOODY_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// 使用环境变量中的 FOODYE 代币地址，如果没有则使用默认地址
const FOODY_TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_FOODYE_TOKEN_ADDRESS || '0x1022b1b028a2237c440dbac51dc6fc220d88c08f') as `0x${string}`;

interface FoodyBalanceProps {
  className?: string;
}

export function FoodyBalance({ className = '' }: FoodyBalanceProps) {
  const { address } = useAccount();
  const [foodyPrice, setFoodyPrice] = useState<number>(0);
  const [priceChange24h, setPriceChange24h] = useState<number>(0);

  // 获取 FOODY 代币余额
  const { data: balance, isLoading: isBalanceLoading } = useReadContract({
    address: FOODY_TOKEN_ADDRESS,
    abi: FOODY_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 10000, // 10秒刷新一次
    },
  });

  // 获取 FOODY 实时价格和24h变化 (仅使用 GeckoTerminal API)
  useEffect(() => {
    const fetchFoodyPrice = async () => {
      try {
        console.log('🦎 Fetching real-time price and 24h change from GeckoTerminal...');
        
        // 获取过去2天的数据来计算24h变化
        const response = await fetch(
          'https://api.geckoterminal.com/api/v2/networks/base/pools/0xfd25915646ba7677de6079320b1a4975a450891d/ohlcv/day?aggregate=1&limit=2'
        );
        
        if (!response.ok) {
          throw new Error(`GeckoTerminal API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.data && data.data.attributes && data.data.attributes.ohlcv_list.length >= 2) {
          const ohlcvList = data.data.attributes.ohlcv_list;
          
          // 最新价格 (今天的收盘价)
          const latestPrice = parseFloat(ohlcvList[0][4]);
          // 24小时前的价格 (昨天的收盘价)
          const price24hAgo = parseFloat(ohlcvList[1][4]);
          
          // 计算24h价格变化百分比
          const priceChange = ((latestPrice - price24hAgo) / price24hAgo) * 100;
          
          console.log('✅ GeckoTerminal data:', {
            currentPrice: latestPrice,
            price24hAgo: price24hAgo,
            change24h: priceChange.toFixed(2) + '%'
          });
          
          setFoodyPrice(latestPrice);
          setPriceChange24h(priceChange);
        } else if (data.data && data.data.attributes && data.data.attributes.ohlcv_list.length === 1) {
          // 如果只有一天的数据，使用当前价格，变化设为0
          const latestPrice = parseFloat(data.data.attributes.ohlcv_list[0][4]);
          console.log('⚠️ Only 1 day of data available, using current price:', latestPrice);
          
          setFoodyPrice(latestPrice);
          setPriceChange24h(0);
        } else {
          throw new Error('Insufficient data from GeckoTerminal');
        }
      } catch (error) {
        console.error('❌ Failed to fetch GeckoTerminal data:', error);
        // 如果 API 失败，使用最后已知的市场价格作为后备
        setFoodyPrice(0.0001171);
        setPriceChange24h(0);
      }
    };

    fetchFoodyPrice();
    const interval = setInterval(fetchFoodyPrice, 60000); // 每分钟更新价格
    
    return () => clearInterval(interval);
  }, []);

  if (!address) {
    return (
      <div className={`bg-gray-100 dark:bg-gray-800 rounded-lg p-4 ${className}`}>
        <p className="text-gray-500 dark:text-gray-400 text-center">
          请先连接钱包
        </p>
      </div>
    );
  }

  if (isBalanceLoading) {
    return (
      <div className={`bg-gray-100 dark:bg-gray-800 rounded-lg p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2 mb-2"></div>
          <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  // 格式化余额
  const foodyBalance = balance ? parseFloat(formatUnits(balance, 18)) : 0;
  const usdValue = foodyBalance * foodyPrice;

  return (
    <div className={`bg-gradient-to-r from-[#222c4e] to-[#555b8f] rounded-lg p-4 text-white ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center p-1">
            <Image 
              src="/FoodyBot.png" 
              alt="FOODY Token" 
              width={32}
              height={32}
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <div>
            <h3 className="font-semibold">FOODY Balance</h3>
            <p className="text-xs text-purple-100">Foodye Coin</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-purple-100">24h Change</p>
          <p className={`text-sm font-semibold ${
            priceChange24h >= 0 ? 'text-green-300' : 'text-red-300'
          }`}>
            {priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(2)}%
          </p>
        </div>
      </div>
      
      <div className="space-y-1">
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold">
            {foodyBalance.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </span>
          <span className="text-purple-200 font-medium">FOODY</span>
        </div>
        
        <div className="flex items-baseline space-x-2">
          <span className="text-lg font-semibold text-purple-100">
            ${usdValue.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </span>
          <span className="text-xs text-purple-200">USD</span>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-purple-400">
        <div className="flex justify-between text-xs text-purple-200">
          <span>Real-time Price</span>
          <span>${foodyPrice.toFixed(7)}</span>
        </div>
        <div className="flex justify-between text-xs text-purple-200 mt-1">
          <span>Data Source</span>
          <span>GeckoTerminal API</span>
        </div>
      </div>
    </div>
  );
}
