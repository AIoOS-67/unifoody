"use client";

import Link from "next/link";

export default function CloudPage() {
  return (
    <main className="min-h-screen px-6 md:px-10 py-10 max-w-5xl mx-auto text-white">
      <div className="flex items-center justify-center mb-8">
        <Link href="/" aria-label="Go to homepage">
          <img
            src="/FoodyePayLogo.png"
            alt="FoodyePay Logo"
            className="h-20 md:h-24 w-auto drop-shadow-[0_0_16px_rgba(99,102,241,0.35)] hover:opacity-90 transition"
          />
        </Link>
      </div>
      <section>
        <div className="card-premium p-6 md:p-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">FoodyePay on Google Cloud</h1>
          <p className="text-zinc-400 mt-2">Integration Overview</p>
          
          <div className="mt-6 border-t border-zinc-700/50 pt-6 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-zinc-400">Company</p>
                <p className="font-semibold text-zinc-200">FoodyePay Technology, Inc.</p>
              </div>
              <div>
                <p className="text-zinc-400">Organization ID</p>
                <p className="font-mono text-zinc-200">185761594443</p>
              </div>
              <div>
                <p className="text-zinc-400">Partner ID</p>
                <p className="font-mono text-zinc-200">GUVWcQjFZJ</p>
              </div>
              <div>
                <p className="text-zinc-400">Status</p>
                <p className="font-semibold text-green-400">Active (Verified Organization)</p>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4 text-zinc-200 leading-relaxed">
            <h2 className="text-2xl font-semibold border-t border-zinc-700/50 pt-6">Overview</h2>
            <p>
              FoodyePay is a Web3 payment infrastructure built entirely on Google Cloud, providing low-cost, near-instant USDC settlements for merchants and restaurants.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <h2 className="text-2xl font-semibold border-t border-zinc-700/50 pt-6">Google Cloud Integration</h2>
            <ul className="list-disc pl-6 text-zinc-300 mt-3 space-y-2">
              <li><span className="font-semibold text-zinc-100">Cloud Run</span> – hosts microservices and APIs</li>
              <li><span className="font-semibold text-zinc-100">Cloud SQL</span> – manages transactional payment data</li>
              <li><span className="font-semibold text-zinc-100">BigQuery</span> – handles analytics and reporting</li>
              <li><span className="font-semibold text-zinc-100">Apigee</span> – secures and manages API access</li>
              <li><span className="font-semibold text-zinc-100">Vertex AI</span> – supports fraud detection and risk intelligence</li>
            </ul>
          </div>

          <div className="mt-6 space-y-4">
            <h2 className="text-2xl font-semibold border-t border-zinc-700/50 pt-6">Architecture</h2>
            <div className="p-4 bg-zinc-900/70 rounded-lg overflow-x-auto">
              <code className="text-sm text-cyan-400 whitespace-nowrap">
                Users → Apigee → Cloud Run → Cloud SQL → BigQuery → Vertex AI
              </code>
            </div>
             <p className="text-sm text-zinc-400 mt-2">
              All FoodyePay services operate under the verified Google Cloud organization (foodyepay.com) using project ID <code className="font-mono text-xs bg-zinc-700 p-1 rounded">FoodyePay-Prod</code>.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <h2 className="text-2xl font-semibold border-t border-zinc-700/50 pt-6">Use Case Example</h2>
            <p className="text-zinc-200 leading-relaxed">
              When a restaurant receives a USDC payment, FoodyePay APIs run on Cloud Run, log the data to BigQuery, and analyze it in real time via Vertex AI for risk scoring and compliance.
            </p>
          </div>

        </div>
      </section>
    </main>
  );
}
