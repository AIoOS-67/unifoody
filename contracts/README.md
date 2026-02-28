# UniFoody Smart Contracts

Uniswap V4 Hook + ERC-20 + ERC-721 for restaurant payments on Unichain.

## Contracts

| Contract | Description |
|----------|-------------|
| `FoodySwapHook.sol` | V4 Hook: constraints, dynamic pricing, settlement + rewards |
| `FoodyToken.sol` | ERC-20 "FoodyeCoin" (FOODY) with MINTER_ROLE, 1B max supply |
| `FoodyVIPNFT.sol` | Soulbound ERC-721 for VIP tier ($1000+ spend) |

## Setup

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependencies
forge install

# Build
forge build

# Test (29 tests: 18 unit + 5 fuzz + 6 utility)
forge test -vv

# Gas snapshot
forge snapshot
```

## Deploy to Unichain Sepolia

```bash
cp .env.example .env
# Fill in PRIVATE_KEY, ADMIN_ADDRESS, UNISCAN_API_KEY

# 1. Deploy FOODY Token
forge script script/DeployFoodyToken.s.sol --rpc-url unichain_sepolia --broadcast --verify

# 2. Deploy FoodySwap Hook (CREATE2 salt mining)
forge script script/DeployFoodySwap.s.sol --rpc-url unichain_sepolia --broadcast --verify

# 3. Create FOODY/USDC Pool + Add Liquidity
forge script script/CreatePool.s.sol --rpc-url unichain_sepolia --broadcast --verify
```

## Architecture

```
beforeSwap() -> Layer 1: Constraints (whitelist, hours, limits)
             -> Layer 2: Dynamic Pricing (tier discount + peak hour)
afterSwap()  -> Layer 3: Settlement (fee split, cashback, tier upgrade, VIP NFT)
```

## License

MIT
