import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import pool from '@/lib/db';

// Configure VAPID
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:push@foodyepay.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Map notification type to preference column
const prefColumnMap: Record<string, string> = {
  order_update: 'notify_order_updates',
  payment_confirmation: 'notify_payment_confirmations',
  promotion: 'notify_promotions',
  foody_reward: 'notify_foody_rewards',
};

export async function POST(request: NextRequest) {
  try {
    const { userId, userRole, notificationType, title, body, url, tag } =
      await request.json();

    if (!userId || !userRole || !notificationType) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: userId, userRole, notificationType',
        },
        { status: 400 }
      );
    }

    const col = prefColumnMap[notificationType];
    if (!col) {
      return NextResponse.json(
        { error: `Invalid notification type: ${notificationType}` },
        { status: 400 }
      );
    }

    // Get subscriptions that have this notification type enabled
    const result = await pool.query(
      `SELECT endpoint, p256dh, auth, locale FROM push_subscriptions
       WHERE user_id = $1 AND user_role = $2 AND "${col}" = true`,
      [userId, userRole]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, message: 'No subscriptions found' });
    }

    const sent: string[] = [];
    const failed: { endpoint: string; error: string }[] = [];

    for (const sub of result.rows) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };

      try {
        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify({ title, body, url, tag })
        );
        sent.push(sub.endpoint);
      } catch (err: any) {
        // 410 Gone or 404 — subscription expired, remove it
        if (err.statusCode === 410 || err.statusCode === 404) {
          await pool.query(
            'DELETE FROM push_subscriptions WHERE endpoint = $1',
            [sub.endpoint]
          );
        }
        failed.push({ endpoint: sub.endpoint, error: err.message });
      }
    }

    return NextResponse.json({ sent: sent.length, failed: failed.length });
  } catch (err: any) {
    console.error('[Push] Send error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
