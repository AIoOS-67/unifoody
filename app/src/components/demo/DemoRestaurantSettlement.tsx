'use client';

import { useState } from 'react';
import { SETTLEMENT_STEPS, FEE_SPLIT } from '@/lib/uniswap-v4/demo-scenarios';

export default function DemoRestaurantSettlement() {
  const [orderAmount, setOrderAmount] = useState(28.50);
  const [activeStep, setActiveStep] = useState(-1);
  const [isAnimating, setIsAnimating] = useState(false);

  const restaurantAmount = orderAmount * 0.9;
  const platformAmount = orderAmount * 0.05;
  const rewardAmount = orderAmount * 0.05;
  const cashbackFoody = orderAmount * 0.03 * 1000; // Bronze 3%, 1 USD = 1000 FOODY

  const animateFlow = async () => {
    setIsAnimating(true);
    setActiveStep(-1);
    for (let i = 0; i < SETTLEMENT_STEPS.length; i++) {
      await sleep(600);
      setActiveStep(i);
    }
    setIsAnimating(false);
  };

  return (
    <section className="py-16 border-t border-zinc-800/50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-2">
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              How Restaurants Get Paid
            </span>
          </h2>
          <p className="text-sm text-zinc-400">
            The complete payment flow — from FOODY tokens to USD in the restaurant&apos;s bank account
          </p>
        </div>

        {/* Key differentiator banner */}
        <div className="max-w-3xl mx-auto mb-10 rounded-2xl border border-emerald-800/30 bg-gradient-to-r from-emerald-950/20 to-cyan-950/20 p-5">
          <div className="flex items-center justify-center space-x-3 mb-3">
            <span className="text-3xl">🏪</span>
            <h3 className="text-lg font-bold text-emerald-300">Restaurants Never Touch Crypto</h3>
          </div>
          <p className="text-sm text-zinc-400 text-center max-w-xl mx-auto">
            Customers pay with FOODY tokens. The hook automatically swaps to USDC,
            then Stripe Connect off-ramps to USD in the restaurant&apos;s bank account.
            Zero crypto friction for merchants.
          </p>
        </div>

        {/* Flow Diagram */}
        <div className="max-w-5xl mx-auto mb-10">
          <div className="flex items-center justify-center mb-4">
            <button
              onClick={animateFlow}
              disabled={isAnimating}
              className={`px-4 py-2 rounded-xl text-sm transition-all ${
                isAnimating
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white hover:from-emerald-500 hover:to-cyan-500'
              }`}
            >
              {isAnimating ? 'Animating...' : '▶ Animate Payment Flow'}
            </button>
          </div>

          {/* Steps */}
          <div className="flex flex-col md:flex-row items-stretch gap-2">
            {SETTLEMENT_STEPS.map((step, i) => {
              const isActive = activeStep >= i;
              const isCurrent = activeStep === i;
              return (
                <div key={step.id} className="flex-1 flex flex-col md:flex-row items-center">
                  <div className={`w-full rounded-xl border p-4 text-center transition-all duration-500 ${
                    isCurrent
                      ? `border-${step.color}-500 bg-${step.color}-950/30 shadow-lg shadow-${step.color}-900/20 scale-105`
                      : isActive
                        ? `border-${step.color}-800/40 bg-${step.color}-950/20`
                        : 'border-zinc-800 bg-zinc-950'
                  }`}
                  style={isCurrent ? { transform: 'scale(1.05)', boxShadow: '0 0 20px rgba(99,102,241,0.15)' } : undefined}
                  >
                    <div className={`text-2xl mb-2 transition-all duration-300 ${isActive ? '' : 'grayscale opacity-40'}`}>
                      {step.emoji}
                    </div>
                    <div className={`text-xs font-semibold mb-1 transition-colors duration-300 ${isActive ? 'text-zinc-200' : 'text-zinc-600'}`}>
                      {step.label}
                    </div>
                    <div className={`text-[10px] transition-colors duration-300 ${isActive ? 'text-zinc-400' : 'text-zinc-700'}`}>
                      {step.detail}
                    </div>
                  </div>
                  {i < SETTLEMENT_STEPS.length - 1 && (
                    <div className={`hidden md:block text-lg px-1 transition-colors duration-300 ${isActive ? 'text-zinc-400' : 'text-zinc-800'}`}>
                      →
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Concrete Example */}
        <div className="max-w-3xl mx-auto mb-10">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4 text-center">
              Concrete Example: ${orderAmount.toFixed(2)} Dinner Order
            </h3>

            {/* Amount slider */}
            <div className="mb-4">
              <input
                type="range"
                min={5}
                max={200}
                step={0.5}
                value={orderAmount}
                onChange={(e) => setOrderAmount(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
              <div className="text-center text-xs text-zinc-500">
                Drag to change order amount: <span className="text-white font-mono">${orderAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Breakdown */}
            <div className="space-y-3">
              {/* Customer pays */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-violet-800/30 bg-violet-950/10">
                <div className="flex items-center space-x-2">
                  <span>👛</span>
                  <span className="text-xs text-zinc-300">Customer pays</span>
                </div>
                <span className="text-sm font-mono text-violet-300">{(orderAmount * 1000).toLocaleString()} FOODY</span>
              </div>

              <div className="text-center text-zinc-600 text-xs">↓ Hook swaps FOODY → USDC ↓</div>

              {/* Fee split */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-lg border border-emerald-800/30 bg-emerald-950/10 text-center">
                  <div className="text-xs text-zinc-500 mb-1">🏪 Restaurant</div>
                  <div className="text-sm font-mono text-emerald-400">${restaurantAmount.toFixed(2)}</div>
                  <div className="text-[10px] text-zinc-600">90%</div>
                </div>
                <div className="p-3 rounded-lg border border-blue-800/30 bg-blue-950/10 text-center">
                  <div className="text-xs text-zinc-500 mb-1">🔧 Platform</div>
                  <div className="text-sm font-mono text-blue-400">${platformAmount.toFixed(2)}</div>
                  <div className="text-[10px] text-zinc-600">5%</div>
                </div>
                <div className="p-3 rounded-lg border border-violet-800/30 bg-violet-950/10 text-center">
                  <div className="text-xs text-zinc-500 mb-1">🎁 Rewards</div>
                  <div className="text-sm font-mono text-violet-400">${rewardAmount.toFixed(2)}</div>
                  <div className="text-[10px] text-zinc-600">5%</div>
                </div>
              </div>

              <div className="text-center text-zinc-600 text-xs">↓ Stripe Connect off-ramp ↓</div>

              {/* Restaurant receives USD */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-800/30 bg-emerald-950/10">
                <div className="flex items-center space-x-2">
                  <span>🏦</span>
                  <span className="text-xs text-zinc-300">Restaurant bank receives</span>
                </div>
                <span className="text-sm font-mono text-emerald-400 font-bold">${restaurantAmount.toFixed(2)} USD</span>
              </div>

              {/* Customer cashback */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-green-800/30 bg-green-950/10">
                <div className="flex items-center space-x-2">
                  <span>🎁</span>
                  <span className="text-xs text-zinc-300">Customer cashback (Bronze 3%)</span>
                </div>
                <span className="text-sm font-mono text-green-400">+{cashbackFoody.toFixed(0)} FOODY</span>
              </div>
            </div>
          </div>
        </div>

        {/* Why Restaurants Love This */}
        <div className="max-w-4xl mx-auto">
          <h3 className="text-sm uppercase tracking-wider text-zinc-500 mb-4 text-center">Why Restaurants Love This</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { emoji: '🚫', title: 'No Wallet Needed', desc: 'Zero crypto knowledge required' },
              { emoji: '💱', title: 'No Volatility Risk', desc: 'Always receive USD, not tokens' },
              { emoji: '🤖', title: 'Auto Loyalty Program', desc: 'Built-in, no setup cost' },
              { emoji: '⚡', title: 'Instant Settlement', desc: 'Via Stripe Connect to bank' },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-center">
                <div className="text-2xl mb-2">{item.emoji}</div>
                <div className="text-xs font-semibold text-zinc-300 mb-1">{item.title}</div>
                <div className="text-[10px] text-zinc-500">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
