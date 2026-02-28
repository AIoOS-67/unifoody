// app/api/connect/start/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
export const runtime = 'nodejs';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const clientBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL || 'http://localhost:3000';
const refreshPath = '/register/connect/refresh';
const returnPath = '/register/connect/return';

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' }) : (null as any);

export async function POST(req: NextRequest) {
  if (!stripeSecretKey || !stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  try {
    const { email, restaurantName } = await req.json();
    // Create or reuse a connected account (Express)
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      business_type: 'company',
      metadata: { restaurantName: restaurantName || '' }
    });

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${clientBaseUrl}${refreshPath}?account=${account.id}`,
      return_url: `${clientBaseUrl}${returnPath}?account=${account.id}`,
      type: 'account_onboarding'
    });

    return NextResponse.json({ accountId: account.id, onboardingUrl: accountLink.url });
  } catch (err: any) {
    console.error('Connect start error:', err);
    return NextResponse.json({ error: err.message || 'Connect start failed' }, { status: 500 });
  }
}
