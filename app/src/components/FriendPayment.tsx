import React, { useState } from 'react';
import { QRScanner } from './QRScanner';
import { executeFoodyPayment, checkFoodyBalance } from '@/lib/paymentService';
import { useAccount, useConfig } from 'wagmi';
import { supabase } from '@/lib/supabase';

interface FriendPaymentProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FriendPayment: React.FC<FriendPaymentProps> = ({ isOpen, onClose }) => {
  const { address } = useAccount();
  const config = useConfig();
  const [showScanner, setShowScanner] = useState(false);
  const [friendAddress, setFriendAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<string>('');

  const handleQRScan = (scannedData: string) => {
    // 检查扫描的是否是钱包地址（以0x开头，42个字符）
    if (scannedData.startsWith('0x') && scannedData.length === 42) {
      setFriendAddress(scannedData);
      setShowScanner(false);
      setPaymentResult('');
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

    setIsProcessing(true);
    try {
      // 检查余额
      const balance = await checkFoodyBalance(address, config);
      const sendAmount = parseFloat(amount);
      
      if (balance < sendAmount) {
        alert(`Insufficient FOODY balance. You have ${balance.toFixed(2)} FOODY`);
        setIsProcessing(false);
        return;
      }

      // 执行转账 - 使用正确的类型
      const paymentRequest = {
        fromAddress: address,
        toAddress: friendAddress as `0x${string}`, // 类型断言
        foodyAmount: sendAmount,
        usdcEquivalent: 0, // 朋友转账不需要USDC
        orderId: `friend-transfer-${Date.now()}`,
        restaurantId: 'friend-transfer',
        restaurantName: 'Friend Transfer'
      };

      const result = await executeFoodyPayment(paymentRequest, config);
      
      if (result.success) {
        // 保存朋友转账记录到数据库
        try {
          const { error: insertError } = await supabase
            .from('confirm_and_pay')
            .insert({
              diner_wallet_address: address,
              restaurant_wallet_address: friendAddress,
              restaurant_name: 'Friend Transfer',
              total_amount: 0, // 朋友转账不涉及USDC
              foody_amount: sendAmount,
              tx_hash: result.transactionHash,
              payment_method: 'FOODY',
              status: 'paid',
              order_id: paymentRequest.orderId
            });

          if (insertError) {
            console.warn('Failed to save friend transfer record:', insertError);
          } else {
            console.log('✅ Friend transfer record saved successfully');
          }
        } catch (dbError) {
          console.warn('Database save error:', dbError);
        }

        setPaymentResult(`✅ Successfully sent ${sendAmount} FOODY to your friend!\n\nTransaction: ${result.transactionHash}\n\n💡 This transaction will appear in your Transaction History.`);
        setAmount('');
        setFriendAddress('');
      } else {
        setPaymentResult(`❌ Payment failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Friend payment error:', error);
      setPaymentResult('❌ Payment failed due to unexpected error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setShowScanner(false);
    setFriendAddress('');
    setAmount('');
    setPaymentResult('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl p-6 w-full max-w-md relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl"
        >
          ✕
        </button>
        
        <h2 className="text-xl font-bold text-green-400 mb-4">💸 Send FOODY to Friend</h2>
        
        {/* 朋友地址输入 */}
        <div className="space-y-4">
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
              />
              <button
                onClick={() => setShowScanner(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
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
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400"
            />
          </div>

          {/* 发送按钮 */}
          <button
            onClick={handleSendFoody}
            disabled={isProcessing || !friendAddress || !amount}
            className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center ${
              isProcessing || !friendAddress || !amount
                ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Sending...
              </>
            ) : (
              '💸 Send FOODY'
            )}
          </button>

          {/* 结果显示 */}
          {paymentResult && (
            <div className="bg-zinc-800 rounded-lg p-4">
              <pre className="text-sm text-white whitespace-pre-wrap">{paymentResult}</pre>
            </div>
          )}
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
