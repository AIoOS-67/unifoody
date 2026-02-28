// components/FoodyeRateDisplaySimple.tsx
// Simplified display for Foodye Coin exchange rates

'use client';

interface FoodyeRateDisplayProps {
  estimatedGasCostEth?: number;
  showDetailed?: boolean;
}

export function FoodyeRateDisplaySimple({ 
  estimatedGasCostEth = 0.001, 
  showDetailed = true 
}: FoodyeRateDisplayProps) {
  // Exchange rates
  const FOODYE_TO_USDC = 0.0001; // 1 FOODYE = 0.0001 USDC
  const ETH_TO_USDC = 2500; // 1 ETH ≈ 2500 USDC
  const ETH_TO_FOODYE = 25000000; // 1 ETH = 25M FOODYE

  // Calculate gas costs
  const gasCostInFoodye = Math.ceil(estimatedGasCostEth * ETH_TO_FOODYE);
  // const gasCostInUsdc = gasCostInFoodye * FOODYE_TO_USDC; // Removed unused variable

  // Registration rewards
  const rewards = {
    basicSignup: 1000,
    emailVerification: 2500,
    firstTransaction: 5000,
    referralBonus: 10000,
  };

  // Typical gas costs
  const typicalCosts = {
    walletCreation: 10000,
    tokenTransfer: 2500,
    swapTransaction: 7500,
    nftMint: 5000,
  };

  const formatUsdcValue = (foodyeAmount: number) => {
    return `$${(foodyeAmount * FOODYE_TO_USDC).toFixed(4)}`;
  };

  return (
    <div className="space-y-4">
      {/* Current Exchange Rates */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-3">
          💰 Foodye Coin 汇率表
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
            <div className="font-bold text-green-600">1 FOODYE</div>
            <div className="text-gray-600 dark:text-gray-400">= $0.0001 USDC</div>
          </div>
          
          <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
            <div className="font-bold text-blue-600">1 ETH</div>
            <div className="text-gray-600 dark:text-gray-400">≈ {ETH_TO_FOODYE.toLocaleString()} FOODYE</div>
          </div>
          
          <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
            <div className="font-bold text-purple-600">1 ETH</div>
            <div className="text-gray-600 dark:text-gray-400">≈ ${ETH_TO_USDC} USDC</div>
          </div>
        </div>
      </div>

      {/* Gas Cost Calculator */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">⛽ Gas 费用计算器</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">预估 Gas 费用 (ETH):</span>
            <span className="font-medium">{estimatedGasCostEth} ETH</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">需要支付 (FOODYE):</span>
            <span className="font-bold text-green-600">{gasCostInFoodye.toLocaleString()} FOODYE</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">等值 (USDC):</span>
            <span className="font-medium text-blue-600">{formatUsdcValue(gasCostInFoodye)}</span>
          </div>
        </div>
      </div>

      {/* Registration Rewards Display */}
      {showDetailed && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-3">
            🎁 注册奖励系统
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>基础注册:</span>
                <span className="font-medium">
                  {rewards.basicSignup.toLocaleString()} FOODYE
                  <span className="text-xs text-gray-500 ml-1">
                    ({formatUsdcValue(rewards.basicSignup)})
                  </span>
                </span>
              </div>
              
              <div className="flex justify-between">
                <span>邮箱验证:</span>
                <span className="font-medium">
                  {rewards.emailVerification.toLocaleString()} FOODYE
                  <span className="text-xs text-gray-500 ml-1">
                    ({formatUsdcValue(rewards.emailVerification)})
                  </span>
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>首次交易:</span>
                <span className="font-medium">
                  {rewards.firstTransaction.toLocaleString()} FOODYE
                  <span className="text-xs text-gray-500 ml-1">
                    ({formatUsdcValue(rewards.firstTransaction)})
                  </span>
                </span>
              </div>
              
              <div className="flex justify-between">
                <span>推荐奖励:</span>
                <span className="font-medium">
                  {rewards.referralBonus.toLocaleString()} FOODYE
                  <span className="text-xs text-gray-500 ml-1">
                    ({formatUsdcValue(rewards.referralBonus)})
                  </span>
                </span>
              </div>
            </div>
          </div>
          
          <div className="mt-3 p-2 bg-white dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400">
            💡 总计可获得: {(
              rewards.basicSignup +
              rewards.emailVerification +
              rewards.firstTransaction +
              rewards.referralBonus
            ).toLocaleString()} FOODYE (约 $1.85 价值)
          </div>
        </div>
      )}

      {/* Typical Gas Costs */}
      {showDetailed && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-3">
            📊 常见操作 Gas 费用
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between">
              <span>钱包创建:</span>
              <span className="font-medium">
                {typicalCosts.walletCreation.toLocaleString()} FOODYE
                <span className="text-xs text-gray-500 ml-1">
                  ({formatUsdcValue(typicalCosts.walletCreation)})
                </span>
              </span>
            </div>
            
            <div className="flex justify-between">
              <span>代币转账:</span>
              <span className="font-medium">
                {typicalCosts.tokenTransfer.toLocaleString()} FOODYE
                <span className="text-xs text-gray-500 ml-1">
                  ({formatUsdcValue(typicalCosts.tokenTransfer)})
                </span>
              </span>
            </div>
            
            <div className="flex justify-between">
              <span>交换交易:</span>
              <span className="font-medium">
                {typicalCosts.swapTransaction.toLocaleString()} FOODYE
                <span className="text-xs text-gray-500 ml-1">
                  ({formatUsdcValue(typicalCosts.swapTransaction)})
                </span>
              </span>
            </div>
            
            <div className="flex justify-between">
              <span>NFT 铸造:</span>
              <span className="font-medium">
                {typicalCosts.nftMint.toLocaleString()} FOODYE
                <span className="text-xs text-gray-500 ml-1">
                  ({formatUsdcValue(typicalCosts.nftMint)})
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
