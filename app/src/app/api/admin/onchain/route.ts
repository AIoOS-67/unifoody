// Server-side API route for On-Chain FOODY transfer data
// Returns SEPARATE blockchain data + V4 Hook simulation settlements

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';
const FOODY_TOKEN = '0x55aEcFfA2F2E4DDcc63B40bac01b939A9C23f91A';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const HOOK_ADDRESS = '0x7D81E8e79F19949905E587288bD90BBfDee3e280';

const WALLET_LABELS: Record<string, string> = {
  '0xb4ffaac40f4ca6ecb006ae6d739262f1458b64a3': '🔑 Deployer',
  '0xa5178af57139c7081104d7a1a2ecb6cd6e63a121': '🍽️ Mei Lin (diner_001)',
  '0x3fa507dc3185a9c5ac6b66184fd2248f5ee92242': '🍽️ David Chen (diner_002)',
  '0x3c2204d6ec590c70adfbfbce44d2f95b8d100232': '🍽️ Sofia Rodriguez (diner_003)',
  '0x940beb572afa69fce20f09ce3a3054db69d15199': '🍽️ James Wu (diner_004)',
  '0x24265be054d94affcab000d553a6653e2ebc6a5e': '🍽️ Amy Zhang (diner_005)',
  '0xcf5c56396128557ead615d5b6beed756159c0c13': '🏪 Sichuan Garden (rest_001)',
  '0x7355048e9134cf7b641787e2061db87847e5d334': '🏪 Pearl Dim Sum (rest_002)',
  '0x9c958328f273782fdda6012fd28e556f466b118b': '🏪 Golden Pho (rest_003)',
};

async function rpcCall(method: string, params: unknown[], id = 1) {
  const res = await fetch(BASE_SEPOLIA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`RPC error: ${data.error.message}`);
  return data.result;
}

// Build wallet → diner name label map from DB
async function buildWalletLabels(): Promise<Record<string, string>> {
  const labels: Record<string, string> = { ...WALLET_LABELS };
  try {
    const rows = await pool.query(
      `SELECT wallet_address, first_name, last_name, state FROM diners WHERE wallet_address IS NOT NULL LIMIT 6000`
    );
    for (const r of rows.rows) {
      const w = (r.wallet_address as string).toLowerCase();
      if (!labels[w]) {
        const stateTag = r.state ? ` · ${r.state}` : '';
        labels[w] = `🍽️ ${r.first_name}${stateTag}`;
      }
    }
  } catch {
    // Ignore — use static labels only
  }
  return labels;
}

// Fetch V4 Hook simulation settlements from database
async function fetchSimulationSettlements(labels: Record<string, string>, limit = 200) {
  try {
    const result = await pool.query(`
      SELECT
        id, wallet_address, reward_type, foody_amount,
        swap_amount_usdc, loyalty_tier, description, created_at,
        onchain_status, onchain_tx_hash
      FROM v4_rewards
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    return result.rows.map((r: Record<string, unknown>) => {
      const wallet = (r.wallet_address as string).toLowerCase();
      const foody = parseFloat(String(r.foody_amount));
      const createdAt = new Date(r.created_at as string);
      const timestamp = Math.floor(createdAt.getTime() / 1000);

      const rewardTypeEmoji: Record<string, string> = {
        swap_bonus: '💱',
        loyalty_bonus: '⭐',
        streak_bonus: '🔥',
        first_swap_bonus: '🎉',
        cashback_restaurant: '🏪',
      };
      const emoji = rewardTypeEmoji[r.reward_type as string] || '💰';
      const realTxHash = r.onchain_tx_hash as string | null;
      const onchainStatus = (r.onchain_status as string) || 'pending';

      return {
        txHash: realTxHash || `0x${(r.id as string).replace(/[^a-f0-9]/gi, '').slice(0, 64).padEnd(64, '0')}`,
        blockNumber: 0,
        timestamp,
        from: HOOK_ADDRESS.toLowerCase(),
        to: wallet,
        foodyAmount: foody.toLocaleString('en-US', { maximumFractionDigits: 0 }),
        fromLabel: '🦄 FoodySwap Hook',
        toLabel: labels[wallet] ?? `${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
        source: 'v4_hook',
        rewardType: r.reward_type as string,
        rewardEmoji: emoji,
        loyaltyTier: r.loyalty_tier as string,
        usdcAmount: parseFloat(String(r.swap_amount_usdc || 0)),
        onchainStatus,
        hasRealTx: !!realTxHash,
      };
    });
  } catch (e) {
    console.warn('[Onchain] V4 simulation query failed:', e);
    return [];
  }
}

// Aggregate stats from V4 simulation data
async function fetchSimulationStats() {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)::int as total_rewards,
        COALESCE(SUM(foody_amount), 0)::float as total_foody,
        COUNT(DISTINCT wallet_address)::int as unique_wallets
      FROM v4_rewards
    `);
    const row = result.rows[0];
    return {
      totalRewards: row?.total_rewards || 0,
      totalFoody: Math.round(row?.total_foody || 0),
      uniqueWallets: row?.unique_wallets || 0,
    };
  } catch {
    return { totalRewards: 0, totalFoody: 0, uniqueWallets: 0 };
  }
}

// Tier distribution from v4_loyalty
async function fetchTierDistribution() {
  try {
    const result = await pool.query(`
      SELECT tier, COUNT(*)::int as cnt
      FROM v4_loyalty
      GROUP BY tier
    `);
    const dist: Record<string, number> = { none: 0, bronze: 0, silver: 0, gold: 0, platinum: 0 };
    for (const r of result.rows) {
      dist[r.tier as string] = r.cnt as number;
    }
    return dist;
  } catch {
    return { none: 0, bronze: 0, silver: 0, gold: 0, platinum: 0 };
  }
}

export async function GET(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get('authorization');
  const apiKey = authHeader?.replace('Bearer ', '');
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Build wallet labels from DB
    const labels = await buildWalletLabels();

    // Fetch all sources in parallel
    const [simTxs, simStats, tierDist, rpcData] = await Promise.all([
      fetchSimulationSettlements(labels),
      fetchSimulationStats(),
      fetchTierDistribution(),
      fetchRpcTransfers(labels),
    ]);

    // Return SEPARATE data — no misleading merged stats (no-cache to avoid stale labels)
    return new NextResponse(JSON.stringify({
      // Real blockchain data
      blockchainTxs: rpcData.txs,
      blockchainStats: {
        totalTxs: rpcData.txs.length,
        totalFoody: rpcData.totalFoody,
        activeWallets: new Set([
          ...rpcData.txs.map(t => t.from),
          ...rpcData.txs.map(t => t.to),
        ]).size,
      },
      // V4 Hook simulation data
      simulationTxs: simTxs,
      simulationStats: {
        totalRewards: simStats.totalRewards,
        totalFoody: simStats.totalFoody,
        uniqueWallets: simStats.uniqueWallets,
        tierDistribution: tierDist,
      },
      meta: {
        ...rpcData.meta,
      },
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('On-chain API error:', msg);
    return NextResponse.json({ error: msg ?? 'Failed to fetch on-chain data' }, { status: 500 });
  }
}

// Existing RPC logic
async function fetchRpcTransfers(labels: Record<string, string>) {
  const allLogs: Record<string, unknown>[] = [];
  let latestBlock = 0;
  let startBlock = 0;
  let chunksQueried = 0;

  try {
    const latestBlockHex = await rpcCall('eth_blockNumber', []);
    latestBlock = parseInt(latestBlockHex, 16);
    const totalRange = 200000; // ~4.6 days on Base Sepolia (2s/block)
    const chunkSize = 9500;
    startBlock = Math.max(0, latestBlock - totalRange);

    const chunks: Array<{ from: number; to: number }> = [];
    for (let b = startBlock; b <= latestBlock; b += chunkSize) {
      chunks.push({ from: b, to: Math.min(b + chunkSize - 1, latestBlock) });
    }
    chunksQueried = chunks.length;

    // Fetch all chunks in parallel (5 at a time) for speed
    const PARALLEL = 5;
    for (let i = 0; i < chunks.length; i += PARALLEL) {
      const batch = chunks.slice(i, i + PARALLEL);
      const results = await Promise.allSettled(
        batch.map(chunk =>
          rpcCall('eth_getLogs', [{
            address: FOODY_TOKEN,
            topics: [TRANSFER_TOPIC],
            fromBlock: '0x' + chunk.from.toString(16),
            toBlock: '0x' + chunk.to.toString(16),
          }])
        )
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          allLogs.push(...r.value);
        }
      }
    }
  } catch (e) {
    console.warn('[Onchain] RPC fetch failed, continuing with simulation data only:', e);
  }

  // Fetch block timestamps in parallel (10 at a time)
  const uniqueBlocks = [...new Set<string>(allLogs.map((l: Record<string, unknown>) => l.blockNumber as string))];
  const blockTimes: Record<string, number> = {};
  for (let i = 0; i < uniqueBlocks.length; i += 10) {
    const batch = uniqueBlocks.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map(bn => rpcCall('eth_getBlockByNumber', [bn, false]))
    );
    batch.forEach((bn, idx) => {
      const r = results[idx];
      blockTimes[bn] = r.status === 'fulfilled' ? parseInt(r.value?.timestamp ?? '0', 16) : 0;
    });
  }

  const txs = allLogs
    .map((log: Record<string, unknown>) => {
      const topics = log.topics as string[];
      const from = '0x' + topics[1].slice(26).toLowerCase();
      const to = '0x' + topics[2].slice(26).toLowerCase();
      const rawAmount = BigInt(log.data as string);
      const foodyAmount = Number(rawAmount) / 1e18;
      return {
        txHash: log.transactionHash as string,
        blockNumber: parseInt(log.blockNumber as string, 16),
        timestamp: blockTimes[log.blockNumber as string] ?? 0,
        from,
        to,
        foodyAmount: foodyAmount.toLocaleString('en-US', { maximumFractionDigits: 2 }),
        fromLabel: labels[from] ?? `${from.slice(0, 6)}...${from.slice(-4)}`,
        toLabel: labels[to] ?? `${to.slice(0, 6)}...${to.slice(-4)}`,
        source: 'blockchain',
      };
    })
    .filter(t => t.from !== '0x0000000000000000000000000000000000000000')
    .sort((a, b) => b.blockNumber - a.blockNumber);

  const totalFoody = allLogs
    .filter((l: Record<string, unknown>) => (l.topics as string[])[1].slice(26) !== '0'.repeat(40))
    .reduce((sum, l: Record<string, unknown>) => sum + Number(BigInt(l.data as string)) / 1e18, 0);

  return {
    txs,
    totalFoody: Math.round(totalFoody),
    meta: { latestBlock, startBlock, chunksQueried, totalLogsFound: allLogs.length },
  };
}
