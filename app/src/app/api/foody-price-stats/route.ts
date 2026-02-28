// app/api/foody-price-stats/route.ts
import { NextResponse } from 'next/server';
import { getPriceStats, resetPriceStats } from '@/lib/foodyTokenService';

export async function GET() {
  try {
    const stats = getPriceStats();
    
    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        uptime_minutes: Math.floor((Date.now() - (stats.last_price_update || Date.now())) / 60000),
        cache_hit_rate_formatted: `${stats.cache_hit_rate.toFixed(1)}%`
      },
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Price stats lookup error:', error);
    return NextResponse.json(
      { 
        error: 'Stats lookup failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    resetPriceStats();
    
    return NextResponse.json({
      success: true,
      message: 'Price statistics reset successfully',
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Price stats reset error:', error);
    return NextResponse.json(
      { 
        error: 'Stats reset failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
