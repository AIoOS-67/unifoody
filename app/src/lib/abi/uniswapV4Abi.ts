// src/lib/abi/uniswapV4Abi.ts
// ABI definitions for Uniswap v4 PoolManager, SwapRouter, and FoodyePay hook contracts.
// These are the real v4 ABIs — ready for use once the contracts are deployed on Base.

// ---------------------------------------------------------------------------
// PoolManager (singleton) — core read functions
// ---------------------------------------------------------------------------

export const POOL_MANAGER_ABI = [
  // Pool state queries
  {
    name: 'getSlot0',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'protocolFee', type: 'uint24' },
      { name: 'lpFee', type: 'uint24' },
    ],
  },
  {
    name: 'getLiquidity',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [{ name: 'liquidity', type: 'uint128' }],
  },
  {
    name: 'getPosition',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'id', type: 'bytes32' },
      { name: 'owner', type: 'address' },
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [
      { name: 'liquidity', type: 'uint128' },
      { name: 'feeGrowthInside0LastX128', type: 'uint256' },
      { name: 'feeGrowthInside1LastX128', type: 'uint256' },
    ],
  },
  // Currency balance tracking
  {
    name: 'currencyDelta',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'caller', type: 'address' },
      { name: 'currency', type: 'address' },
    ],
    outputs: [{ name: 'delta', type: 'int256' }],
  },
  // Unlock (entry point for all pool operations)
  {
    name: 'unlock',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'data', type: 'bytes' }],
    outputs: [{ name: 'result', type: 'bytes' }],
  },
  // Swap
  {
    name: 'swap',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'key',
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
      },
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'zeroForOne', type: 'bool' },
          { name: 'amountSpecified', type: 'int256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
      { name: 'hookData', type: 'bytes' },
    ],
    outputs: [{ name: 'delta', type: 'int256' }],
  },
  // Initialize a new pool
  {
    name: 'initialize',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'key',
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
      },
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'hookData', type: 'bytes' },
    ],
    outputs: [{ name: 'tick', type: 'int24' }],
  },
] as const

// ---------------------------------------------------------------------------
// Hook interface — callbacks invoked by PoolManager
// This is the interface our FoodyePay hooks implement.
// ---------------------------------------------------------------------------

export const HOOK_ABI = [
  // beforeSwap — called by PoolManager before executing the swap
  {
    name: 'beforeSwap',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'sender', type: 'address' },
      {
        name: 'key',
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
      },
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'zeroForOne', type: 'bool' },
          { name: 'amountSpecified', type: 'int256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
      { name: 'hookData', type: 'bytes' },
    ],
    outputs: [
      { name: 'selector', type: 'bytes4' },
      { name: 'beforeSwapDelta', type: 'int256' },
      { name: 'lpFeeOverride', type: 'uint24' },
    ],
  },
  // afterSwap — called by PoolManager after executing the swap
  {
    name: 'afterSwap',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'sender', type: 'address' },
      {
        name: 'key',
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
      },
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'zeroForOne', type: 'bool' },
          { name: 'amountSpecified', type: 'int256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
      { name: 'delta', type: 'int256' },
      { name: 'hookData', type: 'bytes' },
    ],
    outputs: [
      { name: 'selector', type: 'bytes4' },
      { name: 'afterSwapDelta', type: 'int256' },
    ],
  },
  // beforeInitialize
  {
    name: 'beforeInitialize',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'sender', type: 'address' },
      {
        name: 'key',
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
      },
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'hookData', type: 'bytes' },
    ],
    outputs: [{ name: 'selector', type: 'bytes4' }],
  },
  // afterInitialize
  {
    name: 'afterInitialize',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'sender', type: 'address' },
      {
        name: 'key',
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
      },
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'hookData', type: 'bytes' },
    ],
    outputs: [{ name: 'selector', type: 'bytes4' }],
  },
] as const

// ---------------------------------------------------------------------------
// ERC-20 (minimal) — for USDC approval and FOODY balance checks
// ---------------------------------------------------------------------------

export const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const

// ---------------------------------------------------------------------------
// Universal Router v4 (swap execution)
// ---------------------------------------------------------------------------

export const UNIVERSAL_ROUTER_V4_ABI = [
  {
    name: 'execute',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'commands', type: 'bytes' },
      { name: 'inputs', type: 'bytes[]' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
] as const
