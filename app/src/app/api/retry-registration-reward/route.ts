// app/api/retry-registration-reward/route.ts
// 管理端：为已记录为 completed 但使用 mock 交易哈希的注册奖励，重新发起真实链上发放

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { distributeFoodyTokens } from '@/lib/foodyTokenDistribution';

const DINER_REWARD_AMOUNT = 888;

export async function POST(request: NextRequest) {
  try {
    // Admin authentication required
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!process.env.ADMIN_API_KEY || token !== process.env.ADMIN_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { walletAddress } = await request.json();

    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    if (!process.env.MAIN_WALLET_PRIVATE_KEY) {
      return NextResponse.json({ error: 'MAIN_WALLET_PRIVATE_KEY not configured' }, { status: 400 });
    }

    // 查找该钱包的奖励记录
    const { data: reward, error } = await supabaseAdmin
      .from('diner_rewards')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: 'Database error', details: error.message }, { status: 500 });
    }

    if (!reward) {
      return NextResponse.json({ error: 'No reward record found for this wallet' }, { status: 404 });
    }

    // 如果已经有真实交易哈希，直接返回
    if (reward.transaction_hash && typeof reward.transaction_hash === 'string' && !reward.transaction_hash.startsWith('mock_')) {
      return NextResponse.json({ success: true, message: 'Onchain transfer already completed', reward });
    }

    // 重新发起链上转账
    const result = await distributeFoodyTokens(walletAddress, DINER_REWARD_AMOUNT);

    if (!result.success || !result.transactionHash) {
      return NextResponse.json({ error: result.error || 'Token distribution failed' }, { status: 502 });
    }

    // 更新交易哈希与完成时间
    const { error: updateError, data: updated } = await supabaseAdmin
      .from('diner_rewards')
      .update({
        status: 'completed',
        transaction_hash: result.transactionHash,
        completed_at: new Date().toISOString()
      })
      .eq('id', reward.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Database update failed', details: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, tx: result.transactionHash, reward: updated });

  } catch (err) {
    return NextResponse.json({ error: 'Internal server error', details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
