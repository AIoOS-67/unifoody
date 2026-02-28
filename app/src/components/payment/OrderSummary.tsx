'use client';

import { useTranslation } from 'react-i18next';

interface OrderSummaryProps {
  restaurantName: string;
  restaurantAddress?: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  orderId?: string;
  tableNumber?: string;
  foodyRewardEstimate?: number;
}

export function OrderSummary({
  restaurantName,
  restaurantAddress,
  subtotal,
  taxRate,
  taxAmount,
  total,
  orderId,
  tableNumber,
  foodyRewardEstimate,
}: OrderSummaryProps) {
  const { t } = useTranslation('payment');

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      {/* Restaurant Header */}
      <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 p-4 border-b border-zinc-800">
        <h2 className="text-white font-bold text-lg">{restaurantName}</h2>
        {restaurantAddress && (
          <p className="text-gray-400 text-sm mt-0.5">{restaurantAddress}</p>
        )}
      </div>

      {/* Order Details */}
      <div className="p-4 space-y-3">
        {(orderId || tableNumber) && (
          <div className="flex justify-between text-sm text-gray-400">
            {orderId && <span>{t('order', 'Order')}: {orderId}</span>}
            {tableNumber && <span>{t('table', 'Table')}: {tableNumber}</span>}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">{t('subtotal', 'Subtotal')}</span>
            <span className="text-white">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">
              {t('tax', 'Tax')} ({(taxRate * 100).toFixed(2)}%)
            </span>
            <span className="text-white">${taxAmount.toFixed(2)}</span>
          </div>
          <div className="border-t border-zinc-700 pt-2 flex justify-between">
            <span className="text-white font-semibold">{t('total', 'Total')}</span>
            <span className="text-white font-bold text-lg">
              ${total.toFixed(2)}
            </span>
          </div>
        </div>

        {foodyRewardEstimate && foodyRewardEstimate > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mt-2">
            <p className="text-yellow-400 text-sm font-medium">
              🎁 {t('earnReward', 'Earn {{amount}} FOODY rewards!', {
                amount: foodyRewardEstimate.toLocaleString(),
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
