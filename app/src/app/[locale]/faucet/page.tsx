'use client';

import { useState, useEffect } from 'react';
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
import { LocaleLink } from '@/components/LocaleLink';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FaucetResult {
  wallet: string;
  usdc_tx: string;
  eth_tx: string;
  usdc_amount: string;
  eth_amount: string;
  explorer: { usdc: string; eth: string };
  next_available_in: string;
  tip: string;
}

interface ApiResponse {
  ok: boolean;
  data?: FaucetResult;
  error?: string;
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function FaucetPage() {
  const { address, isConnected } = useAccount();

  const [wallet, setWallet] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FaucetResult | null>(null);
  const [error, setError] = useState('');

  // Auto-fill wallet from connected account
  useEffect(() => {
    if (address) setWallet(address);
  }, [address]);

  // ── Claim handler ──────────────────────────────────────────────────────
  const handleClaim = async () => {
    setLoading(true);
    setResult(null);
    setError('');

    try {
      const res = await fetch('/api/v1/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet }),
      });

      const data: ApiResponse = await res.json();

      if (data.ok && data.data) {
        setResult(data.data);
      } else {
        setError(data.error || `Request failed (${res.status})`);
      }
    } catch (err) {
      setError('Network error. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────
  const isValidAddress = wallet.length === 42 && wallet.startsWith('0x');
  const canClaim = isValidAddress && !loading;

  const truncateHash = (hash: string) =>
    hash ? `${hash.slice(0, 10)}...${hash.slice(-8)}` : '';

  return (
    <div className="flex flex-col min-h-screen font-sans bg-black text-white">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Left: Back + Branding */}
          <div className="flex items-center space-x-4">
            <LocaleLink
              href="/foodyswap"
              className="text-zinc-400 hover:text-white transition-colors"
            >
              &larr; Back
            </LocaleLink>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                UniFoody Faucet
              </h1>
              <p className="text-xs text-zinc-500">
                Unichain Sepolia Testnet
              </p>
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

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <main className="flex-grow p-4 md:p-6">
        <div className="max-w-lg mx-auto">
          {/* Info Banner */}
          <div className="mb-6 rounded-xl border border-emerald-800/30 bg-gradient-to-r from-emerald-950/20 to-teal-950/20 p-4">
            <div className="flex items-start space-x-3">
              <span className="text-2xl">🎯</span>
              <div>
                <h2 className="text-sm font-semibold text-emerald-300">
                  AI Agent Onboarding
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Claim 1 USDC + 0.001 ETH (gas) to start swapping for FOODY
                  tokens on the UniFoody platform.
                </p>
              </div>
            </div>
          </div>

          {/* ── Main Card ─────────────────────────────────────────────── */}
          <div className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
            {/* Card Header */}
            <div className="px-6 py-4 border-b border-zinc-800 bg-gradient-to-r from-emerald-950/30 to-teal-950/30">
              <h3 className="text-base font-semibold text-emerald-300">
                Claim Testnet Tokens
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                One claim per address every hour
              </p>
            </div>

            {/* Card Body */}
            <div className="p-6 space-y-5">
              {/* Wallet Input */}
              <div>
                <label className="block text-xs text-zinc-400 mb-2">
                  Recipient Wallet Address
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={wallet}
                    onChange={(e) => setWallet(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 text-white text-sm border border-zinc-700 focus:border-emerald-500 focus:outline-none font-mono placeholder:text-zinc-600"
                  />
                  {isConnected && address && wallet === address && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-800/50">
                      Connected
                    </span>
                  )}
                </div>
              </div>

              {/* Drip Amounts */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-center">
                  <div className="text-lg font-bold text-emerald-400">
                    1 USDC
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    For swapping
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-center">
                  <div className="text-lg font-bold text-teal-400">
                    0.001 ETH
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    For gas fees
                  </div>
                </div>
              </div>

              {/* Claim Button */}
              <button
                onClick={handleClaim}
                disabled={!canClaim}
                className={`w-full py-3 rounded-lg text-sm font-semibold transition-all ${
                  canClaim
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-900/30'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center space-x-2">
                    <span className="w-4 h-4 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin" />
                    <span>Sending tokens...</span>
                  </span>
                ) : (
                  'Claim Tokens'
                )}
              </button>

              {/* ── Success Result ─────────────────────────────────────── */}
              {result && (
                <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-4 space-y-3">
                  <div className="flex items-center space-x-2 text-emerald-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-semibold text-sm">Tokens sent!</span>
                  </div>

                  {/* TX Links */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">USDC Transfer</span>
                      <a
                        href={result.explorer.usdc}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 font-mono"
                      >
                        {truncateHash(result.usdc_tx)} &rarr;
                      </a>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">ETH Transfer</span>
                      <a
                        href={result.explorer.eth}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-400 hover:text-teal-300 font-mono"
                      >
                        {truncateHash(result.eth_tx)} &rarr;
                      </a>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-500">
                    Next claim available in {result.next_available_in}
                  </p>
                </div>
              )}

              {/* ── Error Result ───────────────────────────────────────── */}
              {error && (
                <div className="rounded-lg border border-red-800/50 bg-red-950/20 p-4">
                  <div className="flex items-center space-x-2 text-red-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="font-semibold text-sm">Claim failed</span>
                  </div>
                  <p className="text-xs text-red-300/80 mt-2">{error}</p>
                  <button
                    onClick={() => setError('')}
                    className="text-xs text-zinc-500 hover:text-zinc-300 mt-2 underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Tips ───────────────────────────────────────────────────── */}
          <div className="mt-6 space-y-2 text-xs text-zinc-500">
            <p>
              <span className="text-zinc-400">Next step:</span>{' '}
              <LocaleLink href="/foodyswap" className="text-emerald-400 hover:text-emerald-300 underline">
                Swap USDC → FOODY at FoodySwap
              </LocaleLink>
            </p>
            <p>
              <span className="text-zinc-400">API:</span>{' '}
              <code className="text-teal-400 bg-zinc-900 px-1.5 py-0.5 rounded font-mono">
                POST /api/v1/faucet {'{'} &quot;wallet&quot;: &quot;0x...&quot; {'}'}
              </code>
            </p>
            <p>
              <span className="text-zinc-400">Docs:</span>{' '}
              <a href="/api/v1" className="text-zinc-400 hover:text-white underline">
                /api/v1
              </a>
            </p>
          </div>
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800 py-4 text-center text-xs text-zinc-600">
        UniFoody Faucet &middot; Unichain Sepolia &middot; UHI Hookathon 8
      </footer>
    </div>
  );
}
