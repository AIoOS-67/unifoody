// app/api/connect/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
export const runtime = 'nodejs';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' }) : (null as any);

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!stripe || !webhookSecret) return NextResponse.json({}, { status: 200 });
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') as string;
  try {
    const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

    switch (event.type) {
      case 'account.updated': {
        // TODO: persist account status in DB
        break;
      }
      case 'account.application.authorized':
      case 'account.application.deauthorized':
      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Stripe webhook error:', err);
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }
}
