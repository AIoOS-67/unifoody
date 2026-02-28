// lib/baseAccountDataFetcher.ts
// 获取 Base Account 风格的数据

import { createPublicClient, http, formatUnits } from 'viem';
import { unichain } from '@/lib/chains';

// Base RPC Client
const publicClient = createPublicClient({
  chain: unichain,
  transport: http('https://mainnet.base.org')
});

// ERC20 Token ABI (标准方法)
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  }
] as const;

// 代币信息接口
interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
  usdValue?: number;
}

// 钱包余额信息
interface WalletBalance {
  address: string;
  ethBalance: string;
  ethBalanceFormatted: string;
  tokens: TokenInfo[];
  totalUsdValue: number;
}

// 获取 ETH 余额
export async function getEthBalance(address: `0x${string}`): Promise<string> {
  try {
    const balance = await publicClient.getBalance({ address });
    return formatUnits(balance, 18);
  } catch (error) {
    console.error('Failed to get ETH balance:', error);
    return '0';
  }
}

// 获取 ERC20 代币信息
export async function getTokenInfo(
  tokenAddress: `0x${string}`, 
  walletAddress: `0x${string}`
): Promise<TokenInfo | null> {
  try {
    // 并行获取代币信息
    const [balance, decimals, symbol, name] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [walletAddress],
      }),
      publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }),
      publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }),
      publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'name',
      }),
    ]);

    const balanceFormatted = formatUnits(balance as bigint, decimals as number);

    return {
      address: tokenAddress,
      symbol: symbol as string,
      name: name as string,
      decimals: decimals as number,
      balance: (balance as bigint).toString(),
      balanceFormatted,
    };
  } catch (error) {
    console.error(`Failed to get token info for ${tokenAddress}:`, error);
    return null;
  }
}

// 获取完整的钱包余额信息 (Base Account 风格)
export async function getWalletBalance(
  address: `0x${string}`,
  tokenAddresses: `0x${string}`[] = []
): Promise<WalletBalance> {
  try {
    console.log('🔍 Fetching wallet balance for:', address);

    // 获取 ETH 余额
    const ethBalance = await publicClient.getBalance({ address });
    const ethBalanceFormatted = formatUnits(ethBalance, 18);

    // 获取所有代币信息
    const tokenPromises = tokenAddresses.map(tokenAddr => 
      getTokenInfo(tokenAddr, address)
    );
    const tokenResults = await Promise.all(tokenPromises);
    const tokens = tokenResults.filter(token => token !== null) as TokenInfo[];

    console.log('✅ Token balances fetched:', tokens);

    return {
      address,
      ethBalance: ethBalance.toString(),
      ethBalanceFormatted,
      tokens,
      totalUsdValue: 0, // TODO: 添加价格计算
    };
  } catch (error) {
    console.error('Failed to get wallet balance:', error);
    throw error;
  }
}

// 获取 FOODYE 代币的详细信息 (包括价格)
export async function getFoodyeTokenData(address: `0x${string}`) {
  const FOODYE_ADDRESS = '0x1022b1b028a2237c440dbac51dc6fc220d88c08f' as `0x${string}`;
  
  try {
    const tokenInfo = await getTokenInfo(FOODYE_ADDRESS, address);
    
    if (!tokenInfo) {
      throw new Error('Failed to fetch FOODYE token info');
    }

    // 模拟 Base Account 的价格计算
    // 基于实际 Swap 数据: $129.02 / 1252524.66570 FOODY ≈ $0.0001030 per FOODY
    const foodyePrice = 0.0001030;
    const usdValue = parseFloat(tokenInfo.balanceFormatted) * foodyePrice;

    return {
      ...tokenInfo,
      usdValue,
      price: foodyePrice,
      // 添加一些 Base Account 风格的格式化
      displayBalance: parseFloat(tokenInfo.balanceFormatted).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 3
      }),
      displayUsdValue: usdValue.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    };
  } catch (error) {
    console.error('Failed to get FOODYE data:', error);
    throw error;
  }
}

// Uniscan API 集成 (可选)
export async function getTokensFromBaseScan(address: string) {
  try {
    // 注意: 需要 Uniscan API key
    const API_KEY = process.env.BASESCAN_API_KEY;
    if (!API_KEY) {
      console.warn('Uniscan API key not found');
      return null;
    }

    const response = await fetch(
      `https://api.uniscan.xyz/api?module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${API_KEY}`
    );
    
    const data = await response.json();
    
    if (data.status === '1') {
      // 处理 Uniscan 返回的代币交易数据
      return data.result;
    }
    
    return null;
  } catch (error) {
    console.error('Uniscan API error:', error);
    return null;
  }
}
