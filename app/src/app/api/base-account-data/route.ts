// app/api/base-account-data/route.ts
// API 路由: 提供 Base Account 风格的钱包数据

import { NextResponse } from 'next/server';
import { getFoodyeTokenData, getWalletBalance } from '@/lib/baseAccountDataFetcher';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Missing wallet address parameter' },
        { status: 400 }
      );
    }

    // 验证地址格式
    if (!address.startsWith('0x') || address.length !== 42) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    console.log('🔍 Fetching Base Account style data for:', address);

    // 获取 FOODYE 数据
    const foodyeData = await getFoodyeTokenData(address as `0x${string}`);

    // 获取完整钱包数据
    const walletData = await getWalletBalance(
      address as `0x${string}`,
      ['0x1022b1b028a2237c440dbac51dc6fc220d88c08f'] // FOODYE token
    );

    const response = {
      success: true,
      data: {
        address,
        timestamp: new Date().toISOString(),
        ethBalance: walletData.ethBalanceFormatted,
        foodyeToken: foodyeData,
        allTokens: walletData.tokens,
        summary: {
          totalUsdValue: foodyeData.usdValue,
          foodyeBalance: foodyeData.displayBalance,
          foodyeUsdValue: foodyeData.displayUsdValue,
          pricePerFoodye: foodyeData.price
        }
      }
    };

    console.log('✅ Base Account data response:', response);

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Base Account data API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address, tokens } = body;

    if (!address) {
      return NextResponse.json(
        { error: 'Missing wallet address' },
        { status: 400 }
      );
    }

    // 获取多个代币的数据
    const tokenAddresses = tokens || ['0x1022b1b028a2237c440dbac51dc6fc220d88c08f'];
    
    const walletData = await getWalletBalance(
      address as `0x${string}`,
      tokenAddresses
    );

    return NextResponse.json({
      success: true,
      data: walletData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Base Account batch data error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
