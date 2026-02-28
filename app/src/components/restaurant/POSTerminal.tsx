'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

type ReaderStatus = 'disconnected' | 'discovering' | 'connecting' | 'connected' | 'error';
type PaymentStatus = 'idle' | 'creating' | 'collecting' | 'processing' | 'succeeded' | 'failed';

interface Transaction {
  id: string;
  amount: number;
  status: 'succeeded' | 'failed';
  method: string;
  timestamp: Date;
}

interface POSTerminalProps {
  restaurantId: string;
  restaurantName: string;
  stripeAccountId: string;
}

export function POSTerminal({
  restaurantId,
  restaurantName,
  stripeAccountId,
}: POSTerminalProps) {
  const { t } = useTranslation('payment');
  const terminalRef = useRef<any>(null);
  const readerRef = useRef<any>(null);

  const [readerStatus, setReaderStatus] = useState<ReaderStatus>('disconnected');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [amount, setAmount] = useState<string>('');
  const [orderId, setOrderId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [lastPaymentResult, setLastPaymentResult] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [useSimulator, setUseSimulator] = useState(true);
  const [discoveredReaders, setDiscoveredReaders] = useState<any[]>([]);
  const [terminalLoaded, setTerminalLoaded] = useState(false);

  // Load Stripe Terminal SDK
  useEffect(() => {
    const loadTerminal = async () => {
      try {
        const { StripeTerminal } = await import('@stripe/terminal-js');
        const terminal = StripeTerminal.create({
          onFetchConnectionToken: async () => {
            const res = await fetch('/api/terminal/connection-token', {
              method: 'POST',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to get token');
            return data.secret;
          },
          onUnexpectedReaderDisconnect: () => {
            setReaderStatus('disconnected');
            readerRef.current = null;
            setError(t('readerDisconnected', 'Reader disconnected unexpectedly'));
          },
        });

        terminalRef.current = terminal;
        setTerminalLoaded(true);
      } catch (err: any) {
        console.error('[POS] Failed to load Terminal SDK:', err);
        setError(t('terminalLoadError', 'Failed to load Terminal SDK. Please refresh.'));
      }
    };

    loadTerminal();

    return () => {
      if (readerRef.current && terminalRef.current) {
        try {
          terminalRef.current.disconnectReader();
        } catch {}
      }
    };
  }, [t]);

  // Discover and connect to readers
  const discoverReaders = useCallback(async () => {
    if (!terminalRef.current) return;

    setReaderStatus('discovering');
    setError(null);

    try {
      const config = useSimulator
        ? { simulated: true }
        : { simulated: false };

      const result = await terminalRef.current.discoverReaders(config);

      if (result.error) {
        setError(result.error.message);
        setReaderStatus('error');
        return;
      }

      if (result.discoveredReaders.length === 0) {
        setError(t('noReaders', 'No readers found. Make sure your reader is powered on and nearby.'));
        setReaderStatus('disconnected');
        return;
      }

      setDiscoveredReaders(result.discoveredReaders);

      // Auto-connect to first reader (or simulated reader)
      if (useSimulator || result.discoveredReaders.length === 1) {
        await connectReader(result.discoveredReaders[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Discovery failed');
      setReaderStatus('error');
    }
  }, [useSimulator, t]);

  const connectReader = async (reader: any) => {
    if (!terminalRef.current) return;

    setReaderStatus('connecting');

    try {
      const result = useSimulator
        ? await terminalRef.current.connectReader(reader, { fail_if_in_use: true })
        : await terminalRef.current.connectReader(reader);

      if (result.error) {
        setError(result.error.message);
        setReaderStatus('error');
        return;
      }

      readerRef.current = result.reader;
      setReaderStatus('connected');
    } catch (err: any) {
      setError(err.message || 'Connection failed');
      setReaderStatus('error');
    }
  };

  const disconnectReader = async () => {
    if (!terminalRef.current) return;

    try {
      await terminalRef.current.disconnectReader();
      readerRef.current = null;
      setReaderStatus('disconnected');
      setDiscoveredReaders([]);
    } catch (err: any) {
      console.error('[POS] Disconnect error:', err);
    }
  };

  // Process payment
  const processPayment = async () => {
    if (!terminalRef.current || !readerRef.current) {
      setError(t('connectReaderFirst', 'Connect a reader first'));
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < 0.5) {
      setError(t('minAmount', 'Minimum amount is $0.50'));
      return;
    }

    setPaymentStatus('creating');
    setError(null);
    setLastPaymentResult(null);

    try {
      // 1. Create PaymentIntent on server
      const res = await fetch('/api/terminal/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          amountUSD: amountNum,
          orderId: orderId || `POS-${Date.now()}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create payment');

      // 2. Collect payment method from reader
      setPaymentStatus('collecting');

      if (useSimulator) {
        // For simulated reader, set test card first
        await terminalRef.current.setSimulatorConfiguration({
          testCardNumber: '4242424242424242',
        });
      }

      const collectResult = await terminalRef.current.collectPaymentMethod(
        data.clientSecret
      );

      if (collectResult.error) {
        throw new Error(collectResult.error.message);
      }

      // 3. Process the payment
      setPaymentStatus('processing');

      const processResult = await terminalRef.current.processPayment(
        collectResult.paymentIntent
      );

      if (processResult.error) {
        throw new Error(processResult.error.message);
      }

      // 4. Success!
      setPaymentStatus('succeeded');
      setLastPaymentResult(
        t('paymentSuccessAmount', 'Payment of ${{amount}} completed!', {
          amount: amountNum.toFixed(2),
        })
      );

      // Add to transaction history
      setTransactions((prev) => [
        {
          id: data.paymentIntentId,
          amount: amountNum,
          status: 'succeeded',
          method: 'terminal',
          timestamp: new Date(),
        },
        ...prev,
      ]);

      // Reset form
      setAmount('');
      setOrderId('');

      setTimeout(() => {
        setPaymentStatus('idle');
        setLastPaymentResult(null);
      }, 5000);
    } catch (err: any) {
      setPaymentStatus('failed');
      setError(err.message || 'Payment failed');

      setTransactions((prev) => [
        {
          id: `failed-${Date.now()}`,
          amount: amountNum,
          status: 'failed',
          method: 'terminal',
          timestamp: new Date(),
        },
        ...prev,
      ]);

      setTimeout(() => {
        setPaymentStatus('idle');
      }, 3000);
    }
  };

  const cancelCollection = async () => {
    if (!terminalRef.current) return;
    try {
      await terminalRef.current.cancelCollectPaymentMethod();
      setPaymentStatus('idle');
    } catch {}
  };

  const getReaderStatusColor = () => {
    switch (readerStatus) {
      case 'connected':
        return 'bg-green-500';
      case 'discovering':
      case 'connecting':
        return 'bg-yellow-500 animate-pulse';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-4">
      {/* Reader Connection Panel */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${getReaderStatusColor()}`} />
            <h3 className="text-white font-semibold text-sm">
              {t('readerStatus', 'Reader Status')}
            </h3>
          </div>
          <span className="text-gray-400 text-xs capitalize">{readerStatus}</span>
        </div>

        {/* Reader Mode Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setUseSimulator(true)}
            className={`flex-1 py-2 text-xs rounded-lg transition ${
              useSimulator
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-zinc-800 text-gray-400 border border-zinc-700'
            }`}
          >
            🧪 {t('simulator', 'Simulator')}
          </button>
          <button
            onClick={() => setUseSimulator(false)}
            className={`flex-1 py-2 text-xs rounded-lg transition ${
              !useSimulator
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-zinc-800 text-gray-400 border border-zinc-700'
            }`}
          >
            📟 {t('physicalReader', 'Physical Reader')}
          </button>
        </div>

        {/* Connect / Disconnect */}
        {readerStatus === 'disconnected' || readerStatus === 'error' ? (
          <button
            onClick={discoverReaders}
            disabled={!terminalLoaded}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-gray-500 text-white text-sm rounded-lg font-medium transition"
          >
            {!terminalLoaded
              ? t('loadingSDK', 'Loading Terminal SDK...')
              : t('connectReader', 'Connect Reader')}
          </button>
        ) : readerStatus === 'connected' ? (
          <button
            onClick={disconnectReader}
            className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-gray-300 text-sm rounded-lg font-medium transition"
          >
            {t('disconnectReader', 'Disconnect Reader')}
          </button>
        ) : (
          <div className="flex items-center justify-center py-2.5">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400 text-sm ml-2">
              {readerStatus === 'discovering'
                ? t('discovering', 'Discovering readers...')
                : t('connecting', 'Connecting...')}
            </span>
          </div>
        )}

        {/* Discovered Readers List */}
        {discoveredReaders.length > 1 && readerStatus !== 'connected' && (
          <div className="space-y-2">
            <p className="text-gray-400 text-xs">
              {t('selectReader', 'Select a reader:')}
            </p>
            {discoveredReaders.map((reader: any, idx: number) => (
              <button
                key={idx}
                onClick={() => connectReader(reader)}
                className="w-full text-left px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white transition"
              >
                📟 {reader.label || reader.serial_number || `Reader ${idx + 1}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Payment Input */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-3">
        <h3 className="text-white font-semibold text-sm">
          💰 {t('newPayment', 'New Payment')}
        </h3>

        <div className="space-y-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
              $
            </span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0.50"
              disabled={paymentStatus !== 'idle'}
              className="w-full pl-8 pr-4 py-4 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-2xl font-bold focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>

          <input
            type="text"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder={t('orderIdOptional', 'Order ID (optional)')}
            disabled={paymentStatus !== 'idle'}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>

        {/* Quick Amount Buttons */}
        <div className="grid grid-cols-4 gap-2">
          {[5, 10, 25, 50].map((val) => (
            <button
              key={val}
              onClick={() => setAmount(val.toString())}
              disabled={paymentStatus !== 'idle'}
              className="py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-sm rounded-lg transition"
            >
              ${val}
            </button>
          ))}
        </div>

        {/* Charge Button */}
        {paymentStatus === 'idle' ? (
          <button
            onClick={processPayment}
            disabled={
              readerStatus !== 'connected' ||
              !amount ||
              parseFloat(amount) < 0.5
            }
            className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-zinc-700 disabled:to-zinc-700 disabled:text-gray-500 text-white rounded-lg font-bold text-lg transition"
          >
            {readerStatus !== 'connected'
              ? t('connectReaderFirst', 'Connect Reader First')
              : !amount || parseFloat(amount) < 0.5
              ? t('enterAmount', 'Enter Amount')
              : t('chargeAmount', 'Charge ${{amount}}', {
                  amount: parseFloat(amount).toFixed(2),
                })}
          </button>
        ) : paymentStatus === 'collecting' ? (
          <div className="space-y-2">
            <div className="w-full py-3.5 bg-blue-600 text-white rounded-lg font-bold text-center animate-pulse">
              📶 {t('tapCard', 'Tap / Insert / Swipe Card...')}
            </div>
            <button
              onClick={cancelCollection}
              className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-gray-300 text-sm rounded-lg transition"
            >
              {t('cancel', 'Cancel')}
            </button>
          </div>
        ) : (
          <div
            className={`w-full py-3.5 rounded-lg font-bold text-center ${
              paymentStatus === 'succeeded'
                ? 'bg-green-500/20 text-green-400'
                : paymentStatus === 'failed'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-blue-500/20 text-blue-400 animate-pulse'
            }`}
          >
            {paymentStatus === 'creating' && t('creatingPayment', 'Creating payment...')}
            {paymentStatus === 'processing' && t('processingPayment', 'Processing...')}
            {paymentStatus === 'succeeded' && '✅ ' + (lastPaymentResult || t('paymentSuccess', 'Payment Successful!'))}
            {paymentStatus === 'failed' && '❌ ' + t('paymentFailed', 'Payment Failed')}
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-400/60 text-xs mt-1 hover:text-red-400"
          >
            {t('dismiss', 'Dismiss')}
          </button>
        </div>
      )}

      {/* Transaction History */}
      {transactions.length > 0 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-3">
          <h3 className="text-white font-semibold text-sm">
            📋 {t('recentTransactions', 'Recent Transactions')}
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-2 px-3 bg-zinc-800 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm ${
                      tx.status === 'succeeded' ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {tx.status === 'succeeded' ? '✅' : '❌'}
                  </span>
                  <div>
                    <p className="text-white text-sm font-medium">
                      ${tx.amount.toFixed(2)}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {tx.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <span className="text-gray-400 text-xs">{tx.method}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
