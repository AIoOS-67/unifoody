// app/api/diner-reward/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface DinerRewardRequest {
  walletAddress: string;
  email: string;
  role: string;
}

// FOODY 奖励配置
const DINER_REWARD_AMOUNT = 888; // 888 FOODY tokens
const REWARD_REASON = '平台奖励';

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, email, role }: DinerRewardRequest = await request.json();

    // 验证输入
    if (!walletAddress || !email || role !== 'diner') {
      return NextResponse.json(
        { error: 'Invalid request. Only diners are eligible for registration rewards.' },
        { status: 400 }
      );
    }

    // 验证钱包地址格式
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    // 检查是否已经领取过奖励
    const { data: existingReward, error: checkError } = await supabaseAdmin
      .from('diner_rewards')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Database check error:', checkError);
      return NextResponse.json(
        { error: 'Database error while checking existing rewards' },
        { status: 500 }
      );
    }

    if (existingReward) {
      return NextResponse.json(
        { 
          error: 'Reward already claimed',
          message: 'This wallet has already received the registration reward',
          previousReward: {
            amount: existingReward.reward_amount,
            claimedAt: existingReward.created_at
          }
        },
        { status: 409 }
      );
    }

    // 记录奖励发放
    const { data: rewardRecord, error: insertError } = await supabaseAdmin
      .from('diner_rewards')
      .insert({
        wallet_address: walletAddress.toLowerCase(),
        email: email.toLowerCase(),
        reward_amount: DINER_REWARD_AMOUNT,
        reward_reason: REWARD_REASON,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to record reward' },
        { status: 500 }
      );
    }

    // 模拟发放代币（在实际应用中，这里会调用智能合约或代币服务）
    // 更新状态为已完成
    const { error: updateError } = await supabaseAdmin
      .from('diner_rewards')
      .update({ 
        status: 'completed',
        transaction_hash: `mock_tx_${Date.now()}`, // 在实际应用中使用真实的交易哈希
        completed_at: new Date().toISOString()
      })
      .eq('id', rewardRecord.id);

    if (updateError) {
      console.error('Database update error:', updateError);
      // 即使更新失败，奖励已记录，不返回错误
    }

    return NextResponse.json({
      success: true,
      message: `Congratulations! You've received ${DINER_REWARD_AMOUNT} FOODY tokens for joining as a new diner!`,
      reward: {
        amount: DINER_REWARD_AMOUNT,
        reason: REWARD_REASON,
        walletAddress: walletAddress,
        rewardId: rewardRecord.id,
        status: 'completed'
      }
    });

  } catch (error) {
    console.error('Diner reward error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// 获取奖励统计
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let walletAddress = searchParams.get('wallet');
    const action = searchParams.get('action');
    if (walletAddress) walletAddress = walletAddress.toLowerCase();

    if (action === 'stats') {
      // 获取全局统计（admin 客户端，绕过 RLS）
      const { data: stats, error: statsError } = await supabaseAdmin
        .from('diner_rewards')
        .select('reward_amount, status, created_at');

      if (statsError) {
        return NextResponse.json({ error: 'Database query error' }, { status: 500 });
      }

      const totalRewards = stats?.length || 0;
      const totalAmount = stats?.reduce((sum, reward) => sum + (reward as any).reward_amount, 0) || 0;
      const completedRewards = stats?.filter((r: any) => r.status === 'completed').length || 0;

      const payload = {
        totalRewards,
        totalAmount,
        completedRewards,
        pendingRewards: totalRewards - completedRewards,
        averageReward: totalRewards > 0 ? totalAmount / totalRewards : 0
      };

      return NextResponse.json({ success: true, stats: payload, statistics: payload });
    }

    if (walletAddress) {
      // 查询特定钱包的奖励记录
      const { data: rewards, error } = await supabaseAdmin
        .from('diner_rewards')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: 'Database query error' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        wallet: walletAddress,
        rewards: rewards || [],
        totalRewarded: rewards?.reduce((sum, reward) => sum + reward.reward_amount, 0) || 0
      });
    }

    // 默认返回全量统计（兼容旧用法，无 action 参数时也给 statistics）
    const { data: statsDefault, error: statsErrorDefault } = await supabaseAdmin
      .from('diner_rewards')
      .select('reward_amount, status, created_at');

    if (statsErrorDefault) {
      return NextResponse.json({ error: 'Database query error' }, { status: 500 });
    }

    const totalRewardsDef = statsDefault?.length || 0;
    const totalAmountDef = statsDefault?.reduce((sum, reward) => sum + (reward as any).reward_amount, 0) || 0;
    const completedRewardsDef = statsDefault?.filter((r: any) => r.status === 'completed').length || 0;

    return NextResponse.json({
      success: true,
      statistics: {
        totalRewards: totalRewardsDef,
        totalAmount: totalAmountDef,
        completedRewards: completedRewardsDef,
        pendingRewards: totalRewardsDef - completedRewardsDef,
        averageReward: totalRewardsDef > 0 ? totalAmountDef / totalRewardsDef : 0
      }
    });

  } catch (error) {
    console.error('Stats query error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
