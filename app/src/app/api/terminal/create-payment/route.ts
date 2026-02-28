// app/api/terminal/create-payment/route.ts
// Creates a PaymentIntent specifically for Stripe Terminal (in-person) payments.

import { NextRequest, NextResponse } from 'next/server';
import { getStripe, calculatePlatformFee } from '@/lib/stripe';
import pool from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { restaurantId, amountUSD, orderId } = await request.json();

    if (!restaurantId || !amountUSD) {
      return NextResponse.json(
        { error: 'Missing required fields: restaurantId, amountUSD' },
        { status: 400 }
      );
    }

    // Look up restaurant
    const result = await pool.query(
      'SELECT id, name, stripe_account_id FROM restaurants WHERE id = $1',
      [restaurantId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      );
    }

    const restaurant = result.rows[0];

    if (!restaurant.stripe_account_id) {
      return NextResponse.json(
        { error: 'Restaurant has not completed Stripe onboarding' },
        { status: 400 }
      );
    }

    const amountCents = Math.round(amountUSD * 100);
    const platformFeeCents = calculatePlatformFee(amountCents);
    const stripe = getStripe();

    // Create PaymentIntent for Terminal (card_present)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      payment_method_types: ['card_present'],
      capture_method: 'automatic',
      application_fee_amount: platformFeeCents,
      transfer_data: {
        destination: restaurant.stripe_account_id,
      },
      metadata: {
        orderId: orderId || `POS-${Date.now()}`,
        restaurantId,
        restaurantName: restaurant.name,
        source: 'foodyepay_terminal',
      },
    });

    // Record in fiat_payments
    await pool.query(
      `INSERT INTO fiat_payments (
        restaurant_id, stripe_payment_intent_id, amount_usd,
        platform_fee_usd, restaurant_payout_usd, payment_method,
        status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (stripe_payment_intent_id) DO NOTHING`,
      [
        restaurantId,
        paymentIntent.id,
        amountUSD,
        platformFeeCents / 100,
        (amountCents - platformFeeCents) / 100,
        'terminal',
        'pending',
        JSON.stringify({ orderId: orderId || paymentIntent.metadata.orderId }),
      ]
    );

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err: any) {
    console.error('[Terminal] Create payment error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create terminal payment' },
      { status: 500 }
    );
  }
}
