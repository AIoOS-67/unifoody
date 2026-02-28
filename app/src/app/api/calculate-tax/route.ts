// app/api/calculate-tax/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTaxRateByZipCode, getTaxRateByState, calculateTax } from '@/lib/taxService';

export async function POST(request: NextRequest) {
  try {
    const { amount, zipCode, state } = await request.json();

    if (!amount || (!zipCode && !state)) {
      return NextResponse.json(
        { error: 'Amount and either zipCode or state are required' },
        { status: 400 }
      );
    }

    // 验证金额
    const subtotal = parseFloat(amount);
    if (isNaN(subtotal) || subtotal <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    console.log(`🧮 Calculating tax for amount: ${subtotal}, state: ${state || 'from ZIP'}, zip: ${zipCode || 'N/A'}`);

    // 获取税率 - 优先使用州，否则使用ZIP code
    let taxRate;
    let usedState = state;
    
    if (state) {
      // 直接使用州税率 (推荐方式)
      taxRate = await getTaxRateByState(state);
      usedState = state.toUpperCase();
    } else if (zipCode) {
      // 向后兼容：从ZIP code推断州
      const zipPattern = /^\d{5}(-\d{4})?$/;
      if (!zipPattern.test(zipCode)) {
        return NextResponse.json(
          { error: 'Invalid zip code format' },
          { status: 400 }
        );
      }
      taxRate = await getTaxRateByZipCode(zipCode);
      usedState = 'Unknown'; // 会在calculateTax中推断
    }
    
    // 计算税费
    const taxCalculation = await calculateTax(subtotal, usedState, taxRate);

    return NextResponse.json({
      success: true,
      ...taxCalculation,
      method: state ? 'state-based' : 'zip-based',
      api_used: 'prepared-food-rates'
    });

  } catch (error) {
    console.error('Tax calculation error:', error);
    return NextResponse.json(
      { 
        error: 'Tax calculation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const zipCode = searchParams.get('zip');
  const state = searchParams.get('state');

  if (!zipCode && !state) {
    return NextResponse.json(
      { error: 'Either zip code or state parameter is required' },
      { status: 400 }
    );
  }

  try {
    let taxRate;
    let method;
    let identifier;

    if (state) {
      // 优先使用州查询
      taxRate = await getTaxRateByState(state);
      method = 'state-based';
      identifier = state.toUpperCase();
    } else if (zipCode) {
      // 向后兼容ZIP code查询
      taxRate = await getTaxRateByZipCode(zipCode);
      method = 'zip-based';
      identifier = zipCode;
    }
    
    return NextResponse.json({
      success: true,
      identifier: identifier,
      tax_rate: taxRate?.total_rate || 0,
      percentage: `${((taxRate?.total_rate || 0) * 100).toFixed(2)}%`,
      method: method,
      api_used: 'prepared-food-rates'
    });

  } catch (error) {
    console.error('Tax rate lookup error:', error);
    return NextResponse.json(
      { 
        error: 'Tax rate lookup failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
