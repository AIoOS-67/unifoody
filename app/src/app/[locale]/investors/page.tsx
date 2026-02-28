import React from "react";
import Link from "next/link";

export const metadata = {
  title: "Investors | FoodyePay",
  description:
    "FoodyePay Investors Portal — Empowering real-world crypto payments for the global dining industry. Seed round raising $2M at $7M post.",
  openGraph: {
    title: "Investors | FoodyePay",
    description:
      "FoodyePay Investors Portal — Empowering real-world crypto payments for the global dining industry.",
    url: "https://www.foodyepay.com/investors",
    type: "website",
  },
};

export default function InvestorsPage() {
  return (
    <main className="min-h-screen px-6 md:px-10 py-10 max-w-5xl mx-auto text-white">
      {/* Header Logo */}
      <div className="flex items-center justify-center mb-8">
        <Link href="https://www.foodyepay.com" aria-label="Go to FoodyePay.com">
          <img
            src="/FoodyePayLogo.png"
            alt="FoodyePay Logo"
            className="h-20 md:h-24 w-auto drop-shadow-[0_0_16px_rgba(99,102,241,0.35)] cursor-pointer"
          />
        </Link>
      </div>

      {/* Hero / Intro */}
      <section className="mb-10">
        <div className="card-premium p-6 md:p-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">FoodyePay Investors Portal</h1>
          <p className="text-zinc-400 mt-2">Empowering Real-World Crypto Payments for the Global Dining Industry</p>
          <div className="mt-6 space-y-4 text-zinc-200 leading-relaxed">
            <p>
              <span className="font-semibold">FoodyePay Technology, Inc.</span> is a Delaware-based Web3 payment infrastructure company bringing blockchain payments into everyday dining.
            </p>
            <p>
              We enable diners to pay with crypto (USDC, Foodye Coin) while restaurants receive instant on-chain settlements — no banks, no delays, no hidden fees.
            </p>
          </div>
        </div>
      </section>

      {/* About FoodyePay */}
      <section className="mb-10">
        <div className="card-premium p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-semibold">About FoodyePay</h2>
          <div className="mt-4 space-y-4 text-zinc-200">
            <p>
              FoodyePay is building the bridge between blockchain and real-world payments. Our DApp and PWA platform allow diners to complete transactions using Coinbase Smart Wallet, while restaurants can view and withdraw earnings instantly in crypto or stablecoins.
            </p>
            <div>
              <h3 className="text-xl font-semibold">Core Features:</h3>
              <ul className="list-disc pl-6 mt-2 space-y-2 text-zinc-300">
                <li>Instant blockchain settlement for restaurants</li>
                <li>Foodye Coin (FOODY) as native utility token</li>
                <li>NFT-based menu and loyalty system (FoodyeMenuNFT)</li>
                <li>Coinbase Smart Wallet integration (extension-free onboarding)</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Fundraising */}
      <section className="mb-10">
        <div className="card-premium p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-semibold">Current Fundraising Round</h2>
          <div className="mt-4 grid md:grid-cols-2 gap-6 text-zinc-200">
            <ul className="space-y-2">
              <li><span className="font-semibold">Round:</span> Seed (Raising)</li>
              <li><span className="font-semibold">Target:</span> USD 2,000,000</li>
              <li><span className="font-semibold">Valuation:</span> USD 10,000,000 post-money</li>
              <li><span className="font-semibold">Status:</span> Open for accredited investors</li>
              <li><span className="font-semibold">Round announced:</span> October 11, 2025</li>
            </ul>
            <div>
              <h3 className="text-lg font-semibold mb-2">Use of Funds:</h3>
              <ul className="list-disc pl-6 space-y-1 text-zinc-300">
                <li>40% Product & Engineering</li>
                <li>30% Licensing & Compliance (U.S. money transmitter registration)</li>
                <li>20% Merchant acquisition & restaurant partnerships</li>
                <li>10% Marketing & community growth</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Why Invest */}
      <section className="mb-10">
        <div className="card-premium p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-semibold">Why Invest in FoodyePay</h2>
          <ul className="list-disc pl-6 mt-4 space-y-2 text-zinc-300">
            <li>Massive Market Opportunity — 45,000+ Chinese restaurants in the U.S. alone, $900B+ annual restaurant volume.</li>
            <li>Real-world Adoption — Crypto payments tied to real, daily food transactions.</li>
            <li>Proprietary Token Economy — Foodye Coin (FOODY) integrates payment + loyalty + settlement.</li>
            <li>Web3 x FinTech Hybrid — Built on Base, connected to Coinbase ecosystem.</li>
            <li>Strong Expansion Path — From U.S. to global Asian restaurant networks.</li>
          </ul>
        </div>
      </section>

      {/* Roadmap */}
      <section className="mb-10">
        <div className="card-premium p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-semibold">Roadmap Highlights</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-zinc-200">
              <thead className="text-zinc-400">
                <tr>
                  <th className="py-2 pr-4">Quarter</th>
                  <th className="py-2">Milestone</th>
                  <th className="py-2 pl-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                <tr>
                  <td className="py-3 pr-4">Q4 2025</td>
                  <td className="py-3">
                    Seed round open + strategic partnerships with
                    {" "}
                    <a
                      href="https://docs.cloud.coinbase.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:underline"
                    >
                      Coinbase Smart Wallet/CDP APIs
                    </a>
                    {" "}&
                    {" "}
                    <a
                      href="https://stripe.com/connect"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:underline"
                    >
                      Stripe Connect
                    </a>
                  </td>
                  <td className="py-3 pl-4"><span className="rounded bg-indigo-900/40 px-2 py-1 text-xs">In progress</span><span className="ml-2 text-xs text-zinc-400">(Connect live approved; webhook sync pending)</span></td>
                </tr>
                <tr>
                  <td className="py-3 pr-4">Q1 2026</td>
                  <td className="py-3">Merchant POS SDK release</td>
                  <td className="py-3 pl-4"><span className="rounded bg-zinc-800 px-2 py-1 text-xs">Planned</span><span className="ml-2 text-xs text-zinc-400">(scope: API surface, sample app, docs)</span></td>
                </tr>
                <tr>
                  <td className="py-3 pr-4">Q2 2026</td>
                  <td className="py-3">Pilot “FoodyePay Anywhere” Visa Card (via Issuing partner) — pending approvals</td>
                  <td className="py-3 pl-4"><span className="rounded bg-amber-900/30 px-2 py-1 text-xs">Exploratory</span><span className="ml-2 text-xs text-zinc-400">(BIN sponsor, card program, compliance)</span></td>
                </tr>
                <tr>
                  <td className="py-3 pr-4">Q3 2026</td>
                  <td className="py-3">Global restaurant onboarding (U.S., Canada, UK, Asia)</td>
                  <td className="py-3 pl-4"><span className="rounded bg-zinc-800 px-2 py-1 text-xs">Planned</span><span className="ml-2 text-xs text-zinc-400">(depends on country availability, localization)</span></td>
                </tr>
                <tr>
                  <td className="py-3 pr-4">Q4 2026</td>
                  <td className="py-3">Foodye Coin ecosystem expansion & NFT loyalty integration</td>
                  <td className="py-3 pl-4"><span className="rounded bg-zinc-800 px-2 py-1 text-xs">Planned</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-400">Roadmap targets are forward-looking and subject to change.</p>
        </div>
      </section>

      {/* Token Overview */}
      <section className="mb-10">
        <div className="card-premium p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-semibold">Token Overview — Foodye Coin (FOODY)</h2>
          <ul className="mt-4 space-y-2 text-zinc-300">
            <li><span className="font-semibold">Blockchain:</span> Ethereum Mainnet + Base Network (EVM Compatible)</li>
            <li><span className="font-semibold">Use Cases:</span> Payments, loyalty rewards, NFT redemption</li>
            <li><span className="font-semibold">Launch Date:</span> May-12-2025</li>
            <li>
              <span className="font-semibold">Smart Contract Address:</span>
              <br />
              <code className="text-zinc-100">0x1022B1B028a2237C440DbAc51Dc6fC220D88C08F</code>
            </li>
            <li><span className="font-semibold">Verification Status:</span> ✅ Contract Source Code Verified (Exact Match)</li>
            <li><span className="font-semibold">Compiler Version:</span> Solidity v0.8.22 (Optimization enabled, 200 runs)</li>
            <li><span className="font-semibold">EVM Version:</span> Paris</li>
            <li><span className="font-semibold">Contract Creator:</span> foodyepay.eth</li>
          </ul>
        </div>
      </section>

      {/* Contact */}
      <section>
        <div className="card-premium p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-semibold">Investor Contact</h2>
          <div className="mt-4 text-zinc-200 space-y-2">
            <p><span className="font-semibold">Ken Liao</span><br/>Founder &amp; Chief Engineer</p>
            <p>
              <span className="font-semibold">Email:</span> <a href="mailto:investors@foodyepay.com" className="text-indigo-400 hover:underline">investors@foodyepay.com</a>
            </p>
            <p>
              <span className="font-semibold">Website:</span> <a href="https://www.foodyepay.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">www.foodyepay.com</a>
            </p>
            <p>New York, United States</p>
          </div>
          <blockquote className="mt-6 border-l-4 border-indigo-600 pl-4 text-zinc-300 italic">
            “FoodyePay is redefining how the world pays for food — with speed, transparency, and the power of Web3.”
          </blockquote>
        </div>
      </section>
    </main>
  );
}
