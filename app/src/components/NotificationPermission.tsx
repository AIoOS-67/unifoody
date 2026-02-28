'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  requestNotificationPermission,
  subscribeToPush,
} from '@/lib/pushNotifications';

interface Props {
  userId: string;
  userRole: 'diner' | 'restaurant';
}

export function NotificationPermission({ userId, userRole }: Props) {
  const { t, i18n } = useTranslation('notifications');
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [showBanner, setShowBanner] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
      if (Notification.permission === 'default') {
        const dismissed = localStorage.getItem('push-dismissed');
        // Show banner if not dismissed in the last 7 days
        if (
          !dismissed ||
          Date.now() - parseInt(dismissed) > 7 * 24 * 60 * 60 * 1000
        ) {
          setShowBanner(true);
        }
      }
    }
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const result = await requestNotificationPermission();
      setPermission(result);
      if (result === 'granted') {
        await subscribeToPush(userId, userRole, i18n.language);
        setShowBanner(false);
      }
    } catch (err) {
      console.error('Failed to enable notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('push-dismissed', Date.now().toString());
  };

  if (!showBanner || permission !== 'default') return null;

  return (
    <div className="bg-blue-900/30 border border-blue-700/50 rounded-xl p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-white font-semibold text-sm">
            {t('enableTitle', 'Stay Updated')}
          </h3>
          <p className="text-blue-200/70 text-xs mt-0.5">
            {t(
              'enableDescription',
              'Get notified about orders, payments, and FOODY rewards'
            )}
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleEnable}
          disabled={loading}
          className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
        >
          {loading ? '...' : t('enableButton', 'Enable Notifications')}
        </button>
        <button
          onClick={handleDismiss}
          className="px-3 py-1.5 text-gray-400 hover:text-gray-300 text-sm transition"
        >
          {t('laterButton', 'Later')}
        </button>
      </div>
    </div>
  );
}
