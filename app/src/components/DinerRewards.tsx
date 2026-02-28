// components/DinerRewards.tsx
// Diner 奖励显示组件

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { DinerReward, RewardStats } from '@/lib/dinerRewardService';

interface DinerRewardsProps {
  className?: string;
}

interface RegistrationRewardStatus {
  eligible: boolean;
  claimed: boolean;
  availableReward?: {
    amount: number;
    reason: string;
    description: string;
  };
  reward?: {
    amount: number;
    status: string;
    claimedAt: string;
    transactionHash: string;
  };
  message: string;
}

export default function DinerRewards({ className = '' }: DinerRewardsProps) {
  const { address } = useAccount();
  // 保证钱包地址为小写，避免数据库查不到
  const lowerCaseAddress = address ? address.toLowerCase() : undefined;
  const [rewards, setRewards] = useState<DinerReward[]>([]);
  const [stats, setStats] = useState<RewardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registrationRewardStatus, setRegistrationRewardStatus] = useState<RegistrationRewardStatus | null>(null);
  const [claimingReward, setClaimingReward] = useState(false);

  // 当 eligibility 未返回但用户没有任何奖励记录时，启用安全兜底显示（服务端仍会防重复）
  const shouldShowClaim = useMemo(() => {
    if (registrationRewardStatus) {
      return registrationRewardStatus.eligible && !registrationRewardStatus.claimed;
    }
    // 兜底：有地址且当前无任何奖励，提示可领取
    return Boolean(lowerCaseAddress) && rewards.length === 0;
  }, [registrationRewardStatus, lowerCaseAddress, rewards.length]);

  useEffect(() => {
    // 调试：打印是否显示领取按钮的判断
    console.log('[Rewards] shouldShowClaim:', shouldShowClaim, {
      address: lowerCaseAddress,
      rewardsCount: rewards.length,
      registrationRewardStatus
    });
  }, [shouldShowClaim, lowerCaseAddress, rewards.length, registrationRewardStatus]);

  // 按用户要求：仅显示按钮，不自动触发领取

  const fetchRewardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 检查新注册奖励状态
      const registrationResponse = await fetch(`/api/check-registration-reward?wallet=${lowerCaseAddress}`);
      if (registrationResponse.ok) {
        const registrationData = await registrationResponse.json();
        console.log('[Rewards] registration status:', registrationData);
        setRegistrationRewardStatus(registrationData);
      }

      // 获取用户奖励记录
      const rewardsResponse = await fetch(`/api/diner-reward?wallet=${lowerCaseAddress}`);
      if (rewardsResponse.ok) {
        const rewardsData = await rewardsResponse.json();
        console.log('调试rewards:', rewardsData.rewards);
        setRewards(rewardsData.rewards || []);
      }

      // 获取整体统计
      const statsResponse = await fetch('/api/diner-reward?action=stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.stats);
      }
    } catch (err) {
      console.error('Error fetching reward data:', err);
      setError('Failed to load reward information');
    } finally {
      setLoading(false);
    }
  }, [address]);

  const handleClaimRegistrationReward = async () => {
    if (!lowerCaseAddress || !registrationRewardStatus?.eligible) return;

    try {
      setClaimingReward(true);
      const response = await fetch('/api/claim-registration-reward', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: lowerCaseAddress,
          email: '' // You might want to get this from user context
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 重新获取奖励数据
        await fetchRewardData();
        // 可以添加成功提示
        console.log('Registration reward claimed successfully!');
      } else {
        setError(data.error || 'Failed to claim registration reward');
      }
    } catch (err) {
      console.error('Error claiming registration reward:', err);
      setError('Failed to claim registration reward');
    } finally {
      setClaimingReward(false);
    }
  };

  useEffect(() => {
    if (lowerCaseAddress) {
      fetchRewardData();
    }
  }, [lowerCaseAddress, fetchRewardData]);

  if (loading) {
    return (
      <div className={`bg-zinc-900 rounded-xl p-6 ${className}`}>
        <div className="flex items-center justify-center space-x-2">
          <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-yellow-300">Loading rewards...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-zinc-900 rounded-xl p-6 ${className}`}>
        <div className="text-center text-red-400">
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchRewardData}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // 允许无status字段时也能统计
  const totalEarned = rewards.reduce((sum, reward) => {
    const r: any = reward;
    // 只要有金额就统计，强制转数字
    if (!r.status || r.status === 'completed' || r.status === '') {
      return sum + Number(r.rewardAmount || r.reward_amount || 0);
    }
    return sum;
  }, 0);

  return (
    <div className={`bg-zinc-900 rounded-xl p-6 space-y-4 ${className}`}>
      {/* 标题和总览 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-yellow-400">🎁 Your Rewards</h3>
        <div className="text-right">
          <div className="text-xl font-bold text-yellow-300">
            {totalEarned.toLocaleString()} FOODY
          </div>
          <div className="text-xs text-zinc-400">Total Earned</div>
        </div>
      </div>

      {/* 新注册奖励提示 */}
      {shouldShowClaim && (
        <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-2xl">🎉</div>
              <div>
                <div className="font-medium text-yellow-300">
                  {`领取平台注册奖励 ${(registrationRewardStatus?.availableReward?.amount ?? 888).toLocaleString()} FOODY`}
                </div>
                <div className="text-sm text-yellow-400/80">
                  新用户平台注册奖励（My Reward）
                </div>
              </div>
            </div>
            <button
              onClick={handleClaimRegistrationReward}
              disabled={claimingReward}
              className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-700 disabled:cursor-not-allowed text-black font-medium px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {claimingReward ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  <span>Claiming...</span>
                </div>
              ) : (
                'Claim Now'
              )}
            </button>
          </div>
        </div>
      )}

      {/* 奖励列表 */}
      {rewards.length > 0 ? (
        <div className="space-y-3">
          {rewards.map((reward) => {
            const r: any = reward;
            // 兼容status为null/空字符串
            const status = r.status === undefined || r.status === null || r.status === '' ? 'completed' : r.status;
            const amount = r.rewardAmount || r.reward_amount || 0;
            const reason = r.rewardReason || r.reward_reason || 'Reward';
            const createdAt = r.createdAt || r.created_at || '';
            return (
              <div
                key={reward.id}
                className="bg-zinc-800 rounded-lg p-4 border-l-4 border-yellow-500"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">
                      {status === 'completed' ? '✅' : status === 'pending' ? '⏳' : '❌'}
                    </div>
                    <div>
                      <div className="font-medium text-white">
                        {reason}
                      </div>
                      <div className="text-sm text-zinc-400">
                        {createdAt ? new Date(createdAt).toLocaleDateString() : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-yellow-300">
                      +{amount.toLocaleString()} FOODY
                    </div>
                    <div className="text-xs text-zinc-500 capitalize">
                      {status}
                    </div>
                  </div>
                </div>
                {reward.transactionHash && (
                  <div className="mt-2 text-xs text-blue-400">
                    TX: {reward.transactionHash.slice(0, 20)}...
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-zinc-400">
          <div className="text-4xl mb-2">🎁</div>
          <p className="text-sm">No rewards yet</p>
          <p className="text-xs text-zinc-500 mt-1">
            Complete actions to earn FOODY tokens!
          </p>
        </div>
      )}

      {/* 平台统计 */}
      {stats && (
        <div className="border-t border-zinc-700 pt-4">
          <div className="text-xs text-zinc-400 mb-2">Platform Stats</div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-green-400">
                {stats.totalRewards.toLocaleString()}
              </div>
              <div className="text-xs text-zinc-500">Total Rewards</div>
            </div>
            <div>
              <div className="text-lg font-bold text-yellow-400">
                {(stats.totalAmount / 1000).toFixed(1)}K
              </div>
              <div className="text-xs text-zinc-500">FOODY Distributed</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
