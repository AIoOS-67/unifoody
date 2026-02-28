'use client';

import { useState, useEffect } from 'react';
import { X, TrendingUp, DollarSign } from 'lucide-react';
import { getRestaurantTransactions } from '@/lib/transactionService';
import Image from 'next/image';

interface FinancialStats {
  today_revenue: number;
  week_revenue: number;
  month_revenue: number;
  total_orders: number;
  today_orders: number;
  week_orders: number;
  avg_order_value: number;
  foody_earned: number;
}

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  order_id?: string;
}

interface FinancialAnalyticsProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: string;
}

export function FinancialAnalytics({ isOpen, onClose, restaurantId }: FinancialAnalyticsProps) {
  const [stats, setStats] = useState<FinancialStats>({
    today_revenue: 0,
    week_revenue: 0,
    month_revenue: 0,
    total_orders: 0,
    today_orders: 0,
    week_orders: 0,
    avg_order_value: 0,
    foody_earned: 0
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week');

  useEffect(() => {
    if (isOpen) {
      fetchFinancialData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, restaurantId, timeRange]);

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      console.log('📊 Fetching financial data for restaurant:', restaurantId);
      
      // 使用新的交易服务获取餐厅交易
      const transactionData = await getRestaurantTransactions(restaurantId, 50);
      
      console.log('💰 Fetched restaurant transactions:', transactionData);
      
      // 计算日期范围
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // 处理交易数据，明确类型 - 匹配实际数据库结构
      const completedTransactions = transactionData.filter((item: {
        status: string;
        created_at: string;
        total_amount: number;
        foody_amount: number;
        payments?: Array<{
          tx_hash: string;
          status: string;
        }>;
        id: string;
      }) => 
        item.status === 'completed' || item.status === 'delivered'
      );

      // 计算统计数据
      const todayTransactions = completedTransactions.filter((item) => 
        new Date(item.created_at) >= todayStart
      );
      const weekTransactions = completedTransactions.filter((item) => 
        new Date(item.created_at) >= weekStart
      );

      const todayRevenue = todayTransactions.reduce((sum: number, item) => 
        sum + (item.total_amount || 0), 0
      );
      const weekRevenue = weekTransactions.reduce((sum: number, item) => 
        sum + (item.total_amount || 0), 0
      );
      const monthRevenue = completedTransactions.reduce((sum: number, item) => 
        sum + (item.total_amount || 0), 0
      );

      const foodyEarned = completedTransactions.reduce((sum: number, item) => {
        return sum + (item.foody_amount || 0);
      }, 0);

      const avgOrderValue = completedTransactions.length > 0 ? 
        monthRevenue / completedTransactions.length : 0;

      // 更新统计数据
      setStats({
        today_revenue: todayRevenue,
        week_revenue: weekRevenue,
        month_revenue: monthRevenue,
        total_orders: completedTransactions.length,
        today_orders: todayTransactions.length,
        week_orders: weekTransactions.length,
        avg_order_value: avgOrderValue,
        foody_earned: foodyEarned
      });

      // 格式化交易记录用于显示
      const formattedTransactions: Transaction[] = completedTransactions
        .slice(0, 10) // 只显示最近10笔
        .map((item) => {
          return {
            id: item.id,
            amount: item.total_amount || 0,
            currency: 'FOODY',
            status: item.status,
            created_at: item.created_at,
            order_id: item.id
          };
        });

      setTransactions(formattedTransactions);

    } catch (error) {
      console.error('❌ Error fetching financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ 
    title, 
    value, 
    icon, 
    color, 
    subtitle 
  }: { 
    title: string; 
    value: string; 
    icon: React.ReactNode; 
    color: string; 
    subtitle?: string;
  }) => (
    <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-2 rounded-lg ${color.replace('text-', 'bg-').replace('600', '100')} dark:${color.replace('text-', 'bg-').replace('600', '900')}`}>
          {icon}
        </div>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-6xl w-full h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Financial Analytics
          </h2>
          <div className="flex items-center space-x-4">
            <div className="flex bg-gray-100 dark:bg-zinc-800 rounded-lg p-1">
              {(['week', 'month', 'year'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    timeRange === range
                      ? 'bg-[#222c4e] text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#222c4e]"></div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                  title="Today's Revenue"
                  value={`$${stats.today_revenue.toFixed(2)}`}
                  icon={<DollarSign size={20} />}
                  color="text-green-600"
                  subtitle={`${stats.today_orders} orders`}
                />
                
                <StatCard
                  title="This Week"
                  value={`$${stats.week_revenue.toFixed(2)}`}
                  icon={<TrendingUp size={20} />}
                  color="text-blue-600"
                  subtitle={`${stats.week_orders} orders`}
                />
                
                <StatCard
                  title="This Month"
                  value={`$${stats.month_revenue.toFixed(2)}`}
                  icon={<DollarSign size={20} />}
                  color="text-purple-600"
                  subtitle={`${stats.total_orders} total orders`}
                />
                
                <StatCard
                  title="FOODY Earned"
                  value={`${stats.foody_earned.toFixed(2)}`}
                  icon={<Image src="/FoodyBot.png" alt="FOODY" width={20} height={20} />}
                  color="text-yellow-600"
                  subtitle="Loyalty rewards"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Key Metrics */}
                <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Key Metrics</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Average Order Value</span>
                      <span className="font-semibold text-gray-900 dark:text-white">${stats.avg_order_value.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Orders Today</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{stats.today_orders}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Orders This Week</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{stats.week_orders}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Total Orders</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{stats.total_orders}</span>
                    </div>
                  </div>
                </div>

                {/* Revenue Breakdown */}
                <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Revenue Breakdown</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Today</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          ${stats.today_revenue.toFixed(2)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: stats.month_revenue > 0 
                              ? `${Math.min((stats.today_revenue / stats.month_revenue) * 100, 100)}%` 
                              : '0%' 
                          }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-600 dark:text-gray-400">This Week</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          ${stats.week_revenue.toFixed(2)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: stats.month_revenue > 0 
                              ? `${Math.min((stats.week_revenue / stats.month_revenue) * 100, 100)}%` 
                              : '0%' 
                          }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-600 dark:text-gray-400">This Month</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          ${stats.month_revenue.toFixed(2)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div className="bg-purple-600 h-2 rounded-full w-full transition-all duration-300"></div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="flex-1 overflow-y-auto p-6 pt-0">
          <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Transactions</h3>
            </div>
            
            {transactions.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                No transactions found
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {transactions.slice(0, 10).map((transaction) => (
                  <div key={transaction.id} className="p-4 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                        <DollarSign size={16} className="text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          Payment Received
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(transaction.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        +{transaction.amount.toFixed(4)} {transaction.currency}
                      </p>
                      <p className="text-sm text-green-600 dark:text-green-400 capitalize">
                        {transaction.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
