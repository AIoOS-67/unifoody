'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

function RegisterSuccessContent() {
  const params = useSearchParams();
  const role = params.get('role');
  const router = useRouter();
  const [rewardInfo, setRewardInfo] = useState<{
    claimed: boolean;
    amount?: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    const delay = setTimeout(() => {
      if (role === 'diner') router.push('/dashboard-diner');
      else if (role === 'restaurant') router.push('/dashboard-restaurant');
    }, 4000); // 增加延迟，让用户看到奖励信息

    return () => clearTimeout(delay);
  }, [role, router]);

  // 如果是 Diner，检查奖励状态
  useEffect(() => {
    if (role === 'diner') {
      const checkReward = async () => {
        try {
          // 从 localStorage 获取钱包地址
          const walletAddress = localStorage.getItem('foodye_wallet');
          if (!walletAddress) return;

          const response = await fetch(`/api/diner-reward?wallet=${walletAddress}`);
          if (response.ok) {
            const data = await response.json();
            if (data.rewards && data.rewards.length > 0) {
              const latestReward = data.rewards[0];
              setRewardInfo({
                claimed: true,
                amount: latestReward.rewardAmount
              });
            }
          }
        } catch (error) {
          console.error('Error checking reward:', error);
          setRewardInfo({
            claimed: false,
            error: 'Failed to check reward status'
          });
        }
      };

      checkReward();
    }
  }, [role]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
      <div className="bg-zinc-900 rounded-xl p-6 text-center shadow-xl space-y-4 max-w-md">
        <h1 className="text-2xl font-bold text-green-400">🎉 Registration Successful!</h1>
        <p className="text-zinc-300">Welcome to FoodyePay, {role === 'restaurant' ? 'Restaurant' : 'Diner'}!</p>
        
        {/* Diner 专属奖励信息 */}
        {role === 'diner' && (
          <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30 rounded-lg p-4 space-y-2">
            <div className="text-yellow-400 text-lg font-semibold">🎁 Welcome Bonus!</div>
            {rewardInfo === null ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-yellow-300 text-sm">Processing your reward...</span>
              </div>
            ) : rewardInfo.claimed ? (
              <div className="space-y-1">
                <div className="text-yellow-300 font-medium">
                  {rewardInfo.amount?.toLocaleString() || 1000} FOODY tokens
                </div>
                <div className="text-yellow-200 text-sm">
                  Have been added to your wallet! 🪙
                </div>
              </div>
            ) : (
              <div className="text-yellow-300 text-sm">
                {rewardInfo.error || 'Reward processing...'}
              </div>
            )}
          </div>
        )}
        
        <p className="text-sm text-zinc-500">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
}

export default function RegisterSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <RegisterSuccessContent />
    </Suspense>
  );
}
