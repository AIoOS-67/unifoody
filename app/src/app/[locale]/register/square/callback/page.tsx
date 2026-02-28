// register/square/callback/page.tsx
// Handles Square OAuth redirect — exchanges code for merchant data, stores in localStorage, redirects back to /register
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

function SquareCallbackInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    (async () => {
      const code = params.get('code');
      const state = params.get('state');
      const error = params.get('error');

      // Square sends error param if user denied access
      if (error) {
        setStatus('error');
        setErrorMsg(params.get('error_description') || 'Authorization was denied');
        setTimeout(() => router.replace('/register'), 3000);
        return;
      }

      if (!code) {
        setStatus('error');
        setErrorMsg('No authorization code received');
        setTimeout(() => router.replace('/register'), 3000);
        return;
      }

      // Verify CSRF state token
      const savedState = localStorage.getItem('square_oauth_state');
      if (savedState && state !== savedState) {
        setStatus('error');
        setErrorMsg('Invalid state token — possible CSRF attack');
        setTimeout(() => router.replace('/register'), 3000);
        return;
      }

      try {
        // Exchange code for merchant data
        const redirectUri = `${window.location.origin}/en/register/square/callback`;
        const res = await fetch('/api/square/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirectUri }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to verify Square account');
        }

        // Store Square merchant data in localStorage
        localStorage.setItem('square_merchant_id', data.merchantId);
        localStorage.setItem('square_data', JSON.stringify({
          merchantId: data.merchantId,
          merchantName: data.merchantName,
          merchantCountry: data.merchantCountry,
          merchantStatus: data.merchantStatus,
          locations: data.locations,
        }));

        // Clean up state token
        localStorage.removeItem('square_oauth_state');

        // Redirect back to registration page (Square data will be picked up)
        router.replace('/register');
      } catch (err: any) {
        console.error('[Square Callback] Error:', err);
        setStatus('error');
        setErrorMsg(err.message || 'Square verification failed');
        setTimeout(() => router.replace('/register'), 4000);
      }
    })();
  }, [params, router]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center space-y-3">
        {status === 'loading' ? (
          <>
            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm text-gray-400">Verifying your Square account...</p>
          </>
        ) : (
          <>
            <div className="text-red-400 text-lg">Verification Error</div>
            <p className="text-sm text-gray-400">{errorMsg}</p>
            <p className="text-xs text-gray-500">Redirecting back to registration...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function SquareCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      }
    >
      <SquareCallbackInner />
    </Suspense>
  );
}
