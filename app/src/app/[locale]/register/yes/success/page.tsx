'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get('role');
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // 根据角色重定向到相应的 dashboard
          if (role === 'diner') {
            router.push('/dashboard-diner');
          } else if (role === 'restaurant') {
            router.push('/dashboard-restaurant');
          } else {
            router.push('/dashboard-diner'); // 默认跳转
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router, role]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Success Message */}
        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-green-400">Registration Successful!</h1>
          <p className="text-gray-300">
            Welcome to FoodyePay! Your {role === 'restaurant' ? 'restaurant' : 'diner'} account has been created successfully.
          </p>
        </div>

        {/* Countdown */}
        <div className="bg-zinc-900 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-2">
            Redirecting to your dashboard in
          </p>
          <div className="text-2xl font-bold text-blue-400">
            {countdown} seconds
          </div>
        </div>

        {/* Manual Redirect Button */}
        <button
          onClick={() => {
            if (role === 'diner') {
              router.push('/dashboard-diner');
            } else if (role === 'restaurant') {
              router.push('/dashboard-restaurant');
            } else {
              router.push('/dashboard-diner');
            }
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          Go to Dashboard Now
        </button>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
