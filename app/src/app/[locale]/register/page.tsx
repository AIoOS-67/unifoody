// app/register/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useFoodyeWallet } from '@/components/Wallet/WalletProvider';
import { supabase } from '@/lib/supabase';
import { checkUserExists, isDemoWalletAddress } from '@/lib/auth';
import {
  generateVerificationCode,
  saveVerificationCode,
  validateVerificationCode,
} from '@/lib/verificationCode';
import { sendVerificationCodeEmail, sendWelcomeEmail } from '@/lib/emailService';
import { BusinessVerification } from '@/components/BusinessVerification';
import { PhoneVerification } from '@/components/PhoneVerification';
import { calculateVerificationScore } from '@/lib/businessVerification';

interface Business {
  place_id: string;
  name: string;
  formatted_address: string;
  rating: number;
  user_ratings_total: number;
  business_status?: string;
  price_level?: number;
  formatted_phone_number?: string | null;
  international_phone_number?: string | null;
}

export default function RegisterPage() {
  const router = useRouter();
  const { address } = useAccount();
  const { } = useFoodyeWallet();

  const [role, setRole] = useState<'diner' | 'restaurant'>('diner');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [emailLocal, setEmailLocal] = useState('');
  const [area, setArea] = useState('');
  const [prefix, setPrefix] = useState('');
  const [line, setLine] = useState('');

  // Restaurant-specific fields
  const [restaurantEmail] = useState('');
  const isValidEmail = (v: string) => /.+@.+\..+/.test(v);

  // Verification states
  const [businessVerified, setBusinessVerified] = useState(false);
  const [verifiedBusiness, setVerifiedBusiness] = useState<Business | null>(null);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [squareMerchantId, setSquareMerchantId] = useState<string | null>(null);
  const [squareMerchantName, setSquareMerchantName] = useState<string | null>(null);
  const [squareLocations, setSquareLocations] = useState<any[]>([]);
  const [squareStatus, setSquareStatus] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [codeSentAt, setCodeSentAt] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [checkingRegistration, setCheckingRegistration] = useState(true);

  const areaRef = useRef<HTMLInputElement>(null);
  const prefixRef = useRef<HTMLInputElement>(null);
  const lineRef = useRef<HTMLInputElement>(null);

  // Calculate verification score
  const squareReady = !!squareMerchantId;
  const verificationResult = calculateVerificationScore({
    googlePlacesData: businessVerified && verifiedBusiness ? verifiedBusiness : undefined,
    phoneVerified,
    squareVerified: squareReady,
  });

  // Force clear demo wallet and redirect
  useEffect(() => {
    const cachedWallet = localStorage.getItem('foodye_wallet');

    if (cachedWallet && isDemoWalletAddress(cachedWallet)) {
      console.log('FORCE CLEARING demo wallet cache:', cachedWallet);
      localStorage.removeItem('foodye_wallet');
      alert('Demo wallet detected! Please connect a real Coinbase Smart Wallet.');
      router.push('/');
      return;
    }

    if (address && isDemoWalletAddress(address)) {
      console.log('Detected demo wallet:', address);
      localStorage.removeItem('foodye_wallet');
      alert('Demo wallet detected! Please connect a real Coinbase Smart Wallet.');
      router.push('/');
      return;
    }
  }, [address, router]);

  // Auto check registration status and redirect
  useEffect(() => {
    const checkExistingRegistration = async () => {
      if (!address) {
        console.log('No wallet connected, redirecting...');
        router.push('/');
        return;
      }

      if (isDemoWalletAddress(address)) {
        console.log('Demo wallet detected in check, redirecting');
        localStorage.removeItem('foodye_wallet');
        router.push('/');
        return;
      }

      try {
        console.log('Checking registration for:', address);
        const userRole = await checkUserExists(address);

        if (userRole === 'diner') {
          console.log('Found diner, redirecting...');
          router.push('/dashboard-diner');
          return;
        }

        if (userRole === 'restaurant') {
          console.log('Found restaurant, redirecting...');
          router.push('/dashboard-restaurant');
          return;
        }

        console.log('Not registered yet, show form');
      } catch (error) {
        console.error('Error in registration check:', error);
      } finally {
        setCheckingRegistration(false);
      }
    };

    checkExistingRegistration();
  }, [address, router]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    if (codeSentAt && Date.now() - codeSentAt > 10 * 60 * 1000) {
      alert('Verification code expired');
      setVerificationSent(false);
      setInputCode('');
      setCodeSentAt(null);
      setSuccessMessage('');
    }
  }, [inputCode, codeSentAt]);

  // Handle business verification completion
  const handleBusinessVerificationComplete = (business: Business) => {
    setVerifiedBusiness(business);
    setBusinessVerified(true);
    try { localStorage.setItem('selected_business', JSON.stringify(business)); } catch {}
    try { localStorage.setItem('register_role', 'restaurant'); } catch {}

  };

  // Handle phone verification completion
  const handlePhoneVerificationComplete = (phoneNumber: string) => {
    setVerifiedPhone(phoneNumber);
    setPhoneVerified(true);
  };

  // Start Square OAuth login
  const handleStartSquareAuth = async () => {
    try {
      if (!verifiedBusiness) {
        alert('Please select your restaurant first');
        return;
      }
      try { if (address) localStorage.setItem('connected_wallet', address); } catch {}
      const res = await fetch('/api/square/authorize');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start Square login');
      // Save CSRF state token
      try { localStorage.setItem('square_oauth_state', data.state); } catch {}
      // Redirect to Square OAuth
      window.location.href = data.url;
    } catch (e: any) {
      console.error('Square auth error', e);
      alert(e.message || 'Failed to start Square login');
    }
  };

  // Simple US address parser from formatted string
  const parseAddressParts = (formatted?: string) => {
    if (!formatted) return { city: null, state: null, postal_code: null, country: null, street_number: null, street_name: null } as any;
    const parts = formatted.split(',').map(s => s.trim());
    const street = parts[0] || '';
    const city = parts[1] || null;
    let state: string | null = null;
    let postal_code: string | null = null;
    const m = (parts[2] || '').match(/([A-Za-z]{2})\s+(\d{5}(-\d{4})?)/);
    if (m) { state = m[1]; postal_code = m[2]; }
    const country = parts[3] || null;
    const streetNum = (street.match(/^\s*(\d+)/) || [])[1] || null;
    const streetName = streetNum ? street.replace(/^\s*\d+\s*/, '') : street;
    return { city, state, postal_code, country, street_number: streetNum, street_name: streetName || null };
  };

  // Load cached Square merchant data + business from localStorage
  useEffect(() => {
    try {
      const savedRole = localStorage.getItem('register_role');
      if (savedRole === 'restaurant' || savedRole === 'diner') {
        setRole(savedRole as any);
      }

      const savedBiz = localStorage.getItem('selected_business');
      if (savedBiz) {
        try {
          const parsed = JSON.parse(savedBiz) as Business;
          setVerifiedBusiness(parsed);
          setBusinessVerified(true);
        } catch {}
      }

      // Restore Square OAuth data (set by callback page)
      const cachedMerchantId = localStorage.getItem('square_merchant_id');
      const cachedSquareData = localStorage.getItem('square_data');
      if (cachedMerchantId) {
        setSquareMerchantId(cachedMerchantId);
        if (cachedSquareData) {
          try {
            const sq = JSON.parse(cachedSquareData);
            setSquareMerchantName(sq.merchantName || null);
            setSquareStatus(sq.merchantStatus || 'ACTIVE');
            setSquareLocations(sq.locations || []);
          } catch {}
        }
      }
    } catch {}
  }, []);

  // Finalize restaurant registration with verification score
  const handleFinalizeRestaurantRegistration = async () => {
    if (!address) return alert('Wallet not ready');
    if (!verifiedBusiness) return alert('Please select your restaurant first');

    // Ensure both steps are done
    if (!phoneVerified) return alert('Please verify your restaurant phone first.');
    if (!squareMerchantId) return alert('Please login with Square first.');

    try {
      const payload: any = {
        name: verifiedBusiness?.name || 'Unknown Restaurant',
        google_place_id: verifiedBusiness?.place_id,
        address: verifiedBusiness?.formatted_address,
        rating: verifiedBusiness?.rating || 0,
        user_ratings_total: verifiedBusiness?.user_ratings_total || 0,
        business_status: verifiedBusiness?.business_status || 'OPERATIONAL',
        wallet_address: address,
        role: 'restaurant',
        square_merchant_id: squareMerchantId,
        square_status: squareStatus,
        business_verified: businessVerified,
        phone_verified: phoneVerified,
        verification_score: verificationResult.score,
        email: restaurantEmail || undefined,
        phone: verifiedBusiness?.formatted_phone_number || verifiedPhone || undefined,
      };

      const parts = parseAddressParts(verifiedBusiness?.formatted_address);
      payload.city = parts.city;
      payload.state = parts.state;
      payload.postal_code = parts.postal_code;
      payload.country = parts.country;
      if (parts.street_number) payload.street_number = parts.street_number;
      if (parts.street_name) payload.street_name = parts.street_name;
      if (parts.postal_code) payload.zip_code = parts.postal_code;

      let { data, error } = await supabase
        .from('restaurants')
        .insert([payload])
        .select();

      if (error) {
        // Fallback minimal insert
        const minimal: any = {
          name: payload.name,
          address: payload.address || (verifiedBusiness?.formatted_address ?? 'Unknown Address'),
          wallet_address: payload.wallet_address,
          role: payload.role,
          business_verified: businessVerified,
          phone_verified: phoneVerified,
        };
        const parts2 = parseAddressParts(verifiedBusiness?.formatted_address);
        minimal.city = parts2.city;
        minimal.state = parts2.state;
        minimal.postal_code = parts2.postal_code;
        minimal.country = parts2.country;
        if (parts2.postal_code) minimal.zip_code = parts2.postal_code;
        if (parts2.street_number) minimal.street_number = parts2.street_number;
        if (parts2.street_name) minimal.street_name = parts2.street_name;

        const retry = await supabase.from('restaurants').insert([minimal]).select();
        if (retry.error) {
          alert(`Database error: ${retry.error.message}`);
          return;
        }
        data = retry.data;
      }

      // Persist verification score to DB
      try {
        await fetch('/api/verify-business', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            googlePlacesData: verifiedBusiness,
            phoneVerified,
            squareMerchantId,
            walletAddress: address,
          }),
        });
      } catch (e) {
        console.warn('Failed to persist verification score:', e);
      }

      try { localStorage.setItem('foodye_wallet', address); } catch {}
      router.push(`/register/yes/success?role=restaurant`);
    } catch (err: any) {
      console.error('Finalize restaurant failed', err);
      alert('Registration error');
    }
  };

  const handleSendVerification = async () => {
    console.log('handleSendVerification called');

    // Validation for diner
    if (role === 'diner' && (!emailLocal || !firstName || !lastName || !area || !prefix || !line)) {
      alert('Please complete all required fields for diner registration');
      return;
    }

    // Validation for restaurant -- handled by finalize flow
    if (role === 'restaurant') {
      return; // Restaurant uses the finalize button, not this flow
    }

    const email = `${emailLocal}@gmail.com`;
    const code = generateVerificationCode();
    saveVerificationCode(email, code);

    setSending(true);
    try {
      const { echoedCode, echoMode } = await sendVerificationCodeEmail(email, code, address!);
      setVerificationSent(true);
      setCountdown(60);
      setCodeSentAt(Date.now());
      if (echoMode && echoedCode) {
        setInputCode(echoedCode);
        setSuccessMessage('Code sent (dev mode). Prefilled for convenience.');
      } else {
        setSuccessMessage('Code sent to email!');
      }
    } catch (err) {
      console.error('Email send error', err);
      alert('Failed to send code');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    if (!address) return alert('Wallet not ready');

    const email = `${emailLocal}@gmail.com`;
    const phone = `1-${area}-${prefix}-${line}`;
    const isValid = validateVerificationCode(email, inputCode);
    if (!isValid) return alert('Invalid or expired verification code');

    setVerifying(true);

    const payload = {
      email,
      phone,
      first_name: firstName,
      last_name: lastName,
      wallet_address: address,
      role: 'diner' as const,
    };

    try {
      const { data, error } = await supabase
        .from('diners')
        .insert([payload])
        .select();

      if (error) {
        alert(`Database error: ${error.message}`);
        return;
      }

      await sendWelcomeEmail(email, address);

      // Diner registration reward logic
      try {
        const rewardResponse = await fetch('/api/diner-reward', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: address, email })
        });
        if (rewardResponse.ok) {
          const rewardData = await rewardResponse.json();
          console.log('Diner reward issued:', rewardData);
        }
      } catch (rewardError) {
        console.error('Error issuing Diner reward:', rewardError);
      }

      localStorage.setItem('foodye_wallet', address);
      router.push(`/register/yes/success?role=diner`);
    } catch (err) {
      console.error('Registration failed', err);
      alert('Registration error');
    } finally {
      setVerifying(false);
    }
  };

  if (checkingRegistration) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <h2 className="text-2xl font-bold">Checking Registration...</h2>
          <p className="text-gray-400">
            {address ? `Wallet: ${address.slice(0, 6)}...${address.slice(-4)}` : 'Verifying...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-zinc-900 p-6 rounded-xl shadow space-y-4">
        <h1 className="text-xl font-bold text-center">Register on FoodyePay</h1>

        {/* Role Switch */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-400 text-center">Choose your role</h3>
          <div className="flex space-x-3">
            <button
              onClick={() => setRole('diner')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                role === 'diner'
                  ? 'bg-[#4F46E5] text-white shadow-lg transform scale-105'
                  : 'bg-zinc-700 text-gray-300 hover:bg-zinc-600'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <span>Diner</span>
              </div>
            </button>
            <button
              onClick={() => setRole('restaurant')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                role === 'restaurant'
                  ? 'bg-[#4F46E5] text-white shadow-lg transform scale-105'
                  : 'bg-zinc-700 text-gray-300 hover:bg-zinc-600'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <span>Restaurant</span>
              </div>
            </button>
          </div>
        </div>

        {/* Diner Fields */}
        {role === 'diner' && (
          <>
            <input placeholder="First Name *" value={firstName} onChange={e => setFirstName(e.target.value)} className="input-base w-full" />
            <input placeholder="Last Name *" value={lastName} onChange={e => setLastName(e.target.value)} className="input-base w-full" />
          </>
        )}

        {/* Restaurant Fields -- 2-Step Auth */}
        {role === 'restaurant' && (
          <div className="space-y-4">

            {/* Step 1: Find Restaurant (Google) + Verify by Phone Call */}
            <BusinessVerification
              onVerificationComplete={handleBusinessVerificationComplete}
              isVerified={businessVerified}
              verifiedBusiness={verifiedBusiness}
            />

            {/* Phone Verification — shown after selecting a restaurant */}
            {businessVerified && !phoneVerified && (
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-gray-400">
                  Verify Restaurant Ownership
                </h4>
                <PhoneVerification
                  onVerificationComplete={handlePhoneVerificationComplete}
                  isVerified={phoneVerified}
                  verifiedPhone={verifiedPhone}
                  autoFilledPhone={verifiedBusiness?.formatted_phone_number || verifiedBusiness?.international_phone_number || undefined}
                  restaurantName={verifiedBusiness?.name}
                  walletAddress={address}
                  placeId={verifiedBusiness?.place_id}
                />
              </div>
            )}

            {/* Phone verified confirmation */}
            {phoneVerified && (
              <div className="p-3 bg-green-900/30 border border-green-700/50 rounded-lg">
                <p className="text-green-400 text-sm font-medium">{'\u2713'} Step 1 Complete — Restaurant verified via Google + Phone</p>
              </div>
            )}

            {/* Step 2: Login with Square (only after Step 1 is done) */}
            {businessVerified && phoneVerified && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-400">
                  Step 2: Login with Square
                </h4>

                {!squareMerchantId ? (
                  <button
                    onClick={handleStartSquareAuth}
                    className="w-full py-3 px-4 rounded-lg font-semibold bg-orange-600 hover:bg-orange-700 text-white transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M4.5 2A2.5 2.5 0 002 4.5v15A2.5 2.5 0 004.5 22h15a2.5 2.5 0 002.5-2.5v-15A2.5 2.5 0 0019.5 2h-15zm3 5h9a1.5 1.5 0 011.5 1.5v7a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 016 15.5v-7A1.5 1.5 0 017.5 7z"/></svg>
                    Login with Square
                  </button>
                ) : (
                  <div className="p-3 bg-green-900/30 border border-green-700/50 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-green-400 font-medium">{'\u2713'} Square Connected</span>
                    </div>
                    {squareMerchantName && (
                      <p className="text-sm text-gray-300">
                        Merchant: <span className="text-white font-medium">{squareMerchantName}</span>
                      </p>
                    )}
                    {squareLocations.length > 0 && (
                      <div className="text-xs text-gray-400 space-y-1">
                        {squareLocations.slice(0, 3).map((loc: any, i: number) => (
                          <p key={i}>
                            {loc.name}{loc.address ? ` - ${loc.address}` : ''}
                          </p>
                        ))}
                        {squareLocations.length > 3 && (
                          <p className="text-gray-500">+{squareLocations.length - 3} more locations</p>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => {
                        localStorage.removeItem('square_merchant_id');
                        localStorage.removeItem('square_data');
                        setSquareMerchantId(null);
                        setSquareMerchantName(null);
                        setSquareLocations([]);
                        setSquareStatus(null);
                      }}
                      className="text-xs text-gray-500 hover:text-gray-300 underline"
                    >
                      Disconnect Square
                    </button>
                  </div>
                )}

                {/* Finalize registration — show after Square connected */}
                {squareMerchantId && (
                  <button
                    onClick={handleFinalizeRestaurantRegistration}
                    className="w-full py-3 px-4 rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                  >
                    Finish Registration
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Diner Email and Phone */}
        {role === 'diner' && (
          <>
            <div className="flex w-full">
              <input placeholder="Gmail (no @)" value={emailLocal} onChange={e => setEmailLocal(e.target.value)} className="input-base w-7/10 rounded-r-none" />
              <span className="input-base bg-zinc-700 rounded-l-none flex items-center justify-center w-3/10">@gmail.com</span>
            </div>

            <div className="flex gap-2">
              <div className="flex items-center gap-1"><span className="font-bold">1</span><span>+</span></div>
              <input maxLength={3} ref={areaRef} value={area} onChange={e => { setArea(e.target.value); if (e.target.value.length === 3) prefixRef.current?.focus(); }} className="input-base w-1/3" />
              <input maxLength={3} ref={prefixRef} value={prefix} onChange={e => { setPrefix(e.target.value); if (e.target.value.length === 3) lineRef.current?.focus(); }} className="input-base w-1/3" />
              <input maxLength={4} ref={lineRef} value={line} onChange={e => setLine(e.target.value)} className="input-base w-1/3" />
            </div>
          </>
        )}

        {successMessage && <p className="text-green-400 text-center text-sm">{successMessage}</p>}

        {!verificationSent ? (
          (role === 'diner') ? (
            <button
              onClick={handleSendVerification}
              className={`w-full py-2 px-4 rounded font-semibold mb-3 transition-all duration-200 ${
                sending || countdown > 0 ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-[#4F46E5] hover:bg-[#4338CA] text-white'
              }`}
              disabled={sending || countdown > 0}
            >
              {sending ? 'Sending...' : countdown > 0 ? `Resend (${countdown}s)` : 'Send Verification Code'}
            </button>
          ) : null
        ) : (
          <>
            <input placeholder="Enter Code" value={inputCode} onChange={e => setInputCode(e.target.value)} className="input-base w-full" />
            <button onClick={handleSubmit} className="btn-primary bg-[#4F46E5] w-full" disabled={verifying}>
              {verifying ? 'Verifying...' : 'Register'}
            </button>
          </>
        )}

        {role === 'diner' && (
          <p className="text-sm text-center text-zinc-500">Your Smart Wallet: {address || 'Not connected'}</p>
        )}
      </div>
    </div>
  );
}
