'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Globe,
  Utensils,
} from 'lucide-react';

type Language = 'EN' | '中文' | '粵語' | 'ES';
type TimePeriod = 'today' | 'week' | 'month' | 'all';

interface StatCard {
  label: string;
  value: number;
  prevValue: number;
  trend: 'up' | 'down' | 'neutral';
  format: 'number' | 'currency' | 'percentage';
  icon: React.ReactNode;
}

interface PopularItem {
  name: string;
  count: number;
  revenue: number;
}

interface LanguageStats {
  language: Language;
  percentage: number;
  count: number;
}

interface AnalyticsData {
  total_calls: number;
  prev_total_calls: number;
  successful_orders: number;
  prev_successful_orders: number;
  successful_orders_percentage: number;
  average_order_value: number;
  prev_average_order_value: number;
  total_revenue: number;
  prev_total_revenue: number;
  popular_items: PopularItem[];
  language_distribution: LanguageStats[];
}

const LANGUAGE_LABELS: Record<Language, string> = {
  EN: 'English',
  '中文': 'Simplified Chinese',
  '粵語': 'Cantonese',
  ES: 'Spanish',
};

const LANGUAGE_COLORS: Record<Language, string> = {
  EN: 'bg-blue-500',
  '中文': 'bg-red-500',
  '粵語': 'bg-orange-500',
  ES: 'bg-green-500',
};

export default function AVOSAnalytics({
  restaurantId,
}: {
  restaurantId: string;
}) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState<TimePeriod>('week');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [restaurantId, period]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/avos/analytics?restaurantId=${restaurantId}&period=${period}`
      );

      if (!response.ok) throw new Error('Failed to fetch analytics');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTrend = (
    current: number,
    previous: number
  ): 'up' | 'down' | 'neutral' => {
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'neutral';
  };

  const calculateTrendPercentage = (
    current: number,
    previous: number
  ): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const formatNumber = (value: number, format: string): string => {
    switch (format) {
      case 'currency':
        return `$${value.toFixed(2)}`;
      case 'percentage':
        return `${value.toFixed(1)}%`;
      default:
        return value.toLocaleString();
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6 animate-pulse"
            >
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3"></div>
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const stats: StatCard[] = [
    {
      label: 'Total Calls',
      value: data.total_calls,
      prevValue: data.prev_total_calls,
      trend: calculateTrend(data.total_calls, data.prev_total_calls),
      format: 'number',
      icon: <Utensils className="w-5 h-5" />,
    },
    {
      label: 'Successful Orders',
      value: data.successful_orders,
      prevValue: data.prev_successful_orders,
      trend: calculateTrend(data.successful_orders, data.prev_successful_orders),
      format: 'number',
      icon: <TrendingUp className="w-5 h-5" />,
    },
    {
      label: 'Avg Order Value',
      value: data.average_order_value,
      prevValue: data.prev_average_order_value,
      trend: calculateTrend(
        data.average_order_value,
        data.prev_average_order_value
      ),
      format: 'currency',
      icon: <BarChart3 className="w-5 h-5" />,
    },
    {
      label: 'Revenue from AVOS',
      value: data.total_revenue,
      prevValue: data.prev_total_revenue,
      trend: calculateTrend(data.total_revenue, data.prev_total_revenue),
      format: 'currency',
      icon: <TrendingUp className="w-5 h-5" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Time Period Selector */}
      <div className="flex gap-2">
        {(['today', 'week', 'month', 'all'] as TimePeriod[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              period === p
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-purple-600 dark:hover:border-purple-400'
            }`}
          >
            {p === 'today'
              ? 'Today'
              : p === 'week'
                ? 'This Week'
                : p === 'month'
                  ? 'This Month'
                  : 'All Time'}
          </button>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const trendPercentage = calculateTrendPercentage(
            stat.value,
            stat.prevValue
          );
          const TrendIcon =
            stat.trend === 'up' ? TrendingUp : TrendingDown;

          return (
            <div
              key={i}
              className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    {stat.label}
                  </p>
                </div>
                <div className="text-gray-400 dark:text-gray-600">
                  {stat.icon}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {formatNumber(stat.value, stat.format)}
                </p>

                {stat.trend !== 'neutral' && (
                  <div
                    className={`flex items-center gap-1 text-sm font-medium ${
                      stat.trend === 'up'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    <TrendIcon className="w-4 h-4" />
                    {Math.abs(trendPercentage)}% from last period
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Popular Items and Language Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular Items */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Utensils className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Top Items Ordered
            </h3>
          </div>

          <div className="space-y-3">
            {data.popular_items.length > 0 ? (
              data.popular_items.map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {i + 1}. {item.name}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {item.count} orders • ${item.revenue.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 flex items-center justify-center">
                      <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                        #{i + 1}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No items ordered yet
              </p>
            )}
          </div>
        </div>

        {/* Language Distribution */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Language Distribution
            </h3>
          </div>

          <div className="space-y-4">
            {data.language_distribution.length > 0 ? (
              data.language_distribution.map((lang) => (
                <div key={lang.language} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {LANGUAGE_LABELS[lang.language]}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {lang.percentage.toFixed(1)}%
                      <span className="text-xs ml-1 text-gray-500 dark:text-gray-500">
                        ({lang.count})
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full ${LANGUAGE_COLORS[lang.language]} transition-all`}
                      style={{ width: `${lang.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No call data available
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
