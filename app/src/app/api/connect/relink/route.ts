// app/api/connect/relink/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const clientBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const refreshPath = '/register/connect/refresh';
const returnPath = '/register/connect/return';

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' }) : (null as any);

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  try {
    const { accountId } = await req.json();
    if (!accountId) return NextResponse.json({ error: 'Missing accountId' }, { status: 400 });

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${clientBaseUrl}${refreshPath}?account=${accountId}`,
      return_url: `${clientBaseUrl}${returnPath}?account=${accountId}`,
      type: 'account_onboarding'
    });
    return NextResponse.json({ onboardingUrl: link.url });
  } catch (err: any) {
    console.error('Connect relink error:', err);
    return NextResponse.json({ error: err.message || 'Relink failed' }, { status: 500 });
  }
}
