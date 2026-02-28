'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { createConfig, http } from 'wagmi';
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors';
import { unichain, unichainSepolia } from '@/lib/chains';

// Use testnet when NEXT_PUBLIC_CHAIN_MODE=testnet
const isTestnet = process.env.NEXT_PUBLIC_CHAIN_MODE === 'testnet';
const activeChain = isTestnet ? unichainSepolia : unichain;

const config = createConfig({
  chains: [unichain, unichainSepolia],
  connectors: [
    injected(), // MetaMask, Rabby, Brave, etc.
    coinbaseWallet({
      appName: 'UniFoody',
      version: '4',
    }),
    ...(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
      ? [walletConnect({ projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID })]
      : []),
  ],
  transports: {
    [unichain.id]: http('https://mainnet.unichain.org'),
    [unichainSepolia.id]: http('https://sepolia.unichain.org'),
  },
});

const queryClient = new QueryClient();

interface OnchainProvidersProps {
  children: React.ReactNode;
}

export function OnchainProviders({ children }: OnchainProvidersProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export { activeChain, isTestnet };
