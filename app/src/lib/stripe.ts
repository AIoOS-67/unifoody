// lib/stripe.ts — Server-side Stripe singleton
// Shared by Connect routes AND Payment routes

import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeInstance) return stripeInstance;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('[Stripe] STRIPE_SECRET_KEY is not configured');
  }

  stripeInstance = new Stripe(secretKey, {
    apiVersion: '2024-06-20',
    appInfo: {
      name: 'FoodyePay',
      version: '2.0.0',
      url: 'https://foodyepay.com',
    },
  });

  return stripeInstance;
}

// Platform fee configuration
export const PLATFORM_FEE_PERCENT = parseFloat(
  process.env.FOODYEPAY_PLATFORM_FEE_PERCENT || '2.5'
);

/**
 * Calculate platform fee in cents from total amount in cents
 */
export function calculatePlatformFee(amountCents: number): number {
  return Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100));
}
