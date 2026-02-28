'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { LiveChatWidget } from '@/components/live-chat/LiveChatWidget';
import { supabase } from '@/lib/supabase';

interface Restaurant {
  id: string;
  name: string;
  description?: string;
}

export default function LiveChatPage() {
  const params = useParams();
  const restaurantId = params.restaurantId as string;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (restaurantId) loadRestaurant();
  }, [restaurantId]);

  const loadRestaurant = async () => {
    try {
      const { data, error: dbError } = await supabase
        .from('restaurants')
        .select('id, name, description')
        .eq('id', restaurantId)
        .single();

      if (dbError || !data) {
        setError('Restaurant not found.');
        return;
      }

      setRestaurant(data);
    } catch (err) {
      setError('Failed to load restaurant.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full" />
          <p className="text-gray-400 text-sm">Loading restaurant...</p>
        </div>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-2">{error || 'Restaurant not found'}</p>
          <a href="/" className="text-orange-400 hover:underline text-sm">
            Go back to home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen">
      <LiveChatWidget
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
      />
    </div>
  );
}
