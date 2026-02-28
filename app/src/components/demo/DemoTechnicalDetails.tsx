'use client';

import {
  HOOK_ADDRESS,
  VIP_NFT_ADDRESS,
  FOODY_ADDRESS,
  USDC_ADDRESS,
  POOL_MANAGER_ADDRESS,
  BLOCK_EXPLORER_URL,
} from '@/lib/uniswap-v4/constants';

const contracts = [
  { label: 'FoodySwapHook', address: HOOK_ADDRESS, description: 'Main V4 Hook (beforeSwap + afterSwap)' },
  { label: 'FoodyVIPNFT', address: VIP_NFT_ADDRESS, description: 'Soulbound VIP NFT (ERC-721)' },
  { label: 'FOODY Token', address: FOODY_ADDRESS as string, description: 'FoodyePay ERC-20 Token' },
  { label: 'MockUSDC', address: USDC_ADDRESS as string, description: 'Test USDC (6 decimals)' },
  { label: 'PoolManager', address: POOL_MANAGER_ADDRESS, description: 'Uniswap V4 Singleton' },
];

const hookPermissions = [
  { permission: 'afterInitialize', used: true, purpose: 'Set dynamic fee flag on pool creation' },
  { permission: 'beforeSwap', used: true, purpose: 'Constraint checks + dynamic fee calculation' },
  { permission: 'afterSwap', used: true, purpose: 'Settlement, loyalty, cashback, referral, VIP NFT' },
  { permission: 'beforeAddLiquidity', used: false, purpose: '' },
  { permission: 'afterAddLiquidity', used: false, purpose: '' },
  { permission: 'beforeRemoveLiquidity', used: false, purpose: '' },
  { permission: 'afterRemoveLiquidity', used: false, purpose: '' },
];

const testStats = [
  { label: 'Unit Tests', count: 18, color: 'green' },
  { label: 'Fuzz Tests', count: 5, color: 'yellow' },
  { label: 'Integration', count: 6, color: 'blue' },
];

export default function DemoTechnicalDetails() {
  return (
    <section className="py-16 border-t border-zinc-800/50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-2">
            <span className="bg-gradient-to-r from-zinc-300 to-zinc-500 bg-clip-text text-transparent">
              Under the Hood
            </span>
          </h2>
          <p className="text-sm text-zinc-400">
            Contract addresses, hook permissions, and test coverage
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* Contract Addresses */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4">Contract Addresses (Base Sepolia)</h3>
            <div className="space-y-3">
              {contracts.map((c) => (
                <div key={c.label} className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-zinc-300 font-medium">{c.label}</div>
                    <div className="text-[10px] text-zinc-600">{c.description}</div>
                  </div>
                  <a
                    href={`${BLOCK_EXPLORER_URL}/address/${c.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-violet-400 hover:text-violet-300 font-mono whitespace-nowrap ml-2"
                  >
                    {c.address.slice(0, 6)}...{c.address.slice(-4)} ↗
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Hook Permissions */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4">Hook Permissions</h3>
            <div className="space-y-2">
              {hookPermissions.map((hp) => (
                <div key={hp.permission} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                      hp.used
                        ? 'bg-green-900/50 text-green-400'
                        : 'bg-zinc-800 text-zinc-600'
                    }`}>
                      {hp.used ? '✓' : '—'}
                    </span>
                    <span className={`text-xs font-mono ${hp.used ? 'text-zinc-300' : 'text-zinc-600'}`}>
                      {hp.permission}
                    </span>
                  </div>
                  {hp.used && (
                    <span className="text-[10px] text-zinc-500 max-w-[200px] text-right">{hp.purpose}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Test Coverage */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4">Test Coverage</h3>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {testStats.map((t) => (
                <div key={t.label} className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-3 text-center">
                  <div className={`text-2xl font-bold font-mono ${
                    t.color === 'green' ? 'text-green-400' :
                    t.color === 'yellow' ? 'text-yellow-400' : 'text-blue-400'
                  }`}>
                    {t.count}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-1">{t.label}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-xs text-green-400 font-semibold">29 tests passing</span>
              <span className="text-[10px] text-zinc-600">All green on Foundry</span>
            </div>
            <div className="mt-3 text-[10px] text-zinc-600 text-center">
              Includes: basic swap flow, tier upgrades, VIP NFT mint, referral bonuses,
              operating hours, amount limits, fuzz testing with random amounts/addresses
            </div>
          </div>

          {/* Tech Stack & Links */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4">Tech Stack &amp; Links</h3>

            {/* Stack badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                'Solidity ^0.8.26',
                'Foundry',
                'Uniswap V4',
                'Base Chain',
                'OpenZeppelin',
                'ERC-721 (Soulbound)',
              ].map((tech) => (
                <span key={tech} className="px-2 py-1 rounded-md bg-zinc-900 border border-zinc-700 text-[10px] text-zinc-400">
                  {tech}
                </span>
              ))}
            </div>

            {/* Links */}
            <div className="space-y-2">
              <a
                href="https://github.com/AIoOS-67/foodyswap-hook"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
              >
                <span>📦</span>
                <span className="text-xs text-zinc-300">GitHub Repository</span>
                <span className="text-[10px] text-zinc-600 ml-auto">AIoOS-67/foodyswap-hook ↗</span>
              </a>
              <a
                href={`${BLOCK_EXPLORER_URL}/address/${HOOK_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
              >
                <span>🔍</span>
                <span className="text-xs text-zinc-300">View on Uniscan</span>
                <span className="text-[10px] text-zinc-600 ml-auto">Unichain Sepolia ↗</span>
              </a>
              <div className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-zinc-700">
                <span>🏆</span>
                <span className="text-xs text-zinc-300">UHI Hookathon 8</span>
                <span className="text-[10px] text-zinc-600 ml-auto">Cohort: UHI8</span>
              </div>
            </div>

            {/* Gas Note */}
            <div className="mt-4 rounded-lg bg-zinc-900/50 border border-zinc-800 p-3">
              <div className="text-[10px] text-zinc-500 mb-1">Gas Efficiency</div>
              <div className="text-xs text-zinc-400">
                Single hook contract with three internal layers. No cross-contract calls.
                All loyalty data stored in optimized mappings. VIP NFT mint uses try/catch
                for graceful degradation.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
