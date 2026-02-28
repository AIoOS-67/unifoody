'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { KioskAudioEngine } from '@/components/kiosk/KioskAudioEngine';
import type { MenuCardData, MenuCardMatch, ReceiptCardData, CheckoutReadyData } from '@/components/kiosk/KioskAudioEngine';
import { KioskCart } from '@/components/kiosk/KioskCart';
import { MotionDetector } from '@/components/kiosk/MotionDetector';
import { ExpressCheckout } from '@/components/payment/ExpressCheckout';
import QRCode from 'qrcode';

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface Restaurant {
  id: string;
  name: string;
  description?: string;
  stripe_account_id?: string;
  wallet_address?: string;
  address?: string;
}

interface CartItem {
  menu_item_id: string;
  item_name: string;
  price_usd: number;
  quantity: number;
  modifications?: string[];
}

interface Transcript {
  text: string;
  role: 'user' | 'agent';
  time: number;
}

type KioskState = 'IDLE' | 'ACTIVE' | 'CHECKOUT';

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------

const INACTIVITY_WARN_MS = 60_000; // 60 seconds before warning
const INACTIVITY_RESET_MS = 75_000; // 75 seconds before full reset
const CHECKOUT_TIMEOUT_MS = 120_000; // 2 minutes to scan QR

// Use localhost for local dev, Cloud Run for production
const AGENT_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:8081'
  : (process.env.NEXT_PUBLIC_AGENT_URL || 'https://foodyepay-agent-443906211776.us-east1.run.app');

// -------------------------------------------------------------------
// Page Component
// -------------------------------------------------------------------

export default function KioskPage() {
  const params = useParams();
  const restaurantId = params.restaurantId as string;
  const locale = (params.locale as string) || 'en';

  // Restaurant data
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract state code from restaurant address (e.g., "123 Main St, New York, NY 10001")
  const restaurantState = restaurant?.address?.match(/\b([A-Z]{2})\s*\d{5}/)?.[1] || 'NY';

  // Kiosk state machine
  const [kioskState, setKioskState] = useState<KioskState>('IDLE');
  const [sessionId, setSessionId] = useState('');

  // Cart & transcript
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [inactivityWarning, setInactivityWarning] = useState(false);

  // Dynamic Menu Card
  const [menuCard, setMenuCard] = useState<MenuCardData | null>(null);
  const [menuCardVisible, setMenuCardVisible] = useState(false);
  const menuCardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Receipt Card (order summary)
  const [receiptCard, setReceiptCard] = useState<ReceiptCardData | null>(null);
  const [receiptCardVisible, setReceiptCardVisible] = useState(false);
  const receiptCardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Checkout
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [orderTotal, setOrderTotal] = useState({ subtotal: 0, tax: 0, total: 0 });
  const [checkoutOrderId, setCheckoutOrderId] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Timers
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------
  // Load restaurant
  // -------------------------------------------------------------------

  useEffect(() => {
    if (restaurantId) loadRestaurant();
  }, [restaurantId]);

  const loadRestaurant = async () => {
    try {
      const { data, error: dbError } = await supabase
        .from('restaurants')
        .select('id, name, description, stripe_account_id, wallet_address, address')
        .eq('id', restaurantId)
        .single();

      if (dbError || !data) {
        setError('Restaurant not found.');
        return;
      }
      setRestaurant(data);
    } catch {
      setError('Failed to load restaurant.');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------
  // State machine transitions
  // -------------------------------------------------------------------

  const generateSessionId = () =>
    `kiosk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const startOrder = useCallback(() => {
    if (kioskState !== 'IDLE') return;

    const newSid = generateSessionId();
    setSessionId(newSid);
    setCartItems([]);
    setTranscripts([]);
    setInactivityWarning(false);
    setKioskState('ACTIVE');
    resetInactivityTimer();
  }, [kioskState]);

  const goToCheckout = useCallback(async (checkoutData?: CheckoutReadyData) => {
    if (kioskState !== 'ACTIVE') return;

    setKioskState('CHECKOUT');
    setPaymentSuccess(false);
    clearAllTimers();

    // Use AI-provided data if available, otherwise calculate locally
    let subtotal: number, tax: number, total: number;
    if (checkoutData) {
      subtotal = checkoutData.subtotal_usd;
      tax = checkoutData.tax_usd;
      total = checkoutData.total_usd;
    } else {
      subtotal = cartItems.reduce((sum, i) => sum + i.price_usd * i.quantity, 0);
      // Fetch restaurant state tax rate; fallback to 7.25% national average
      let taxRate = 0.0725;
      try {
        const res = await fetch(`/api/calculate-tax?state=${encodeURIComponent(restaurantState || 'NY')}`);
        if (res.ok) {
          const data = await res.json();
          taxRate = data.tax_rate || 0.0725;
        }
      } catch { /* use fallback */ }
      tax = Math.round(subtotal * taxRate * 100) / 100;
      total = Math.round((subtotal + tax) * 100) / 100;
    }
    setOrderTotal({ subtotal, tax, total });

    // Generate payment URL and QR code
    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
    setCheckoutOrderId(orderId);
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://foodyepay.com';
    const paymentUrl = `${baseUrl}/${locale}/pay/${restaurantId}?amount=${total.toFixed(2)}&order=${orderId}&source=kiosk&session=${sessionId}`;

    try {
      const dataUrl = await QRCode.toDataURL(paymentUrl, {
        width: 280,
        margin: 2,
        color: { dark: '#ffffff', light: '#00000000' },
      });
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error('[Kiosk] QR generation error:', err);
    }

    // Auto-reset after checkout timeout
    checkoutTimerRef.current = setTimeout(resetToIdle, CHECKOUT_TIMEOUT_MS);
  }, [kioskState, cartItems, locale, restaurantId, sessionId]);

  // Handle AI-triggered checkout (from trigger_checkout tool)
  const handleCheckoutReady = useCallback((data: CheckoutReadyData) => {
    goToCheckout(data);
  }, [goToCheckout]);

  const resetToIdle = useCallback(() => {
    clearAllTimers();
    setKioskState('IDLE');
    setSessionId('');
    setCartItems([]);
    setTranscripts([]);
    setInactivityWarning(false);
    setQrDataUrl('');
    setOrderTotal({ subtotal: 0, tax: 0, total: 0 });
    setMenuCard(null);
    setMenuCardVisible(false);
    setReceiptCard(null);
    setReceiptCardVisible(false);
  }, []);

  // -------------------------------------------------------------------
  // Inactivity timer
  // -------------------------------------------------------------------

  const clearAllTimers = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    if (checkoutTimerRef.current) clearTimeout(checkoutTimerRef.current);
    if (menuCardTimerRef.current) clearTimeout(menuCardTimerRef.current);
    if (receiptCardTimerRef.current) clearTimeout(receiptCardTimerRef.current);
    inactivityTimerRef.current = null;
    resetTimerRef.current = null;
    checkoutTimerRef.current = null;
    menuCardTimerRef.current = null;
    receiptCardTimerRef.current = null;
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setInactivityWarning(false);

    inactivityTimerRef.current = setTimeout(() => {
      setInactivityWarning(true);
      // Give 15 more seconds after warning
      resetTimerRef.current = setTimeout(resetToIdle, INACTIVITY_RESET_MS - INACTIVITY_WARN_MS);
    }, INACTIVITY_WARN_MS);
  }, [resetToIdle]);

  // -------------------------------------------------------------------
  // Event handlers from audio engine
  // -------------------------------------------------------------------

  const handleTranscript = useCallback(
    (text: string, role: 'user' | 'agent') => {
      setTranscripts((prev) => [...prev.slice(-20), { text, role, time: Date.now() }]);
    },
    []
  );

  const handleCartUpdate = useCallback((items: CartItem[]) => {
    setCartItems(items);
  }, []);

  const handleActivityDetected = useCallback(() => {
    if (kioskState === 'ACTIVE') {
      resetInactivityTimer();
    }
  }, [kioskState, resetInactivityTimer]);

  const handleCheckoutRequested = useCallback(() => {
    if (cartItems.length > 0) {
      goToCheckout();
    }
  }, [cartItems, goToCheckout]);

  const handleMenuCard = useCallback((data: MenuCardData) => {
    // If a card is already visible, fade it out briefly before showing new one
    if (menuCardVisible && menuCard) {
      setMenuCardVisible(false);
      // Short gap (250ms) then show new card — smooth transition, no "flash"
      setTimeout(() => {
        setMenuCard(data);
        setMenuCardVisible(true);
      }, 250);
    } else {
      // First card — show immediately
      setMenuCard(data);
      setMenuCardVisible(true);
    }

    // Clear previous timer
    if (menuCardTimerRef.current) clearTimeout(menuCardTimerRef.current);

    // Auto-hide after 15 seconds (was 8s — too short, felt like "flashing")
    menuCardTimerRef.current = setTimeout(() => {
      setMenuCardVisible(false);
      // Remove from DOM after fade-out animation (700ms for slower exit)
      setTimeout(() => setMenuCard(null), 700);
    }, 15000);
  }, [menuCard, menuCardVisible]);

  const handleReceiptCard = useCallback((data: ReceiptCardData) => {
    setReceiptCard(data);
    setReceiptCardVisible(true);

    if (receiptCardTimerRef.current) clearTimeout(receiptCardTimerRef.current);

    // Auto-hide after 20 seconds
    receiptCardTimerRef.current = setTimeout(() => {
      setReceiptCardVisible(false);
      setTimeout(() => setReceiptCard(null), 700);
    }, 20000);
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  // -------------------------------------------------------------------
  // Render: Loading / Error
  // -------------------------------------------------------------------

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full" />
          <p className="text-gray-400">Loading kiosk...</p>
        </div>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-3">{error || 'Restaurant not found'}</p>
          <a href="/" className="text-orange-400 hover:underline">
            Go back to home
          </a>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------
  // Render: IDLE State — Attract Screen
  // -------------------------------------------------------------------

  if (kioskState === 'IDLE') {
    return (
      <div
        className="h-screen bg-black flex flex-col items-center justify-center cursor-pointer select-none"
        onClick={startOrder}
      >
        {/* Motion detector running in background */}
        <MotionDetector
          enabled={true}
          sensitivity={25}
          onMotionDetected={startOrder}
        />

        {/* Attract screen */}
        <div className="text-center animate-fade-in px-6">
          {/* Restaurant logo / name */}
          <div className="mb-6 sm:mb-8">
            <div className="w-52 h-52 sm:w-72 sm:h-72 mx-auto mb-4 sm:mb-6">
              <img src="/FoodyBot.png" alt="Foody" className="w-full h-full object-contain animate-foody-float drop-shadow-[0_0_25px_rgba(249,115,22,0.5)]" />
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2">
              {restaurant.name}
            </h1>
            {restaurant.description && (
              <p className="text-gray-400 text-sm sm:text-lg max-w-md mx-auto">
                {restaurant.description}
              </p>
            )}
          </div>

          {/* Pulsing CTA */}
          <div className="animate-kiosk-pulse">
            <div className="inline-flex items-center gap-2 sm:gap-3 bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 sm:px-10 py-4 sm:py-5 rounded-2xl text-xl sm:text-2xl font-bold shadow-2xl shadow-orange-600/30">
              <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              Tap to Order
            </div>
          </div>

          <p className="text-gray-600 text-xs sm:text-sm mt-6 sm:mt-8">
            Voice ordering powered by AI &bull; English &bull; 中文 &bull; Espa&ntilde;ol
          </p>
        </div>

        {/* Animated gradient border at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1 animate-gradient" />
      </div>
    );
  }

  // -------------------------------------------------------------------
  // Render: ACTIVE State — Voice Ordering
  // -------------------------------------------------------------------

  if (kioskState === 'ACTIVE') {
    return (
      <div className="h-screen bg-black flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3 border-b border-gray-800 bg-gray-950">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
              <span className="text-xs sm:text-sm">🍜</span>
            </div>
            <div>
              <h1 className="text-white font-semibold text-xs sm:text-sm">{restaurant.name}</h1>
              <p className="text-gray-500 text-[10px] sm:text-xs">Voice Order Kiosk</p>
            </div>
          </div>

          <button
            onClick={resetToIdle}
            className="text-gray-500 hover:text-white text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Main content: Voice + Cart */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Voice interaction */}
          <div className="flex-1 flex flex-col">
            {/* Scrollable voice + cards area */}
            <div className="flex-1 overflow-y-auto flex flex-col items-center px-3 sm:px-6 py-3 sm:py-6">

              {/* Foody mascot + status */}
              <div className="flex flex-col items-center mb-4 sm:mb-6">
                <div className="relative mb-2">
                  {/* Pulsing glow ring behind Foody */}
                  <div className="absolute inset-0 rounded-full bg-orange-500/20 animate-foody-glow" />
                  <div className="relative w-44 h-44 sm:w-52 sm:h-52">
                    <img
                      src="/FoodyBot.png"
                      alt="Foody"
                      className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(249,115,22,0.4)] animate-foody-float"
                    />
                  </div>
                </div>
                {transcripts.length === 0 ? (
                  <p className="text-gray-400 text-xs sm:text-sm text-center">
                    Tell me what you&apos;d like to order!
                  </p>
                ) : (
                  <p className="text-gray-300 text-xs sm:text-sm text-center max-w-xs leading-relaxed">
                    {(() => {
                      const lastAgent = [...transcripts].reverse().find(t => t.role === 'agent');
                      return lastAgent ? lastAgent.text : 'Listening...';
                    })()}
                  </p>
                )}
              </div>

              {/* ✨ Dynamic Menu Card — scrollable area */}
              {menuCard && menuCard.matches.length > 0 && (
                <div
                  className={`w-full max-w-sm mb-4 transition-all ease-out ${
                    menuCardVisible
                      ? 'opacity-100 translate-y-0 scale-100 duration-700'
                      : 'opacity-0 translate-y-4 scale-95 duration-500'
                  }`}
                >
                  <div className="bg-gray-900/95 backdrop-blur-sm border border-orange-500/30 rounded-2xl p-3 sm:p-4 shadow-xl shadow-orange-600/10">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-full bg-orange-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <span className="text-orange-400 text-[10px] sm:text-xs font-medium uppercase tracking-wider">
                        Menu Match
                      </span>
                      {menuCard.query && (
                        <span className="text-gray-500 text-[10px] sm:text-xs ml-auto truncate max-w-[120px]">
                          &ldquo;{menuCard.query}&rdquo;
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {menuCard.matches.map((item, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-2 sm:p-2.5 rounded-xl ${
                            idx === 0
                              ? 'bg-orange-600/15 border border-orange-500/20'
                              : 'bg-gray-800/50'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold truncate ${
                              idx === 0 ? 'text-white text-sm' : 'text-gray-300 text-xs'
                            }`}>
                              {item.name}
                            </p>
                            {item.category && (
                              <p className="text-gray-500 text-[10px] mt-0.5">{item.category}</p>
                            )}
                          </div>
                          <span className={`ml-2 font-bold flex-shrink-0 ${
                            idx === 0 ? 'text-orange-400 text-sm sm:text-base' : 'text-gray-400 text-xs'
                          }`}>
                            ${item.price_usd.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 🧾 Receipt Card — order summary when customer asks total */}
              {receiptCard && (
                <div
                  className={`w-full max-w-sm mb-4 transition-all ease-out ${
                    receiptCardVisible
                      ? 'opacity-100 translate-y-0 scale-100 duration-700'
                      : 'opacity-0 translate-y-4 scale-95 duration-500'
                  }`}
                >
                  <div className="bg-gray-900/95 backdrop-blur-sm border border-green-500/30 rounded-2xl p-3 sm:p-4 shadow-xl shadow-green-600/10">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <span className="text-green-400 text-[10px] sm:text-xs font-medium uppercase tracking-wider">
                        Order Summary
                      </span>
                      <span className="text-gray-500 text-[10px] sm:text-xs ml-auto">
                        {receiptCard.item_count} item{receiptCard.item_count !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Items list */}
                    <div className="space-y-1 mb-2">
                      {receiptCard.items.map((item, idx) => (
                        <p key={idx} className="text-gray-300 text-xs sm:text-sm truncate">
                          {item}
                        </p>
                      ))}
                    </div>

                    {/* Totals */}
                    <div className="border-t border-gray-700 pt-2 space-y-1">
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>Subtotal</span>
                        <span>${receiptCard.subtotal_usd.toFixed(2)}</span>
                      </div>
                      {receiptCard.tax_usd != null && (
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>Tax{receiptCard.state ? ` (${receiptCard.state})` : ''}</span>
                          <span>${receiptCard.tax_usd.toFixed(2)}</span>
                        </div>
                      )}
                      {receiptCard.total_usd != null && (
                        <div className="flex justify-between text-sm font-bold">
                          <span className="text-white">Total</span>
                          <span className="text-green-400">${receiptCard.total_usd.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div ref={transcriptEndRef} />
            </div>

            {/* Audio engine — compact bottom bar */}
            <div className="border-t border-gray-800 bg-gray-950 px-3 sm:px-4 py-1 sm:py-1.5">
              <KioskAudioEngine
                restaurantId={restaurantId}
                sessionId={sessionId}
                agentUrl={AGENT_URL}
                isActive={kioskState === 'ACTIVE'}
                onTranscript={handleTranscript}
                onCartUpdate={handleCartUpdate}
                onActivityDetected={handleActivityDetected}
                onCheckoutRequested={handleCheckoutRequested}
                onCheckoutReady={handleCheckoutReady}
                onMenuCard={handleMenuCard}
                onReceiptCard={handleReceiptCard}
              />
            </div>
          </div>

          {/* Right: Cart (desktop only) */}
          <div className="hidden md:block w-80 lg:w-96 border-l border-gray-800">
            <KioskCart items={cartItems} onCheckout={goToCheckout} />
          </div>
        </div>

        {/* Mobile: floating cart bar at bottom */}
        {cartItems.length > 0 && (
          <div className="md:hidden border-t border-gray-800 bg-gray-950 px-3 py-2">
            <button
              onClick={goToCheckout}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white py-2.5 rounded-xl font-semibold flex items-center justify-between px-4 transition-all text-sm"
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
                {cartItems.reduce((sum, i) => sum + i.quantity, 0)} items
              </span>
              <span className="font-bold">
                ${cartItems.reduce((sum, i) => sum + i.price_usd * i.quantity, 0).toFixed(2)} — Checkout
              </span>
            </button>
          </div>
        )}

        {/* Inactivity warning overlay */}
        {inactivityWarning && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-2xl p-6 sm:p-8 text-center max-w-sm mx-4 border border-gray-700">
              <p className="text-xl sm:text-2xl text-white font-bold mb-2 sm:mb-3">Still there?</p>
              <p className="text-gray-400 text-sm sm:text-base mb-4 sm:mb-6">
                Your order will be cancelled in a few seconds.
              </p>
              <button
                onClick={() => {
                  setInactivityWarning(false);
                  resetInactivityTimer();
                }}
                className="bg-orange-600 hover:bg-orange-500 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl font-semibold text-base sm:text-lg transition-all"
              >
                I&apos;m still here!
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------
  // Render: CHECKOUT State — Dual Payment (Stripe + QR)
  // -------------------------------------------------------------------

  return (
    <div className="h-screen bg-black flex flex-col items-center justify-start p-4 sm:p-6 overflow-y-auto">
      {/* Payment Success Overlay */}
      {paymentSuccess && (
        <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-50 animate-fade-in">
          <div className="text-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6 rounded-full bg-green-600 flex items-center justify-center animate-kiosk-pulse">
              <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Payment Received!</h1>
            <p className="text-gray-400 text-base sm:text-lg mb-1">Thank you for your order.</p>
            <p className="text-gray-500 text-sm">Returning to home screen...</p>
          </div>
        </div>
      )}

      <div className="max-w-2xl w-full animate-fade-in">
        {/* Header */}
        <div className="text-center mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Order Ready!</h1>
          <p className="text-gray-400 text-sm sm:text-base">Choose how you&apos;d like to pay</p>
        </div>

        {/* Order summary */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-3 sm:p-5 mb-4 sm:mb-6">
          <h2 className="text-white font-semibold text-sm sm:text-base mb-2 sm:mb-3 flex items-center gap-2">
            <span>🧾</span> Order Summary
          </h2>

          <div className="space-y-2 mb-3">
            {cartItems.map((item, idx) => (
              <div key={idx} className="flex justify-between text-xs sm:text-sm">
                <span className="text-gray-300">
                  {item.item_name} ×{item.quantity}
                  {item.modifications && item.modifications.length > 0 && (
                    <span className="text-orange-400 text-[10px] sm:text-xs ml-1">
                      ({item.modifications.join(', ')})
                    </span>
                  )}
                </span>
                <span className="text-white font-medium">
                  ${(item.price_usd * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-800 pt-2 space-y-1">
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-gray-400">Subtotal</span>
              <span className="text-white">${orderTotal.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-gray-400">Tax</span>
              <span className="text-white">${orderTotal.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base sm:text-lg font-bold">
              <span className="text-white">Total</span>
              <span className="text-green-400">${orderTotal.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Dual Payment Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 sm:mb-6">
          {/* Left: Pay Here (Stripe) */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 sm:p-5">
            <h3 className="text-white font-semibold text-sm sm:text-base mb-3 flex items-center gap-2">
              <span>💳</span> Pay Here
            </h3>
            {restaurant?.stripe_account_id ? (
              <ExpressCheckout
                restaurantId={restaurantId}
                amountUSD={orderTotal.total}
                orderId={checkoutOrderId}
                onSuccess={(piId, method) => {
                  console.log('[Kiosk] Payment success:', piId, method);
                  setPaymentSuccess(true);
                  clearAllTimers();
                  checkoutTimerRef.current = setTimeout(resetToIdle, 5000);
                }}
                onError={(err) => {
                  console.error('[Kiosk] Payment error:', err);
                }}
              />
            ) : (
              <div className="space-y-3">
                {/* Apple Pay style button */}
                <button
                  onClick={() => {
                    setPaymentSuccess(true);
                    clearAllTimers();
                    checkoutTimerRef.current = setTimeout(resetToIdle, 5000);
                  }}
                  className="w-full bg-black hover:bg-gray-900 text-white py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 border border-gray-700 transition-all active:scale-95"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                  Pay — ${orderTotal.total.toFixed(2)}
                </button>
                {/* Google Pay style button */}
                <button
                  onClick={() => {
                    setPaymentSuccess(true);
                    clearAllTimers();
                    checkoutTimerRef.current = setTimeout(resetToIdle, 5000);
                  }}
                  className="w-full bg-white hover:bg-gray-100 text-gray-900 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Pay — ${orderTotal.total.toFixed(2)}
                </button>
                {/* Credit Card button */}
                <button
                  onClick={() => {
                    setPaymentSuccess(true);
                    clearAllTimers();
                    checkoutTimerRef.current = setTimeout(resetToIdle, 5000);
                  }}
                  className="w-full bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 border border-gray-700 transition-all active:scale-95"
                >
                  💳 Credit Card — ${orderTotal.total.toFixed(2)}
                </button>
              </div>
            )}
            <div className="flex items-center justify-center gap-2 mt-3 text-[10px] sm:text-xs text-gray-500">
              <span>Apple Pay</span>
              <span>•</span>
              <span>Google Pay</span>
              <span>•</span>
              <span>Credit Card</span>
            </div>
          </div>

          {/* Right: Pay on Phone (QR) */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 sm:p-5">
            <h3 className="text-white font-semibold text-sm sm:text-base mb-3 flex items-center gap-2">
              <span>📱</span> Pay on Phone
            </h3>
            <div className="flex flex-col items-center">
              {qrDataUrl ? (
                <div className="animate-qr-appear bg-white p-2 sm:p-3 rounded-xl">
                  <img src={qrDataUrl} alt="Payment QR Code" className="w-36 h-36 sm:w-44 sm:h-44" />
                </div>
              ) : (
                <div className="w-36 h-36 sm:w-44 sm:h-44 bg-gray-800 rounded-xl flex items-center justify-center">
                  <div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full" />
                </div>
              )}
              <p className="text-gray-500 text-[10px] sm:text-xs mt-2 text-center">
                Scan to pay with your phone
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 mt-3 text-[10px] sm:text-xs text-gray-500">
              <span>Credit Card</span>
              <span>•</span>
              <span className="text-orange-400 font-medium">FOODY Token</span>
              <span>•</span>
              <span className="text-orange-400 font-medium">USDC</span>
            </div>
          </div>
        </div>

        {/* New order button */}
        <button
          onClick={resetToIdle}
          className="w-full bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-semibold text-sm sm:text-base transition-all border border-gray-700"
        >
          Start New Order
        </button>
      </div>
    </div>
  );
}
