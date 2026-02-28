# UniFoody — AI-Powered Restaurant Payments on Unichain

> **Uniswap V4 Hook for real-world restaurant payments with dynamic fees, loyalty rewards, and FOODY token cashback — natively deployed on Unichain.**

[![UHI8 Submission](https://img.shields.io/badge/UHI-Cohort%208-FF007A)](https://atrium.academy/uhi)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.26-363636)](https://soliditylang.org/)
[![Unichain](https://img.shields.io/badge/Chain-Unichain-FF007A)](https://unichain.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Overview

**UniFoody** is a full-stack Web3 restaurant payment platform that bridges traditional dining with DeFi. When a customer pays at a restaurant, our **FoodySwap Hook** intercepts the Uniswap V4 swap to:

1. **Validate** the transaction (restaurant whitelist, operating hours, amount limits)
2. **Apply dynamic pricing** (loyalty-based fee discounts + peak hour adjustments)
3. **Settle and reward** (fee splitting, FOODY cashback minting, tier upgrades, VIP NFT)

Built natively on **Unichain** — Uniswap Labs' own L2 with 200ms Flashblocks — for the lowest latency and tightest protocol integration possible.

## Architecture

```
FoodySwapHook.sol (ONE Hook, THREE Layers)
│
├── beforeSwap()
│   ├── Layer 1: Constraints
│   │   ├── Restaurant whitelist verification
│   │   ├── Operating hours validation (block.timestamp)
│   │   └── Per-transaction amount limits (min/max USDC)
│   │
│   └── Layer 2: Dynamic Pricing
│       ├── Tier-based fee discount (2% / 5% / 8% / 12%)
│       ├── Peak hour adjustment (lunch/dinner = lower fees)
│       └── LPFeeLibrary.OVERRIDE_FEE_FLAG for dynamic override
│
└── afterSwap()
    └── Layer 3: Settlement + Rewards
        ├── Fee split: Restaurant 90% / Platform 5% / Reward Pool 5%
        ├── FOODY cashback mint (3-10% based on loyalty tier)
        ├── Loyalty tracking + automatic tier upgrade
        ├── Referral bonus (referrer earns 0.5% of referee's spend)
        └── VIP NFT auto-mint at $1000+ cumulative spend
```

## Loyalty Tiers

| Tier | Min Spend | Fee Discount | Cashback | Perk |
|------|-----------|-------------|----------|------|
| Bronze | $0 | 2% | 3% FOODY | Welcome bonus |
| Silver | $200 | 5% | 5% FOODY | Priority support |
| Gold | $500 | 8% | 7% FOODY | Exclusive menu items |
| VIP | $1,000 | 12% | 10% FOODY | Soulbound VIP NFT |

## Smart Contracts

| Contract | Description |
|----------|-------------|
| `FoodySwapHook.sol` | Uniswap V4 Hook — constraints, pricing, settlement |
| `FoodyToken.sol` | ERC-20 with AccessControl MINTER_ROLE (1B max supply) |
| `FoodyVIPNFT.sol` | Soulbound ERC-721 for VIP tier holders |

### Unichain Contract Addresses

| Component | Address |
|-----------|---------|
| PoolManager (V4) | `0x1F98400000000000000000000000000000000004` |
| Universal Router | `0xEf740bf23aCaE26f6492B10De645D6b98dC8Eaf3` |
| PositionManager | `0x4529A01c7A0410167c5740C487A8DE60232617bf` |
| Quoter V4 | `0x333e3C607B141b18fF6dE9f258Db6E77Fe7491E0` |
| StateView | `0x86e8631a016f9068c3f085faf484ee3f5fdee8f2` |
| USDC | `0x078D782b760474a361dDA0AF3839290b0EF57AD6` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

## Project Structure

```
unifoody/
├── contracts/                     # Solidity (Foundry)
│   ├── src/
│   │   ├── FoodySwapHook.sol     # V4 Hook (3-layer architecture)
│   │   ├── FoodyToken.sol        # ERC-20 with MINTER_ROLE
│   │   └── FoodyVIPNFT.sol       # Soulbound ERC-721
│   ├── test/
│   │   ├── FoodySwapHook.t.sol   # 18 unit tests
│   │   └── FoodySwapHook.fuzz.t.sol  # 5 fuzz tests (256 runs each)
│   ├── script/
│   │   ├── DeployFoodyToken.s.sol
│   │   ├── DeployFoodySwap.s.sol # CREATE2 salt mining
│   │   └── CreatePool.s.sol      # Pool creation + liquidity
│   └── foundry.toml              # Unichain RPC + Uniscan verification
│
├── app/                           # Next.js 14 dApp
│   ├── src/
│   │   ├── lib/
│   │   │   ├── chains.ts        # Unichain + Unichain Sepolia definitions
│   │   │   ├── constants.ts     # Chain ID 130, contract addresses
│   │   │   └── uniswap-v4/     # V4 Hook interaction layer
│   │   └── components/
│   │       └── Wallet/          # Multi-wallet (MetaMask + WalletConnect + Coinbase)
│   ├── Dockerfile               # Multi-stage (node:20-alpine)
│   └── cloudbuild.yaml          # Google Cloud Run deployment
│
└── README.md                     # This file
```

## Quick Start

### Prerequisites
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Node.js 20+](https://nodejs.org/) + [pnpm](https://pnpm.io/)
- MetaMask or any EVM wallet with Unichain Sepolia ETH

### Smart Contracts

```bash
cd contracts

# Install dependencies
forge install

# Build
forge build

# Run all tests (18 unit + 5 fuzz = 29 total)
forge test -vv

# Gas snapshot
forge snapshot

# Deploy to Unichain Sepolia
cp .env.example .env
# Fill in your PRIVATE_KEY, ADMIN_ADDRESS, UNISCAN_API_KEY
forge script script/DeployFoodyToken.s.sol --rpc-url unichain_sepolia --broadcast --verify
forge script script/DeployFoodySwap.s.sol --rpc-url unichain_sepolia --broadcast --verify
forge script script/CreatePool.s.sol --rpc-url unichain_sepolia --broadcast --verify
```

### Frontend dApp

```bash
cd app

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env.local
# Fill in contract addresses after deployment

# Development
pnpm dev

# Production build
pnpm build
```

## Testing

All 29 tests pass:

```
$ forge test
[PASS] test_afterSwap_mintsCashback() (gas: ...)
[PASS] test_afterSwap_upgradesTier() (gas: ...)
[PASS] test_beforeSwap_blocksClosedRestaurant() (gas: ...)
[PASS] test_beforeSwap_blocksBelowMinimum() (gas: ...)
[PASS] test_beforeSwap_blocksUnwhitelisted() (gas: ...)
[PASS] test_beforeSwap_dynamicFeeOverride() (gas: ...)
[PASS] test_beforeSwap_peakHourDiscount() (gas: ...)
[PASS] test_referral_bonus() (gas: ...)
[PASS] test_vipNFT_autoMint() (gas: ...)
...
Test result: ok. 29 passed; 0 failed; 0 skipped
```

## dApp Features

### Three Dashboards
- **Diner**: Scan to Pay, wallet balance, transaction history, loyalty rewards, FOODY earnings
- **Restaurant**: QR code generator, order management, NFC tag support, AVOS analytics
- **Admin**: Platform overview, user/restaurant management, on-chain analytics (8 tabs)

### Payment Methods
- FOODY token (via Uniswap V4 Hook)
- Stripe (fiat credit/debit)
- Square (POS integration)
- Coinbase Onramp (fiat-to-crypto)

### AI Agent Integration
- Gemini Live API: Real-time voice ordering via phone
- Vision AI: Dish recognition from photos
- Multilingual support: English, Chinese, Spanish

### Additional Features
- PWA with offline support + push notifications
- i18n (EN/ZH/ES) with locale routing
- Multi-wallet: MetaMask, WalletConnect, Coinbase Wallet
- Background sync for failed transactions

## Partner Integrations

| Partner | Integration |
|---------|-------------|
| **Unichain** | Native L2 deployment (Chain ID 130) |
| **Uniswap V4** | Hook architecture (PoolManager, Universal Router) |
| **OpenZeppelin** | BaseHook, AccessControl, ERC-20, ERC-721 |
| **Stripe** | Fiat payment processing |
| **Square** | POS terminal integration |
| **Twilio** | Phone-based voice ordering |
| **Google Cloud** | Cloud Run, Cloud SQL, Vertex AI, Speech/TTS |
| **WalletConnect** | Multi-wallet connectivity |

## Security

- Role-based access control (MINTER_ROLE for cashback minting)
- 1B max supply cap on FOODY token prevents infinite mint
- Soulbound VIP NFT (non-transferable)
- Restaurant whitelist prevents unauthorized pool access
- Operating hours enforcement via block.timestamp
- Transaction amount limits (min/max USDC per swap)
- Platform wallet + reward pool separation
- Reentrancy protection via Uniswap V4 PoolManager lock

## Why Unichain?

1. **Native Uniswap Integration** — Deployed on Uniswap's own L2 for first-class V4 Hook support
2. **200ms Flashblocks** — Near-instant payment confirmations for real-world restaurant use
3. **Low Gas Costs** — OP Stack L2 economics make micro-transactions viable
4. **Uniswap Ecosystem** — Direct access to Uniswap liquidity and tooling

## Team

Built by the UniFoody team for UHI Cohort 8.

- **Ken Liao** — Full-stack developer, Web3 architect
- Discord: `foodyepay_96725`

## License

MIT

---

*Built with Uniswap V4 Hooks on Unichain*
