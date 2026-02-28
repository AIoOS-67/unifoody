'use client';

import { useState, useEffect } from 'react';
import { X, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// MVP: 支付记录接口，不再是订单接口
interface PaymentRecord {
  id: string;
  diner_id: string;
  restaurant_id: string;
  total_amount: number;
  foody_amount: number;
  status: 'completed'; // MVP: 支付记录都是已完成
  created_at: string;
  updated_at: string;
  diner_name?: string;
  restaurant_name?: string;
  tx_hash?: string;
  payment_method?: string;
  // MVP: 支付状态（支付记录都是已支付）
  payment_status: 'paid';
}

interface OrderManagementProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: string;
}

export function OrderManagement({ isOpen, onClose, restaurantId }: OrderManagementProps) {
  const [orders, setOrders] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid'>('all'); // MVP: 只显示支付状态

  useEffect(() => {
    if (isOpen) {
      fetchOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, restaurantId]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // MVP: 查询支付记录而不是订单记录
      const { data, error } = await supabase
        .from('confirm_and_pay')
        .select(`
          *,
          diners:diner_id (first_name, last_name, phone)
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching payment records:', error);
        return;
      }

      const formattedOrders = data?.map(payment => ({
        id: payment.order_id || payment.id,
        diner_id: payment.diner_id,
        restaurant_id: payment.restaurant_id,
        total_amount: payment.total_amount || 0,
        foody_amount: payment.foody_amount || 0,
        status: 'completed' as const, // MVP: 支付记录都是已完成
        payment_status: 'paid' as const, // MVP: confirm_and_pay 表中的都是已支付
        created_at: payment.created_at,
        updated_at: payment.updated_at || payment.created_at,
        diner_name: payment.diners ? `${payment.diners.first_name}` : 'Unknown',
        restaurant_name: payment.restaurant_name || 'Unknown Restaurant',
        tx_hash: payment.tx_hash,
        payment_method: payment.payment_method || 'FOODY'
      })) || [];

      setOrders(formattedOrders);
    } catch (error) {
      console.error('Failed to fetch payment records:', error);
    } finally {
      setLoading(false);
    }
  };

  // MVP: 获取支付状态颜色
  const getPaymentStatusColor = (order: PaymentRecord) => {
    const isPaid = order.status === 'completed' || order.payment_status === 'paid';
    return isPaid 
      ? 'text-green-500 bg-green-100 dark:bg-green-900'
      : 'text-red-500 bg-red-100 dark:bg-red-900';
  };

  // MVP: 获取支付状态图标
  const getPaymentStatusIcon = (order: PaymentRecord) => {
    const isPaid = order.status === 'completed' || order.payment_status === 'paid';
    return isPaid ? <CheckCircle size={16} /> : <Clock size={16} />;
  };

  // MVP: 获取支付状态文本
  const getPaymentStatusText = (order: PaymentRecord) => {
    const isPaid = order.status === 'completed' || order.payment_status === 'paid';
    return isPaid ? 'PAID' : 'UNPAID';
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    if (filter === 'paid') return order.status === 'completed' || order.payment_status === 'paid';
    if (filter === 'unpaid') return order.status !== 'completed' && order.payment_status !== 'paid';
    return false;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-4xl w-full h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Payment Management
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* Filter Tabs - MVP: 只显示支付状态 */}
        <div className="flex space-x-1 p-4 bg-gray-50 dark:bg-zinc-800">
          {(['all', 'paid', 'unpaid'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === status
                  ? 'bg-[#222c4e] text-white'
                  : 'bg-white dark:bg-zinc-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-600'
              }`}
            >
              {status === 'all' ? 'All' : status === 'paid' ? 'Paid' : 'Unpaid'}
              {status !== 'all' && (
                <span className="ml-2 bg-gray-200 dark:bg-gray-600 text-xs px-2 py-1 rounded-full">
                  {orders.filter(o => {
                    if (status === 'paid') return o.status === 'completed' || o.payment_status === 'paid';
                    if (status === 'unpaid') return o.status !== 'completed' && o.payment_status !== 'paid';
                    return false;
                  }).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#222c4e]"></div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No orders found for this filter
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                >
                  {/* Payment Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Payment #{order.id.slice(-8)}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {order.diner_name} • {new Date(order.created_at).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Restaurant: {order.restaurant_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(order)}`}>
                        {getPaymentStatusIcon(order)}
                        <span>{getPaymentStatusText(order)}</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                        ${order.total_amount.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div className="mb-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">FOODY Amount:</span>
                        <span className="ml-2 font-medium">{order.foody_amount.toFixed(2)} FOODY</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Payment Method:</span>
                        <span className="ml-2 font-medium">{order.payment_method}</span>
                      </div>
                      {order.tx_hash && (
                        <div className="col-span-2">
                          <span className="text-gray-600 dark:text-gray-400">Transaction:</span>
                          <span className="ml-2 font-mono text-xs">{order.tx_hash}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* MVP: 不显示Action Buttons，只显示支付状态 */}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
