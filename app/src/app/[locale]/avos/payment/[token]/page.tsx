'use client';

/**
 * AVOS SMS Payment Page
 * Customer-facing payment page accessed via SMS link
 * Displays order summary and handles wallet connection + payment
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Providers } from '@/app/providers';
import { AVOSOrderItem } from '@/lib/avos/types';
import { useAccount, useConfig } from 'wagmi';
import { checkFoodyBalance } from '@/lib/paymentService';
import { ConnectWallet } from '@coinbase/onchainkit/wallet';

// PaymentLinkPayload used client-side (mirrors server type)
interface PaymentLinkPayload {
  restaurantName: string;
  items: AVOSOrderItem[];
  subtotalUsd: number;
  taxUsd: number;
  totalUsd: number;
  foodyAmount: number;
  exchangeRate: number;
  expiresAt: number;
}

interface PaymentPageState {
  loading: boolean;
  error: string | null;
  paymentData: PaymentLinkPayload | null;
  timeRemaining: number;
  paymentProcessing: boolean;
  paymentSuccess: boolean;
  txHash?: string;
}

function PaymentPageContent() {
  const params = useParams();
  const token = params.token as string;
  const { address, isConnected } = useAccount();
  const config = useConfig();

  const [state, setState] = useState<PaymentPageState>({
    loading: true,
    error: null,
    paymentData: null,
    timeRemaining: 0,
    paymentProcessing: false,
    paymentSuccess: false,
  });

  const [foodyBalance, setFoodyBalance] = useState<number | null>(null);

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      try {
        console.log('[AVOS] Verifying payment token...');
        const res = await fetch(`/api/avos/verify-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const payload = res.ok ? await res.json() : null;

        if (!payload) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: 'Payment link has expired or is invalid',
          }));
          return;
        }

        // Calculate time remaining
        const now = Math.floor(Date.now() / 1000);
        const timeRemaining = Math.max(0, payload.expiresAt - now);

        if (timeRemaining === 0) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: 'Payment link has expired',
          }));
          return;
        }

        console.log(`[AVOS] Token verified, expires in ${timeRemaining}s`);

        setState((prev) => ({
          ...prev,
          loading: false,
          paymentData: payload,
          timeRemaining,
        }));
      } catch (error) {
        console.error('[AVOS] Token verification error:', error);
        setState((prev) => ({
          ...prev,
          loading: false,
          error:
            error instanceof Error ? error.message : 'Verification failed',
        }));
      }
    };

    if (token) {
      verifyToken();
    }
  }, [token]);

  // Update timer every second
  useEffect(() => {
    if (!state.paymentData || state.paymentSuccess) return;

    const timer = setInterval(() => {
      setState((prev) => {
        const newTime = Math.max(0, prev.timeRemaining - 1);
        if (newTime === 0) {
          // Payment link expired
          return {
            ...prev,
            timeRemaining: 0,
            error: 'Payment link has expired',
          };
        }
        return { ...prev, timeRemaining: newTime };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [state.paymentData, state.paymentSuccess]);

  // Check FOODY balance when wallet connects
  useEffect(() => {
    if (!isConnected || !address || !config) return;

    const checkBalance = async () => {
      try {
        const balance = await checkFoodyBalance(address, config);
        setFoodyBalance(balance);
      } catch (error) {
        console.error('[AVOS] Balance check error:', error);
      }
    };

    checkBalance();
  }, [isConnected, address, config]);

  // Handle payment
  const handlePayment = async () => {
    if (!isConnected || !address || !state.paymentData) {
      setState((prev) => ({
        ...prev,
        error: 'Please connect wallet first',
      }));
      return;
    }

    if (!foodyBalance) {
      setState((prev) => ({
        ...prev,
        error: 'Unable to check balance',
      }));
      return;
    }

    if (foodyBalance < state.paymentData.foodyAmount) {
      setState((prev) => ({
        ...prev,
        error: `Insufficient FOODY balance. Need ${state.paymentData!.foodyAmount}, have ${foodyBalance}`,
      }));
      return;
    }

    setState((prev) => ({ ...prev, paymentProcessing: true, error: null }));

    try {
      console.log(`[AVOS] Processing payment: ${state.paymentData.foodyAmount} FOODY`);

      // TODO: Execute payment via paymentService
      // For now, just mark as success for demo
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const txHash = `0x${Math.random().toString(16).slice(2)}`;

      // Update payment status via API
      await fetch('/api/avos/payment-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, status: 'completed', txHash }),
      });

      setState((prev) => ({
        ...prev,
        paymentProcessing: false,
        paymentSuccess: true,
        txHash,
      }));

      console.log('[AVOS] Payment successful');
    } catch (error) {
      console.error('[AVOS] Payment error:', error);
      setState((prev) => ({
        ...prev,
        paymentProcessing: false,
        error:
          error instanceof Error ? error.message : 'Payment failed',
      }));
    }
  };

  // Format time remaining
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const { paymentData, error, loading } = state;

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <div className="max-w-md mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Order Payment</h1>
          <p className="text-zinc-400">Complete your payment to confirm order</p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-zinc-800 rounded-lg p-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
            <p>Verifying payment link...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {/* Payment Content */}
        {paymentData && !loading && (
          <>
            {/* Restaurant Info */}
            <div className="bg-zinc-800 rounded-lg p-6 mb-6">
              <p className="text-zinc-400 text-sm mb-2">Restaurant</p>
              <h2 className="text-2xl font-bold mb-1">{paymentData.restaurantName}</h2>
              <p className="text-zinc-400 text-sm">
                Order placed via voice call
              </p>
            </div>

            {/* Order Summary */}
            <div className="bg-zinc-800 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Order Summary</h3>

              {/* Items */}
              <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                {paymentData.items.map((item: AVOSOrderItem, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center py-2 border-b border-zinc-700 last:border-b-0"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      {item.modifications && item.modifications.length > 0 && (
                        <p className="text-xs text-zinc-400">
                          {item.modifications.join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-zinc-400">x{item.quantity}</p>
                      <p className="font-semibold">
                        ${(item.priceUsd * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-2 pt-4 border-t border-zinc-700">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Subtotal</span>
                  <span>${paymentData.subtotalUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Tax</span>
                  <span>${paymentData.taxUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-zinc-700">
                  <span>Total</span>
                  <span>${paymentData.totalUsd.toFixed(2)} USD</span>
                </div>
              </div>
            </div>

            {/* FOODY Payment Info */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
              <h4 className="font-semibold mb-2 flex items-center">
                <span className="text-blue-400 mr-2">💰</span>
                FOODY Payment
              </h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Amount</span>
                  <span className="font-semibold">
                    {paymentData.foodyAmount.toLocaleString()} FOODY
                  </span>
                </div>
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Exchange Rate</span>
                  <span>{paymentData.exchangeRate.toFixed(2)} FOODY/USD</span>
                </div>
              </div>
            </div>

            {/* Wallet Connection */}
            {!isConnected ? (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                <p className="text-yellow-200 text-sm mb-4">
                  Connect wallet to complete payment
                </p>
                <ConnectWallet />
              </div>
            ) : (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
                <p className="text-green-200 text-sm mb-2">
                  Wallet: {address?.slice(0, 6)}...{address?.slice(-4)}
                </p>
                {foodyBalance !== null && (
                  <p className="text-green-200 text-sm">
                    FOODY Balance: {foodyBalance.toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* Success State */}
            {state.paymentSuccess ? (
              <div className="bg-green-500/20 border border-green-500 rounded-lg p-6 text-center mb-6">
                <div className="text-4xl mb-3">✓</div>
                <h3 className="text-lg font-bold mb-2">Payment Successful!</h3>
                <p className="text-green-200 text-sm mb-3">
                  Your order has been confirmed
                </p>
                {state.txHash && (
                  <p className="text-xs text-zinc-400 break-all">
                    Transaction: {state.txHash}
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* Time Remaining */}
                <div className="flex items-center justify-between bg-zinc-800 rounded-lg p-3 mb-6">
                  <span className="text-sm text-zinc-400">Payment expires in</span>
                  <span className="font-mono font-bold text-lg">
                    {formatTime(state.timeRemaining)}
                  </span>
                </div>

                {/* Pay Button */}
                <button
                  onClick={handlePayment}
                  disabled={
                    !isConnected ||
                    state.paymentProcessing ||
                    state.timeRemaining === 0
                  }
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-600 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {state.paymentProcessing ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <span>💳</span>
                      Pay {paymentData.foodyAmount.toLocaleString()} FOODY
                    </>
                  )}
                </button>

                {/* Info Text */}
                <p className="text-xs text-zinc-500 text-center mt-4">
                  Payment secured by Coinbase Smart Wallet on Base Network
                </p>
              </>
            )}
          </>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-zinc-500">
          <p>Powered by FoodyePay</p>
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Providers>
      <PaymentPageContent />
    </Providers>
  );
}
