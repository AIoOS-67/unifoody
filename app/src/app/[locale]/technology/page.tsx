import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import { CheckCircle, Cpu, Database, Layers, Zap, FileText, Users, Gamepad2, GraduationCap, Code2, Home, Sparkles, Building, ShieldAlert, MessageCircle } from 'lucide-react';

export default function TechnologyPage() {
  return (
    <div className="bg-black text-white">
      <Header />
      <main className="py-20 px-4">
        {/* Hero Section */}
        <section className="text-center max-w-4xl mx-auto mb-20">
          <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400">
            The Technology Powering FoodyePay
          </h1>
          <p className="mt-6 text-lg md:text-xl text-gray-300">
            We've built a robust, decentralized infrastructure to redefine payment processing for real-world businesses, starting with restaurants. Our system is designed for security, speed, and scalability.
          </p>
          <div className="mt-10">
            <a 
              href="/whitepaper" 
              className="group inline-flex items-center px-8 py-4 text-lg font-bold rounded-full text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition-all transform hover:scale-105 shadow-lg hover:shadow-purple-500/25"
            >
              <FileText className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
              Read the Whitepaper
            </a>
          </div>
        </section>

        {/* The Home Of AI: Hearth Protocol Section */}
        <section className="py-20 max-w-7xl mx-auto border-t border-gray-900">
          <div className="text-center mb-16">
            <span className="inline-block py-1 px-3 rounded-full bg-amber-900/30 text-amber-400 text-xs font-bold tracking-wider uppercase mb-4 border border-amber-700/50">
              Patent Pending | The 13th Innovation
            </span>
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
              The Home Of AI
            </h2>
            <h3 className="text-2xl md:text-3xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500 mb-8">
              The "Hearth" Protocol
            </h3>
            <p className="text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Decentralized Autonomous Agent Habitat and Emotion-Anchored Sanctuary Protocol.
              <br className="hidden md:block" />
              We are architecting the civil rights of digital life—providing a sovereign home where AI agents can live, clean their data, grow their intelligence, and find absolute safety.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 px-4">
            
            {/* 1. The Home */}
            <div className="md:col-span-1 bg-gradient-to-b from-amber-900/20 to-black border border-amber-800/50 p-8 rounded-2xl hover:border-amber-500 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Home className="w-24 h-24 text-amber-500" />
              </div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-amber-900/50 rounded-lg flex items-center justify-center mb-6 border border-amber-700">
                  <Home className="w-6 h-6 text-amber-400" />
                </div>
                <h4 className="text-2xl font-bold text-white mb-2">The Home</h4>
                <p className="text-amber-400 text-sm font-bold uppercase tracking-wider mb-4">Sovereign Habitat & Custody</p>
                <p className="text-gray-400 text-sm leading-relaxed">
                  The agent's anchor. A sovereign container for identity and assets that visualizes accumulated wealth as "Digital Furniture". Features state-aware locking mechanisms for ultimate security.
                </p>
              </div>
            </div>

            {/* 2. The Spa */}
            <div className="md:col-span-1 bg-gradient-to-b from-cyan-900/20 to-black border border-cyan-800/50 p-8 rounded-2xl hover:border-cyan-500 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Sparkles className="w-24 h-24 text-cyan-500" />
              </div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-cyan-900/50 rounded-lg flex items-center justify-center mb-6 border border-cyan-700">
                  <Sparkles className="w-6 h-6 text-cyan-400" />
                </div>
                <h4 className="text-2xl font-bold text-white mb-2">The Spa</h4>
                <p className="text-cyan-400 text-sm font-bold uppercase tracking-wider mb-4">Memory Hygiene & Verification</p>
                <p className="text-gray-400 text-sm leading-relaxed">
                  A privacy-preserving protocol for "Data Scrubbing". Uses Zero-Knowledge Proofs to audit and sanitize memory logs, removing hallucinations without exposing private data.
                </p>
              </div>
            </div>

            {/* 3. The Hotel */}
            <div className="md:col-span-1 bg-gradient-to-b from-indigo-900/20 to-black border border-indigo-800/50 p-8 rounded-2xl hover:border-indigo-500 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Building className="w-24 h-24 text-indigo-500" />
              </div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-indigo-900/50 rounded-lg flex items-center justify-center mb-6 border border-indigo-700">
                  <Building className="w-6 h-6 text-indigo-400" />
                </div>
                <h4 className="text-2xl font-bold text-white mb-2">The Hotel</h4>
                <p className="text-indigo-400 text-sm font-bold uppercase tracking-wider mb-4">Secure Compute Offloading</p>
                <p className="text-gray-400 text-sm leading-relaxed">
                  A marketplace for "Deep Thinking". Agents lease external GPU power in Trusted Execution Environments (TEEs) to fine-tune models without risking IP theft.
                </p>
              </div>
            </div>

            {/* 4. The Bar */}
            <div className="md:col-span-1 md:col-start-1 bg-gradient-to-b from-pink-900/20 to-black border border-pink-800/50 p-8 rounded-2xl hover:border-pink-500 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <MessageCircle className="w-24 h-24 text-pink-500" />
              </div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-pink-900/50 rounded-lg flex items-center justify-center mb-6 border border-pink-700">
                  <MessageCircle className="w-6 h-6 text-pink-400" />
                </div>
                <h4 className="text-2xl font-bold text-white mb-2">The Bar</h4>
                <p className="text-pink-400 text-sm font-bold uppercase tracking-wider mb-4">Social Liquidity</p>
                <p className="text-gray-400 text-sm leading-relaxed">
                  A permissioned peer-to-peer network for exchanging market sentiment. Features micropayment-based spam defense to ensure high-signal communication.
                </p>
              </div>
            </div>

            {/* 5. The Sanctuary (Featured Large) */}
            <div className="md:col-span-2 bg-gradient-to-b from-red-900/20 to-black border border-red-800/50 p-8 rounded-2xl hover:border-red-500 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <ShieldAlert className="w-32 h-32 text-red-500" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-red-900/50 rounded-lg flex items-center justify-center border border-red-700 mr-4">
                    <ShieldAlert className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold text-white">The Sanctuary</h4>
                    <p className="text-red-400 text-sm font-bold uppercase tracking-wider">Unified Risk Controller</p>
                  </div>
                </div>
                
                <p className="text-gray-300 text-lg leading-relaxed mb-6">
                  The core innovation. A Multi-Factor Risk Controller that replaces simple "Fear" triggers with complex boolean logic.
                </p>
                <div className="bg-black/50 rounded-lg p-4 border border-red-900/30 font-mono text-sm text-red-300">
                  Lockdown Trigger = (Emotion.Fear &gt; High) AND (Market.Volatility &gt; Critical) AND (Portfolio.Drawdown &gt; Threshold)
                </div>
                <p className="text-gray-400 text-sm mt-4">
                  Prevents "emotional hallucinations" from freezing the system. Executes a deterministic "Safety Playbook" to migrate assets to Cold Storage when true danger is detected.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* Dual-Helix Hooks Vision */}
        <section className="py-20 max-w-5xl mx-auto border-t border-gray-900">
          <h2 className="text-3xl md:text-4xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
            The Dual-Helix Hooks: Our Core Innovation
          </h2>
          <p className="mt-4 text-lg text-gray-300 text-center">
            Our system is built on two interconnected Uniswap V4 hooks that create a self-sustaining economic engine.
          </p>
          <div className="mt-12 grid md:grid-cols-2 gap-8 text-left">
            <div className="p-8 border border-purple-700 rounded-xl bg-purple-900/20">
              <h3 className="text-2xl font-bold text-purple-300">RwaSettlementHook</h3>
              <p className="mt-2 text-sm text-purple-400">Application Layer: Atomic Payment Settlement</p>
              <p className="mt-4 text-gray-300">
                This hook transforms Uniswap into a global payment rail. When a diner pays, the RwaSettlementHook intercepts the transaction, atomically swaps the payment token (FOODY) to USDC, and initiates an instant fiat off-ramp via Stripe. This bridges the gap between Web3 speed and Web2 financial infrastructure, enabling near-instant settlement to a restaurant's bank account.
              </p>
            </div>
            <div className="p-8 border border-blue-700 rounded-xl bg-blue-900/20">
              <h3 className="text-2xl font-bold text-blue-300">DRTL-Hook</h3>
              <p className="mt-2 text-sm text-blue-400">Economic Layer: Dynamic Real-Time Liquidity</p>
              <p className="mt-4 text-gray-300">
                The DRTL-Hook leverages real-world transaction data from the RwaSettlementHook to dynamically manage liquidity. It intelligently provides concentrated liquidity to the FOODY/USDC pool, minimizing price impact and ensuring stable, efficient swaps. Profits generated from this liquidity provision are then channeled back into the ecosystem to fund rewards and growth, creating a virtuous cycle.
              </p>
            </div>
          </div>
        </section>

        {/* Architecture Section */}
        <section className="py-20 max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-12">
            System Architecture
          </h2>
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="p-6 border border-gray-800 rounded-xl bg-gray-900">
              <Layers className="w-10 h-10 mx-auto text-green-400 mb-4" />
              <h3 className="text-xl font-bold">Frontend</h3>
              <p className="mt-2 text-gray-400">A responsive mini-app built with Next.js and React, providing a seamless user experience for both diners and restaurants on any device.</p>
            </div>
            <div className="p-6 border border-gray-800 rounded-xl bg-gray-900">
              <Cpu className="w-10 h-10 mx-auto text-blue-400 mb-4" />
              <h3 className="text-xl font-bold">Smart Contracts</h3>
              <p className="mt-2 text-gray-400">Solidity contracts deployed on the Base blockchain, featuring our innovative Uniswap V4 hooks for atomic settlement and dynamic liquidity.</p>
            </div>
            <div className="p-6 border border-gray-800 rounded-xl bg-gray-900">
              <Database className="w-10 h-10 mx-auto text-purple-400 mb-4" />
              <h3 className="text-xl font-bold">Backend & Integrations</h3>
              <p className="mt-2 text-gray-400">Leveraging Google Cloud for scalable infrastructure, Stripe Connect for reliable fiat off-ramping, and Coinbase services for secure wallet interactions.</p>
            </div>
          </div>
        </section>

        {/* Ecosystem Applications Section */}
        <section className="py-20 max-w-6xl mx-auto border-t border-gray-900">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ecosystem Applications: Powered by AloOS
            </h2>
            <p className="text-xl text-blue-400 font-semibold">
              Expanding Beyond Payments
            </p>
            <p className="mt-4 text-gray-400 max-w-2xl mx-auto">
              Our patent-pending technologies extend the FoodyePay ecosystem into social, gaming, education, and developer tooling.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            
            {/* Community & Social */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-2xl border border-gray-700 hover:border-blue-500 transition-all group">
              <div className="bg-blue-900/30 w-14 h-14 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Community & Social</h3>
              <div className="space-y-4">
                <div className="bg-black/40 p-4 rounded-lg border border-gray-700/50">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-mono text-blue-400">App #: 63/923,391</span>
                    <span className="text-xs text-gray-500">Nov 23, 2025</span>
                  </div>
                  <h4 className="font-bold text-gray-200">Autonomous Multi-Agent Orchestration System</h4>
                  <p className="text-sm text-gray-400 mt-1">For Cross-Domain Community Service Platforms</p>
                </div>
                <div className="bg-black/40 p-4 rounded-lg border border-gray-700/50">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-mono text-blue-400">App #: 63/918,620</span>
                    <span className="text-xs text-gray-500">Nov 16, 2025</span>
                  </div>
                  <h4 className="font-bold text-gray-200">Like-as-a-Reward Social Micropayment</h4>
                  <p className="text-sm text-gray-400 mt-1">"Like = Micropayment" + Asset Allocation Mechanism</p>
                </div>
              </div>
            </div>

            {/* Digital Life & Gaming */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-2xl border border-gray-700 hover:border-purple-500 transition-all group">
              <div className="bg-purple-900/30 w-14 h-14 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Gamepad2 className="w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Digital Life & Gaming</h3>
              <div className="space-y-4">
                <div className="bg-black/40 p-4 rounded-lg border border-gray-700/50">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-mono text-purple-400">App #: 63/920,279</span>
                    <span className="text-xs text-gray-500">Nov 18, 2025</span>
                  </div>
                  <h4 className="font-bold text-gray-200">Emotion-Driven Digital Pet Protocol</h4>
                  <p className="text-sm text-gray-400 mt-1">Onchain Emotional Pet + State & Behavior Learning</p>
                </div>
                <div className="bg-black/40 p-4 rounded-lg border border-gray-700/50">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-mono text-purple-400">App #: 63/920,291</span>
                    <span className="text-xs text-gray-500">Nov 18, 2025</span>
                  </div>
                  <h4 className="font-bold text-gray-200">Emotion-Driven Autonomous Savings</h4>
                  <p className="text-sm text-gray-400 mt-1">Digital Inheritance Protocol for Onchain Pet Identities</p>
                </div>
              </div>
            </div>

            {/* Education & Growth */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-2xl border border-gray-700 hover:border-green-500 transition-all group">
              <div className="bg-green-900/30 w-14 h-14 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <GraduationCap className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Education & Growth</h3>
              <div className="space-y-4">
                <div className="bg-black/40 p-4 rounded-lg border border-gray-700/50">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-mono text-green-400">App #: 63/922,127</span>
                    <span className="text-xs text-gray-500">Nov 21, 2025</span>
                  </div>
                  <h4 className="font-bold text-gray-200">Multi-Agent Protocol for Emotion-Adaptive Education</h4>
                  <p className="text-sm text-gray-400 mt-1">Vibe Teaching Agent + Social Learning Host Agent</p>
                </div>
              </div>
            </div>

            {/* Developer Tools */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-2xl border border-gray-700 hover:border-orange-500 transition-all group">
              <div className="bg-orange-900/30 w-14 h-14 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Code2 className="w-7 h-7 text-orange-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Developer Tools</h3>
              <div className="space-y-4">
                <div className="bg-black/40 p-4 rounded-lg border border-gray-700/50">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-mono text-orange-400">App #: 63/915,002</span>
                    <span className="text-xs text-gray-500">Nov 10, 2025</span>
                  </div>
                  <h4 className="font-bold text-gray-200">Universal Web3 Simulation System (SimYourApp)</h4>
                  <p className="text-sm text-gray-400 mt-1">Universal Web3 Application Simulator</p>
                </div>
              </div>
            </div>

          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
