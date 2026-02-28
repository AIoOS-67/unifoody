// app/register/connect/refresh/page.tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function RefreshInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { address } = useAccount();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    (async () => {
      const account = params.get('account');
      if (account) {
        try { localStorage.setItem('stripe_account_id', account); } catch {}
      }

      try {
        const acct = account || localStorage.getItem('stripe_account_id');
        const savedBiz = localStorage.getItem('selected_business');
        if (!acct) { router.replace('/register'); setDone(true); return; }

        const res = await fetch('/api/connect/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: acct }) });
        const data = await res.json();
        const status = res.ok ? data.verification_status : null;

        const wallet = address || localStorage.getItem('connected_wallet');
        if (status === 'verified' && savedBiz && wallet) {
          const business = JSON.parse(savedBiz);

          const exists = await supabase.from('restaurants').select('id').eq('wallet_address', wallet).limit(1);
          if (!exists.error && exists.data && exists.data.length > 0) {
            router.replace('/dashboard-restaurant'); setDone(true); return;
          }

          const payload: any = {
            name: business?.name || 'Unknown Restaurant',
            google_place_id: business?.place_id,
            address: business?.formatted_address,
            rating: business?.rating || 0,
            user_ratings_total: business?.user_ratings_total || 0,
            wallet_address: wallet,
            role: 'restaurant',
            stripe_account_id: acct,
            stripe_status: status,
          };

          // derive structured parts
          const parse = (formatted?: string) => {
            if (!formatted) return { city: null, state: null, postal_code: null, country: null, street_number: null } as any;
            const parts = formatted.split(',').map(s => s.trim());
            const city = parts[1] || null;
            let state: string | null = null;
            let postal_code: string | null = null;
            const m = (parts[2] || '').match(/([A-Za-z]{2})\s+(\d{5}(-\d{4})?)/);
            if (m) { state = m[1]; postal_code = m[2]; }
            const country = parts[3] || null;
            const streetNum = ((parts[0] || '').match(/^\s*(\d+)/) || [])[1] || null;
            return { city, state, postal_code, country, street_number: streetNum };
          };
          const p = parse(business?.formatted_address);
          payload.city = p.city; payload.state = p.state; payload.postal_code = p.postal_code; payload.country = p.country; if (p.street_number) payload.street_number = p.street_number; if (p.street_name) payload.street_name = p.street_name; if (p.postal_code) payload.zip_code = p.postal_code;

          let { data: ins, error } = await supabase.from('restaurants').insert([payload]).select();
          if (error) {
            const minimal: any = {
              name: payload.name,
              address: payload.address || (business?.formatted_address ?? 'Unknown Address'),
              wallet_address: payload.wallet_address,
              role: payload.role,
            };
            minimal.city = p.city; minimal.state = p.state; minimal.postal_code = p.postal_code; minimal.country = p.country; if (p.street_number) minimal.street_number = p.street_number; if (p.street_name) minimal.street_name = p.street_name; if (p.postal_code) minimal.zip_code = p.postal_code;

            const errMsg = String(error.message || '');
            const m = errMsg.match(/column\s+"?(\w+)"?.*not-null/i);
            if (m && m[1] === 'street_number') {
              const formatted = business?.formatted_address || '';
              const sn = (formatted.match(/^\s*(\d+)/) || [])[1];
              if (sn) minimal.street_number = sn;
            }

            const retry = await supabase.from('restaurants').insert([minimal]).select();
            if (retry.error) {
              router.replace('/register'); setDone(true); return;
            }
          }
          try { localStorage.setItem('foodye_wallet', wallet as string); } catch {}
          router.replace('/dashboard-restaurant'); setDone(true); return;
        }
      } catch {
        // ignore
      }
      router.replace('/register');
      setDone(true);
    })();
  }, [params, router, address, done]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center space-y-2">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-sm text-gray-400">Re-opening onboarding…</p>
      </div>
    </div>
  );
}

export default function StripeRefreshPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>}>
      <RefreshInner />
    </Suspense>
  );
}
