'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Elements,
  ExpressCheckoutElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import type { StripeExpressCheckoutElementConfirmEvent } from '@stripe/stripe-js';
import { getStripePromise } from '@/lib/stripeClient';

interface ExpressCheckoutProps {
  restaurantId: string;
  amountUSD: number;
  orderId?: string;
  table?: string;
  onSuccess: (paymentIntentId: string, paymentMethod: string) => void;
  onError: (error: string) => void;
}

function CheckoutForm({
  restaurantId,
  amountUSD,
  orderId,
  table,
  onSuccess,
  onError,
}: ExpressCheckoutProps) {
  const { t } = useTranslation('payment');
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleConfirm = useCallback(
    async (event: StripeExpressCheckoutElementConfirmEvent) => {
      if (!stripe || !elements) {
        onError('Stripe not loaded');
        return;
      }

      setProcessing(true);

      try {
        // 1. Create PaymentIntent on server
        const res = await fetch('/api/payments/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantId,
            amountUSD,
            orderId,
            table,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to create payment');
        }

        const { clientSecret, paymentIntentId } = await res.json();

        // 2. Confirm payment with Stripe
        const { error } = await stripe.confirmPayment({
          elements,
          clientSecret,
          confirmParams: {
            return_url: `${window.location.origin}${window.location.pathname}/success?pi=${paymentIntentId}`,
          },
        });

        if (error) {
          // Payment failed or was cancelled
          if (error.type === 'card_error' || error.type === 'validation_error') {
            onError(error.message || 'Payment failed');
          } else {
            onError('An unexpected error occurred');
          }
        } else {
          // Payment redirect will happen automatically
          onSuccess(paymentIntentId, 'card');
        }
      } catch (err: any) {
        console.error('[ExpressCheckout] Error:', err);
        onError(err.message || 'Payment failed');
      } finally {
        setProcessing(false);
      }
    },
    [stripe, elements, restaurantId, amountUSD, orderId, table, onSuccess, onError]
  );

  return (
    <div className="space-y-3">
      <ExpressCheckoutElement
        onConfirm={handleConfirm}
        options={{
          buttonType: {
            applePay: 'pay',
            googlePay: 'pay',
          },
        }}
      />
      {processing && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          {t('processing', 'Processing payment...')}
        </div>
      )}
    </div>
  );
}

export function ExpressCheckout(props: ExpressCheckoutProps) {
  const amountCents = Math.round(props.amountUSD * 100);

  return (
    <Elements
      stripe={getStripePromise()}
      options={{
        mode: 'payment',
        amount: amountCents,
        currency: 'usd',
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#3b82f6',
            colorBackground: '#18181b',
            colorText: '#ffffff',
            colorDanger: '#ef4444',
            borderRadius: '8px',
          },
        },
      }}
    >
      <CheckoutForm {...props} />
    </Elements>
  );
}
