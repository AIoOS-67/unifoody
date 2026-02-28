import React from 'react';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import Link from 'next/link';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

const Feature = ({ title, description }: { title: string, description: string }) => (
  <div className="flex gap-4">
    <CheckCircleIcon className="h-6 w-6 text-green-500 mt-1 flex-shrink-0" />
    <div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="text-gray-400 mt-1">{description}</p>
    </div>
  </div>
);

const ForRestaurantsPage = () => {
  return (
    <div className="bg-gray-900 text-white min-h-screen">
      <Header />
      <main className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <section className="text-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
              Focus on Your Craft, Not Your Fees
            </h1>
            <p className="mt-6 text-xl text-gray-300 max-w-3xl mx-auto">
              FoodyePay eliminates the 3% transaction fees that cut into your profits. Our on-chain settlement system means you get paid almost instantly, keeping your hard-earned money in your pocket.
            </p>
            <div className="mt-10">
              <Link href="/register" legacyBehavior>
                <a className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg text-lg transition-transform transform hover:scale-105">
                  Start Onboarding
                </a>
              </Link>
            </div>
          </section>

          {/* Key Benefits Section */}
          <section className="mt-20 sm:mt-24">
            <h2 className="text-3xl font-bold text-center mb-12">
              The Modern Payment Solution You've Been Waiting For
            </h2>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-12">
              <Feature
                title="Eliminate 3% Fees"
                description="Stop giving away your profits. Our system leverages the Base blockchain for settlements that cost a fraction of a cent, not a percentage of your sale."
              />
              <Feature
                title="Instant Settlement"
                description="No more waiting 2-3 business days for your money. Payments are settled on-chain in seconds, giving you immediate access to your funds."
              />
              <Feature
                title="Simplified Reconciliation"
                description="Every transaction is recorded on an immutable public ledger. Our dashboard makes auditing and reconciliation effortless and transparent."
              />
              <Feature
                title="Secure & Non-Custodial"
                description="You are always in control of your funds. We never take custody of your money. Payments go directly from the customer to you."
              />
              <Feature
                title="Easy Onboarding with Stripe"
                description="Get started in minutes. We partner with Stripe for industry-standard Know Your Business (KYB) verification, ensuring a secure and compliant setup."
              />
              <Feature
                title="Global Reach, Stable Currency"
                description="Receive payments in USDC, a stablecoin pegged to the US Dollar. Accept payments from anyone, anywhere, without worrying about currency volatility or conversion fees."
              />
            </div>
          </section>

          {/* How It Works Section */}
          <section className="mt-20 sm:mt-24 text-center">
            <h2 className="text-3xl font-bold mb-12">Simple Steps to a Better Bottom Line</h2>
            <div className="relative max-w-2xl mx-auto">
              {/* Vertical line */}
              <div className="absolute left-1/2 -translate-x-1/2 h-full w-0.5 bg-gray-700" aria-hidden="true"></div>

              <div className="space-y-16">
                <div className="relative flex items-center">
                  <div className="w-1/2 pr-8 text-right">
                    <h3 className="text-2xl font-semibold text-blue-400">Step 1: Onboard</h3>
                    <p className="text-gray-400 mt-2">Complete a quick and secure verification process through our partner, Stripe Connect.</p>
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold z-10">1</div>
                  <div className="w-1/2 pl-8"></div>
                </div>

                <div className="relative flex items-center">
                    <div className="w-1/2 pr-8"></div>
                    <div className="absolute left-1/2 -translate-x-1/2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold z-10">2</div>
                    <div className="w-1/2 pl-8 text-left">
                        <h3 className="text-2xl font-semibold text-blue-400">Step 2: Generate QR Code</h3>
                        <p className="text-gray-400 mt-2">Use your dashboard to generate a unique QR code for your point-of-sale.</p>
                    </div>
                </div>

                <div className="relative flex items-center">
                  <div className="w-1/2 pr-8 text-right">
                    <h3 className="text-2xl font-semibold text-blue-400">Step 3: Get Paid</h3>
                    <p className="text-gray-400 mt-2">Diners scan the code and pay with USDC. Funds arrive in your wallet instantly.</p>
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold z-10">3</div>
                  <div className="w-1/2 pl-8"></div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ForRestaurantsPage;
