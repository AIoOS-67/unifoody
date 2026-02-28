// app/api/foody-convert/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getFoodyPrice, convertUsdcToFoody, convertFoodyToUsdc, formatFoodyAmount } from '@/lib/foodyTokenService';

export async function POST(request: NextRequest) {
  try {
    const { amount, fromCurrency, toCurrency } = await request.json();

    if (!amount || !fromCurrency || !toCurrency) {
      return NextResponse.json(
        { error: 'Amount, fromCurrency, and toCurrency are required' },
        { status: 400 }
      );
    }

    const inputAmount = parseFloat(amount);
    if (isNaN(inputAmount) || inputAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // 获取当前 FOODY 价格
    const foodyPrice = await getFoodyPrice();

    let convertedAmount: number;
    let formatted: string;

    if (fromCurrency === 'USDC' && toCurrency === 'FOODY') {
      convertedAmount = convertUsdcToFoody(inputAmount, foodyPrice);
      formatted = formatFoodyAmount(convertedAmount);
    } else if (fromCurrency === 'FOODY' && toCurrency === 'USDC') {
      convertedAmount = convertFoodyToUsdc(inputAmount, foodyPrice);
      formatted = `$${convertedAmount.toFixed(2)} USDC`;
    } else {
      return NextResponse.json(
        { error: 'Unsupported currency pair' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      input: {
        amount: inputAmount,
        currency: fromCurrency
      },
      output: {
        amount: convertedAmount,
        currency: toCurrency,
        formatted: formatted
      },
      exchange_rate: fromCurrency === 'USDC' ? foodyPrice.foody_per_usd : foodyPrice.usd_price,
      price_info: {
        foody_usd_price: foodyPrice.usd_price,
        foody_per_usd: foodyPrice.foody_per_usd,
        last_updated: foodyPrice.last_updated,
        source: foodyPrice.source
      }
    });

  } catch (error) {
    console.error('FOODY conversion error:', error);
    return NextResponse.json(
      { 
        error: 'Conversion failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// 修复：移除未使用的 request 参数
export async function GET() {
  try {
    const foodyPrice = await getFoodyPrice();
    
    return NextResponse.json({
      success: true,
      price_info: {
        foody_usd_price: foodyPrice.usd_price,
        foody_per_usd: foodyPrice.foody_per_usd,
        last_updated: foodyPrice.last_updated,
        source: foodyPrice.source
      },
      examples: {
        '1_usdc_to_foody': convertUsdcToFoody(1, foodyPrice),
        '10_usdc_to_foody': convertUsdcToFoody(10, foodyPrice),
        '100_usdc_to_foody': convertUsdcToFoody(100, foodyPrice)
      }
    });

  } catch (error) {
    console.error('FOODY price lookup error:', error);
    return NextResponse.json(
      { 
        error: 'Price lookup failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
