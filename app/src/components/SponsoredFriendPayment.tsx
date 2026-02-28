import React, { useState, useCallback } from 'react';
import { QRScanner } from './QRScanner';
import { useAccount } from 'wagmi';
import { supabase } from '@/lib/supabase';
import { 
  Transaction, 
  TransactionButton, 
  TransactionSponsor, 
  TransactionStatus, 
  TransactionStatusAction, 
  TransactionStatusLabel 
} from '@coinbase/onchainkit/transaction';
import type { LifecycleStatus } from '@coinbase/onchainkit/transaction';
import { encodeFunctionData, parseEther } from 'viem';
import { unichain } from '@/lib/chains';

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

// FOODY Token contract address on Base (从环境变量获取)
const FOODY_TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_FOODYE_TOKEN_ADDRESS || '0x1022b1b028a2237c440dbac51dc6fc220d88c08f') as `0x${string}`;

interface SponsoredFriendPaymentProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SponsoredFriendPayment: React.FC<SponsoredFriendPaymentProps> = ({ isOpen, onClose }) => {
  const { address } = useAccount();
  const [showScanner, setShowScanner] = useState(false);
  const [friendAddress, setFriendAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleQRScan = (scannedData: string) => {
    // 检查扫描的是否是钱包地址（以0x开头，42个字符）
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

  // 创建转账交易的 calls
  const getTransferCalls = useCallback(() => {
    if (!friendAddress || !amount || !isValidAddress(friendAddress)) {
      return [];
    }

    try {
      const transferAmount = parseEther(amount); // 转换为 wei

      return [
        {
          to: FOODY_TOKEN_ADDRESS,
          data: encodeFunctionData({
            abi: FOODY_TOKEN_ABI,
            functionName: 'transfer',
            args: [friendAddress as `0x${string}`, transferAmount],
          }),
          value: BigInt(0),
        },
      ];
    } catch (error) {
      console.error('Error creating transfer calls:', error);
      return [];
    }
  }, [friendAddress, amount]);

  // 处理交易状态变化
  const handleOnStatus = useCallback(async (status: LifecycleStatus) => {
    console.log('Transaction status:', status);
    
    if (status.statusName === 'success' && status.statusData?.transactionReceipts) {
      const transactionHash = status.statusData.transactionReceipts[0]?.transactionHash;
      
      if (transactionHash) {
        // 保存朋友转账记录到数据库
        try {
          const { error: insertError } = await supabase
            .from('confirm_and_pay')
            .insert({
              diner_wallet_address: address,
              restaurant_wallet_address: friendAddress,
              restaurant_name: 'Friend Transfer (Sponsored)',
              total_amount: 0, // 朋友转账不涉及USDC
              foody_amount: parseFloat(amount),
              tx_hash: transactionHash,
              payment_method: 'FOODY_SPONSORED',
              status: 'paid',
              order_id: `sponsored-friend-transfer-${Date.now()}`
            });

          if (insertError) {
            console.warn('Failed to save sponsored friend transfer record:', insertError);
          } else {
            console.log('✅ Sponsored friend transfer record saved successfully');
          }
        } catch (dbError) {
          console.warn('Database save error:', dbError);
        }

        // 清空表单
        setAmount('');
        setFriendAddress('');
        
        // 延迟关闭模态框以显示成功状态
        setTimeout(() => {
          onClose();
        }, 3000);
      }
    }
  }, [address, friendAddress, amount, onClose]);

  const handleClose = () => {
    setShowScanner(false);
    setFriendAddress('');
    setAmount('');
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
        
        <h2 className="text-xl font-bold text-green-400 mb-4">🎉 Send FOODY to Friend (Gas-Free!)</h2>
        
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

          {/* Sponsored Transaction */}
          {canProceed && (
            <Transaction
              calls={getTransferCalls()}
              chainId={unichain.id}
              capabilities={{
                paymasterService: {
                  url: process.env.NEXT_PUBLIC_COINBASE_PAYMASTER_URL || `https://api.developer.coinbase.com/rpc/v1/base/${process.env.NEXT_PUBLIC_COINBASE_PROJECT_ID}`,
                },
              }}
              onStatus={handleOnStatus}
            >
              <div className="space-y-3">
                {/* 显示这是 sponsored transaction */}
                <TransactionSponsor className="text-green-400 text-sm flex items-center justify-center bg-green-500/10 rounded-lg p-2" />
                
                {/* 发送按钮 */}
                {/* @ts-ignore React 18/19 type mismatch with OnchainKit */}
                <TransactionButton
                  text="🎉 Send FOODY (Gas-Free!)"
                  disabled={!canProceed}
                  className="w-full py-3 px-4 rounded-lg font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
                />
                
                {/* 交易状态 */}
                <TransactionStatus>
                  <TransactionStatusLabel className="text-white" />
                  <TransactionStatusAction className="text-blue-400 hover:text-blue-300" />
                </TransactionStatus>
              </div>
            </Transaction>
          )}

          {/* 如果表单未完成则显示提示 */}
          {!canProceed && (
            <div className="bg-zinc-800 rounded-lg p-4 text-center">
              <p className="text-gray-400 text-sm">
                {!friendAddress ? "Enter friend's wallet address" : 
                 !amount ? "Enter amount to send" : 
                 parseFloat(amount) <= 0 ? "Amount must be greater than 0" : 
                 "Invalid wallet address"}
              </p>
            </div>
          )}

          {/* Gas-free 说明 */}
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <span className="text-green-400">🎉</span>
              <div>
                <p className="text-green-400 font-medium text-sm">Gas-Free Transaction</p>
                <p className="text-green-300 text-xs">Powered by Base Sponsored Transactions</p>
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
