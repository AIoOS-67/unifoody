// app/[locale]/admin/dashboard/page.tsx
// Platform Admin Dashboard — see ALL platform data
'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────
interface AdminData {
  timestamp: string;
  period: string;
  overview: {
    restaurants: { total: number; new_this_week: number; verified: number };
    diners: { total: number; new_this_week: number };
    orders: { total: number; gmv: number; avg_order_value: number; completed: number; pending: number };
    payments: { total: number; successful: number; total_volume: number; success_rate: number };
    foody: { total_purchases: number; total_foody_purchased: number; total_usdt_spent: number };
    avos: { total_calls: number; completed_calls: number; avg_duration: number; language_count: number };
    rewards: { total: number; completed: number; pending: number; total_distributed: number };
  };
  restaurants: Array<{ id: string; name: string; wallet_address: string; business_verified: boolean; phone_verified: boolean; created_at: string; order_count: number; total_revenue: number }>;
  diners: Array<{ id: string; first_name: string; last_name: string; email: string; wallet_address: string; state?: string; created_at: string; order_count: number; total_spent: number }>;
  recentOrders: Array<{ id: string; restaurant_id: string; restaurant_name: string; diner_id: string; items: any; subtotal: number; tax: number; total: number; status: string; created_at: string }>;
  paymentMethods: Array<{ payment_method: string; count: number; volume: number }>;
  dailyVolume: Array<{ day: string; count: number; volume: number }>;
  avosLanguages: Array<{ language: string; count: number }>;
  avosOrders: { total: number; revenue: number; foody_collected: number };
}

type Tab = 'overview' | 'restaurants' | 'users' | 'orders' | 'payments' | 'avos' | 'agents' | 'onchain';
type Period = 'today' | 'week' | 'month' | 'all';

// ─── Helpers ──────────────────────────────────────────
function truncAddr(addr: string): string {
  if (!addr) return 'N/A';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtCurrency(v: number): string {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function getTier(spent: number): { name: string; color: string } {
  if (spent >= 1000) return { name: 'VIP', color: 'text-yellow-400' };
  if (spent >= 500) return { name: 'Gold', color: 'text-yellow-500' };
  if (spent >= 200) return { name: 'Silver', color: 'text-gray-300' };
  return { name: 'Bronze', color: 'text-orange-400' };
}
function statusBadge(status: string) {
  const s = status?.toLowerCase() || '';
  if (['completed', 'succeeded'].includes(s)) return 'bg-green-500/20 text-green-400';
  if (['pending', 'processing'].includes(s)) return 'bg-yellow-500/20 text-yellow-400';
  return 'bg-red-500/20 text-red-400';
}

// ─── Color Map (Tailwind JIT needs full class names) ──
const textColorMap: Record<string, string> = {
  green: 'text-green-400',
  blue: 'text-blue-400',
  purple: 'text-purple-400',
  yellow: 'text-yellow-400',
  orange: 'text-orange-400',
  cyan: 'text-cyan-400',
  red: 'text-red-400',
};
const bgColorMap: Record<string, string> = {
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  yellow: 'bg-yellow-500',
  orange: 'bg-orange-500',
  cyan: 'bg-cyan-500',
  red: 'bg-red-500',
};

// ─── Stat Card ────────────────────────────────────────
function StatCard({ label, value, subtitle, color = 'green' }: { label: string; value: string | number; subtitle?: string; color?: string }) {
  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
      <p className="text-gray-400 text-xs">{label}</p>
      <p className={`text-2xl font-bold ${textColorMap[color] || 'text-green-400'} mt-1`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

// ─── Bar Chart ────────────────────────────────────────
function BarChart({ data, labelKey, valueKey, title, color = 'green' }: { data: any[]; labelKey: string; valueKey: string; title: string; color?: string }) {
  if (!data || data.length === 0) return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
      <h3 className="text-sm font-bold text-white mb-4">{title}</h3>
      <p className="text-gray-500 text-sm">No data yet</p>
    </div>
  );
  const maxVal = Math.max(...data.map(d => Number(d[valueKey]) || 0), 1);
  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
      <h3 className="text-sm font-bold text-white mb-4">{title}</h3>
      <div className="space-y-2">
        {data.map((d, i) => {
          const val = Number(d[valueKey]) || 0;
          const pct = (val / maxVal) * 100;
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-24 truncate">{d[labelKey]}</span>
              <div className="flex-1 bg-zinc-800 rounded-full h-4 overflow-hidden">
                <div className={`h-full ${bgColorMap[color] || 'bg-green-500'} rounded-full transition-all`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-gray-400 w-20 text-right">
                {typeof val === 'number' && valueKey.includes('volume') ? fmtCurrency(val) : val.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────
export default function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [period, setPeriod] = useState<Period>('all');

  const [restaurantSearch, setRestaurantSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // ─── Pagination ──────────────────────────────────────
  const ITEMS_PER_PAGE = 20;
  const [pages, setPages] = useState<Record<string, number>>({
    restaurants: 1, users: 1, orders: 1, blockchain: 1, simulation: 1,
  });
  const setPage = (key: string, p: number) => setPages(prev => ({ ...prev, [key]: p }));

  // ─── On-Chain State ──────────────────────────────────
  interface OnchainTx {
    txHash: string;
    blockNumber: number;
    timestamp: number;
    from: string;
    to: string;
    foodyAmount: string;
    fromLabel: string;
    toLabel: string;
    source?: string;
    rewardType?: string;
    rewardEmoji?: string;
    loyaltyTier?: string;
    usdcAmount?: number;
  }
  const [blockchainTxs, setBlockchainTxs] = useState<OnchainTx[]>([]);
  const [simulationTxs, setSimulationTxs] = useState<OnchainTx[]>([]);
  const [onchainLoading, setOnchainLoading] = useState(false);
  const [onchainError, setOnchainError] = useState('');
  const [blockchainStats, setBlockchainStats] = useState({ totalTxs: 0, totalFoody: 0, activeWallets: 0 });
  const [simulationStats, setSimulationStats] = useState({ totalRewards: 0, totalFoody: 0, uniqueWallets: 0, tierDistribution: { none: 0, bronze: 0, silver: 0, gold: 0, platinum: 0 } as Record<string, number> });
  const FOODY_TOKEN = '0x55aEcFfA2F2E4DDcc63B40bac01b939A9C23f91A';

  // Fetch on-chain data via server-side API (avoids browser RPC rate limits)
  const fetchOnchain = async () => {
    setOnchainLoading(true);
    setOnchainError('');
    try {
      const storedKey = localStorage.getItem('admin_api_key') ?? keyInput;
      const res = await fetch('/api/admin/onchain', {
        headers: { 'Authorization': `Bearer ${storedKey}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to fetch on-chain data');

      setBlockchainTxs(data.blockchainTxs ?? []);
      setSimulationTxs(data.simulationTxs ?? []);
      setBlockchainStats(data.blockchainStats ?? { totalTxs: 0, totalFoody: 0, activeWallets: 0 });
      setSimulationStats(data.simulationStats ?? { totalRewards: 0, totalFoody: 0, uniqueWallets: 0, tierDistribution: {} });
    } catch (e: any) {
      setOnchainError(e.message ?? 'Failed to fetch on-chain data');
    } finally {
      setOnchainLoading(false);
    }
  };

  // Auto-fetch when switching to onchain tab
  useEffect(() => {
    if (activeTab === 'onchain') fetchOnchain();
  }, [activeTab]);

  // Fetch data
  const fetchData = useCallback(async (apiKey: string, p: Period) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/dashboard-stats?period=${p}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.status === 401) {
        localStorage.removeItem('admin_api_key');
        setAuthenticated(false);
        setAuthError('API key expired or invalid');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-login from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('admin_api_key');
    if (saved) {
      setAuthenticated(true);
      fetchData(saved, period);
    }
  }, []); // eslint-disable-line

  // Re-fetch on period change
  useEffect(() => {
    if (!authenticated) return;
    const key = localStorage.getItem('admin_api_key');
    if (key) fetchData(key, period);
  }, [period, authenticated, fetchData]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!authenticated || !autoRefresh) return;
    const interval = setInterval(() => {
      const key = localStorage.getItem('admin_api_key');
      if (key) fetchData(key, period);
    }, 10000);
    return () => clearInterval(interval);
  }, [authenticated, autoRefresh, period, fetchData]);

  // Login handler
  const handleLogin = async () => {
    setAuthError('');
    const res = await fetch(`/api/admin/dashboard-stats?period=all`, {
      headers: { Authorization: `Bearer ${keyInput}` },
    });
    if (res.ok) {
      localStorage.setItem('admin_api_key', keyInput);
      setAuthenticated(true);
      const json = await res.json();
      setData(json);
    } else {
      setAuthError('Invalid API key');
    }
  };

  // ─── Login Screen ──────────────────────────────────
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-8 w-full max-w-sm space-y-4">
          <div className="text-center">
            <span className="text-3xl">🛡️</span>
            <h1 className="text-xl font-bold mt-2">Admin Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">Enter your admin API key</p>
          </div>
          <input
            type="password"
            placeholder="API Key"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:border-green-500 focus:outline-none"
          />
          {authError && <p className="text-red-400 text-sm text-center">{authError}</p>}
          <button
            onClick={handleLogin}
            disabled={!keyInput}
            className="w-full py-2.5 rounded-lg font-semibold bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-700 disabled:text-gray-500 transition-colors"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  // ─── Loading ───────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  const o = data?.overview;

  // ─── Tab configs ────────────────────────────────────
  const tabs: { key: Tab; label: string; emoji: string }[] = [
    { key: 'overview', label: 'Overview', emoji: '📊' },
    { key: 'restaurants', label: 'Restaurants', emoji: '🏪' },
    { key: 'users', label: 'Users', emoji: '👥' },
    { key: 'orders', label: 'Orders', emoji: '🛒' },
    { key: 'payments', label: 'Payments', emoji: '💳' },
    { key: 'avos', label: 'AVOS', emoji: '📞' },
    { key: 'agents', label: 'Agents', emoji: '🤖' },
    { key: 'onchain', label: 'On-Chain', emoji: '⛓️' },
  ];

  const periods: { key: Period; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'all', label: 'All Time' },
  ];

  // Filtered lists
  const filteredRestaurants = (data?.restaurants || []).filter(r =>
    r.name?.toLowerCase().includes(restaurantSearch.toLowerCase())
  );
  const filteredUsers = (data?.diners || []).filter(d =>
    `${d.first_name} ${d.last_name} ${d.email}`.toLowerCase().includes(userSearch.toLowerCase())
  );

  // ─── Pagination helper ──────────────────────────────
  const paginate = <T,>(arr: T[], key: string) => {
    const page = pages[key] || 1;
    const total = arr.length;
    const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return { items: arr.slice(start, start + ITEMS_PER_PAGE), page: safePage, totalPages, total, start };
  };

  const PaginationControls = ({ pageKey, totalItems, className = '' }: { pageKey: string; totalItems: number; className?: string }) => {
    const page = pages[pageKey] || 1;
    const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * ITEMS_PER_PAGE + 1;
    const end = Math.min(safePage * ITEMS_PER_PAGE, totalItems);
    if (totalItems <= ITEMS_PER_PAGE) return null;
    return (
      <div className={`flex items-center justify-between px-4 py-2 ${className}`}>
        <span className="text-xs text-gray-500">Showing {start}–{end} of {totalItems.toLocaleString()}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(pageKey, 1)} disabled={safePage <= 1}
            className="px-2 py-1 text-xs rounded border border-zinc-700 text-gray-400 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed">First</button>
          <button onClick={() => setPage(pageKey, safePage - 1)} disabled={safePage <= 1}
            className="px-2 py-1 text-xs rounded border border-zinc-700 text-gray-400 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed">‹</button>
          <span className="px-3 py-1 text-xs text-gray-300 border border-zinc-700 rounded bg-zinc-800/50">Page {safePage} of {totalPages}</span>
          <button onClick={() => setPage(pageKey, safePage + 1)} disabled={safePage >= totalPages}
            className="px-2 py-1 text-xs rounded border border-zinc-700 text-gray-400 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed">›</button>
          <button onClick={() => setPage(pageKey, totalPages)} disabled={safePage >= totalPages}
            className="px-2 py-1 text-xs rounded border border-zinc-700 text-gray-400 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-red-400">Last</button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛡️</span>
            <div>
              <h1 className="text-lg font-bold">FoodyePay Admin</h1>
              <p className="text-xs text-gray-500">Platform Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Live indicator */}
            {autoRefresh && (
              <div className="flex items-center gap-1.5 bg-red-900/30 border border-red-700/50 rounded-full px-3 py-1">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-400 text-xs font-bold">LIVE</span>
              </div>
            )}
            {/* Auto-refresh toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                autoRefresh ? 'bg-red-600/20 text-red-400 border border-red-700/50' : 'bg-zinc-800 text-gray-400'
              }`}
            >
              {autoRefresh ? '⏸ Pause' : '▶ Auto'}
            </button>
            {/* Period filter */}
            <div className="flex bg-zinc-800 rounded-lg p-0.5">
              {periods.map(p => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    period === p.key ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {/* Refresh */}
            <button
              onClick={() => { const k = localStorage.getItem('admin_api_key'); if (k) fetchData(k, period); }}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Refresh"
            >
              ↻
            </button>
            {/* Logout */}
            <button
              onClick={() => { localStorage.removeItem('admin_api_key'); setAuthenticated(false); setData(null); setKeyInput(''); }}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto flex overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === t.key
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Error */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && data && (
        <div className="max-w-7xl mx-auto px-6 mt-2">
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            Refreshing...
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* ════════ OVERVIEW ════════ */}
        {activeTab === 'overview' && o && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Restaurants" value={o.restaurants.total} subtitle={`${o.restaurants.verified} verified, +${o.restaurants.new_this_week} this week`} color="purple" />
              <StatCard label="Diners" value={o.diners.total} subtitle={`+${o.diners.new_this_week} this week`} color="blue" />
              <StatCard label="Total Orders" value={o.orders.total} subtitle={`${o.orders.completed} completed, ${o.orders.pending} pending`} color="yellow" />
              <StatCard label="GMV" value={fmtCurrency(o.orders.gmv)} subtitle={`avg ${fmtCurrency(o.orders.avg_order_value)}`} color="green" />
              <StatCard label="FOODY Purchased" value={o.foody.total_foody_purchased.toLocaleString()} subtitle={`${fmtCurrency(o.foody.total_usdt_spent)} USDT spent`} color="orange" />
              <StatCard label="Payment Success" value={`${o.payments.success_rate.toFixed(1)}%`} subtitle={`${o.payments.successful}/${o.payments.total} payments`} color="green" />
              <StatCard label="AVOS Calls" value={o.avos.total_calls} subtitle={`${o.avos.completed_calls} completed, avg ${o.avos.avg_duration}s`} color="orange" />
              <StatCard label="Rewards" value={`${o.rewards.total_distributed.toLocaleString()} FOODY`} subtitle={`${o.rewards.completed} completed, ${o.rewards.pending} pending`} color="purple" />
            </div>
            <BarChart
              data={data?.dailyVolume || []}
              labelKey="day"
              valueKey="volume"
              title="Payment Volume (Last 14 Days)"
              color="green"
            />
          </>
        )}

        {/* ════════ RESTAURANTS ════════ */}
        {activeTab === 'restaurants' && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">All Restaurants ({filteredRestaurants.length})</h3>
              <input
                placeholder="Search by name..."
                value={restaurantSearch}
                onChange={e => { setRestaurantSearch(e.target.value); setPage('restaurants', 1); }}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white w-64 focus:border-green-500 focus:outline-none"
              />
            </div>
            <PaginationControls pageKey="restaurants" totalItems={filteredRestaurants.length} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs border-b border-zinc-800">
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-left px-4 py-3">Wallet</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Orders</th>
                    <th className="text-right px-4 py-3">Revenue</th>
                    <th className="text-right px-4 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {paginate(filteredRestaurants, 'restaurants').items.map(r => (
                    <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/50">
                      <td className="px-4 py-3 text-white font-medium">{r.name}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{truncAddr(r.wallet_address)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${r.business_verified ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {r.business_verified ? 'Verified' : 'Unverified'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-right">{r.order_count}</td>
                      <td className="px-4 py-3 text-green-400 text-right font-medium">{fmtCurrency(r.total_revenue)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs text-right">{fmtDate(r.created_at)}</td>
                    </tr>
                  ))}
                  {filteredRestaurants.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No restaurants found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls pageKey="restaurants" totalItems={filteredRestaurants.length} className="border-t border-zinc-800" />
          </div>
        )}

        {/* ════════ USERS ════════ */}
        {activeTab === 'users' && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">All Diners ({filteredUsers.length})</h3>
              <input
                placeholder="Search by name or email..."
                value={userSearch}
                onChange={e => { setUserSearch(e.target.value); setPage('users', 1); }}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white w-64 focus:border-green-500 focus:outline-none"
              />
            </div>
            <PaginationControls pageKey="users" totalItems={filteredUsers.length} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs border-b border-zinc-800">
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">Wallet</th>
                    <th className="text-center px-4 py-3">State</th>
                    <th className="text-right px-4 py-3">Orders</th>
                    <th className="text-right px-4 py-3">Spent</th>
                    <th className="text-center px-4 py-3">Tier</th>
                    <th className="text-right px-4 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {paginate(filteredUsers, 'users').items.map(d => {
                    const tier = getTier(d.total_spent);
                    return (
                      <tr key={d.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/50">
                        <td className="px-4 py-3 text-white font-medium">{d.first_name} {d.last_name}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{d.email || '-'}</td>
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">{truncAddr(d.wallet_address)}</td>
                        <td className="px-4 py-3 text-center text-xs"><span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">{d.state || '—'}</span></td>
                        <td className="px-4 py-3 text-gray-300 text-right">{d.order_count}</td>
                        <td className="px-4 py-3 text-green-400 text-right">{fmtCurrency(d.total_spent)}</td>
                        <td className={`px-4 py-3 text-center text-xs font-bold ${tier.color}`}>{tier.name}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs text-right">{fmtDate(d.created_at)}</td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No users found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls pageKey="users" totalItems={filteredUsers.length} className="border-t border-zinc-800" />
          </div>
        )}

        {/* ════════ ORDERS ════════ */}
        {activeTab === 'orders' && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-800">
              <h3 className="text-lg font-bold text-white">Recent Orders ({data?.recentOrders?.length || 0})</h3>
            </div>
            <PaginationControls pageKey="orders" totalItems={data?.recentOrders?.length || 0} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs border-b border-zinc-800">
                    <th className="text-left px-4 py-3">Order ID</th>
                    <th className="text-left px-4 py-3">Restaurant</th>
                    <th className="text-right px-4 py-3">Items</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginate(data?.recentOrders || [], 'orders').items.map(o => {
                    const itemCount = Array.isArray(o.items) ? o.items.length : 0;
                    return (
                      <tr key={o.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/50">
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">{o.id.slice(0, 8)}...</td>
                        <td className="px-4 py-3 text-white">{o.restaurant_name || 'Unknown'}</td>
                        <td className="px-4 py-3 text-gray-300 text-right">{itemCount}</td>
                        <td className="px-4 py-3 text-green-400 text-right font-medium">{fmtCurrency(o.total || 0)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs ${statusBadge(o.status)}`}>{o.status}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs text-right">{fmtDate(o.created_at)}</td>
                      </tr>
                    );
                  })}
                  {(!data?.recentOrders || data.recentOrders.length === 0) && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No orders yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls pageKey="orders" totalItems={data?.recentOrders?.length || 0} className="border-t border-zinc-800" />
          </div>
        )}

        {/* ════════ PAYMENTS ════════ */}
        {activeTab === 'payments' && o && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Volume" value={fmtCurrency(o.payments.total_volume)} color="green" />
              <StatCard label="Success Rate" value={`${o.payments.success_rate.toFixed(1)}%`} subtitle={`${o.payments.successful}/${o.payments.total}`} color="green" />
              <StatCard label="FOODY Purchases" value={o.foody.total_purchases} subtitle={`${o.foody.total_foody_purchased.toLocaleString()} FOODY`} color="orange" />
              <StatCard label="AVOS Revenue" value={fmtCurrency(data?.avosOrders?.revenue || 0)} subtitle={`${data?.avosOrders?.total || 0} voice orders`} color="orange" />
            </div>
            <BarChart
              data={data?.paymentMethods || []}
              labelKey="payment_method"
              valueKey="volume"
              title="Payment Methods Breakdown"
              color="blue"
            />
            <BarChart
              data={data?.dailyVolume || []}
              labelKey="day"
              valueKey="volume"
              title="Daily Payment Volume (14 Days)"
              color="green"
            />
          </>
        )}

        {/* ════════ AVOS ════════ */}
        {activeTab === 'avos' && o && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Calls" value={o.avos.total_calls} color="orange" />
              <StatCard label="Completed" value={o.avos.completed_calls} subtitle={o.avos.total_calls > 0 ? `${((o.avos.completed_calls / o.avos.total_calls) * 100).toFixed(0)}% success` : ''} color="green" />
              <StatCard label="Avg Duration" value={`${o.avos.avg_duration}s`} color="blue" />
              <StatCard label="Languages" value={o.avos.language_count} color="purple" />
            </div>
            <BarChart
              data={data?.avosLanguages || []}
              labelKey="language"
              valueKey="count"
              title="Calls by Language"
              color="orange"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="AVOS Orders" value={data?.avosOrders?.total || 0} color="yellow" />
              <StatCard label="AVOS Revenue" value={fmtCurrency(data?.avosOrders?.revenue || 0)} color="green" />
              <StatCard label="FOODY Collected" value={`${(data?.avosOrders?.foody_collected || 0).toLocaleString()} FOODY`} color="orange" />
            </div>
          </>
        )}

        {/* ════════ AGENTS ════════ */}
        {activeTab === 'agents' && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-12 text-center">
            <span className="text-6xl block mb-4">🤖</span>
            <h3 className="text-xl font-bold text-cyan-400 mb-2">Agent Monitoring</h3>
            <p className="text-gray-400">Coming soon — OpenClaw Agent activity tracking</p>
            <p className="text-gray-500 text-sm mt-2">
              Will monitor: autonomous agent registrations, orders, token spending, Moltbook posts, and task completion rates
            </p>
            <div className="mt-6 grid grid-cols-3 gap-4 max-w-md mx-auto">
              <div className="bg-zinc-800 rounded-lg p-3">
                <p className="text-cyan-400 text-2xl font-bold">0</p>
                <p className="text-gray-500 text-xs">Active Agents</p>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3">
                <p className="text-cyan-400 text-2xl font-bold">0</p>
                <p className="text-gray-500 text-xs">Agent Orders</p>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3">
                <p className="text-cyan-400 text-2xl font-bold">0</p>
                <p className="text-gray-500 text-xs">FOODY Spent</p>
              </div>
            </div>
          </div>
        )}

        {/* ─── On-Chain Tab ─────────────────────────────────── */}
        {activeTab === 'onchain' && (
          <div className="space-y-8">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">⛓️ On-Chain Activity</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Real blockchain transfers + V4 Hook simulation data
                </p>
              </div>
              <button
                onClick={fetchOnchain}
                disabled={onchainLoading}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
              >
                {onchainLoading ? '⟳ Loading…' : '↺ Refresh'}
              </button>
            </div>

            {onchainError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                {onchainError}
              </div>
            )}

            {/* ════════════════════════════════════════════════════ */}
            {/* SECTION 1: Real Blockchain Transfers                */}
            {/* ════════════════════════════════════════════════════ */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <h3 className="text-lg font-semibold text-white">Real On-Chain Transfers</h3>
                <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded-full font-mono">Base Sepolia</span>
                <a
                  href={`https://sepolia.uniscan.xyz/token/${FOODY_TOKEN}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:underline font-mono text-xs ml-auto"
                >
                  {FOODY_TOKEN.slice(0, 10)}...{FOODY_TOKEN.slice(-6)} ↗
                </a>
              </div>

              {/* Blockchain stat cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-zinc-900 rounded-xl border border-cyan-800/40 p-4">
                  <p className="text-gray-400 text-xs">Transfers</p>
                  <p className="text-2xl font-bold text-cyan-400 mt-1">{blockchainStats.totalTxs}</p>
                </div>
                <div className="bg-zinc-900 rounded-xl border border-cyan-800/40 p-4">
                  <p className="text-gray-400 text-xs">FOODY Transferred</p>
                  <p className="text-2xl font-bold text-green-400 mt-1">{blockchainStats.totalFoody.toLocaleString()}</p>
                </div>
                <div className="bg-zinc-900 rounded-xl border border-cyan-800/40 p-4">
                  <p className="text-gray-400 text-xs">Wallets</p>
                  <p className="text-2xl font-bold text-purple-400 mt-1">{blockchainStats.activeWallets}</p>
                </div>
              </div>

              {/* Blockchain transaction table */}
              <div className="bg-zinc-900 rounded-xl border border-cyan-800/40 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-gray-300">FOODY ERC-20 Transfer Events</h4>
                  <span className="text-xs text-gray-500">— verifiable on Uniscan</span>
                </div>

                {onchainLoading ? (
                  <div className="p-8 text-center text-gray-500">
                    <div className="text-3xl mb-2 animate-pulse">⛓️</div>
                    <p className="text-sm">Reading from Base Sepolia RPC…</p>
                  </div>
                ) : blockchainTxs.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <div className="text-3xl mb-2">📭</div>
                    <p className="text-sm">No transfers found in the last 50,000 blocks</p>
                  </div>
                ) : (
                  <>
                  <PaginationControls pageKey="blockchain" totalItems={blockchainTxs.length} />
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 text-xs border-b border-zinc-800">
                          <th className="px-4 py-3">Time</th>
                          <th className="px-4 py-3">From</th>
                          <th className="px-4 py-3">To</th>
                          <th className="px-4 py-3 text-right">FOODY</th>
                          <th className="px-4 py-3">Block</th>
                          <th className="px-4 py-3">TX</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginate(blockchainTxs, 'blockchain').items.map((tx) => (
                          <tr key={tx.txHash} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                            <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                              {tx.timestamp
                                ? new Date(tx.timestamp * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                : `Block #${tx.blockNumber}`}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <span className={tx.fromLabel.startsWith('🔑') ? 'text-yellow-400' : tx.fromLabel.startsWith('🍽️') ? 'text-blue-400' : 'text-gray-300'}>
                                {tx.fromLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <span className={tx.toLabel.startsWith('🏪') ? 'text-green-400' : tx.toLabel.startsWith('🍽️') ? 'text-blue-400' : 'text-gray-300'}>
                                {tx.toLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-cyan-400">
                              {tx.foodyAmount}
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                              #{tx.blockNumber.toLocaleString()}
                            </td>
                            <td className="px-4 py-3">
                              <a
                                href={`https://sepolia.uniscan.xyz/tx/${tx.txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan-500 hover:text-cyan-300 font-mono text-xs"
                              >
                                {tx.txHash.slice(0, 8)}… ↗
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <PaginationControls pageKey="blockchain" totalItems={blockchainTxs.length} className="border-t border-zinc-800" />
                  </>
                )}
              </div>
            </div>

            {/* ════════════════════════════════════════════════════ */}
            {/* SECTION 2: V4 Hook Settlements (Simulation)        */}
            {/* ════════════════════════════════════════════════════ */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                <h3 className="text-lg font-semibold text-white">V4 Hook Settlements</h3>
                <span className="px-2 py-0.5 bg-violet-500/20 text-violet-400 text-xs rounded-full">Simulation</span>
                <span className="text-gray-500 text-xs ml-auto">FoodySwap Hook reward calculations from AI simulation</span>
              </div>

              {/* Simulation stat cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-zinc-900 rounded-xl border border-violet-800/40 p-4">
                  <p className="text-gray-400 text-xs">Reward Events</p>
                  <p className="text-2xl font-bold text-violet-400 mt-1">{simulationStats.totalRewards.toLocaleString()}</p>
                </div>
                <div className="bg-zinc-900 rounded-xl border border-violet-800/40 p-4">
                  <p className="text-gray-400 text-xs">FOODY Distributed</p>
                  <p className="text-2xl font-bold text-green-400 mt-1">{simulationStats.totalFoody.toLocaleString()}</p>
                </div>
                <div className="bg-zinc-900 rounded-xl border border-violet-800/40 p-4">
                  <p className="text-gray-400 text-xs">Unique Wallets</p>
                  <p className="text-2xl font-bold text-purple-400 mt-1">{simulationStats.uniqueWallets.toLocaleString()}</p>
                </div>
                <div className="bg-zinc-900 rounded-xl border border-violet-800/40 p-4">
                  <p className="text-gray-400 text-xs">Tier Distribution</p>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {simulationStats.tierDistribution && Object.entries(simulationStats.tierDistribution).filter(([, v]) => v > 0).map(([tier, count]) => (
                      <span key={tier} className={`text-xs px-1.5 py-0.5 rounded ${
                        tier === 'platinum' ? 'bg-indigo-500/20 text-indigo-300' :
                        tier === 'gold' ? 'bg-yellow-500/20 text-yellow-300' :
                        tier === 'silver' ? 'bg-gray-500/20 text-gray-300' :
                        'bg-amber-500/20 text-amber-300'
                      }`}>
                        {tier}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Simulation settlement table */}
              <div className="bg-zinc-900 rounded-xl border border-violet-800/40 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-gray-300">Hook Reward Settlements</h4>
                  <span className="text-xs text-gray-500">— computed from afterSwap() hook logic</span>
                </div>

                {onchainLoading ? (
                  <div className="p-8 text-center text-gray-500">
                    <div className="text-3xl mb-2 animate-pulse">🦄</div>
                    <p className="text-sm">Loading V4 Hook data…</p>
                  </div>
                ) : simulationTxs.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <div className="text-3xl mb-2">🦄</div>
                    <p className="text-sm">No V4 Hook settlements yet — start the simulation</p>
                  </div>
                ) : (
                  <>
                  <PaginationControls pageKey="simulation" totalItems={simulationTxs.length} />
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 text-xs border-b border-zinc-800">
                          <th className="px-4 py-3">Time</th>
                          <th className="px-4 py-3">Reward Type</th>
                          <th className="px-4 py-3">Wallet</th>
                          <th className="px-4 py-3 text-right">FOODY</th>
                          <th className="px-4 py-3">Tier</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginate(simulationTxs, 'simulation').items.map((tx, i) => (
                          <tr key={`${tx.txHash}-${i}`} className="border-b border-zinc-800/50 hover:bg-violet-900/10 transition-colors">
                            <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                              {tx.timestamp
                                ? new Date(tx.timestamp * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                : '—'}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <span className="text-violet-400">
                                {tx.rewardEmoji} {tx.rewardType?.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <span className="text-blue-400">{tx.toLabel}</span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-violet-400">
                              {tx.foodyAmount}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <span className={`px-1.5 py-0.5 rounded ${
                                tx.loyaltyTier === 'platinum' ? 'bg-indigo-500/20 text-indigo-300' :
                                tx.loyaltyTier === 'gold' ? 'bg-yellow-500/20 text-yellow-300' :
                                tx.loyaltyTier === 'silver' ? 'bg-gray-500/20 text-gray-300' :
                                'bg-amber-500/20 text-amber-300'
                              }`}>
                                {tx.loyaltyTier || 'bronze'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <PaginationControls pageKey="simulation" totalItems={simulationTxs.length} className="border-t border-zinc-800" />
                  </>
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-4 text-center text-xs text-gray-600">
        Last updated: {data?.timestamp ? new Date(data.timestamp).toLocaleString() : '-'} | Period: {period}
      </footer>
    </div>
  );
}
