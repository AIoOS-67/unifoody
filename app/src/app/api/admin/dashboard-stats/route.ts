// app/api/admin/dashboard-stats/route.ts
// Platform Admin Dashboard — aggregated stats across all tables
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

function getPeriodStart(period: string): string {
  const now = new Date();
  switch (period) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d.toISOString();
    }
    case 'month': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      return d.toISOString();
    }
    default:
      return '1970-01-01T00:00:00Z';
  }
}

export async function GET(request: NextRequest) {
  try {
    // Admin auth (same pattern as reward-stats)
    const adminKey = process.env.ADMIN_API_KEY;
    const authHeader = request.headers.get('authorization');
    if (!adminKey || !authHeader || authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all';
    const periodStart = getPeriodStart(period);
    const isAll = period === 'all';

    // Run all queries in parallel
    const [
      restaurantsRes,
      dinersRes,
      ordersRes,
      paymentsRes,
      fiatMethodsRes,
      foodyRes,
      avosCallsRes,
      avosLangRes,
      topRestaurantsRes,
      recentOrdersRes,
      dinerStatsRes,
      dailyVolumeRes,
      rewardsRes,
      avosOrdersRes,
    ] = await Promise.all([
      // 1. Restaurant count
      pool.query(`
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int as new_this_week,
          COUNT(*) FILTER (WHERE business_verified = true)::int as verified
        FROM restaurants
      `),

      // 2. Diner count
      pool.query(`
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int as new_this_week
        FROM diners
      `),

      // 3. Orders summary
      pool.query(
        `SELECT
          COUNT(*)::int as total_orders,
          COALESCE(SUM(total), 0)::float as gmv,
          COALESCE(AVG(total), 0)::float as avg_order_value,
          COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
          COUNT(*) FILTER (WHERE status = 'pending')::int as pending
        FROM orders
        WHERE ($1::boolean OR created_at >= $2::timestamptz)`,
        [isAll, periodStart],
      ),

      // 4. Payments summary
      pool.query(
        `SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status = 'succeeded')::int as successful,
          COALESCE(SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END), 0)::float as total_volume
        FROM payments
        WHERE ($1::boolean OR created_at >= $2::timestamptz)`,
        [isAll, periodStart],
      ),

      // 5. Fiat payment methods breakdown
      pool.query(`
        SELECT payment_method, COUNT(*)::int as count, COALESCE(SUM(amount_usd), 0)::float as volume
        FROM fiat_payments
        WHERE status = 'succeeded'
        GROUP BY payment_method
        ORDER BY volume DESC
      `).catch(() => ({ rows: [] })),

      // 6. FOODY token purchases
      pool.query(`
        SELECT
          COUNT(*)::int as total_purchases,
          COALESCE(SUM(foody_amount), 0)::float as total_foody_purchased,
          COALESCE(SUM(amount_usdt), 0)::float as total_usdt_spent
        FROM foody_orders
      `).catch(() => ({ rows: [{ total_purchases: 0, total_foody_purchased: 0, total_usdt_spent: 0 }] })),

      // 7. AVOS call stats
      pool.query(
        `SELECT
          COUNT(*)::int as total_calls,
          COUNT(*) FILTER (WHERE call_status = 'completed')::int as completed_calls,
          COALESCE(AVG(duration_seconds), 0)::float as avg_duration,
          COUNT(DISTINCT language)::int as language_count
        FROM avos_calls
        WHERE ($1::boolean OR started_at >= $2::timestamptz)`,
        [isAll, periodStart],
      ).catch(() => ({ rows: [{ total_calls: 0, completed_calls: 0, avg_duration: 0, language_count: 0 }] })),

      // 8. AVOS language distribution
      pool.query(`
        SELECT language, COUNT(*)::int as count
        FROM avos_calls
        GROUP BY language
        ORDER BY count DESC
      `).catch(() => ({ rows: [] })),

      // 9. Top restaurants by revenue
      pool.query(`
        SELECT
          r.id, r.name, r.wallet_address, r.business_verified, r.phone_verified, r.created_at,
          COUNT(o.id)::int as order_count,
          COALESCE(SUM(o.total), 0)::float as total_revenue
        FROM restaurants r
        LEFT JOIN orders o ON o.restaurant_id = r.id
        GROUP BY r.id
        ORDER BY total_revenue DESC
        LIMIT 50
      `),

      // 10. Recent orders
      pool.query(`
        SELECT
          o.id, o.restaurant_id, o.diner_id, o.items, o.subtotal, o.tax, o.total,
          o.status, o.created_at,
          r.name as restaurant_name
        FROM orders o
        LEFT JOIN restaurants r ON r.id = o.restaurant_id
        ORDER BY o.created_at DESC
        LIMIT 50
      `).catch(() => ({ rows: [] })),

      // 11. Diner stats
      pool.query(`
        SELECT
          d.id, d.first_name, d.last_name, d.email, d.wallet_address, d.state, d.created_at,
          COUNT(DISTINCT o.id)::int as order_count,
          COALESCE(SUM(o.total), 0)::float as total_spent
        FROM diners d
        LEFT JOIN orders o ON o.diner_id = d.id
        GROUP BY d.id
        ORDER BY total_spent DESC
        LIMIT 100
      `).catch(() => ({ rows: [] })),

      // 12. Daily payment volume (last 14 days)
      pool.query(`
        SELECT
          DATE(created_at)::text as day,
          COUNT(*)::int as count,
          COALESCE(SUM(amount), 0)::float as volume
        FROM payments
        WHERE created_at >= NOW() - INTERVAL '14 days' AND status = 'succeeded'
        GROUP BY DATE(created_at)
        ORDER BY day ASC
      `).catch(() => ({ rows: [] })),

      // 13. Reward stats
      pool.query(`
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
          COUNT(*) FILTER (WHERE status = 'pending')::int as pending,
          COALESCE(SUM(reward_amount), 0)::float as total_distributed
        FROM diner_rewards
      `).catch(() => ({ rows: [{ total: 0, completed: 0, pending: 0, total_distributed: 0 }] })),

      // 14. AVOS orders revenue
      pool.query(`
        SELECT
          COUNT(*)::int as total,
          COALESCE(SUM(total_usd), 0)::float as revenue,
          COALESCE(SUM(foody_amount), 0)::float as foody_collected
        FROM avos_orders
      `).catch(() => ({ rows: [{ total: 0, revenue: 0, foody_collected: 0 }] })),
    ]);

    // Build response
    const rRow = restaurantsRes.rows[0];
    const dRow = dinersRes.rows[0];
    const oRow = ordersRes.rows[0];
    const pRow = paymentsRes.rows[0];
    const fRow = foodyRes.rows[0];
    const aRow = avosCallsRes.rows[0];
    const rwRow = rewardsRes.rows[0];
    const aoRow = avosOrdersRes.rows[0];

    const paymentTotal = pRow.total || 1;
    const successRate = ((pRow.successful / paymentTotal) * 100);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      period,
      overview: {
        restaurants: { total: rRow.total, new_this_week: rRow.new_this_week, verified: rRow.verified },
        diners: { total: dRow.total, new_this_week: dRow.new_this_week },
        orders: {
          total: oRow.total_orders,
          gmv: oRow.gmv,
          avg_order_value: oRow.avg_order_value,
          completed: oRow.completed,
          pending: oRow.pending,
        },
        payments: {
          total: pRow.total,
          successful: pRow.successful,
          total_volume: pRow.total_volume,
          success_rate: successRate,
        },
        foody: {
          total_purchases: fRow.total_purchases,
          total_foody_purchased: fRow.total_foody_purchased,
          total_usdt_spent: fRow.total_usdt_spent,
        },
        avos: {
          total_calls: aRow.total_calls,
          completed_calls: aRow.completed_calls,
          avg_duration: Math.round(aRow.avg_duration),
          language_count: aRow.language_count,
        },
        rewards: {
          total: rwRow.total,
          completed: rwRow.completed,
          pending: rwRow.pending,
          total_distributed: rwRow.total_distributed,
        },
      },
      restaurants: topRestaurantsRes.rows,
      diners: dinerStatsRes.rows,
      recentOrders: recentOrdersRes.rows,
      paymentMethods: fiatMethodsRes.rows,
      dailyVolume: dailyVolumeRes.rows,
      avosLanguages: avosLangRes.rows,
      avosOrders: { total: aoRow.total, revenue: aoRow.revenue, foody_collected: aoRow.foody_collected },
    });
  } catch (error) {
    console.error('Admin dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Failed to load dashboard stats', details: String(error) },
      { status: 500 },
    );
  }
}
