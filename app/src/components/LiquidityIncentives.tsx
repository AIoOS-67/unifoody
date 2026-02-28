// components/LiquidityIncentives.tsx
// 流动性挖矿和激励计划

'use client';

import { useState } from 'react';

export function LiquidityIncentives() {
  const [selectedPool, setSelectedPool] = useState('USDC/FOODY');
  const [liquidityAmount, setLiquidityAmount] = useState(1000);

  const pools = [
    {
      name: 'USDC/FOODY',
      tvl: '$52,000',
      apr: '45%',
      rewards: 'FOODY + Trading Fees',
      priceImpact: '7.2%',
      dailyVolume: '$8,500'
    },
    {
      name: 'ETH/FOODY',
      tvl: '$28,000',
      apr: '62%',
      rewards: 'FOODY + Trading Fees',
      priceImpact: '12.8%',
      dailyVolume: '$3,200'
    }
  ];

  const calculateRewards = (amount: number, apr: number) => {
    const dailyReward = (amount * apr / 100) / 365;
    const monthlyReward = dailyReward * 30;
    return { daily: dailyReward, monthly: monthlyReward };
  };

  const rewards = calculateRewards(liquidityAmount, 45);

  return (
    <div className="space-y-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg border border-green-200 dark:border-green-800">
      <div className="text-center">
        <h3 className="text-lg font-bold text-green-800 dark:text-green-200 mb-2">
          💰 流动性挖矿计划
        </h3>
        <p className="text-sm text-green-600 dark:text-green-300">
          提供流动性获得高额奖励，同时改善所有用户的交易体验
        </p>
      </div>

      {/* 流动性池选择 */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">选择流动性池</label>
        <div className="grid grid-cols-1 gap-2">
          {pools.map((pool) => (
            <div
              key={pool.name}
              onClick={() => setSelectedPool(pool.name)}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedPool === pool.name
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-green-300'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">{pool.name}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    TVL: {pool.tvl} • Volume: {pool.dailyVolume}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600">{pool.apr}</div>
                  <div className="text-xs text-gray-500">APR</div>
                </div>
              </div>
              <div className="mt-2 text-xs">
                <div className="text-gray-600 dark:text-gray-400">奖励: {pool.rewards}</div>
                <div className="text-red-600 dark:text-red-400">价格冲击: {pool.priceImpact}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 投资金额 */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">流动性投资金额 (USD)</label>
        <input
          type="range"
          min="100"
          max="100000"
          step="100"
          value={liquidityAmount}
          onChange={(e) => setLiquidityAmount(Number(e.target.value))}
          className="w-full"
        />
        <div className="text-center text-lg font-bold">${liquidityAmount.toLocaleString()}</div>
      </div>

      {/* 收益预测 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg text-center">
          <div className="text-green-800 dark:text-green-200">
            <div className="text-xs mb-1">日收益</div>
            <div className="text-lg font-bold">${rewards.daily.toFixed(2)}</div>
            <div className="text-xs">约 {(rewards.daily / liquidityAmount * 100).toFixed(3)}%</div>
          </div>
        </div>

        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-center">
          <div className="text-blue-800 dark:text-blue-200">
            <div className="text-xs mb-1">月收益</div>
            <div className="text-lg font-bold">${rewards.monthly.toFixed(2)}</div>
            <div className="text-xs">约 {(rewards.monthly / liquidityAmount * 100).toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* 流动性影响 */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="text-blue-800 dark:text-blue-200 text-sm">
          <div className="font-medium mb-2">🌊 您的贡献影响:</div>
          <div className="text-xs space-y-1">
            <div>• 当前池TVL: $52,000 → ${(52000 + liquidityAmount).toLocaleString()}</div>
            <div>• 价格冲击改善: 7.2% → {(7.2 * 52000 / (52000 + liquidityAmount)).toFixed(1)}%</div>
            <div>• 用户交易体验: 显著提升</div>
            <div>• 平台交易量: 预计增长 {Math.min(liquidityAmount / 1000, 50).toFixed(0)}%</div>
          </div>
        </div>
      </div>

      {/* 开始挖矿按钮 */}
      <div className="space-y-2">
        <button className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium transition-colors">
          💰 开始流动性挖矿
        </button>
        
        <div className="text-xs text-center text-gray-600 dark:text-gray-400">
          无锁定期 • 随时可撤回 • 实时收益结算
        </div>
      </div>

      {/* 风险提示 */}
      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div className="text-yellow-800 dark:text-yellow-200 text-xs">
          <div className="font-medium mb-1">⚠️ 风险提示:</div>
          <div className="space-y-1">
            <div>• 无常损失风险（价格波动可能影响收益）</div>
            <div>• 智能合约风险（代码审计已通过）</div>
            <div>• 收益率会根据市场条件动态调整</div>
          </div>
        </div>
      </div>
    </div>
  );
}
