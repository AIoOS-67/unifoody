'use client';

import { useState, useEffect } from 'react';
import {
  Phone,
  Clock,
  DollarSign,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type Language = 'EN' | '中文' | '粵語' | 'ES';
type CallStatus = 'completed' | 'failed' | 'transferred' | 'in_progress';
type DateRange = '7days' | '30days' | 'all';

interface TranscriptMessage {
  speaker: 'ai' | 'customer';
  text: string;
  timestamp: string;
}

interface Call {
  id: string;
  caller_phone: string;
  duration_seconds: number;
  language: Language;
  items_ordered: string[];
  total_amount: number;
  status: CallStatus;
  created_at: string;
  transcript?: TranscriptMessage[];
}

interface PaginatedResponse {
  calls: Call[];
  total: number;
  offset: number;
}

const LANGUAGE_LABELS: Record<Language, string> = {
  EN: 'English',
  '中文': 'Simplified Chinese',
  '粵語': 'Cantonese',
  ES: 'Spanish',
};

const STATUS_CONFIG: Record<
  CallStatus,
  { color: string; label: string }
> = {
  completed: {
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    label: 'Completed',
  },
  failed: {
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    label: 'Failed',
  },
  transferred: {
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    label: 'Transferred',
  },
  in_progress: {
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    label: 'In Progress',
  },
};

export default function AVOSCallHistory({
  restaurantId,
}: {
  restaurantId: string;
}) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('7days');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const LIMIT = 20;

  useEffect(() => {
    fetchCalls(0);
  }, [restaurantId, dateRange]);

  const fetchCalls = async (newOffset: number) => {
    try {
      if (newOffset === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const response = await fetch(
        `/api/avos/calls?restaurantId=${restaurantId}&limit=${LIMIT}&offset=${newOffset}&dateRange=${dateRange}`
      );

      if (!response.ok) throw new Error('Failed to fetch calls');

      const data: PaginatedResponse = await response.json();
      if (newOffset === 0) {
        setCalls(data.calls);
      } else {
        setCalls((prev) => [...prev, ...data.calls]);
      }
      setTotal(data.total);
      setOffset(newOffset);
    } catch (error) {
      console.error('Failed to fetch call history:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const handleLoadMore = () => {
    fetchCalls(offset + LIMIT);
  };

  const toggleExpand = async (callId: string) => {
    if (expandedCallId === callId) {
      setExpandedCallId(null);
      return;
    }

    const call = calls.find((c) => c.id === callId);
    if (call && !call.transcript) {
      // Fetch transcript if not already loaded
      try {
        const response = await fetch(
          `/api/avos/calls/${callId}?restaurantId=${restaurantId}`
        );
        if (!response.ok) throw new Error('Failed to fetch transcript');
        const data = await response.json();
        setCalls((prev) =>
          prev.map((c) =>
            c.id === callId ? { ...c, transcript: data.transcript } : c
          )
        );
      } catch (error) {
        console.error('Failed to fetch transcript:', error);
      }
    }

    setExpandedCallId(callId);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-gray-700 p-12">
        <div className="text-center">
          <Phone className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            No calls yet.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            Enable AVOS to start receiving AI-powered orders.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header and Filter */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          Call History
        </h3>
        <select
          value={dateRange}
          onChange={(e) => {
            setDateRange(e.target.value as DateRange);
          }}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
        >
          <option value="7days">Last 7 Days</option>
          <option value="30days">Last 30 Days</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 dark:text-white">
                  Date/Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 dark:text-white">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 dark:text-white">
                  Language
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 dark:text-white">
                  Items
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 dark:text-white">
                  Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 dark:text-white">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-900 dark:text-white">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {calls.map((call) => (
                <React.Fragment key={call.id}>
                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {formatDate(call.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDuration(call.duration_seconds)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200 rounded text-xs font-medium">
                        {LANGUAGE_LABELS[call.language]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {call.items_ordered.length} items
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        {call.total_amount.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          STATUS_CONFIG[call.status].color
                        }`}
                      >
                        {STATUS_CONFIG[call.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleExpand(call.id)}
                        className="inline-flex items-center justify-center p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        {expandedCallId === call.id ? (
                          <ChevronUp className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        )}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Transcript Row */}
                  {expandedCallId === call.id && (
                    <tr className="bg-gray-50 dark:bg-gray-800/50">
                      <td colSpan={7} className="px-4 py-4">
                        <div className="space-y-3">
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                              <MessageSquare className="w-4 h-4" />
                              Transcript
                            </h4>
                            {call.transcript && call.transcript.length > 0 ? (
                              <div className="space-y-2 max-h-60 overflow-y-auto">
                                {call.transcript.map((msg, i) => (
                                  <div key={i} className="flex gap-3">
                                    <div className="flex-shrink-0 w-20">
                                      <span
                                        className={`text-xs font-semibold ${
                                          msg.speaker === 'ai'
                                            ? 'text-blue-600 dark:text-blue-400'
                                            : 'text-green-600 dark:text-green-400'
                                        }`}
                                      >
                                        {msg.speaker === 'ai'
                                          ? 'AI'
                                          : 'Customer'}
                                      </span>
                                    </div>
                                    <div className="flex-1 space-y-1">
                                      <p className="text-xs text-gray-600 dark:text-gray-400">
                                        {msg.text}
                                      </p>
                                      <p className="text-xs text-gray-500 dark:text-gray-500">
                                        {msg.timestamp}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Transcript not available
                              </p>
                            )}
                          </div>

                          {call.items_ordered.length > 0 && (
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                Items Ordered
                              </h4>
                              <div className="space-y-1">
                                {call.items_ordered.map((item, i) => (
                                  <div
                                    key={i}
                                    className="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-2"
                                  >
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                    {item}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Load More Button */}
      {offset + LIMIT < total && (
        <button
          onClick={handleLoadMore}
          disabled={loadingMore}
          className="w-full px-4 py-3 border border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingMore ? 'Loading...' : `Load More (${total - calls.length} remaining)`}
        </button>
      )}

      {/* Results Info */}
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Showing {calls.length} of {total} calls
      </p>
    </div>
  );
}

// Import React for Fragment
import React from 'react';
