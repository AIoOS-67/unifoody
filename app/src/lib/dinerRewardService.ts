// lib/dinerRewardService.ts
// Diner 注册奖励服务

import { supabase } from '@/lib/supabase';
import { distributeDinerRegistrationReward } from '@/lib/foodyTokenDistribution';

export interface DinerReward {
  id: number;
  walletAddress: string;
  email: string;
  rewardAmount: number;
  rewardReason: string;
  status: 'pending' | 'completed' | 'failed';
  transactionHash?: string;
  createdAt: string;
  completedAt?: string;
}

export interface RewardStats {
  totalRewards: number;
  totalAmount: number;
  completedRewards: number;
  pendingRewards: number;
  averageReward: number;
}

export const DINER_REWARD_CONFIG = {
  AMOUNT: 888, // 888 FOODY tokens
  REASON: '平台奖励',
  ELIGIBLE_ROLE: 'diner'
};

// Database record interface
interface DatabaseRewardRecord {
  id: number;
  wallet_address: string;
  email: string;
  reward_amount: number;
  reward_reason: string;
  status: 'pending' | 'completed' | 'failed';
  transaction_hash?: string;
  created_at: string;
  completed_at?: string;
}

/**
 * 检查钱包是否已经领取过奖励
 */
export async function checkRewardEligibility(walletAddress: string): Promise<{
  isEligible: boolean;
  reason?: string;
  existingReward?: DinerReward;
}> {
  try {
    const { data: existingReward, error } = await supabase
      .from('diner_rewards')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Database error: ${error.message}`);
    }

    if (existingReward) {
      return {
        isEligible: false,
        reason: 'Reward already claimed for this wallet',
        existingReward: mapDatabaseToReward(existingReward)
      };
    }

    return { isEligible: true };
  } catch (error) {
    console.error('Error checking reward eligibility:', error);
    throw error;
  }
}

/**
 * 发放 Diner 注册奖励
 */
export async function issueDinerReward(
  walletAddress: string,
  email: string
): Promise<DinerReward> {
  try {
    // 验证输入
    if (!walletAddress || !email) {
      throw new Error('Wallet address and email are required');
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      throw new Error('Invalid wallet address format');
    }

    // 检查资格
    const eligibilityCheck = await checkRewardEligibility(walletAddress);
    if (!eligibilityCheck.isEligible) {
      throw new Error(eligibilityCheck.reason || 'Not eligible for reward');
    }

    // 创建奖励记录
    const { data: rewardRecord, error: insertError } = await supabase
      .from('diner_rewards')
      .insert({
        wallet_address: walletAddress.toLowerCase(),
        email: email.toLowerCase(),
        reward_amount: DINER_REWARD_CONFIG.AMOUNT,
        reward_reason: DINER_REWARD_CONFIG.REASON,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to create reward record: ${insertError.message}`);
    }

    // 真实代币发放（替换模拟发放）
    const tokenDistribution = await distributeDinerRegistrationReward(walletAddress);
    
    if (tokenDistribution.success && tokenDistribution.transactionHash) {
      // 更新为已完成状态
      const { error: updateError } = await supabase
        .from('diner_rewards')
        .update({
          status: 'completed',
          transaction_hash: tokenDistribution.transactionHash,
          completed_at: new Date().toISOString()
        })
        .eq('id', rewardRecord.id);

      if (updateError) {
        console.error('Failed to update reward status:', updateError);
      }

      console.log(`✅ Successfully distributed ${tokenDistribution.amount} FOODY to ${walletAddress}`);
      console.log(`🔗 Transaction: ${tokenDistribution.transactionHash}`);
    } else {
      // No private key = cannot distribute tokens
      if (!process.env.MAIN_WALLET_PRIVATE_KEY) {
        console.error('[RewardService] MAIN_WALLET_PRIVATE_KEY not configured — cannot distribute tokens');

        const { error: updateError } = await supabase
          .from('diner_rewards')
          .update({
            status: 'pending',
            completed_at: null
          })
          .eq('id', rewardRecord.id);

        if (updateError) {
          console.error('[RewardService] Failed to update reward status:', updateError);
        }

        return { success: false, error: 'Token distribution not available: missing wallet key' };
      } else {
        // 更新为失败状态
        const { error: updateError } = await supabase
          .from('diner_rewards')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString()
          })
          .eq('id', rewardRecord.id);

        if (updateError) {
          console.error('Failed to update reward status:', updateError);
        }

        throw new Error(`Token distribution failed: ${tokenDistribution.error}`);
      }
    }

    return mapDatabaseToReward(rewardRecord);
  } catch (error) {
    console.error('Error issuing diner reward:', error);
    throw error;
  }
}

/**
 * 获取用户的奖励记录
 */
export async function getUserRewards(walletAddress: string): Promise<DinerReward[]> {
  try {
    const { data: rewards, error } = await supabase
      .from('diner_rewards')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return (rewards || []).map(mapDatabaseToReward);
  } catch (error) {
    console.error('Error fetching user rewards:', error);
    throw error;
  }
}

/**
 * 获取奖励统计
 */
export async function getRewardStatistics(): Promise<RewardStats> {
  try {
    const { data: stats, error } = await supabase
      .from('diner_reward_statistics')
      .select('*')
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return {
      totalRewards: stats.total_rewards || 0,
      totalAmount: stats.total_amount_distributed || 0,
      completedRewards: stats.completed_rewards || 0,
      pendingRewards: stats.pending_rewards || 0,
      averageReward: stats.average_reward_amount || 0
    };
  } catch (error) {
    console.error('Error fetching reward statistics:', error);
    throw error;
  }
}

/**
 * 数据库记录映射到业务对象
 */
function mapDatabaseToReward(dbRecord: DatabaseRewardRecord): DinerReward {
  return {
    id: dbRecord.id,
    walletAddress: dbRecord.wallet_address,
    email: dbRecord.email,
    rewardAmount: dbRecord.reward_amount,
    rewardReason: dbRecord.reward_reason,
    status: dbRecord.status,
    transactionHash: dbRecord.transaction_hash,
    createdAt: dbRecord.created_at,
    completedAt: dbRecord.completed_at
  };
}

/**
 * 验证用户角色是否为 Diner
 */
export function validateDinerRole(role: string): boolean {
  return role === DINER_REWARD_CONFIG.ELIGIBLE_ROLE;
}

/**
 * 格式化奖励金额显示
 */
export function formatRewardAmount(amount: number): string {
  return `${amount.toLocaleString()} FOODY`;
}
