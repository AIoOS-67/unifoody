'use client';

import { OnchainProviders } from '@/components/Wallet/OnchainProviders';
import { WalletProvider } from '@/components/Wallet/WalletProvider';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { useEffect, type ReactNode } from 'react';
import { registerServiceWorker } from '@/lib/registerSW';

// Initialize i18n (side-effect import)
import '@/lib/i18n';

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <OnchainProviders>
      <WalletProvider>
        {children}
        <PWAInstallPrompt />
      </WalletProvider>
    </OnchainProviders>
  );
}
