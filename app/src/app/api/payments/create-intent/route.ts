// app/api/payments/create-intent/route.ts
// Creates a Stripe PaymentIntent with Destination Charge to the restaurant's
// connected Express account. Used by Apple Pay, Google Pay, and Card payments.

import { NextRequest, NextResponse } from 'next/server';
import { getStripe, calculatePlatformFee } from '@/lib/stripe';
import pool from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { restaurantId, amountUSD, orderId, table, customerEmail } =
      await request.json();

    // Validate required fields
    if (!restaurantId || !amountUSD) {
      return NextResponse.json(
        { error: 'Missing required fields: restaurantId, amountUSD' },
        { status: 400 }
      );
    }

    if (amountUSD < 0.5) {
      return NextResponse.json(
        { error: 'Minimum payment amount is $0.50' },
        { status: 400 }
      );
    }

    // Look up restaurant and its Stripe connected account
    const result = await pool.query(
      'SELECT id, name, stripe_account_id, state, zip_code FROM restaurants WHERE id = $1',
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

    // Convert to cents
    const amountCents = Math.round(amountUSD * 100);
    const platformFeeCents = calculatePlatformFee(amountCents);

    const stripe = getStripe();

    // Create PaymentIntent with Destination Charge
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      application_fee_amount: platformFeeCents,
      transfer_data: {
        destination: restaurant.stripe_account_id,
      },
      metadata: {
        orderId: orderId || `ORD-${Date.now()}`,
        restaurantId,
        restaurantName: restaurant.name,
        table: table || '',
        source: 'foodyepay_tap_to_pay',
      },
      ...(customerEmail && { receipt_email: customerEmail }),
    });

    // Create preliminary fiat_payments record
    const orderIdFinal = orderId || paymentIntent.metadata.orderId;

    await pool.query(
      `INSERT INTO fiat_payments (
        restaurant_id, stripe_payment_intent_id, amount_usd,
        platform_fee_usd, restaurant_payout_usd, payment_method,
        status, customer_email, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (stripe_payment_intent_id) DO NOTHING`,
      [
        restaurantId,
        paymentIntent.id,
        amountUSD,
        platformFeeCents / 100,
        (amountCents - platformFeeCents) / 100,
        'pending', // Will be updated by webhook with actual method
        'pending',
        customerEmail || null,
        JSON.stringify({ orderId: orderIdFinal, table }),
      ]
    );

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amountCents,
      platformFeeCents,
      restaurantName: restaurant.name,
    });
  } catch (err: any) {
    console.error('[Payments] Create intent error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}
