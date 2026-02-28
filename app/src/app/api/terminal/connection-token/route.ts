// app/api/terminal/connection-token/route.ts
// Generates a Stripe Terminal ConnectionToken for POS reader authentication.

import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripe();

    const connectionToken = await stripe.terminal.connectionTokens.create();

    return NextResponse.json({ secret: connectionToken.secret });
  } catch (err: any) {
    console.error('[Terminal] Connection token error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create connection token' },
      { status: 500 }
    );
  }
}
