// components/PhoneVerification.tsx
// Phone ownership verification via automated call to restaurant's Google
// Places listed phone. Includes consent checkbox, session tracking,
// SMS fallback, and cooldown enforcement.
'use client';

import { useState, useRef, useEffect } from 'react';
import InfoTooltip from './InfoTooltip';

interface PhoneVerificationProps {
  onVerificationComplete: (phoneNumber: string) => void;
  isVerified: boolean;
  verifiedPhone?: string;
  autoFilledPhone?: string; // Google Places listed phone
  restaurantName?: string;
  walletAddress?: string;
  placeId?: string; // Google Places ID for composite key
}

export function PhoneVerification({
  onVerificationComplete,
  isVerified,
  verifiedPhone,
  autoFilledPhone,
  restaurantName,
  walletAddress,
  placeId,
}: PhoneVerificationProps) {
  const [codeSent, setCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [calling, setCalling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [consentChecked, setConsentChecked] = useState(false);
  const channel = 'call' as const;
  const [sessionId] = useState(() => crypto.randomUUID());

  const codeRef = useRef<HTMLInputElement>(null);
  const displayPhone = autoFilledPhone || 'Not available';

  // Cleanup countdown timer
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCountdown = (seconds: number) => {
    setCountdown(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCallRestaurant = async () => {
    if (!autoFilledPhone) {
      setError('No restaurant phone number available. Please go back and select a restaurant with a listed phone.');
      return;
    }

    if (!consentChecked) {
      setError('Please check the consent box to authorize the verification call.');
      return;
    }

    setCalling(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/send-phone-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: autoFilledPhone,
          restaurantName: restaurantName || '',
          placeId: placeId || '',
          sessionId,
          channel,
          consentGiven: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCodeSent(true);
        setSuccess(data.message || (channel === 'call' ? 'Calling your restaurant now...' : 'SMS sent.'));
        startCountdown(90); // 90-second cooldown

        // Dev mode: auto-fill echoed code
        if (data.echoedCode) {
          setVerificationCode(data.echoedCode);
        }

        setTimeout(() => codeRef.current?.focus(), 100);
      } else {
        setError(data.message || 'Failed to initiate verification');
      }
    } catch (err) {
      console.error('Send verification error:', err);
      setError('Failed to reach verification service. Please try again.');
    } finally {
      setCalling(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      const response = await fetch('/api/check-phone-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: autoFilledPhone || '',
          code: verificationCode,
          placeId: placeId || '',
          sessionId,
          walletAddress: walletAddress || '',
        }),
      });

      const data = await response.json();

      if (data.success && data.verified) {
        setSuccess('Verification successful!');
        onVerificationComplete(autoFilledPhone || '');
      } else {
        setError(data.message || 'Verification failed');
      }
    } catch (err) {
      console.error('Verify code error:', err);
      setError('Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleRetryCall = () => {
    setCodeSent(false);
    setVerificationCode('');
    setError('');
    setSuccess('');
  };

  // --- Verified state ---

  if (isVerified && verifiedPhone) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-green-900 border border-green-500 rounded-lg">
          <h4 className="text-green-300 font-medium mb-2">
            {'\u2713'} Ownership Verified
          </h4>
          <p className="text-green-200 text-sm">
            Verified via phone call to: {verifiedPhone}
          </p>
        </div>
      </div>
    );
  }

  // --- Main UI ---

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-400 flex items-center">
          Verify Restaurant Ownership{' '}
          <InfoTooltip text="We will call your restaurant's listed phone number and read a 6-digit verification code. This proves you have physical access to the restaurant." />
        </h4>

        {/* Restaurant phone display */}
        <div className="p-3 bg-zinc-800 rounded-lg border border-zinc-700">
          <p className="text-xs text-gray-400 mb-1">Restaurant Listed Phone</p>
          <p className="text-lg font-bold text-white tracking-wide">{displayPhone}</p>
          <p className="text-xs text-gray-500 mt-1">
            We will {channel === 'call' ? 'call this number and read' : 'send an SMS with'} a 6-digit verification code.
          </p>
        </div>

        {!autoFilledPhone && (
          <div className="p-3 bg-yellow-900/50 border border-yellow-600 rounded-lg">
            <p className="text-yellow-300 text-sm">
              No phone number found. Please select a restaurant with a listed phone number.
            </p>
          </div>
        )}

        {!codeSent ? (
          <>
            {/* Consent checkbox */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-zinc-800 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-400 leading-relaxed">
                I authorize FoodyePay to {channel === 'call' ? 'call' : 'send an SMS to'}{' '}
                <span className="text-white font-medium">{displayPhone}</span>{' '}
                with a one-time verification code. I confirm I am authorized to answer calls
                at this restaurant. Standard {channel === 'call' ? 'call' : 'messaging'} rates may apply.
              </span>
            </label>

            {/* Call/SMS button */}
            <button
              onClick={handleCallRestaurant}
              disabled={calling || !autoFilledPhone || !consentChecked}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                calling || !autoFilledPhone || !consentChecked
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {calling ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {channel === 'call' ? `Calling ${displayPhone}...` : `Sending SMS...`}
                </>
              ) : (
                <>
                  {channel === 'call' ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  )}
                  {channel === 'call' ? 'Call My Restaurant to Verify' : 'Send SMS to Verify'}
                </>
              )}
            </button>

            <p className="text-xs text-gray-600 text-center">
              Code expires in 5 minutes. Max 5 attempts. 3 calls per hour.
            </p>
          </>
        ) : (
          <>
            {/* Post-call instructions */}
            <div className="p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
              <p className="text-blue-300 text-sm font-medium mb-1">
                {channel === 'call'
                  ? `Calling ${displayPhone}...`
                  : `SMS sent to ${displayPhone}`}
              </p>
              <p className="text-blue-200 text-xs">
                {channel === 'call'
                  ? 'Answer the phone at your restaurant. A 6-digit code will be read to you twice.'
                  : 'Check your text messages for the 6-digit code.'}
              </p>
            </div>

            {/* Code input */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400">
                Enter the 6-Digit Code
              </label>
              <input
                ref={codeRef}
                type="text"
                placeholder="------"
                value={verificationCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 6) {
                    setVerificationCode(value);
                  }
                }}
                className="input-base w-full text-center text-2xl tracking-[0.5em] font-mono"
                disabled={verifying}
                maxLength={6}
                autoComplete="one-time-code"
                inputMode="numeric"
              />
              <p className="text-xs text-gray-600 text-center">
                5 attempts max &middot; Code expires in 5 minutes
              </p>
            </div>

            {/* Verify + Retry */}
            <div className="flex gap-2">
              <button
                onClick={handleVerifyCode}
                disabled={verifying || verificationCode.length !== 6}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  verifying || verificationCode.length !== 6
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {verifying ? 'Verifying...' : 'Verify Code'}
              </button>

              <button
                onClick={handleRetryCall}
                disabled={countdown > 0}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  countdown > 0
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-zinc-700 hover:bg-zinc-600 text-gray-300'
                }`}
              >
                {countdown > 0 ? `Retry (${countdown}s)` : channel === 'call' ? 'Call Again' : 'Resend SMS'}
              </button>
            </div>

          </>
        )}

        {/* Error / Success messages */}
        {error && (
          <div className="p-3 bg-red-900 border border-red-500 rounded-lg">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {success && !error && (
          <div className="p-3 bg-green-900 border border-green-500 rounded-lg">
            <p className="text-green-300 text-sm">{success}</p>
          </div>
        )}
      </div>
    </div>
  );
}
