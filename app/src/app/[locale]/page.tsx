'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ConnectWallet, Wallet } from '@coinbase/onchainkit/wallet';
import { Address, Avatar, Name, Identity, EthBalance } from '@coinbase/onchainkit/identity';
import { useAccount } from 'wagmi';
import { useFoodyeWallet } from '@/components/Wallet/WalletProvider';
import { checkUserExists, isDemoWalletAddress } from '@/lib/auth';
import Image from 'next/image';

export default function WelcomePage() {
  const router = useRouter();
  const [showWelcome, setShowWelcome] = useState(true);
  const [welcomeCountdown, setWelcomeCountdown] = useState(3);
  const [checking, setChecking] = useState(false);
  const [autoChecking, setAutoChecking] = useState(false);

  // Use Wagmi hooks for real Coinbase Smart Wallet
  const { address, isConnected } = useAccount();

  // Custom wallet provider for state
  const { } = useFoodyeWallet();

  useEffect(() => {
    const cachedWallet = localStorage.getItem('foodye_wallet');
    if (cachedWallet && isDemoWalletAddress(cachedWallet)) {
      localStorage.removeItem('foodye_wallet');
    }
  }, []);

  const checkRegistration = useCallback(async (address: string) => {
    setChecking(true);

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Registration check timeout')), 10000)
      );

      const checkPromise = checkUserExists(address);

      const userRole = await Promise.race([checkPromise, timeoutPromise]) as string | null;

      if (userRole === 'diner') {
        router.push('/dashboard-diner');
        return;
      }

      if (userRole === 'restaurant') {
        router.push('/dashboard-restaurant');
        return;
      }

      router.push('/register');

    } catch (error) {
      console.error('Registration check failed:', error);
      router.push('/register');
    } finally {
      setChecking(false);
      setAutoChecking(false);
    }
  }, [router]);

  useEffect(() => {
    if (showWelcome && welcomeCountdown > 0) {
      const timer = setTimeout(() => {
        setWelcomeCountdown(welcomeCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (welcomeCountdown === 0) {
      setShowWelcome(false);
    }
  }, [showWelcome, welcomeCountdown]);

  useEffect(() => {
    if (!address || checking || showWelcome || autoChecking) return;

    setAutoChecking(true);
    localStorage.setItem('foodye_wallet', address);
    checkRegistration(address);
  }, [address, checkRegistration, checking, showWelcome, autoChecking]);

  // Footer component used across all states
  const PageFooter = () => (
    <footer className="mt-8 border-t border-neutral-800 text-sm text-neutral-400 px-4 py-6">
      <div className="max-w-md mx-auto">
        <div className="flex flex-wrap justify-center gap-4 mb-4">
          <Link href="/about" className="hover:text-neutral-200">About</Link>
          <Link href="/investors" className="hover:text-neutral-200">Investors</Link>
          <Link href="/legal/terms" className="hover:text-neutral-200">Terms</Link>
          <Link href="/legal/privacy" className="hover:text-neutral-200">Privacy</Link>
          <Link href="/legal/risk-disclaimer" className="hover:text-neutral-200">Risk</Link>
        </div>
        <p className="text-center text-neutral-500 text-xs">&copy; 2025 FoodyePay. All rights reserved.</p>
      </div>
    </footer>
  );

  // Welcome splash screen
  if (showWelcome) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="text-center space-y-8">
            <div className="relative">
              <Image
                src="/FoodyePayLogo.png"
                alt="FoodyePay"
                width={200}
                height={200}
                className="mx-auto mb-4"
              />
            </div>

            <div className="space-y-4">
              <h1 className="text-5xl font-bold text-white mb-2">
                Welcome to <span className="text-blue-400">FoodyePay</span>
              </h1>
              <p className="text-xl text-blue-200 max-w-md mx-auto">
                The future of food payments powered by Web3 technology
              </p>
            </div>

            <div className="flex items-center justify-center space-x-2 text-blue-300">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span>Starting in {welcomeCountdown}s</span>
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
            </div>

            <button
              onClick={() => {
                setShowWelcome(false);
                setWelcomeCountdown(0);
              }}
              className="text-blue-400 hover:text-blue-300 underline transition-colors"
            >
              Skip &rarr;
            </button>
          </div>
        </div>
        <PageFooter />
      </div>
    );
  }

  // Checking wallet status
  if (autoChecking || checking) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <h2 className="text-2xl font-bold">Checking Your Wallet...</h2>
            <p className="text-gray-300 text-lg">
              {address ? `Connected: ${address.slice(0, 6)}...${address.slice(-4)}` : 'Verifying registration status...'}
            </p>
          </div>
        </div>
        <PageFooter />
      </div>
    );
  }

  // Connected state - show wallet info
  if (isConnected && address) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="text-center space-y-8 max-w-md mx-auto">
            <Image
              src="/FoodyePayLogo.png"
              alt="FoodyePay"
              width={120}
              height={120}
              className="mx-auto mb-4"
            />

            <div className="space-y-4">
              <h1 className="text-3xl font-bold mb-2">Wallet Connected!</h1>

              <div className="bg-zinc-900 rounded-lg p-6 space-y-4">
                {/* @ts-ignore React 18/19 type mismatch */}
                <Wallet>
                  <Identity
                    address={address}
                    schemaId="0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9"
                    className="flex items-center space-x-3"
                  >
                    <Avatar className="w-12 h-12" />
                    <div className="text-left">
                      <Name className="text-white font-medium text-lg" />
                      <Address className="text-gray-400 text-sm font-mono" />
                    </div>
                  </Identity>

                  <div className="mt-4 pt-4 border-t border-zinc-800">
                    <p className="text-xs text-gray-400 mb-2">Balance</p>
                    <EthBalance
                      address={address}
                      className="text-blue-400 font-bold text-xl"
                    />
                  </div>
                </Wallet>

                <div className="flex items-center justify-center pt-4">
                  <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs px-3 py-1 rounded-full font-medium">
                    Coinbase Smart Wallet
                  </span>
                </div>
              </div>
            </div>

            <p className="text-yellow-400 text-sm">
              Checking registration status...
            </p>
          </div>
        </div>
        <PageFooter />
      </div>
    );
  }

  // Main login - not connected
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-8 max-w-md mx-auto">
          <Image
            src="/FoodyePayLogo.png"
            alt="FoodyePay"
            width={120}
            height={120}
            className="mx-auto mb-4"
          />

          <div className="space-y-4">
            <h1 className="text-3xl font-bold mb-2">Connect Your Wallet</h1>
            <p className="text-gray-400 text-sm">
              Connect your Coinbase Smart Wallet to get started
            </p>
          </div>

          <Wallet>
            {/* @ts-ignore React 18/19 type mismatch with OnchainKit */}
            <ConnectWallet
              disconnectedLabel="Create Coinbase Smart Wallet"
              className="w-full px-6 py-3 rounded-lg font-semibold transition-all duration-200 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl"
            />
          </Wallet>

          <div className="text-center pt-4 border-t border-zinc-800">
            <p className="text-xs text-gray-500">
              Create a free Coinbase Smart Wallet to get started
            </p>
          </div>
        </div>
      </div>
      <PageFooter />
    </div>
  );
}
