import React from 'react';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import Link from 'next/link';

const OurStoryPage = () => {
  return (
    <div className="bg-gray-900 text-white min-h-screen">
      <Header />
      <main className="py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <Link href="/" aria-label="Go to homepage">
                <h1 className="text-4xl sm:text-5xl font-extrabold text-white">
                    Our Story
                </h1>
            </Link>
          </div>
          
          <div className="space-y-12 text-lg leading-relaxed prose prose-invert lg:prose-xl mx-auto">
            <section>
              <h2 className="text-3xl font-bold mb-4 text-blue-400">A Builder's Journey</h2>
              <p>
                I’m a builder who executes relentlessly. I didn’t come from a typical Silicon Valley track — I started in the U.S. Navy, working on electronic systems aboard a warship where reliability and safety are non-negotiable. Later I worked at NYC DOT managing mission-critical infrastructure. Those environments shaped how I build today: simple, robust, verifiable systems that never fail silently.
              </p>
            </section>

            <section>
              <h2 className="text-3xl font-bold mb-4 text-blue-400">The Spark: It Started with a Cake</h2>
              <p>
                In 2024, everything started with a cake. I ordered a cake from a friend’s bakery in Flushing, and during checkout he joked: “Do you have Bitcoin? I can accept it.”
              </p>
              <p className="mt-4">
                That single sentence unlocked the entire insight behind FoodyePay.
              </p>
            </section>

            <section>
              <h2 className="text-3xl font-bold mb-4 text-blue-400">The Realization & Execution</h2>
              <p>I realized that while the desire was there, the infrastructure was missing:</p>
              <ul className="list-disc pl-6 space-y-2 mt-4 text-gray-300">
                <li>Restaurants lack compliant Web3 onboarding</li>
                <li>Diners lack easy KYC/on-ramp into crypto</li>
                <li>Menus don’t exist natively onchain</li>
                <li>Web3 payments don’t fit real-world workflows</li>
                <li>And AI has no standard for verifiable, onchain economic actions</li>
              </ul>
              <p className="mt-6">
                From that tiny spark, I built everything myself:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4 text-gray-300">
                <li>Designed FoodyeCoin + FoodyePay from scratch</li>
                <li>Solved diner KYC via Coinbase Smart Wallet</li>
                <li>Solved restaurant KYC via Stripe Connect</li>
              </ul>
            </section>

            <section>
              <h2 className="text-3xl font-bold mb-4 text-blue-400">The Uniswap v4 Breakthrough</h2>
              <p>
                The announcement of Uniswap v4 and its "hook" architecture was a watershed moment. It was the missing piece of the puzzle. Hooks provided the exact mechanism needed: a way to execute custom code at critical points in a liquidity pool's lifecycle. This was the key to building a truly on-chain, automated, and ultra-low-cost settlement system.
              </p>
              <p className="mt-4">
                Months of intense research and development led to the creation of the <code className="bg-gray-800 p-1 rounded text-sm font-mono">'RwaSettlementHook'</code>. This wasn't just code; it was a new paradigm for real-world asset (RWA) payments. It allowed for atomic, on-chain settlement, splitting payments to the restaurant, calculating taxes, and distributing fees, all in a single, seamless transaction. Our acceptance into the Uniswap Hook Incubator was a powerful validation of this vision.
              </p>
            </section>

            <section>
              <h2 className="text-3xl font-bold mb-4 text-blue-400">The Future is Programmatic and On-Chain</h2>
              <p>
                Today, FoodyePay is more than just a payment processor. We are building the financial infrastructure for the next generation of commerce. Our vision extends beyond simple payments to a future of dynamic, data-driven liquidity and programmable finance for small businesses.
              </p>
              <p className="mt-4">
                Our journey is one of relentless innovation, driven by the belief that technology can create a more equitable and efficient world. We started with a simple problem in a restaurant, and now we're building a global solution on the frontier of DeFi. This is just the beginning.
              </p>
            </section>

            {/* Team Section Added for Google Cloud Startup Program Requirement */}
            <section className="pt-12 border-t border-gray-800 mt-12">
              <h2 className="text-3xl font-bold mb-10 text-blue-400 text-center">Meet the Team</h2>
              <div className="flex flex-wrap justify-center gap-8">
                
                {/* Team Member: Ken Liao */}
                <div className="bg-gray-800 rounded-xl p-6 text-center w-full max-w-xs border border-gray-700 hover:border-blue-500 transition-colors shadow-lg">
                  <a 
                    href="https://www.linkedin.com/in/ken-liao-50b88983/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block w-32 h-32 mx-auto mb-4 bg-gray-900 rounded-full overflow-hidden border-2 border-blue-500 relative hover:opacity-80 transition-opacity"
                  >
                     <img src="/ken-liao.png" alt="Ken Liao" className="w-full h-full object-cover" />
                  </a>
                  <h3 className="text-2xl font-bold text-white mb-1">Ken Liao</h3>
                  <p className="text-blue-300 font-medium mb-3">Founder & Lead Developer</p>
                  <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                    Passionate about AI, blockchain, and revolutionizing restaurant payments through decentralized finance.
                  </p>
                  <a 
                    href="https://www.linkedin.com/in/ken-liao-50b88983/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center justify-center px-6 py-2 bg-[#0077b5] hover:bg-[#006396] text-white rounded-full text-sm font-bold transition-colors"
                  >
                    LinkedIn Profile
                  </a>
                </div>

              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default OurStoryPage;
