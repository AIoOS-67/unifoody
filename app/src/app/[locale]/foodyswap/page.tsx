'use client';

import { useAccount } from 'wagmi';
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownLink,
  WalletDropdownDisconnect,
} from '@coinbase/onchainkit/wallet';
import {
  Address,
  Avatar,
  Name,
  Identity,
  EthBalance,
} from '@coinbase/onchainkit/identity';
import UniswapV4Panel from '@/components/UniswapV4Panel';
import RewardsV4 from '@/components/RewardsV4';
import { LocaleLink } from '@/components/LocaleLink';

export default function FoodySwapPage() {
  const { address } = useAccount();

  return (
    <div className="flex flex-col min-h-screen font-sans bg-black text-white">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Left: Back + Branding */}
          <div className="flex items-center space-x-4">
            <LocaleLink
              href="/dashboard-diner"
              className="text-zinc-400 hover:text-white transition-colors"
            >
              &larr; Back
            </LocaleLink>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
                FoodySwap Hook
              </h1>
              <p className="text-xs text-zinc-500">Uniswap V4 &middot; FOODY / USDC &middot; Base Chain</p>
            </div>
          </div>

          {/* Right: Wallet */}
          <Wallet>
            <ConnectWallet>
              <Avatar className="h-6 w-6" />
              <Name />
            </ConnectWallet>
            <WalletDropdown>
              <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                <Avatar />
                <Name />
                <Address />
                <EthBalance />
              </Identity>
              <WalletDropdownLink
                icon="wallet"
                href="https://keys.coinbase.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Wallet
              </WalletDropdownLink>
              <WalletDropdownDisconnect />
            </WalletDropdown>
          </Wallet>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          {/* Info Banner */}
          <div className="mb-6 rounded-xl border border-violet-800/30 bg-gradient-to-r from-violet-950/20 to-blue-950/20 p-4">
            <div className="flex items-start space-x-3">
              <span className="text-2xl">🦄</span>
              <div>
                <h2 className="text-sm font-semibold text-violet-300">Three-Layer Hook Pipeline</h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Every swap goes through: Constraints (restaurant validation) &rarr; Pricing (tier-based dynamic fees) &rarr; Settlement (FOODY cashback + loyalty upgrades)
                </p>
              </div>
            </div>
          </div>

          {/* Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UniswapV4Panel walletAddress={address} />
            <RewardsV4 walletAddress={address} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-4 text-center text-xs text-zinc-600">
        FoodySwap Hook &middot; Uniswap V4 &middot; UHI Hookathon 8
      </footer>
    </div>
  );
}
