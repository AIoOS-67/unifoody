// src/lib/abi/foodySwapHookAbi.ts
// ABI for FoodySwapHook view/admin/agent functions on Unichain

export const FOODY_SWAP_HOOK_ABI = [
  // ======================== View Functions ========================
  {
    name: 'getUserLoyalty',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'totalSpent', type: 'uint256' },
          { name: 'foodyEarned', type: 'uint256' },
          { name: 'referralEarned', type: 'uint256' },
          { name: 'tier', type: 'uint8' },
          { name: 'referrer', type: 'address' },
          { name: 'lastSwapTime', type: 'uint256' },
          { name: 'swapCount', type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'getUserTier',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'getUserDiscount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint16' }],
  },
  {
    name: 'getCurrentFeeForUser',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint24' }],
  },
  {
    name: 'isVIP',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'restaurants',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'restaurantId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'wallet', type: 'address' },
          { name: 'isActive', type: 'bool' },
          { name: 'openHour', type: 'uint8' },
          { name: 'closeHour', type: 'uint8' },
          { name: 'maxTxAmount', type: 'uint256' },
        ],
      },
    ],
  },
  // State variables
  {
    name: 'admin',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'foodyToken',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'platformWallet',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'totalVolume',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Note: no global totalSwaps counter in contract — swap count is tracked per user in loyalty struct
  {
    name: 'totalRewardsDistributed',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'vipNFT',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  // ======================== AI Agent Functions ========================
  {
    name: 'quoteSwap',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'restaurantId', type: 'bytes32' },
      { name: 'amountUSDC', type: 'uint256' },
    ],
    outputs: [
      {
        name: 'quote',
        type: 'tuple',
        components: [
          { name: 'allowed', type: 'bool' },
          { name: 'reason', type: 'string' },
          { name: 'effectiveFee', type: 'uint24' },
          { name: 'expectedCashbackFOODY', type: 'uint256' },
          { name: 'currentTier', type: 'uint8' },
          { name: 'projectedTier', type: 'uint8' },
          { name: 'willMintVIP', type: 'bool' },
          { name: 'discountBps', type: 'uint16' },
          { name: 'rewardRateBps', type: 'uint16' },
        ],
      },
    ],
  },
  {
    name: 'getAgentProfile',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      {
        name: 'profile',
        type: 'tuple',
        components: [
          { name: 'totalSpent', type: 'uint256' },
          { name: 'foodyEarned', type: 'uint256' },
          { name: 'referralEarned', type: 'uint256' },
          { name: 'tier', type: 'uint8' },
          { name: 'referrer', type: 'address' },
          { name: 'lastSwapTime', type: 'uint64' },
          { name: 'swapCount', type: 'uint32' },
          { name: 'discountBps', type: 'uint16' },
          { name: 'rewardRateBps', type: 'uint16' },
          { name: 'currentFee', type: 'uint24' },
          { name: 'isVIP', type: 'bool' },
          { name: 'nextTierThreshold', type: 'uint256' },
          { name: 'spentToNextTier', type: 'uint256' },
        ],
      },
    ],
  },
  // ======================== Events ========================
  {
    name: 'TierUpgraded',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'oldTier', type: 'uint8', indexed: false },
      { name: 'newTier', type: 'uint8', indexed: false },
    ],
  },
  {
    name: 'CashbackAwarded',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'tier', type: 'uint8', indexed: false },
    ],
  },
  {
    name: 'LoyaltyUpdated',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'tier', type: 'uint8', indexed: false },
      { name: 'totalSpent', type: 'uint256', indexed: false },
      { name: 'foodyEarned', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'VIPMinted',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'RestaurantAdded',
    type: 'event',
    inputs: [
      { name: 'restaurantId', type: 'bytes32', indexed: true },
      { name: 'wallet', type: 'address', indexed: false },
    ],
  },
] as const
