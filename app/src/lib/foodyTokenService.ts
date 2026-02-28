// lib/foodyTokenService.ts
import { createPublicClient, http } from 'viem';
import { unichain } from '@/lib/chains';

interface FoodyPrice {
  usd_price: number;
  foody_per_usd: number;
  last_updated: number;
  source: string;
}

// 价格缓存配置
const PRICE_CACHE_DURATION = 30 * 1000; // 30秒缓存
let cachedPrice: FoodyPrice | null = null;
let lastFetchTime = 0;

/**
 * 检查价格是否合理（防止异常数据）
 */
function isValidPrice(price: FoodyPrice): boolean {
  const { usd_price, foody_per_usd } = price;
  
  // 基本健全性检查
  if (usd_price <= 0 || foody_per_usd <= 0) return false;
  if (!isFinite(usd_price) || !isFinite(foody_per_usd)) return false;
  
  // 检查价格是否在合理范围内 (FOODY应该在1000-50000 per USD之间)
  if (foody_per_usd < 1000 || foody_per_usd > 50000) return false;
  
  // 检查价格互相关系是否正确
  const calculatedFoodyPerUsd = 1 / usd_price;
  const priceDifference = Math.abs(calculatedFoodyPerUsd - foody_per_usd) / foody_per_usd;
  if (priceDifference > 0.01) return false; // 1%容忍度
  
  return true;
}

/**
 * 检查缓存是否仍然有效
 */
function isCacheValid(): boolean {
  const now = Date.now();
  return cachedPrice !== null && (now - lastFetchTime) < PRICE_CACHE_DURATION;
}

// Fallback FOODY price — captured Feb 2026 from on-chain DEX.
// last_updated is a fixed timestamp so consumers know this is stale data.
const FALLBACK_PRICE_CAPTURED_AT = 1740000000000; // ~Feb 19 2025 UTC
const FALLBACK_FOODY_PRICE: FoodyPrice = {
  usd_price: 0.000120338,   // 1/8308.55
  foody_per_usd: 8308.55,   // 1 USD = 8,308.55 FOODY
  last_updated: FALLBACK_PRICE_CAPTURED_AT,
  source: 'Fallback_Stale_DEX_Price'
};

/**
 * 从链上Uniswap V3池直接获取 Foody Token 的实时价格 (增强版)
 */
async function getFoodyPriceFromOnChain(): Promise<FoodyPrice> {
  try {
    const client = createPublicClient({
      chain: unichain,
      transport: http(),
      batch: {
        multicall: true,
      }
    });

    // Uniswap V3 Pool 地址 (FOODY/USDC)
    const poolAddress = '0xfd25915646ba7677de6079320b1a4975a450891d';
    
    // Uniswap V3 Pool ABI (只需要slot0函数)
    const poolABI = [
      {
        inputs: [],
        name: 'slot0',
        outputs: [
          { internalType: 'uint160', name: 'sqrtPriceX96', type: 'uint160' },
          { internalType: 'int24', name: 'tick', type: 'int24' },
          { internalType: 'uint16', name: 'observationIndex', type: 'uint16' },
          { internalType: 'uint16', name: 'observationCardinality', type: 'uint16' },
          { internalType: 'uint16', name: 'observationCardinalityNext', type: 'uint16' },
          { internalType: 'uint8', name: 'feeProtocol', type: 'uint8' },
          { internalType: 'bool', name: 'unlocked', type: 'bool' }
        ],
        stateMutability: 'view',
        type: 'function'
      }
    ];

    // 获取池的当前价格 (增加超时保护)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('On-chain request timeout')), 10000)
    );

    const contractPromise = client.readContract({
      address: poolAddress as `0x${string}`,
      abi: poolABI,
      functionName: 'slot0'
    });

    const result = await Promise.race([contractPromise, timeoutPromise]) as [bigint, number, number, number, number, number, boolean];
    const [slot0Result] = result;
    const sqrtPriceX96 = slot0Result;
    
    // 验证sqrtPriceX96是否合理
    if (!sqrtPriceX96 || sqrtPriceX96 <= BigInt(0)) {
      throw new Error('Invalid sqrtPriceX96 from pool');
    }
    
    // 将sqrtPriceX96转换为实际价格
    // Price = (sqrtPriceX96 / 2^96)^2
    const Q96 = BigInt(2) ** BigInt(96);
    const price = (Number(sqrtPriceX96) / Number(Q96)) ** 2;
    
    // 考虑代币精度：USDC (6 decimals) / FOODY (18 decimals)
    // 所以我们需要调整 10^12 = 10^(18-6)
    const adjustedPrice = price * (10 ** 12);
    
    if (adjustedPrice <= 0 || !isFinite(adjustedPrice)) {
      throw new Error('Invalid calculated price');
    }
    
    // adjustedPrice 现在是 USDC per FOODY，我们需要转换
    const usdPerFoody = adjustedPrice; // 这已经是 USD per FOODY
    const foodyPerUsd = 1 / adjustedPrice; // 这是 FOODY per USD
    
    return {
      usd_price: usdPerFoody,
      foody_per_usd: foodyPerUsd,
      last_updated: Date.now(),
      source: 'OnChain_Uniswap_V3_Pool'
    };
    
  } catch (error) {
    console.error('❌ Failed to get price from on-chain pool:', error);
    throw new Error(`On-chain price fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * 添加价格历史统计功能
 */
interface PriceStats {
  total_requests: number;
  cache_hits: number;
  cache_hit_rate: number;
  last_price_update: number;
  price_sources_used: Record<string, number>;
}

let priceStats: PriceStats = {
  total_requests: 0,
  cache_hits: 0,
  cache_hit_rate: 0,
  last_price_update: 0,
  price_sources_used: {}
};

/**
 * 获取价格服务统计数据
 */
export function getPriceStats(): PriceStats {
  priceStats.cache_hit_rate = priceStats.total_requests > 0 
    ? (priceStats.cache_hits / priceStats.total_requests) * 100 
    : 0;
  return { ...priceStats };
}

/**
 * 重置价格统计
 */
export function resetPriceStats(): void {
  priceStats = {
    total_requests: 0,
    cache_hits: 0,
    cache_hit_rate: 0,
    last_price_update: 0,
    price_sources_used: {}
  };
  console.log('📊 Price statistics reset');
}

/**
 * 更新统计数据
 */
function updateStats(source?: string, fromCache: boolean = false): void {
  priceStats.total_requests++;
  if (fromCache) {
    priceStats.cache_hits++;
  } else {
    priceStats.last_price_update = Date.now();
    if (source) {
      priceStats.price_sources_used[source] = (priceStats.price_sources_used[source] || 0) + 1;
    }
  }
}
async function getFoodyPriceFromGeckoTerminal(): Promise<FoodyPrice> {
  const response = await fetch(
    'https://api.geckoterminal.com/api/v2/networks/base/pools/0xfd25915646ba7677de6079320b1a4975a450891d/ohlcv/day?aggregate=1&limit=1',
    {
      headers: {
        'Accept': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`GeckoTerminal API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.data && data.data.attributes && data.data.attributes.ohlcv_list.length > 0) {
    const ohlcvList = data.data.attributes.ohlcv_list;
    const currentPrice = parseFloat(ohlcvList[0][4]); // 收盘价
    
    return {
      usd_price: currentPrice,
      foody_per_usd: 1 / currentPrice,
      last_updated: Date.now(),
      source: 'GeckoTerminal_API'
    };
  } else {
    throw new Error('Invalid GeckoTerminal API response');
  }
}

/**
 * 获取 Foody Token 的当前价格 (带缓存和验证)
 */
export async function getFoodyPrice(): Promise<FoodyPrice> {
  try {
    // 🚀 优化1: 检查缓存
    if (isCacheValid()) {
      updateStats(undefined, true);
      console.log('🎯 Using cached FOODY price:', cachedPrice);
      return cachedPrice!;
    }

    let bestPrice: FoodyPrice | null = null;
    let priceSource: string = '';
    const errors: string[] = [];

    // 🚀 优化2: 优先尝试从链上Uniswap V3池获取实时价格
    try {
      const onChainPrice = await getFoodyPriceFromOnChain();
      if (isValidPrice(onChainPrice)) {
        bestPrice = onChainPrice;
        priceSource = onChainPrice.source;
        console.log('🪙 Using validated on-chain FOODY price:', onChainPrice);
      } else {
        console.warn('⚠️ On-chain price failed validation:', onChainPrice);
        errors.push('On-chain price validation failed');
      }
    } catch (onChainError) {
      const errorMsg = `On-chain fetch failed: ${onChainError instanceof Error ? onChainError.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.warn('❌ On-chain price fetch failed:', errorMsg);
    }

    // 🚀 优化3: 如果链上失败，尝试 GeckoTerminal API
    if (!bestPrice) {
      try {
        const geckoPrice = await getFoodyPriceFromGeckoTerminal();
        if (isValidPrice(geckoPrice)) {
          bestPrice = geckoPrice;
          priceSource = geckoPrice.source;
          console.log('🪙 Using validated GeckoTerminal FOODY price (fallback):', geckoPrice);
        } else {
          console.warn('⚠️ GeckoTerminal price failed validation:', geckoPrice);
          errors.push('GeckoTerminal price validation failed');
        }
      } catch (geckoError) {
        const errorMsg = `GeckoTerminal fetch failed: ${geckoError instanceof Error ? geckoError.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.warn('❌ GeckoTerminal price fetch failed:', errorMsg);
      }
    }
    
    // 🚀 优化4: 尝试外部API（如果配置了）
    if (!bestPrice && process.env.FOODY_PRICE_API_URL) {
      try {
        const externalPrice = await getFoodyPriceFromAPI();
        if (isValidPrice(externalPrice)) {
          bestPrice = externalPrice;
          priceSource = externalPrice.source;
          console.log('🪙 Using validated external API FOODY price:', externalPrice);
        } else {
          errors.push('External API price validation failed');
        }
      } catch (externalError) {
        errors.push(`External API failed: ${externalError instanceof Error ? externalError.message : 'Unknown error'}`);
      }
    }
    
    // 🚀 优化5: 使用最佳价格或备用价格
    const finalPrice = bestPrice || FALLBACK_FOODY_PRICE;
    
    // 🚀 优化6: 缓存有效价格并更新统计
    if (bestPrice) {
      cachedPrice = finalPrice;
      lastFetchTime = Date.now();
      updateStats(priceSource, false);
      console.log('✅ FOODY price cached successfully');
    } else {
      updateStats('Fallback', false);
      console.warn('⚠️ All price sources failed, using fallback:', errors);
      console.log('🔄 Using fallback FOODY price:', FALLBACK_FOODY_PRICE);
    }
    
    return finalPrice;
    
  } catch (error) {
    console.error('💥 Critical error in getFoodyPrice:', error);
    updateStats('Error_Fallback', false);
    // 返回缓存价格（如果有）或备用价格
    return cachedPrice || FALLBACK_FOODY_PRICE;
  }
}

/**
 * 将 USDC 金额转换为 FOODY 数量
 */
export function convertUsdcToFoody(usdcAmount: number, foodyPrice: FoodyPrice): number {
  const foodyAmount = usdcAmount * foodyPrice.foody_per_usd;
  return Math.round(foodyAmount * 100000) / 100000; // 保留5位小数
}

/**
 * 将 FOODY 数量转换为 USDC 金额
 */
export function convertFoodyToUsdc(foodyAmount: number, foodyPrice: FoodyPrice): number {
  const usdcAmount = foodyAmount * foodyPrice.usd_price;
  return Math.round(usdcAmount * 100) / 100; // 保留2位小数
}

/**
 * 格式化 FOODY 数量显示
 */
export function formatFoodyAmount(amount: number): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(2)}M FOODY`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(2)}K FOODY`;
  } else {
    return `${amount.toFixed(2)} FOODY`;
  }
}

/**
 * 从外部 API 获取 Foody 价格 (当配置了时)
 */
async function getFoodyPriceFromAPI(): Promise<FoodyPrice> {
  const response = await fetch(process.env.FOODY_PRICE_API_URL!, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Foody price API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    usd_price: data.usd_price,
    foody_per_usd: 1 / data.usd_price,
    last_updated: Date.now(),
    source: 'External_API'
  };
}

/**
 * 计算含税总额的 FOODY 等值
 */
export function calculateFoodyPayment(
  subtotal: number, 
  taxAmount: number, 
  foodyPrice: FoodyPrice
): {
  subtotal_usdc: number;
  tax_usdc: number;
  total_usdc: number;
  subtotal_foody: number;
  tax_foody: number;
  total_foody: number;
  exchange_rate: number;
} {
  const totalUsdc = subtotal + taxAmount;
  
  return {
    subtotal_usdc: Math.round(subtotal * 100) / 100,
    tax_usdc: Math.round(taxAmount * 100) / 100,
    total_usdc: Math.round(totalUsdc * 100) / 100,
    subtotal_foody: convertUsdcToFoody(subtotal, foodyPrice),
    tax_foody: convertUsdcToFoody(taxAmount, foodyPrice),
    total_foody: convertUsdcToFoody(totalUsdc, foodyPrice),
    exchange_rate: foodyPrice.foody_per_usd
  };
}
