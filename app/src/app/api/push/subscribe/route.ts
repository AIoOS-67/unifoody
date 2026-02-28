import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { subscription, userId, userRole, locale, preferences } =
      await request.json();

    if (!subscription?.endpoint || !userId || !userRole) {
      return NextResponse.json(
        { error: 'Missing required fields: subscription, userId, userRole' },
        { status: 400 }
      );
    }

    const { endpoint, keys } = subscription;

    if (!keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: 'Missing subscription keys' },
        { status: 400 }
      );
    }

    await pool.query(
      `INSERT INTO push_subscriptions (
        user_id, user_role, endpoint, p256dh, auth, locale,
        notify_order_updates, notify_payment_confirmations,
        notify_promotions, notify_foody_rewards
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (endpoint) DO UPDATE SET
        p256dh = $4, auth = $5, locale = $6,
        notify_order_updates = $7, notify_payment_confirmations = $8,
        notify_promotions = $9, notify_foody_rewards = $10,
        updated_at = now()`,
      [
        userId,
        userRole,
        endpoint,
        keys.p256dh,
        keys.auth,
        locale || 'en',
        preferences?.orderUpdates ?? true,
        preferences?.paymentConfirmations ?? true,
        preferences?.promotions ?? true,
        preferences?.foodyRewards ?? true,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Push] Subscribe error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Missing endpoint' },
        { status: 400 }
      );
    }

    await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [
      endpoint,
    ]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Push] Unsubscribe error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
