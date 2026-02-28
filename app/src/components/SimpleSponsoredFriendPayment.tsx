import React, { useState } from 'react';
import { QRScanner } from './QRScanner';
import { useAccount, useConfig, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { supabase } from '@/lib/supabase';
import { encodeFunctionData, parseEther } from 'viem';

// FOODY Token contract ABI (ERC-20 transfer function)
const FOODY_TOKEN_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// FOODY Token address
const FOODY_TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_FOODYE_TOKEN_ADDRESS || '0x1022b1b028a2237c440dbac51dc6fc220d88c08f') as `0x${string}`;

interface SimpleSponsoredFriendPaymentProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SimpleSponsoredFriendPayment: React.FC<SimpleSponsoredFriendPaymentProps> = ({ isOpen, onClose }) => {
  const { address } = useAccount();
  const [showScanner, setShowScanner] = useState(false);
  const [friendAddress, setFriendAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { sendTransaction, isPending, error } = useSendTransaction({
    mutation: {
      onSuccess: (hash) => {
        setTxHash(hash);
      },
    },
  });
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const handleQRScan = (scannedData: string) => {
    if (scannedData.startsWith('0x') && scannedData.length === 42) {
      setFriendAddress(scannedData);
      setShowScanner(false);
    } else {
      alert('Invalid wallet address QR code. Please scan a valid wallet QR code.');
    }
  };

  const isValidAddress = (addr: string): addr is `0x${string}` => {
    return addr.startsWith('0x') && addr.length === 42;
  };

  const handleSendFoody = async () => {
    if (!address || !friendAddress || !amount) {
      alert('Please fill in all fields');
      return;
    }

    if (!isValidAddress(friendAddress)) {
      alert('Invalid friend wallet address format');
      return;
    }

    if (parseFloat(amount) <= 0) {
      alert('Amount must be greater than 0');
      return;
    }

    try {
      const transferAmount = parseEther(amount);
      
      const data = encodeFunctionData({
        abi: FOODY_TOKEN_ABI,
        functionName: 'transfer',
        args: [friendAddress as `0x${string}`, transferAmount],
      });

      sendTransaction({
        to: FOODY_TOKEN_ADDRESS,
        data,
        value: BigInt(0),
      });
    } catch (error) {
      console.error('Transfer error:', error);
      alert('Transfer failed. Please try again.');
    }
  };

  // 当交易成功时保存到数据库
  React.useEffect(() => {
    if (isSuccess && txHash) {
      const saveTransaction = async () => {
        try {
          const { error: insertError } = await supabase
            .from('confirm_and_pay')
            .insert({
              diner_wallet_address: address,
              restaurant_wallet_address: friendAddress,
              restaurant_name: 'Friend Transfer (Smart Wallet)',
              total_amount: 0,
              foody_amount: parseFloat(amount),
              tx_hash: txHash,
              payment_method: 'FOODY_SMART_WALLET',
              status: 'paid',
              order_id: `smart-wallet-friend-transfer-${Date.now()}`
            });

          if (insertError) {
            console.warn('Failed to save transaction record:', insertError);
          } else {
            console.log('✅ Smart wallet transaction record saved successfully');
          }
        } catch (dbError) {
          console.warn('Database save error:', dbError);
        }
      };

      saveTransaction();
      
      // 延迟关闭模态框
      setTimeout(() => {
        setAmount('');
        setFriendAddress('');
        setTxHash(undefined);
        onClose();
      }, 3000);
    }
  }, [isSuccess, txHash, address, friendAddress, amount, onClose]);

  const handleClose = () => {
    setShowScanner(false);
    setFriendAddress('');
    setAmount('');
    setTxHash(undefined);
    onClose();
  };

  if (!isOpen) return null;

  const canProceed = isValidAddress(friendAddress) && amount && parseFloat(amount) > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl p-6 w-full max-w-md relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl"
        >
          ✕
        </button>
        
        <h2 className="text-xl font-bold text-green-400 mb-4">🎉 Send FOODY to Friend</h2>
        
        <div className="space-y-4">
          {/* 朋友地址输入 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Friend's Wallet Address
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={friendAddress}
                onChange={(e) => setFriendAddress(e.target.value)}
                placeholder="0x... or scan QR code"
                className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400"
                disabled={isPending || isConfirming}
              />
              <button
                onClick={() => setShowScanner(true)}
                disabled={isPending || isConfirming}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                📱 Scan
              </button>
            </div>
          </div>

          {/* 金额输入 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Amount (FOODY)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount to send"
              min="0"
              step="0.01"
              disabled={isPending || isConfirming}
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 disabled:opacity-50"
            />
          </div>

          {/* 发送按钮 */}
          <button
            onClick={handleSendFoody}
            disabled={!canProceed || isPending || isConfirming}
            className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center ${
              !canProceed || isPending || isConfirming
                ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Sending...
              </>
            ) : isConfirming ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Confirming...
              </>
            ) : isSuccess ? (
              '✅ Transfer Successful!'
            ) : (
              '🎉 Send FOODY'
            )}
          </button>

          {/* 错误显示 */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-red-400 text-sm">
                Error: {error.message}
              </p>
            </div>
          )}

          {/* 成功显示 */}
          {isSuccess && txHash && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <p className="text-green-400 text-sm font-medium">✅ Transfer Successful!</p>
              <p className="text-green-300 text-xs mt-1">
                Transaction: {txHash.slice(0, 10)}...{txHash.slice(-8)}
              </p>
              <p className="text-green-300 text-xs">This will appear in your Transaction History.</p>
            </div>
          )}

          {/* Smart Wallet 说明 */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <span className="text-blue-400">🏦</span>
              <div>
                <p className="text-blue-400 font-medium text-sm">Smart Wallet Transfer</p>
                <p className="text-blue-300 text-xs">Optimized with Coinbase Smart Wallet</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QR扫描器 */}
      <QRScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleQRScan}
        onError={(error) => {
          console.error('QR Scanner Error:', error);
          alert('Scan failed, please try again');
        }}
      />
    </div>
  );
};
