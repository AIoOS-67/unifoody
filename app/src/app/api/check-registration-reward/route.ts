// app/api/check-registration-reward/route.ts
// 检查用户是否有资格领取新注册奖励
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
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

    // 检查用户是否已经有注册奖励记录
    const { data: existingReward, error: checkError } = await supabaseAdmin
      .from('diner_rewards')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Database check error:', checkError);
      return NextResponse.json(
        { error: 'Database error while checking registration reward' },
        { status: 500 }
      );
    }

    // 如果有记录，说明已经领取过了
    if (existingReward) {
      return NextResponse.json({
        success: true,
        eligible: false,
        claimed: true,
        reward: {
          amount: existingReward.reward_amount,
          status: existingReward.status,
          claimedAt: existingReward.created_at,
          transactionHash: existingReward.transaction_hash
        },
        message: 'Registration reward already claimed'
      });
    }

    // 检查用户是否在用户表中注册为 diner
    // 这里需要根据您的用户表结构进行调整
    // 暂时假设如果钱包地址存在且未领取奖励，则有资格领取
    return NextResponse.json({
      success: true,
      eligible: true,
      claimed: false,
      availableReward: {
        amount: 888,
        reason: '平台奖励',
        description: '新用户平台注册奖励'
      },
      message: 'Eligible for new member registration reward'
    });

  } catch (error) {
    console.error('Check registration reward error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
