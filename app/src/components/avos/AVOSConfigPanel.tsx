'use client';

import { useState, useEffect } from 'react';
import { Save, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

type Language = 'EN' | '中文' | '粵語' | 'ES';
type AIEngine = 'google-gemini-2.0' | 'amazon-nova-sonic';

interface AVOSConfig {
  enabled: boolean;
  phone_number: string;
  primary_language: Language;
  supported_languages: Language[];
  ai_engine: AIEngine;
  enable_upselling: boolean;
  enable_call_recording: boolean;
  sms_payment_enabled: boolean;
  transfer_phone: string;
  custom_greetings: Record<Language, string>;
}

interface Toast {
  id: string;
  type: 'success' | 'error';
  message: string;
}

const LANGUAGES: Language[] = ['EN', '中文', '粵語', 'ES'];
const LANGUAGE_LABELS: Record<Language, string> = {
  EN: 'English',
  '中文': 'Simplified Chinese',
  '粵語': 'Cantonese',
  ES: 'Spanish',
};

export default function AVOSConfigPanel({
  restaurantId,
  onConfigSaved,
}: {
  restaurantId: string;
  onConfigSaved?: () => void;
}) {
  const [config, setConfig] = useState<AVOSConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    fetchConfig();
  }, [restaurantId]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/avos/config?restaurantId=${restaurantId}`
      );
      if (!response.ok) throw new Error('Failed to fetch config');
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      addToast(
        'error',
        'Failed to load AVOS configuration. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleConfigChange = (updates: Partial<AVOSConfig>) => {
    if (config) {
      setConfig({ ...config, ...updates });
    }
  };

  const handleSaveConfig = async () => {
    if (!config) return;

    try {
      setSaving(true);
      const response = await fetch('/api/avos/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, ...config }),
      });

      if (!response.ok) throw new Error('Failed to save config');

      addToast('success', 'AVOS configuration saved successfully!');
      onConfigSaved?.();
    } catch (error) {
      addToast('error', 'Failed to save configuration. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncMenu = async () => {
    try {
      setSyncing(true);
      const response = await fetch('/api/avos/menu-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId }),
      });

      if (!response.ok) throw new Error('Failed to sync menu');

      addToast('success', 'Menu synchronized successfully!');
    } catch (error) {
      addToast('error', 'Failed to sync menu. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="space-y-6">
      {/* Toast Messages */}
      <div className="fixed top-4 right-4 space-y-2 z-50">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Main Panel */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
          AVOS Configuration
        </h2>

        <div className="space-y-6">
          {/* Enable AVOS Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Enable AVOS
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Activate AI-powered voice ordering for your restaurant
              </p>
            </div>
            <button
              onClick={() => handleConfigChange({ enabled: !config.enabled })}
              className={`relative inline-flex w-12 h-6 rounded-full transition-colors ${
                config.enabled
                  ? 'bg-green-500 dark:bg-green-600'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  config.enabled ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Phone Number (E.164 Format)
            </label>
            <input
              type="tel"
              value={config.phone_number}
              onChange={(e) =>
                handleConfigChange({ phone_number: e.target.value })
              }
              placeholder="+1234567890"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              This is the phone number customers will call to place orders
            </p>
          </div>

          {/* Primary Language */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Primary Language
            </label>
            <select
              value={config.primary_language}
              onChange={(e) =>
                handleConfigChange({
                  primary_language: e.target.value as Language,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {LANGUAGE_LABELS[lang]}
                </option>
              ))}
            </select>
          </div>

          {/* Supported Languages */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
              Supported Languages
            </label>
            <div className="space-y-2">
              {LANGUAGES.map((lang) => (
                <label
                  key={lang}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={config.supported_languages.includes(lang)}
                    onChange={(e) => {
                      const updated = e.target.checked
                        ? [...config.supported_languages, lang]
                        : config.supported_languages.filter((l) => l !== lang);
                      handleConfigChange({ supported_languages: updated });
                    }}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-2 focus:ring-purple-600"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">
                    {LANGUAGE_LABELS[lang]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* AI Engine Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
              AI Engine
            </label>
            <div className="space-y-2">
              {[
                {
                  value: 'google-gemini-2.0' as AIEngine,
                  label: 'Google Gemini 2.0',
                },
                {
                  value: 'amazon-nova-sonic' as AIEngine,
                  label: 'Amazon Nova Sonic',
                },
              ].map((engine) => (
                <label
                  key={engine.value}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="ai_engine"
                    value={engine.value}
                    checked={config.ai_engine === engine.value}
                    onChange={(e) =>
                      handleConfigChange({
                        ai_engine: e.target.value as AIEngine,
                      })
                    }
                    className="w-4 h-4 border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-2 focus:ring-purple-600"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">
                    {engine.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Feature Toggles */}
          <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
            {[
              {
                key: 'enable_upselling' as const,
                label: 'Enable Upselling',
                description: 'AI suggests complementary items during orders',
              },
              {
                key: 'enable_call_recording' as const,
                label: 'Enable Call Recording',
                description: 'Record calls for quality assurance (comply with local laws)',
              },
              {
                key: 'sms_payment_enabled' as const,
                label: 'SMS Payment',
                description: 'Allow payment via SMS (enabled by default)',
              },
            ].map(({ key, label, description }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-900 dark:text-white">
                    {label}
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {description}
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleConfigChange({ [key]: !config[key] })
                  }
                  className={`relative inline-flex w-12 h-6 rounded-full transition-colors ${
                    config[key]
                      ? 'bg-green-500 dark:bg-green-600'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      config[key] ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          {/* Transfer Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Transfer Phone (Fallback)
            </label>
            <input
              type="tel"
              value={config.transfer_phone}
              onChange={(e) =>
                handleConfigChange({ transfer_phone: e.target.value })
              }
              placeholder="+1234567890"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Human agent phone number for failed or transferred calls
            </p>
          </div>

          {/* Custom Greetings */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
              Custom Greetings (Per Language)
            </label>
            <div className="space-y-3">
              {LANGUAGES.map((lang) => (
                <div key={lang}>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {LANGUAGE_LABELS[lang]}
                  </label>
                  <textarea
                    value={config.custom_greetings[lang] || ''}
                    onChange={(e) =>
                      handleConfigChange({
                        custom_greetings: {
                          ...config.custom_greetings,
                          [lang]: e.target.value,
                        },
                      })
                    }
                    placeholder={`Enter greeting in ${LANGUAGE_LABELS[lang]}`}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 border-t border-gray-200 dark:border-gray-700 pt-6">
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="flex items-center justify-center gap-2 flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-medium rounded-lg transition-all disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
            <button
              onClick={handleSyncMenu}
              disabled={syncing || !config.enabled}
              className="flex items-center justify-center gap-2 flex-1 px-4 py-3 border border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Menu'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
