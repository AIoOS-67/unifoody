'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccount } from 'wagmi';
import {
  ConnectWallet,
  Wallet,
} from '@coinbase/onchainkit/wallet';
import { useConfig } from 'wagmi';

interface CryptoCheckoutProps {
  restaurantId: string;
  restaurantWallet: string;
  restaurantName: string;
  amountUSD: number;
  foodyAmount: number;
  orderId: string;
  foodyRewardEstimate: number;
  onSuccess: (txHash: string) => void;
  onError: (error: string) => void;
}

export function CryptoCheckout({
  restaurantId,
  restaurantWallet,
  restaurantName,
  amountUSD,
  foodyAmount,
  orderId,
  foodyRewardEstimate,
  onSuccess,
  onError,
}: CryptoCheckoutProps) {
  const { t } = useTranslation('payment');
  const { address, isConnected } = useAccount();
  const config = useConfig();
  const [processing, setProcessing] = useState(false);

  const handlePay = async () => {
    if (!address || !isConnected) return;

    setProcessing(true);
    try {
      // Dynamic import to avoid SSR issues
      const { executeFoodyPayment } = await import('@/lib/paymentService');

      const result = await executeFoodyPayment(
        {
          fromAddress: address,
          toAddress: restaurantWallet as `0x${string}`,
          foodyAmount,
          usdcEquivalent: amountUSD,
          orderId,
          restaurantId,
          restaurantName,
        },
        config
      );

      if (result.success && result.transactionHash) {
        onSuccess(result.transactionHash);
      } else {
        onError(result.error || 'Payment failed');
      }
    } catch (err: any) {
      console.error('[CryptoCheckout] Error:', err);
      onError(err.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-3">
      {!isConnected ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-gray-400 text-sm text-center">
            {t('connectWalletPrompt', 'Connect your wallet to pay with FOODY')}
          </p>
          <Wallet>
            <ConnectWallet className="w-full" />
          </Wallet>
        </div>
      ) : (
        <button
          onClick={handlePay}
          disabled={processing}
          className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {t('processing', 'Processing...')}
            </span>
          ) : (
            <span>
              🪙 {t('payWithFoody', 'Pay with FOODY')}{' '}
              ({foodyAmount.toLocaleString()} FOODY)
            </span>
          )}
        </button>
      )}

      {foodyRewardEstimate > 0 && (
        <p className="text-center text-xs text-yellow-400">
          🎁 {t('earnReward', 'Earn {{amount}} FOODY rewards!', {
            amount: foodyRewardEstimate.toLocaleString(),
          })}
        </p>
      )}
    </div>
  );
}
