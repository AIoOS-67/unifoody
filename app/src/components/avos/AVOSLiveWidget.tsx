'use client';

import { useState, useEffect } from 'react';
import {
  Phone,
  PhoneIncoming,
  Clock,
  Globe,
  MessageSquare,
  DollarSign,
} from 'lucide-react';

type Language = 'EN' | '中文' | '粵語' | 'ES';

interface ActiveCall {
  id: string;
  caller_phone: string;
  duration_seconds: number;
  language: Language;
  dialog_state: string;
  last_transcript_line: string;
  current_order_items: string[];
  started_at: string;
}

interface DailySummary {
  total_calls: number;
  total_orders: number;
  total_revenue: number;
}

interface AVOSData {
  active_call: ActiveCall | null;
  summary: DailySummary;
}

const LANGUAGE_LABELS: Record<Language, string> = {
  EN: 'English',
  '中文': 'Simplified Chinese',
  '粵語': 'Cantonese',
  ES: 'Spanish',
};

export default function AVOSLiveWidget({
  restaurantId,
}: {
  restaurantId: string;
}) {
  const [data, setData] = useState<AVOSData | null>(null);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch active call data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          `/api/avos/calls?restaurantId=${restaurantId}&status=in_progress&limit=1`
        );
        if (!response.ok) throw new Error('Failed to fetch call data');
        const result = await response.json();
        setData(result);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch AVOS data:', error);
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [restaurantId]);

  // Duration timer
  useEffect(() => {
    if (!data?.active_call) return;

    const interval = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [data?.active_call]);

  const maskPhoneNumber = (phone: string): string => {
    if (!phone || phone.length < 4) return phone;
    const last4 = phone.slice(-4);
    return `***-***-${last4}`;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
      </div>
    );
  }

  const activeCall = data?.active_call;
  const summary = data?.summary;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
      {activeCall ? (
        // Active Call View
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                Call in Progress
              </span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 space-y-3">
            {/* Caller Phone */}
            <div className="flex items-center gap-3 text-sm">
              <PhoneIncoming className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
              <span className="font-mono text-gray-900 dark:text-white">
                {maskPhoneNumber(activeCall.caller_phone)}
              </span>
            </div>

            {/* Duration */}
            <div className="flex items-center gap-3 text-sm">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span className="font-mono text-gray-900 dark:text-white">
                {formatDuration(duration)}
              </span>
            </div>

            {/* Language */}
            <div className="flex items-center gap-3 text-sm">
              <Globe className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
              <span className="px-2 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200 rounded text-xs font-medium">
                {LANGUAGE_LABELS[activeCall.language as Language]}
              </span>
            </div>

            {/* Dialog State */}
            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-4 h-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 rounded text-xs font-medium">
                {activeCall.dialog_state}
              </span>
            </div>
          </div>

          {/* Last Transcript */}
          {activeCall.last_transcript_line && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <MessageSquare className="w-4 h-4 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">
                  {activeCall.last_transcript_line}
                </p>
              </div>
            </div>
          )}

          {/* Current Order Items */}
          {activeCall.current_order_items.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                Items Being Ordered
              </p>
              <div className="space-y-1">
                {activeCall.current_order_items.slice(0, 3).map((item, i) => (
                  <div
                    key={i}
                    className="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-2"
                  >
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    {item}
                  </div>
                ))}
                {activeCall.current_order_items.length > 3 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    +{activeCall.current_order_items.length - 3} more items
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        // No Active Call View
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
              No Active Calls
            </span>
          </div>

          {/* Daily Summary */}
          {summary && (
            <div className="grid grid-cols-3 gap-3 border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Phone className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {summary.total_calls}
                  </p>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Calls Today
                </p>
              </div>

              <div className="text-center border-l border-r border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <MessageSquare className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {summary.total_orders}
                  </p>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Orders Today
                </p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <DollarSign className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    ${summary.total_revenue.toFixed(0)}
                  </p>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Revenue Today
                </p>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Waiting for incoming calls...
          </p>
        </div>
      )}
    </div>
  );
}
