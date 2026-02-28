// app/api/admin/reward-stats/route.ts
// 管理员奖励统计 API
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { getTokenDistributionInfo, checkMainWalletBalance } from '@/lib/foodyTokenDistribution';
import { getRewardStatistics } from '@/lib/dinerRewardService';

export async function GET(request: NextRequest) {
  try {
    // 简单的管理员验证（生产环境中应使用更安全的方法）
    const adminKey = process.env.ADMIN_API_KEY;
    const authHeader = request.headers.get('authorization');
    if (!adminKey || !authHeader || authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 获取数据库统计
    const dbStats = await getRewardStatistics();

    // 获取主钱包余额
    const walletBalance = await checkMainWalletBalance();

    // 获取代币分发信息
    const distributionInfo = await getTokenDistributionInfo();

    const response = {
      timestamp: new Date().toISOString(),
      database: {
        totalRewards: dbStats.totalRewards,
        totalAmountDistributed: dbStats.totalAmount,
        completedRewards: dbStats.completedRewards,
        pendingRewards: dbStats.pendingRewards,
        averageReward: dbStats.averageReward
      },
      mainWallet: {
        address: distributionInfo.mainWallet.address,
        balance: {
          formatted: walletBalance.formattedBalance,
          canDistribute: walletBalance.canDistribute,
          maxPossibleRewards: walletBalance.maxRewards
        }
      },
      tokenInfo: distributionInfo.tokenInfo,
      network: distributionInfo.network,
      rewardConfig: {
        dinerRegistrationAmount: 1000,
        currency: 'FOODY'
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching admin reward stats:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch reward statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// 健康检查端点
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
