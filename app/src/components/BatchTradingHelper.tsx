// components/BatchTradingHelper.tsx
// 分批交易助手，帮助用户优化大额交易

'use client';

import { useState } from 'react';

interface BatchTradingHelperProps {
  totalAmount: number;
  recommendedBatchSize: number;
  estimatedSavings: number;
}

export function BatchTradingHelper({ 
  totalAmount, 
  recommendedBatchSize, 
  estimatedSavings 
}: BatchTradingHelperProps) {
  const [batchSize, setBatchSize] = useState(recommendedBatchSize);
  const [interval, setInterval] = useState(5); // 分钟

  const numberOfBatches = Math.ceil(totalAmount / batchSize);
  const totalTime = (numberOfBatches - 1) * interval;

  return (
    <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <div className="flex items-center space-x-2 text-blue-800 dark:text-blue-200">
        <span>🎯</span>
        <span className="font-medium">智能分批交易</span>
      </div>

      {/* 配置选项 */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1 text-blue-800 dark:text-blue-200">
            每批交易金额: ${batchSize}
          </label>
          <input
            type="range"
            min="10"
            max="50"
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-blue-600 dark:text-blue-300">
            <span>$10</span>
            <span>$50</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-blue-800 dark:text-blue-200">
            交易间隔: {interval} 分钟
          </label>
          <input
            type="range"
            min="1"
            max="15"
            value={interval}
            onChange={(e) => setInterval(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-blue-600 dark:text-blue-300">
            <span>1分钟</span>
            <span>15分钟</span>
          </div>
        </div>
      </div>

      {/* 交易计划 */}
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
          <div className="font-medium">📋 交易计划:</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>总金额: ${totalAmount}</div>
            <div>分批数量: {numberOfBatches}笔</div>
            <div>每笔金额: ${batchSize}</div>
            <div>总耗时: {totalTime}分钟</div>
          </div>
        </div>
      </div>

      {/* 预期收益 */}
      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
        <div className="text-green-800 dark:text-green-200 text-sm">
          <div className="font-medium mb-1">💰 预期收益:</div>
          <div className="text-xs space-y-1">
            <div>• 减少价格冲击: ~{estimatedSavings.toFixed(1)}%</div>
            <div>• 预计节省: ${(totalAmount * estimatedSavings / 100).toFixed(2)}</div>
            <div>• 更好的平均价格</div>
          </div>
        </div>
      </div>

      {/* 执行步骤 */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
          🎬 执行步骤:
        </div>
        {Array.from({ length: numberOfBatches }, (_, i) => (
          <div 
            key={i} 
            className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded text-xs"
          >
            <span>第{i + 1}笔: ${batchSize}</span>
            <span className="text-gray-500">
              {i === 0 ? '立即' : `${i * interval}分钟后`}
            </span>
          </div>
        ))}
      </div>

      {/* 开始按钮 */}
      <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors">
        🚀 开始分批交易
      </button>

      <div className="text-xs text-blue-600 dark:text-blue-300 text-center">
        💡 提示: 您可以手动执行每笔交易，或设置自动执行
      </div>
    </div>
  );
}
