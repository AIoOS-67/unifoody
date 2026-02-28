// app/api/connect/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
export const runtime = 'nodejs';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' }) : (null as any);

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  try {
    const { accountId } = await req.json();
    const account = await stripe.accounts.retrieve(accountId);
    const requirements = (account as any).requirements || {};
    const verification_status = account.details_submitted
      ? (requirements.disabled_reason ? 'needs_more_info' : 'verified')
      : 'pending';
    return NextResponse.json({
      account,
      verification_status,
      requirements_currently_due: requirements.currently_due || [],
      requirements_eventually_due: requirements.eventually_due || []
    });
  } catch (err: any) {
    console.error('Connect status error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch status' }, { status: 500 });
  }
}
