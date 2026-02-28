// components/GasFeeComparison.tsx
// 显示Gas费用对比和节省

'use client';

import { useState, useEffect } from 'react';

interface GasFeeComparisonProps {
  isPaymasterEnabled: boolean;
}

export function GasFeeComparison({ isPaymasterEnabled }: GasFeeComparisonProps) {
  const [estimatedGasFee, setEstimatedGasFee] = useState('$1.50');
  const [savings, setSavings] = useState('100%');

  useEffect(() => {
    // 模拟获取当前Gas价格
    const fetchGasPrice = async () => {
      try {
        // 这里可以添加真实的Gas价格获取逻辑
        // 暂时使用模拟数据
        const randomFee = (Math.random() * 3 + 0.5).toFixed(2);
        setEstimatedGasFee(`$${randomFee}`);
        setSavings('100%');
      } catch (error) {
        console.error('Failed to fetch gas price:', error);
      }
    };

    fetchGasPrice();
    const interval = setInterval(fetchGasPrice, 30000); // 每30秒更新一次

    return () => clearInterval(interval);
  }, []);

  if (!isPaymasterEnabled) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="flex items-center space-x-2 text-red-800 dark:text-red-200">
          <span>💸</span>
          <div>
            <div className="font-medium">标准Gas费用</div>
            <div className="text-sm">预计费用: {estimatedGasFee}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 费用对比 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-center">
          <div className="text-red-800 dark:text-red-200">
            <div className="text-xs font-medium mb-1">普通交易</div>
            <div className="text-lg font-bold">{estimatedGasFee}</div>
            <div className="text-xs">Gas费用</div>
          </div>
        </div>

        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
          <div className="text-green-800 dark:text-green-200">
            <div className="text-xs font-medium mb-1">FoodyePay</div>
            <div className="text-lg font-bold">$0.00</div>
            <div className="text-xs">完全免费!</div>
          </div>
        </div>
      </div>

      {/* 节省说明 */}
      <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <div className="flex items-center justify-between text-green-800 dark:text-green-200">
          <div className="flex items-center space-x-2">
            <span>🎉</span>
            <span className="text-sm font-medium">您节省了 {savings}</span>
          </div>
          <div className="text-sm font-bold">{estimatedGasFee}</div>
        </div>
        <div className="text-xs text-green-600 dark:text-green-300 mt-1">
          感谢使用FoodyePay的免费Gas赞助服务！
        </div>
      </div>
    </div>
  );
}
