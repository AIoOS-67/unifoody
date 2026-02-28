'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export function TestRestaurantCreator() {
  const { address } = useAccount();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const createTestRestaurant = async () => {
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }

    setCreating(true);
    try {
      // Check if restaurant already exists
      const { data: existing } = await supabase
        .from('restaurants')
        .select('id')
        .eq('wallet_address', address)
        .single();

      if (existing) {
        alert('✅ Restaurant already exists! Redirecting to dashboard...');
        router.push('/dashboard-restaurant');
        return;
      }

      // Create test restaurant
      const { error } = await supabase
        .from('restaurants')
        .insert([{
          wallet_address: address,
          name: `Test Restaurant ${address.slice(-4)}`,
          email: `test${address.slice(-4)}@restaurant.com`,
          phone: '+1234567890',
          address: '123 Test Street, Food City',
          cuisine_type: 'International',
          description: 'Test restaurant for development purposes'
        }]);

      if (error) {
        console.error('Error creating test restaurant:', error);
        alert('Failed to create test restaurant: ' + error.message);
        return;
      }

      alert('🎉 Test restaurant created successfully!');
      router.push('/dashboard-restaurant');

    } catch (error) {
      console.error('Failed to create test restaurant:', error);
      alert('Failed to create test restaurant');
    } finally {
      setCreating(false);
    }
  };

  const createTestDiner = async () => {
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }

    setCreating(true);
    try {
      // Check if diner already exists
      const { data: existing } = await supabase
        .from('diners')
        .select('id')
        .eq('wallet_address', address)
        .single();

      if (existing) {
        alert('✅ Diner already exists! Redirecting to dashboard...');
        router.push('/dashboard-diner');
        return;
      }

      // Create test diner
      const { error } = await supabase
        .from('diners')
        .insert([{
          wallet_address: address,
          first_name: 'Test',
          last_name: `User ${address.slice(-4)}`,
          email: `test${address.slice(-4)}@user.com`,
          phone: '+1234567890'
        }]);

      if (error) {
        console.error('Error creating test diner:', error);
        alert('Failed to create test diner: ' + error.message);
        return;
      }

      alert('🎉 Test diner created successfully!');
      router.push('/dashboard-diner');

    } catch (error) {
      console.error('Failed to create test diner:', error);
      alert('Failed to create test diner');
    } finally {
      setCreating(false);
    }
  };

  if (!address) {
    return null;
  }

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
      <div className="text-center space-y-3">
        <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
          🧪 Quick Test Setup
        </h3>
        <p className="text-sm text-yellow-700 dark:text-yellow-300">
          Create test accounts to quickly access dashboards
        </p>
        
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={createTestRestaurant}
            disabled={creating}
            className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
          >
            {creating ? 'Creating...' : '🍽️ Create Test Restaurant'}
          </button>
          
          <button
            onClick={createTestDiner}
            disabled={creating}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
          >
            {creating ? 'Creating...' : '👤 Create Test Diner'}
          </button>
        </div>

        <p className="text-xs text-yellow-600 dark:text-yellow-400">
          This will create test data in your database for current wallet address
        </p>
      </div>
    </div>
  );
}
