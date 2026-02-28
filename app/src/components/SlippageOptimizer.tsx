// components/SlippageOptimizer.tsx
// 极简价格冲击显示组件

'use client';

import { useState, useEffect } from 'react';

interface SlippageOptimizerProps {
  inputAmount: number;
  expectedOutput: number;
  actualOutput: number;
}

export function SlippageOptimizer({ inputAmount, expectedOutput, actualOutput }: SlippageOptimizerProps) {
  const [priceImpact, setPriceImpact] = useState(0);

  useEffect(() => {
    if (inputAmount > 0 && actualOutput > 0) {
      const impactPercent = ((inputAmount - actualOutput) / inputAmount) * 100;
      setPriceImpact(impactPercent);
    }
  }, [inputAmount, expectedOutput, actualOutput]);

  if (priceImpact < 1) {
    return null;
  }

  return (
    <div className={`p-3 rounded-lg border ${
      priceImpact > 10 
        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        : priceImpact > 5
        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
    }`}>
      <div className={`text-sm ${
        priceImpact > 10 
          ? 'text-red-800 dark:text-red-200'
          : priceImpact > 5
          ? 'text-yellow-800 dark:text-yellow-200'
          : 'text-gray-800 dark:text-gray-200'
      }`}>
        <div className="flex items-center justify-between">
          <span>价格冲击</span>
          <span className="font-bold">{priceImpact.toFixed(2)}%</span>
        </div>
      </div>
    </div>
  );
}
