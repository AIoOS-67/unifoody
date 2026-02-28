// app/api/payments/webhook/route.ts
// Handles Stripe payment webhooks for fiat payments (Apple Pay, Google Pay, Card, Terminal).
// Updates fiat_payments + orders tables, triggers FOODY rewards and push notifications.

import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import pool from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_PAYMENTS;

  if (!webhookSecret) {
    console.warn('[Webhook] STRIPE_WEBHOOK_SECRET_PAYMENTS not configured');
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error('[Webhook] Signature verification failed:', err.message);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as any;
        console.log(`[Webhook] Payment succeeded: ${pi.id} ($${pi.amount / 100})`);

        // Determine payment method type
        let paymentMethod = 'card';
        if (pi.payment_method_types?.includes('apple_pay') ||
            pi.charges?.data?.[0]?.payment_method_details?.type === 'card_present') {
          // Try to detect Apple Pay / Google Pay from the charge
          const wallet = pi.charges?.data?.[0]?.payment_method_details?.card?.wallet?.type;
          if (wallet === 'apple_pay') paymentMethod = 'apple_pay';
          else if (wallet === 'google_pay') paymentMethod = 'google_pay';
        }

        // Update fiat_payments record
        await pool.query(
          `UPDATE fiat_payments SET
            status = 'succeeded',
            payment_method = $1,
            stripe_charge_id = $2,
            updated_at = now()
          WHERE stripe_payment_intent_id = $3`,
          [
            paymentMethod,
            pi.latest_charge || null,
            pi.id,
          ]
        );

        // Create/update order record
        const metadata = pi.metadata || {};
        const orderId = metadata.orderId;
        const restaurantId = metadata.restaurantId;

        if (orderId && restaurantId) {
          // Check if order exists
          const existingOrder = await pool.query(
            'SELECT id FROM orders WHERE id = $1',
            [orderId]
          );

          if (existingOrder.rows.length === 0) {
            // Create new order
            await pool.query(
              `INSERT INTO orders (
                id, restaurant_id, status, order_number,
                total_amount, payment_method,
                stripe_payment_intent_id, restaurant_name, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
              ON CONFLICT (id) DO UPDATE SET
                status = 'completed',
                payment_method = $6,
                stripe_payment_intent_id = $7`,
              [
                orderId,
                restaurantId,
                'completed',
                orderId,
                pi.amount / 100,
                paymentMethod,
                pi.id,
                metadata.restaurantName || '',
              ]
            );
          } else {
            await pool.query(
              `UPDATE orders SET
                status = 'completed',
                payment_method = $1,
                stripe_payment_intent_id = $2
              WHERE id = $3`,
              [paymentMethod, pi.id, orderId]
            );
          }
        }

        // Trigger push notification to restaurant (async, non-blocking)
        try {
          if (restaurantId) {
            const restaurantResult = await pool.query(
              'SELECT wallet_address FROM restaurants WHERE id = $1',
              [restaurantId]
            );
            if (restaurantResult.rows.length > 0) {
              // Find restaurant's push subscription and notify
              await fetch(
                `${process.env.NEXT_PUBLIC_BASE_URL || 'https://foodyepay.com'}/api/push/send`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    userId: restaurantId,
                    userRole: 'restaurant',
                    notificationType: 'payment_confirmation',
                    title: 'Payment Received! 💰',
                    body: `$${(pi.amount / 100).toFixed(2)} via ${paymentMethod.replace('_', ' ')}`,
                    url: '/dashboard-restaurant',
                  }),
                }
              ).catch(() => {}); // Don't fail if push fails
            }
          }
        } catch (pushErr) {
          console.warn('[Webhook] Push notification failed:', pushErr);
        }

        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as any;
        console.log(`[Webhook] Payment failed: ${pi.id}`);

        await pool.query(
          `UPDATE fiat_payments SET
            status = 'failed',
            updated_at = now()
          WHERE stripe_payment_intent_id = $1`,
          [pi.id]
        );
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as any;
        console.log(`[Webhook] Charge refunded: ${charge.id}`);

        await pool.query(
          `UPDATE fiat_payments SET
            status = 'refunded',
            updated_at = now()
          WHERE stripe_charge_id = $1`,
          [charge.id]
        );
        break;
      }

      default:
        // Unhandled event type
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('[Webhook] Processing error:', err);
    return NextResponse.json(
      { error: err.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
