// components/LiquidityManager.tsx
// 流动性池管理和价格冲击模拟

'use client';

import { useState, useEffect } from 'react';

interface LiquidityManagerProps {
  currentLiquidity?: number;
  targetLiquidity?: number;
}

export function LiquidityManager({ 
  currentLiquidity = 50000,  // 假设当前流动性$50k
  targetLiquidity = 1000000  // 目标流动性$1M
}: LiquidityManagerProps) {
  const [tradeAmount, setTradeAmount] = useState(100);
  const [currentImpact, setCurrentImpact] = useState(0);
  const [improvedImpact, setImprovedImpact] = useState(0);

  // 计算价格冲击（简化的AMM公式）
  const calculatePriceImpact = (amount: number, liquidity: number) => {
    // 简化公式：价格冲击 ≈ (交易量 / 流动性) * 50
    // 实际AMM更复杂，但这个能给出大概的感觉
    return Math.min((amount / liquidity) * 50, 50); // 最大50%
  };

  useEffect(() => {
    const current = calculatePriceImpact(tradeAmount, currentLiquidity);
    const improved = calculatePriceImpact(tradeAmount, targetLiquidity);
    
    setCurrentImpact(current);
    setImprovedImpact(improved);
  }, [tradeAmount, currentLiquidity, targetLiquidity]);

  const savings = tradeAmount * (currentImpact - improvedImpact) / 100;

  return (
    <div className="space-y-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <div className="text-center">
        <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-2">
          🏊‍♂️ 流动性池优化方案
        </h3>
        <p className="text-sm text-blue-600 dark:text-blue-300">
          通过增加流动性大幅减少用户的交易损失
        </p>
      </div>

      {/* 流动性对比 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-center">
          <div className="text-red-800 dark:text-red-200">
            <div className="text-xs font-medium mb-1">当前流动性</div>
            <div className="text-lg font-bold">${(currentLiquidity / 1000).toFixed(0)}K</div>
            <div className="text-xs">USDC/FOODY池</div>
          </div>
        </div>

        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
          <div className="text-green-800 dark:text-green-200">
            <div className="text-xs font-medium mb-1">目标流动性</div>
            <div className="text-lg font-bold">${(targetLiquidity / 1000).toFixed(0)}K</div>
            <div className="text-xs">增加 ${((targetLiquidity - currentLiquidity) / 1000).toFixed(0)}K</div>
          </div>
        </div>
      </div>

      {/* 交易模拟 */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">模拟交易金额 (USDC)</label>
          <input
            type="range"
            min="10"
            max="10000"
            step="10"
            value={tradeAmount}
            onChange={(e) => setTradeAmount(Number(e.target.value))}
            className="w-full"
          />
          <div className="text-center text-sm font-medium">${tradeAmount}</div>
        </div>

        {/* 价格冲击对比 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg text-center">
            <div className="text-red-800 dark:text-red-200">
              <div className="text-xs mb-1">当前价格冲击</div>
              <div className="text-xl font-bold">{currentImpact.toFixed(2)}%</div>
              <div className="text-xs">损失: ${(tradeAmount * currentImpact / 100).toFixed(2)}</div>
            </div>
          </div>

          <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg text-center">
            <div className="text-green-800 dark:text-green-200">
              <div className="text-xs mb-1">优化后冲击</div>
              <div className="text-xl font-bold">{improvedImpact.toFixed(2)}%</div>
              <div className="text-xs">损失: ${(tradeAmount * improvedImpact / 100).toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* 节省金额 */}
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
          <div className="text-green-800 dark:text-green-200">
            <div className="text-sm font-medium mb-1">🎉 用户每笔交易节省</div>
            <div className="text-2xl font-bold">${savings.toFixed(2)}</div>
            <div className="text-xs">减少 {((currentImpact - improvedImpact) / currentImpact * 100).toFixed(0)}% 的损失</div>
          </div>
        </div>
      </div>

      {/* 实施计划 */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="text-blue-800 dark:text-blue-200 text-sm">
          <div className="font-medium mb-2">💼 实施方案:</div>
          <ul className="text-xs space-y-1">
            <li>• 🏦 与机构投资者合作提供流动性</li>
            <li>• 🎁 设置流动性挖矿奖励机制</li>
            <li>• 🤝 与其他DEX建立流动性共享</li>
            <li>• 💰 使用FoodyePay收入增加流动性</li>
            <li>• 📊 监控和动态调整流动性分配</li>
          </ul>
        </div>
      </div>

      {/* ROI计算 */}
      <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
        <div className="text-purple-800 dark:text-purple-200 text-sm">
          <div className="font-medium mb-2">📈 投资回报:</div>
          <div className="text-xs space-y-1">
            <div>• 投资: ${((targetLiquidity - currentLiquidity) / 1000).toFixed(0)}K 流动性</div>
            <div>• 用户体验: 大幅提升，减少 90%+ 价格冲击</div>
            <div>• 交易量: 预计增长 3-5倍</div>
            <div>• 手续费收入: 流动性提供者分成</div>
          </div>
        </div>
      </div>
    </div>
  );
}
