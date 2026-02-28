'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export function PWAInstallPrompt() {
  const { t } = useTranslation('common');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show custom prompt if not dismissed before
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) setShowPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    if (mediaQuery.matches) {
      setShowPrompt(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-zinc-900 border border-zinc-700 rounded-xl p-4 shadow-2xl z-50 max-w-md mx-auto animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-white font-bold text-lg">
            {t('pwa.installTitle', 'Install FoodyePay')}
          </h3>
          <p className="text-gray-400 text-sm mt-1">
            {t('pwa.installDescription', 'Add FoodyePay to your home screen for the best experience')}
          </p>
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <button
          onClick={handleInstall}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-semibold transition"
        >
          {t('pwa.installButton', 'Install')}
        </button>
        <button
          onClick={handleDismiss}
          className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-gray-300 py-2.5 rounded-lg transition"
        >
          {t('pwa.dismissButton', 'Not now')}
        </button>
      </div>
    </div>
  );
}
