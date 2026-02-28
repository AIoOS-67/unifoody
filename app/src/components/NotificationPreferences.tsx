'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  userId: string;
  userRole: 'diner' | 'restaurant';
}

interface Preferences {
  orderUpdates: boolean;
  paymentConfirmations: boolean;
  promotions: boolean;
  foodyRewards: boolean;
}

export function NotificationPreferences({ userId, userRole }: Props) {
  const { t, i18n } = useTranslation('notifications');
  const [preferences, setPreferences] = useState<Preferences>({
    orderUpdates: true,
    paymentConfirmations: true,
    promotions: true,
    foodyRewards: true,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load preferences from localStorage
    const saved = localStorage.getItem('notification-preferences');
    if (saved) {
      try {
        setPreferences(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const handleToggle = (key: keyof Preferences) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save to localStorage
      localStorage.setItem(
        'notification-preferences',
        JSON.stringify(preferences)
      );

      // Update server subscription if push is active
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscription: subscription.toJSON(),
              userId,
              userRole,
              locale: i18n.language,
              preferences,
            }),
          });
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save preferences:', err);
    } finally {
      setSaving(false);
    }
  };

  const toggleItems: {
    key: keyof Preferences;
    titleKey: string;
    descKey: string;
  }[] = [
    {
      key: 'orderUpdates',
      titleKey: 'preferences.orderUpdates',
      descKey: 'preferences.orderUpdatesDesc',
    },
    {
      key: 'paymentConfirmations',
      titleKey: 'preferences.paymentConfirmations',
      descKey: 'preferences.paymentConfirmationsDesc',
    },
    {
      key: 'promotions',
      titleKey: 'preferences.promotions',
      descKey: 'preferences.promotionsDesc',
    },
    {
      key: 'foodyRewards',
      titleKey: 'preferences.foodyRewards',
      descKey: 'preferences.foodyRewardsDesc',
    },
  ];

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      <h3 className="text-white font-semibold mb-4">
        {t('preferences.title', 'Notification Preferences')}
      </h3>

      <div className="space-y-3">
        {toggleItems.map(({ key, titleKey, descKey }) => (
          <div
            key={key}
            className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0"
          >
            <div>
              <p className="text-white text-sm font-medium">
                {t(titleKey)}
              </p>
              <p className="text-gray-500 text-xs">{t(descKey)}</p>
            </div>
            <button
              onClick={() => handleToggle(key)}
              className={`w-11 h-6 rounded-full relative transition-colors ${
                preferences[key] ? 'bg-blue-600' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  preferences[key] ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
      >
        {saving
          ? '...'
          : saved
          ? t('preferences.saved', 'Preferences saved!')
          : t('preferences.savePreferences', 'Save Preferences')}
      </button>
    </div>
  );
}
