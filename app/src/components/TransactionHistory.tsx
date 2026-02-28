'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { getDinerPaymentHistory } from '@/lib/confirmPayService'; // 使用新的服务
import { supabase } from '@/lib/supabase'; // 添加 supabase 用于调试

interface Transaction {
  id: string;
  restaurant_name: string;
  amount: number;
  status: string;
  created_at: string;
  tx_hash?: string;
  payment_method: string;
  foody_amount?: number; // 添加FOODY数量字段
}

interface TransactionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  dinerUuid?: string; // 添加可选的 dinerUuid 属性
}

const TransactionHistory = ({ isOpen, onClose, dinerUuid }: TransactionHistoryProps) => {
  const { address } = useAccount();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && address) {
      fetchTransactions();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, address, dinerUuid]);

  const fetchTransactions = async () => {
    if (!address) return;
    
    setLoading(true);
    try {
      console.log('🔍 Fetching payment history for:', address);
      console.log('🔍 Full wallet address:', address);
      
      // 首先检查 diner 是否存在
      console.log('1. 检查 diner 记录是否存在...');
      const { data: dinerCheck, error: dinerCheckError } = await supabase
        .from('diners')
        .select('*')
        .eq('wallet_address', address)
        .single();
      
      if (dinerCheckError) {
        console.error('❌ Diner 不存在或查询失败:', dinerCheckError);
        console.log('💡 提示: 可能需要先注册 diner');
        setTransactions([]);
        return;
      }
      
      console.log('✅ 找到 diner 记录:', dinerCheck);
      
      // 使用新的支付确认服务 - 从 confirm_and_pay 表读取
      const paymentData = await getDinerPaymentHistory(address, 20);
      
      console.log('📊 Fetched payment data:', paymentData);
      console.log('📊 Payment data length:', paymentData?.length || 0);
      
      // 格式化数据 - 从 confirm_and_pay 表，所有记录都是 'paid' 状态
      const formattedTransactions: Transaction[] = paymentData.map((item: {
        id: any;
        restaurant_name: any;
        total_amount: any;
        foody_amount: any;
        status: any;
        created_at: any;
        tx_hash: any;
        payment_method: any;
      }) => {
        // 🔧 智能处理FOODY金额缩放问题
        let correctedFoodyAmount = item.foody_amount || 0;
        
        // 如果FOODY金额异常大（可能被错误放大了1,000,000倍），则修正
        if (correctedFoodyAmount > 0 && item.total_amount > 0) {
          const ratio = correctedFoodyAmount / item.total_amount;
          // 正常FOODY汇率应该在5000-15000之间，如果超过500万则可能被放大了
          if (ratio > 5000000) {
            correctedFoodyAmount = correctedFoodyAmount / 1000000;
            console.log(`🔧 修正FOODY金额: ${item.foody_amount} -> ${correctedFoodyAmount}`);
          }
        }

        return {
          id: item.id,
          restaurant_name: item.restaurant_name || '未知餐厅',
          amount: item.total_amount || 0,
          status: 'paid', // confirm_and_pay 表中所有记录都是已支付状态
          created_at: item.created_at,
          tx_hash: item.tx_hash || '',
          payment_method: item.payment_method || 'FOODY',
          foody_amount: correctedFoodyAmount
        };
      });

      console.log('✅ Formatted payment history:', formattedTransactions);
      setTransactions(formattedTransactions);
      
    } catch (error) {
      console.error('❌ Error fetching payment history:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
      case 'completed':
      case 'confirmed':
      case 'delivered':
        return 'text-green-500';
      case 'pending':
        return 'text-yellow-500';
      case 'failed':
      case 'cancelled':
        return 'text-red-500';
      default:
        return 'text-green-500'; // confirm_and_pay 表默认都是绿色
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid':
      case 'completed':
      case 'confirmed':
      case 'delivered':
        return 'Paid'; // 简化显示为 "Paid"
      case 'pending':
        return 'Pending';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Paid'; // confirm_and_pay 表默认都是 Paid
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Transaction History
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        
        <div className="overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Loading...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">No transaction records</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {tx.restaurant_name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {formatDate(tx.created_at)}
                      </p>
                      {tx.foody_amount && tx.foody_amount > 0 && (
                        <p className="text-xs text-yellow-500 mt-1 font-medium">
                          FOODY: {tx.foody_amount.toLocaleString()}
                        </p>
                      )}
                      {tx.tx_hash && (
                        <p className="text-xs text-blue-500 mt-1 font-mono truncate">
                          {tx.tx_hash.slice(0, 20)}...
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        ${tx.amount.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {tx.payment_method}
                      </p>
                      <p className={`text-sm font-medium ${getStatusColor(tx.status)}`}>
                        {getStatusText(tx.status)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="mt-4 flex justify-center">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionHistory;