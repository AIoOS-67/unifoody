'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { POSTerminal } from '@/components/restaurant/POSTerminal';
import Link from 'next/link';

interface Restaurant {
  id: string;
  name: string;
  wallet_address: string;
  stripe_account_id?: string;
}

export default function POSPage() {
  const { t } = useTranslation('payment');
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected || !address) {
      router.push('/');
      return;
    }

    const loadRestaurant = async () => {
      try {
        const { data, error: dbError } = await supabase
          .from('restaurants')
          .select('id, name, wallet_address, stripe_account_id')
          .eq('wallet_address', address.toLowerCase())
          .single();

        if (dbError || !data) {
          setError(t('restaurantNotFound', 'Restaurant not found'));
          return;
        }

        setRestaurant(data);
      } catch (err) {
        console.error('[POS] Error loading restaurant:', err);
        setError(t('loadError', 'Failed to load restaurant'));
      } finally {
        setLoading(false);
      }
    };

    loadRestaurant();
  }, [address, isConnected, router, t]);

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

  if (error || !restaurant) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-4xl">❌</div>
          <h1 className="text-xl font-bold">{error || 'Restaurant not found'}</h1>
          <Link
            href="/dashboard-restaurant"
            className="inline-block px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
          >
            {t('backToDashboard', 'Back to Dashboard')}
          </Link>
        </div>
      </div>
    );
  }

  if (!restaurant.stripe_account_id) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-4xl">🏦</div>
          <h1 className="text-xl font-bold">
            {t('stripeRequired', 'Stripe Setup Required')}
          </h1>
          <p className="text-gray-400">
            {t('stripeRequiredDesc', 'Please complete Stripe onboarding in your dashboard before using POS.')}
          </p>
          <Link
            href="/dashboard-restaurant"
            className="inline-block px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
          >
            {t('backToDashboard', 'Back to Dashboard')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-md mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between py-3 mb-4">
          <div>
            <h1 className="text-xl font-bold">
              <span className="text-purple-400">Foodye</span>
              <span className="text-blue-400">Pay</span>
              <span className="text-gray-400 text-sm ml-2">POS</span>
            </h1>
            <p className="text-gray-400 text-sm">{restaurant.name}</p>
          </div>
          <Link
            href="/dashboard-restaurant"
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-gray-300 text-sm rounded-lg transition"
          >
            ← {t('back', 'Back')}
          </Link>
        </div>

        {/* POS Terminal Component */}
        <POSTerminal
          restaurantId={restaurant.id}
          restaurantName={restaurant.name}
          stripeAccountId={restaurant.stripe_account_id}
        />

        {/* Footer */}
        <div className="text-center py-4 mt-4">
          <p className="text-xs text-gray-600">
            {t('poweredBy', 'Powered by')}{' '}
            <span className="text-purple-400">FoodyePay</span>
            {' + '}
            <span className="text-blue-400">Stripe Terminal</span>
          </p>
        </div>
      </div>
    </div>
  );
}
