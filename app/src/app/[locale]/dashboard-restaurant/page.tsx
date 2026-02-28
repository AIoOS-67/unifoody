'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownLink,
  WalletDropdownDisconnect,
} from '@coinbase/onchainkit/wallet';
import {
  Address,
  Avatar,
  Name,
  Identity,
  EthBalance,
} from '@coinbase/onchainkit/identity';
import { supabase } from '@/lib/supabase';
import { QRGenerator } from '@/components/QRGenerator';
import { OrderManagement } from '@/components/OrderManagement';
import { FoodyBalance } from '@/components/FoodyBalance';
import { NFCTagManager } from '@/components/restaurant/NFCTagManager';
import AVOSConfigPanel from '@/components/avos/AVOSConfigPanel';
import AVOSLiveWidget from '@/components/avos/AVOSLiveWidget';
import AVOSCallHistory from '@/components/avos/AVOSCallHistory';
import AVOSAnalytics from '@/components/avos/AVOSAnalytics';
import Link from 'next/link';

interface Restaurant {
  id: string;
  wallet_address: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  zip_code: string;
  city: string;
  state: string;
  created_at: string;
  stripe_account_id?: string;
}

export default function RestaurantDashboard() {
  const router = useRouter();
  const { address } = useAccount();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  
  // MVP Modal states - 只保留核心功能
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [showOrderManagement, setShowOrderManagement] = useState(false);
  const [showNFCManager, setShowNFCManager] = useState(false);
  const [openingStripeDashboard, setOpeningStripeDashboard] = useState(false);

  // Portfolio display state - 美观简洁的展示控制
  const [showPortfolio, setShowPortfolio] = useState(false);

  // Tab state — 3 tabs: dashboard, payments, avos
  const [activeTab, setActiveTab] = useState<'dashboard' | 'payments' | 'avos'>('dashboard');
  const [avosSubTab, setAvosSubTab] = useState<'live' | 'history' | 'analytics' | 'settings'>('live');

  // Payments tab data
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentStats, setPaymentStats] = useState({ todayFiat: 0, todayCrypto: 0, todayTotal: 0, txCount: 0 });

  useEffect(() => {
    const checkAuth = async () => {
      if (!address) {
        router.push('/');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('restaurants')
          .select('*')
          .eq('wallet_address', address)
          .single();

        if (error || !data) {
          console.warn('Restaurant not found, redirecting to register');
          router.push('/register');
          return;
        }

        setRestaurant(data);
      } catch (err) {
        console.error('Error fetching restaurant data:', err);
        router.push('/register');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [address, router]);

  // Load payments data when Payments tab is active
  useEffect(() => {
    if (activeTab !== 'payments' || !restaurant?.id) return;

    const loadPayments = async () => {
      setPaymentsLoading(true);
      try {
        // Load recent fiat payments
        const { data: fiatData } = await supabase
          .from('fiat_payments')
          .select('*')
          .eq('restaurant_id', restaurant.id)
          .order('created_at', { ascending: false })
          .limit(20);

        // Load recent crypto payments (from orders table)
        const { data: cryptoData } = await supabase
          .from('orders')
          .select('*')
          .eq('restaurant_id', restaurant.id)
          .eq('payment_method', 'FOODY')
          .order('created_at', { ascending: false })
          .limit(20);

        const allPayments = [
          ...(fiatData || []).map((p: any) => ({
            id: p.id,
            amount: p.amount_usd,
            method: p.payment_method || 'card',
            status: p.status,
            created_at: p.created_at,
            type: 'fiat',
          })),
          ...(cryptoData || []).map((o: any) => ({
            id: o.id,
            amount: o.total_usd || o.amount,
            method: 'FOODY',
            status: o.status,
            created_at: o.created_at,
            type: 'crypto',
          })),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setRecentPayments(allPayments);

        // Calculate today's stats
        const today = new Date().toDateString();
        const todayPayments = allPayments.filter(
          (p) => new Date(p.created_at).toDateString() === today && p.status === 'succeeded'
        );
        const todayFiat = todayPayments
          .filter((p) => p.type === 'fiat')
          .reduce((sum, p) => sum + (p.amount || 0), 0);
        const todayCrypto = todayPayments
          .filter((p) => p.type === 'crypto')
          .reduce((sum, p) => sum + (p.amount || 0), 0);

        setPaymentStats({
          todayFiat: Math.round(todayFiat * 100) / 100,
          todayCrypto: Math.round(todayCrypto * 100) / 100,
          todayTotal: Math.round((todayFiat + todayCrypto) * 100) / 100,
          txCount: todayPayments.length,
        });
      } catch (err) {
        console.error('Error loading payments:', err);
      } finally {
        setPaymentsLoading(false);
      }
    };

    loadPayments();
  }, [activeTab, restaurant?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p>Loading restaurant dashboard...</p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return null;
  }

  const handleOpenStripeDashboard = async () => {
    if (!restaurant?.stripe_account_id) {
      alert('Stripe account not found. Please complete onboarding first.');
      return;
    }
    try {
      setOpeningStripeDashboard(true);
      const res = await fetch('/api/connect/express-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: restaurant.stripe_account_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create login link');
      window.location.href = data.url;
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Could not open Stripe Dashboard.');
    } finally {
      setOpeningStripeDashboard(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Welcome Banner */}
      <div className="bg-[#1e40af] text-white p-4 text-center border-b border-zinc-800">
        <h1 className="text-2xl font-bold">
          Welcome to FoodyePay, {restaurant.name.split(' ')[0]}!
        </h1>
        <p className="text-blue-100 mt-1">Manage your restaurant&apos;s Web3 payments</p>
        <p className="text-xs text-blue-200 mt-2 font-mono">
          Restaurant ID: {restaurant.id}
        </p>
      </div>

      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-purple-400">🍽️ {restaurant.name}</h1>
            <p className="text-sm text-gray-400">Restaurant Dashboard</p>
          </div>

          {/* Portfolio Toggle Button */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setShowPortfolio(!showPortfolio)}
                className="text-purple-400 hover:text-purple-300 transition-colors duration-200 font-medium"
              >
                Portfolio
              </button>
              
              {/* Portfolio Dropdown */}
              {showPortfolio && (
                <div className="absolute top-full right-0 mt-2 bg-zinc-900 rounded-xl p-6 shadow-2xl border border-zinc-700 min-w-[320px] z-50">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-purple-400">Restaurant Info</h2>
                    <button
                      onClick={() => setShowPortfolio(false)}
                      className="text-gray-400 hover:text-white transition-colors duration-200 text-lg"
                    >
                      ✕
                    </button>
                  </div>
                  
                  <div className="space-y-3 text-sm">
                    <div>
                      <label className="text-gray-400">Name:</label>
                      <p className="text-white font-medium">{restaurant.name}</p>
                    </div>
                    
                    <div>
                      <label className="text-gray-400">Address:</label>
                      <p className="text-white">{restaurant.address}</p>
                    </div>
                    
                    <div>
                      <label className="text-gray-400">Email:</label>
                      <p className="text-white">{restaurant.email}</p>
                    </div>
                    
                    <div>
                      <label className="text-gray-400">Phone:</label>
                      <p className="text-white">{restaurant.phone}</p>
                    </div>
                    
                    <div>
                      <label className="text-gray-400">Member Since:</label>
                      <p className="text-white">{new Date(restaurant.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Professional Wallet Component */}
            <Wallet>
            <ConnectWallet>
              <Avatar className="h-6 w-6" />
              <Name />
            </ConnectWallet>
            <WalletDropdown>
              <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                <Avatar />
                <Name />
                <Address />
                <EthBalance />
              </Identity>
              <WalletDropdownLink
                icon="wallet"
                href="https://keys.coinbase.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Wallet
              </WalletDropdownLink>
              <WalletDropdownDisconnect />
            </WalletDropdown>
          </Wallet>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto flex">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-6 py-3 text-sm font-medium transition-colors duration-200 border-b-2 ${
              activeTab === 'dashboard'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-6 py-3 text-sm font-medium transition-colors duration-200 border-b-2 flex items-center gap-2 ${
              activeTab === 'payments'
                ? 'border-green-500 text-green-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>Payments</span>
            <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-bold">💳</span>
          </button>
          <button
            onClick={() => setActiveTab('avos')}
            className={`px-6 py-3 text-sm font-medium transition-colors duration-200 border-b-2 flex items-center gap-2 ${
              activeTab === 'avos'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>AVOS</span>
            <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full font-bold">AI</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">

        {/* ===== DASHBOARD TAB ===== */}
        {activeTab === 'dashboard' && (
          <>
            {/* FOODY 余额显示 */}
            <div className="w-full max-w-md mx-auto mb-8">
              <FoodyBalance />
            </div>

            <div className="grid grid-cols-1 gap-6">

              {/* Quick Actions - MVP 核心功能 */}
              <div className="w-full">
                <div className="bg-zinc-900 rounded-xl p-6">
                  <h2 className="text-xl font-semibold text-purple-400 mb-6">Quick Actions</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* Generate QR Code */}
                    <button
                      onClick={() => setShowQRGenerator(true)}
                      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 p-6 rounded-lg transition-all duration-200 text-left group"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">📱</span>
                        <div>
                          <h3 className="font-semibold text-white group-hover:text-purple-100">Generate QR Code</h3>
                          <p className="text-sm text-purple-200">Create payment QR codes for orders</p>
                        </div>
                      </div>
                    </button>

                    {/* Payment Management */}
                    <button
                      onClick={() => setShowOrderManagement(true)}
                      className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 p-6 rounded-lg transition-all duration-200 text-left group"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">💳</span>
                        <div>
                          <h3 className="font-semibold text-white group-hover:text-yellow-100">Payment Management</h3>
                          <p className="text-sm text-yellow-200">View and process payment transactions</p>
                        </div>
                      </div>
                    </button>

                    {/* Manage payouts and settings (Stripe Express Dashboard) */}
                    <button
                      onClick={handleOpenStripeDashboard}
                      disabled={openingStripeDashboard || !restaurant?.stripe_account_id}
                      title={!restaurant?.stripe_account_id ? 'Stripe account not linked yet. Complete onboarding first.' : ''}
                      className={`p-6 rounded-lg transition-all duration-200 text-left group border border-zinc-700 ${
                        openingStripeDashboard || !restaurant?.stripe_account_id
                          ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">🏦</span>
                        <div>
                          <h3 className="font-semibold text-white group-hover:text-blue-100">Manage payouts and settings</h3>
                          <p className="text-sm text-blue-200">Open Stripe Express Dashboard</p>
                        </div>
                      </div>
                    </button>

                    {/* AVOS Quick Launch */}
                    <button
                      onClick={() => setActiveTab('avos')}
                      className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 p-6 rounded-lg transition-all duration-200 text-left group"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">🤖</span>
                        <div>
                          <h3 className="font-semibold text-white group-hover:text-orange-100">AVOS Voice Ordering</h3>
                          <p className="text-sm text-orange-200">AI phone ordering system — Patent Pending</p>
                        </div>
                      </div>
                    </button>

                    {/* Tap to Pay (POS) */}
                    <Link
                      href="/dashboard-restaurant/pos"
                      className={`p-6 rounded-lg transition-all duration-200 text-left group border border-zinc-700 ${
                        !restaurant?.stripe_account_id
                          ? 'bg-zinc-800 text-zinc-400 pointer-events-none'
                          : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">📟</span>
                        <div>
                          <h3 className="font-semibold text-white group-hover:text-green-100">Tap to Pay (POS)</h3>
                          <p className="text-sm text-green-200">Accept card payments at the counter</p>
                        </div>
                      </div>
                    </Link>

                    {/* NFC Tags */}
                    <button
                      onClick={() => setShowNFCManager(true)}
                      className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 p-6 rounded-lg transition-all duration-200 text-left group"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">📶</span>
                        <div>
                          <h3 className="font-semibold text-white group-hover:text-indigo-100">NFC Tags</h3>
                          <p className="text-sm text-indigo-200">Create NFC tap-to-pay tags for tables</p>
                        </div>
                      </div>
                    </button>

                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ===== PAYMENTS TAB ===== */}
        {activeTab === 'payments' && (
          <div className="space-y-6">
            {/* Today's Revenue */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <p className="text-gray-400 text-xs">Today&apos;s Revenue</p>
                <p className="text-2xl font-bold text-green-400">${paymentStats.todayTotal.toFixed(2)}</p>
              </div>
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <p className="text-gray-400 text-xs">Fiat (Card/Apple/Google)</p>
                <p className="text-2xl font-bold text-blue-400">${paymentStats.todayFiat.toFixed(2)}</p>
              </div>
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <p className="text-gray-400 text-xs">Crypto (FOODY)</p>
                <p className="text-2xl font-bold text-yellow-400">${paymentStats.todayCrypto.toFixed(2)}</p>
              </div>
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <p className="text-gray-400 text-xs">Transactions</p>
                <p className="text-2xl font-bold text-purple-400">{paymentStats.txCount}</p>
              </div>
            </div>

            {/* Quick Actions Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/dashboard-restaurant/pos"
                className={`p-4 rounded-xl border transition text-center ${
                  restaurant?.stripe_account_id
                    ? 'bg-green-500/10 border-green-500/30 hover:bg-green-500/20'
                    : 'bg-zinc-800 border-zinc-700 opacity-50 pointer-events-none'
                }`}
              >
                <span className="text-2xl">📟</span>
                <p className="text-green-400 font-medium text-sm mt-1">POS Terminal</p>
              </Link>
              <button
                onClick={() => setShowNFCManager(true)}
                className="p-4 rounded-xl border bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20 transition text-center"
              >
                <span className="text-2xl">📶</span>
                <p className="text-indigo-400 font-medium text-sm mt-1">NFC Tags</p>
              </button>
              <button
                onClick={() => setShowQRGenerator(true)}
                className="p-4 rounded-xl border bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 transition text-center"
              >
                <span className="text-2xl">📱</span>
                <p className="text-purple-400 font-medium text-sm mt-1">QR Codes</p>
              </button>
            </div>

            {/* Recent Transactions */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
              <h3 className="text-white font-semibold mb-4">Recent Transactions</h3>
              {paymentsLoading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-3 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-gray-400 text-sm mt-2">Loading payments...</p>
                </div>
              ) : recentPayments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm">No transactions yet</p>
                  <p className="text-gray-600 text-xs mt-1">Payments will appear here once customers start paying</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {recentPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between py-3 px-3 bg-zinc-800 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">
                          {payment.type === 'crypto'
                            ? '🪙'
                            : payment.method === 'apple_pay'
                            ? '🍎'
                            : payment.method === 'google_pay'
                            ? '📱'
                            : payment.method === 'terminal'
                            ? '📟'
                            : '💳'}
                        </span>
                        <div>
                          <p className="text-white text-sm font-medium">
                            ${(payment.amount || 0).toFixed(2)}
                          </p>
                          <p className="text-gray-500 text-xs">
                            {payment.method?.replace('_', ' ').toUpperCase()} •{' '}
                            {new Date(payment.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          payment.status === 'succeeded'
                            ? 'bg-green-500/20 text-green-400'
                            : payment.status === 'pending'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {payment.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stripe Dashboard Link */}
            {restaurant?.stripe_account_id && (
              <button
                onClick={handleOpenStripeDashboard}
                disabled={openingStripeDashboard}
                className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-xl border border-zinc-700 transition text-sm"
              >
                🏦 Open Stripe Express Dashboard for detailed reports
              </button>
            )}
          </div>
        )}

        {/* ===== AVOS TAB ===== */}
        {activeTab === 'avos' && (
          <div className="space-y-6">

            {/* AVOS Header */}
            <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-orange-400 flex items-center gap-3">
                    AVOS
                    <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-1 rounded-full">AI Voice Ordering System</span>
                    <span className="text-xs bg-zinc-700 text-zinc-300 px-2 py-1 rounded-full">Patent Pending</span>
                  </h2>
                  <p className="text-gray-400 mt-1">
                    AI-powered phone ordering with multilingual support (EN / 中文 / 粵語 / ES)
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Powered by Google Gemini &amp; Amazon Nova
                </div>
              </div>
            </div>

            {/* AVOS Sub-Navigation */}
            <div className="flex gap-2">
              {([
                { key: 'live' as const, label: 'Live Monitor', icon: '📞' },
                { key: 'history' as const, label: 'Call History', icon: '📋' },
                { key: 'analytics' as const, label: 'Analytics', icon: '📊' },
                { key: 'settings' as const, label: 'Settings', icon: '⚙️' },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setAvosSubTab(tab.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                    avosSubTab === tab.key
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'bg-zinc-900 text-gray-400 border border-zinc-800 hover:text-gray-200'
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* AVOS Sub-Tab Content */}
            {avosSubTab === 'live' && (
              <AVOSLiveWidget restaurantId={restaurant.id} />
            )}
            {avosSubTab === 'history' && (
              <AVOSCallHistory restaurantId={restaurant.id} />
            )}
            {avosSubTab === 'analytics' && (
              <AVOSAnalytics restaurantId={restaurant.id} />
            )}
            {avosSubTab === 'settings' && (
              <AVOSConfigPanel restaurantId={restaurant.id} />
            )}

          </div>
        )}

      </main>

      {/* Modals - 只保留核心功能的模态框 */}
      {showQRGenerator && (
        <QRGenerator
          isOpen={showQRGenerator}
          onClose={() => setShowQRGenerator(false)}
          restaurantId={restaurant?.id || ''}
          restaurantWalletAddress={restaurant?.wallet_address || ''}
          restaurantZipCode={restaurant?.zip_code || '10001'}
          restaurantInfo={{
            name: restaurant?.name || 'Restaurant',
            address: restaurant?.address || 'Address not available',
            email: restaurant?.email || 'Email not available',
            phone: restaurant?.phone || 'Phone not available',
            city: restaurant?.city || '',
            state: restaurant?.state || 'NY'
          }}
        />
      )}

      {showOrderManagement && (
        <OrderManagement
          isOpen={showOrderManagement}
          onClose={() => setShowOrderManagement(false)}
          restaurantId={restaurant?.id || ''}
        />
      )}

      {showNFCManager && (
        <NFCTagManager
          isOpen={showNFCManager}
          onClose={() => setShowNFCManager(false)}
          restaurantId={restaurant?.id || ''}
          restaurantName={restaurant?.name || 'Restaurant'}
        />
      )}

    </div>
  );
}
