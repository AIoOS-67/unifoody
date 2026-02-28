'use client';

import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

type WalletContextType = {
  walletAddress: string | null;
  isSmartWallet: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => void;
  disconnect: () => void;
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const isSmartWallet = (() => {
    if (!connector) return false;
    const isWalletSDK = connector.id === 'coinbaseWalletSDK';
    const isCoinbase = connector.name?.toLowerCase().includes('coinbase');
    return isWalletSDK && isCoinbase;
  })();

  useEffect(() => {
    if (address && isConnected) {
      localStorage.setItem('foodye_wallet', address);
    }
  }, [address, isConnected, connector]);

  const handleConnect = () => {
    const coinbaseConnector = connectors.find(c => c.id === 'coinbaseWalletSDK');
    if (coinbaseConnector) {
      connect({ connector: coinbaseConnector });
    }
  };

  const handleDisconnect = () => {
    disconnect();
    localStorage.removeItem('foodye_wallet');
  };

  const value = {
    walletAddress: address || null,
    isSmartWallet,
    isConnected,
    isConnecting: isPending,
    connect: handleConnect,
    disconnect: handleDisconnect,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useFoodyeWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useFoodyeWallet must be used within WalletProvider');
  return ctx;
}
