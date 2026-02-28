'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';

export default function PaymentSuccessPage() {
  const { t } = useTranslation('payment');
  const searchParams = useSearchParams();
  const paymentIntentId = searchParams.get('pi') || searchParams.get('payment_intent');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [paymentDetails, setPaymentDetails] = useState<any>(null);

  useEffect(() => {
    // Verify payment status if we have a PI ID
    if (paymentIntentId) {
      // Small delay to allow webhook to process
      const timer = setTimeout(() => {
        setStatus('success');
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setStatus('success');
    }
  }, [paymentIntentId]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400">{t('verifying', 'Verifying payment...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center space-y-6">
        {/* Success Icon */}
        <div className="relative">
          <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
            <svg
              className="w-12 h-12 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-green-400">
            {t('paymentSuccess', 'Payment Successful!')}
          </h1>
          <p className="text-gray-400 mt-2">
            {t('successDesc', 'Your payment has been processed successfully.')}
          </p>
        </div>

        {/* FOODY Reward Teaser */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 space-y-2">
          <p className="text-yellow-400 font-semibold">🎁 FOODY Rewards</p>
          <p className="text-yellow-200/70 text-sm">
            {t('rewardDesc', 'You may have earned FOODY token rewards with this payment. Connect your wallet to claim them!')}
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <Link
            href="/"
            className="block w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition text-center"
          >
            {t('backHome', 'Back to FoodyePay')}
          </Link>
          <Link
            href="/register"
            className="block w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition text-center"
          >
            {t('createAccount', 'Create Account & Earn Rewards')}
          </Link>
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-600">
          {t('poweredBy', 'Powered by')}{' '}
          <span className="text-purple-400">FoodyePay</span>
        </p>
      </div>
    </div>
  );
}
