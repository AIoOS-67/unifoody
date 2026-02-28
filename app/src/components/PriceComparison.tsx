// components/PriceComparison.tsx
// 实时价格对比组件

'use client';

import { useState, useEffect } from 'react';

interface PriceData {
  source: string;
  price: number;
  timestamp: string;
  status: 'loading' | 'success' | 'error';
}

export function PriceComparison() {
  const [prices, setPrices] = useState<PriceData[]>([
    { source: 'GeckoTerminal', price: 0, timestamp: '', status: 'loading' },
    { source: 'Our App (Fixed)', price: 0.0001030, timestamp: new Date().toISOString(), status: 'success' },
    { source: 'Market Average', price: 0.0001171, timestamp: new Date().toISOString(), status: 'success' },
  ]);

  const [usdcBalance] = useState(1329113.74); // 您的 FOODYE 余额

  useEffect(() => {
    const fetchGeckoPrice = async () => {
      try {
        const response = await fetch(
          'https://api.geckoterminal.com/api/v2/networks/base/pools/0xfd25915646ba7677de6079320b1a4975a450891d/ohlcv/day?aggregate=1&limit=1',
          { method: 'GET', mode: 'cors' }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.data?.attributes?.ohlcv_list?.length > 0) {
            const latestPrice = parseFloat(data.data.attributes.ohlcv_list[0][4]);
            
            setPrices(prev => prev.map(p => 
              p.source === 'GeckoTerminal' 
                ? { ...p, price: latestPrice, timestamp: new Date().toISOString(), status: 'success' }
                : p
            ));
          }
        } else {
          throw new Error('API response not ok');
        }
      } catch (error) {
        console.error('Failed to fetch GeckoTerminal price:', error);
        setPrices(prev => prev.map(p => 
          p.source === 'GeckoTerminal' 
            ? { ...p, price: 0.0001171, timestamp: new Date().toISOString(), status: 'error' }
            : p
        ));
      }
    };

    fetchGeckoPrice();
    const interval = setInterval(fetchGeckoPrice, 30000); // 每30秒更新

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold mb-4 text-center">💱 FOODY 价格对比</h3>
      
      <div className="space-y-3">
        {prices.map((priceData, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${ 
                priceData.status === 'loading' ? 'bg-yellow-500 animate-pulse' :
                priceData.status === 'success' ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <div>
                <div className="font-medium">{priceData.source}</div>
                <div className="text-xs text-gray-500">
                  {new Date(priceData.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="font-mono text-sm">
                ${priceData.price.toFixed(7)}
              </div>
              <div className="text-xs text-gray-500">
                =${(usdcBalance * priceData.price).toFixed(2)} USD
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="text-blue-800 dark:text-blue-200 text-sm">
          <div className="font-medium mb-1">💡 价格差异说明</div>
          <div className="text-xs space-y-1">
            <div>• <strong>GeckoTerminal</strong>: 来自 Uniswap V3 的实时交易价格</div>
            <div>• <strong>Our App</strong>: 基于历史 Swap 数据的固定价格</div>
            <div>• <strong>Market Average</strong>: 当前市场参考价格</div>
            <div className="mt-2 font-medium">
              价格差异导致 USD 价值差异: ${((prices[2].price - prices[1].price) * usdcBalance).toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
