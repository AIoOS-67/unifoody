'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { OrderSummary } from '@/components/payment/OrderSummary';
import { ExpressCheckout } from '@/components/payment/ExpressCheckout';
import { CryptoCheckout } from '@/components/payment/CryptoCheckout';
import { supabase } from '@/lib/supabase';

interface Restaurant {
  id: string;
  name: string;
  address: string;
  wallet_address: string;
  state: string;
  zip_code: string;
  stripe_account_id?: string;
}

// US state tax rates (imported inline for client component)
const STATE_TAX_RATES: Record<string, number> = {
  NY: 0.08875, CA: 0.1025, TX: 0.0825, FL: 0.08, IL: 0.1025,
  NJ: 0.06625, PA: 0.08, GA: 0.08, OH: 0.08, WA: 0.106,
  CO: 0.08, VA: 0.07, MA: 0.0625, CT: 0.0635, OR: 0.0,
  NH: 0.0, DE: 0.0, MT: 0.0, AK: 0.0,
};
const DEFAULT_TAX_RATE = 0.0725;

export default function PaymentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { t } = useTranslation('payment');

  const restaurantId = params.restaurantId as string;
  const amountParam = searchParams.get('amount');
  const orderParam = searchParams.get('order');
  const tableParam = searchParams.get('table');
  const sourceParam = searchParams.get('source'); // 'nfc' | 'qr' | null

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<'fiat' | 'crypto' | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Amount state — allow manual entry if not in URL
  const [subtotal, setSubtotal] = useState<number>(
    amountParam ? parseFloat(amountParam) : 0
  );
  const [manualAmount, setManualAmount] = useState<string>(
    amountParam || ''
  );

  // FOODY conversion state
  const [foodyAmount, setFoodyAmount] = useState<number>(0);
  const [foodyRewardEstimate, setFoodyRewardEstimate] = useState<number>(0);

  // Calculate tax
  const taxRate = restaurant
    ? STATE_TAX_RATES[restaurant.state?.toUpperCase()] || DEFAULT_TAX_RATE
    : DEFAULT_TAX_RATE;
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  // Load restaurant data
  useEffect(() => {
    const loadRestaurant = async () => {
      try {
        const { data, error: dbError } = await supabase
          .from('restaurants')
          .select('id, name, address, wallet_address, state, zip_code, stripe_account_id')
          .eq('id', restaurantId)
          .single();

        if (dbError || !data) {
          setError(t('restaurantNotFound', 'Restaurant not found'));
          return;
        }

        setRestaurant(data);
      } catch (err) {
        console.error('Error loading restaurant:', err);
        setError(t('loadError', 'Failed to load restaurant'));
      } finally {
        setLoading(false);
      }
    };

    loadRestaurant();
  }, [restaurantId, t]);

  // Load FOODY conversion when total changes
  useEffect(() => {
    if (total <= 0) return;

    const loadFoodyConversion = async () => {
      try {
        const res = await fetch('/api/foody-convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amountUSD: total }),
        });
        if (res.ok) {
          const data = await res.json();
          setFoodyAmount(data.foodyAmount || 0);
        }
      } catch {
        // Fallback: use approximate rate
        setFoodyAmount(Math.round(total * 8300));
      }
    };

    const loadRewardEstimate = async () => {
      try {
        // Simple 2% estimate
        const estimate = Math.round(total * 8300 * 0.02);
        setFoodyRewardEstimate(estimate);
      } catch {
        setFoodyRewardEstimate(0);
      }
    };

    loadFoodyConversion();
    loadRewardEstimate();
  }, [total]);

  const handleAmountSubmit = () => {
    const amount = parseFloat(manualAmount);
    if (isNaN(amount) || amount < 0.5) {
      setPaymentError(t('minAmount', 'Minimum amount is $0.50'));
      return;
    }
    setSubtotal(amount);
    setPaymentError(null);
  };

  const handleFiatSuccess = (paymentIntentId: string, method: string) => {
    setPaymentSuccess(true);
  };

  const handleCryptoSuccess = (txHash: string) => {
    setPaymentSuccess(true);
  };

  const handlePaymentError = (err: string) => {
    setPaymentError(err);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400">{t('loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !restaurant) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-4xl">❌</div>
          <h1 className="text-xl font-bold">{error || t('restaurantNotFound', 'Restaurant not found')}</h1>
          <p className="text-gray-400">{t('checkUrl', 'Please check the URL and try again')}</p>
        </div>
      </div>
    );
  }

  // Success state
  if (paymentSuccess) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-6xl">✅</div>
          <h1 className="text-2xl font-bold text-green-400">
            {t('paymentSuccess', 'Payment Successful!')}
          </h1>
          <p className="text-gray-400">
            {t('thankYou', 'Thank you for paying at {{name}}', {
              name: restaurant.name,
            })}
          </p>
          <p className="text-xl font-semibold">${total.toFixed(2)}</p>
          {foodyRewardEstimate > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-yellow-400 font-medium">
                🎁 {t('rewardEarned', 'You earned ~{{amount}} FOODY!', {
                  amount: foodyRewardEstimate.toLocaleString(),
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const orderId = orderParam || `ORD-${Date.now()}`;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* FoodyePay Logo */}
        <div className="text-center py-2">
          <h1 className="text-xl font-bold">
            <span className="text-purple-400">Foodye</span>
            <span className="text-blue-400">Pay</span>
          </h1>
          {sourceParam === 'nfc' && (
            <p className="text-xs text-gray-500 mt-1">📶 NFC Tap to Pay</p>
          )}
        </div>

        {/* Order Summary */}
        {subtotal > 0 ? (
          <OrderSummary
            restaurantName={restaurant.name}
            restaurantAddress={restaurant.address}
            subtotal={subtotal}
            taxRate={taxRate}
            taxAmount={taxAmount}
            total={total}
            orderId={orderParam || undefined}
            tableNumber={tableParam || undefined}
            foodyRewardEstimate={foodyRewardEstimate}
          />
        ) : (
          /* Manual Amount Entry */
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-4">
            <div className="text-center">
              <h2 className="text-white font-bold text-lg">{restaurant.name}</h2>
              {restaurant.address && (
                <p className="text-gray-400 text-sm">{restaurant.address}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400">
                {t('enterAmount', 'Enter payment amount')}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    $
                  </span>
                  <input
                    type="number"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0.50"
                    className="w-full pl-8 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={handleAmountSubmit}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                >
                  {t('continue', 'Continue')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment Methods — only show when we have an amount */}
        {subtotal > 0 && total > 0 && (
          <>
            {/* Fiat Payment: Apple Pay / Google Pay / Card */}
            {restaurant.stripe_account_id && (
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-3">
                <h3 className="text-white font-semibold text-sm">
                  {t('payWith', 'Pay with')}
                </h3>
                <ExpressCheckout
                  restaurantId={restaurant.id}
                  amountUSD={total}
                  orderId={orderId}
                  table={tableParam || undefined}
                  onSuccess={handleFiatSuccess}
                  onError={handlePaymentError}
                />
              </div>
            )}

            {/* Separator */}
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-zinc-800" />
              <span className="text-xs text-gray-500">
                {t('orPayCrypto', 'or pay with crypto')}
              </span>
              <div className="flex-1 border-t border-zinc-800" />
            </div>

            {/* Crypto Payment: FOODY */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
              <CryptoCheckout
                restaurantId={restaurant.id}
                restaurantWallet={restaurant.wallet_address}
                restaurantName={restaurant.name}
                amountUSD={total}
                foodyAmount={foodyAmount}
                orderId={orderId}
                foodyRewardEstimate={foodyRewardEstimate}
                onSuccess={handleCryptoSuccess}
                onError={handlePaymentError}
              />
            </div>
          </>
        )}

        {/* Error Display */}
        {paymentError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-red-400 text-sm">{paymentError}</p>
            <button
              onClick={() => setPaymentError(null)}
              className="text-red-400/60 text-xs mt-1 hover:text-red-400"
            >
              {t('dismiss', 'Dismiss')}
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-600">
            {t('poweredBy', 'Powered by')} <span className="text-purple-400">FoodyePay</span>
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {t('securePayment', 'Secure payment processing by Stripe')}
          </p>
        </div>
      </div>
    </div>
  );
}
