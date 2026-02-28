// lib/baseAccountSDK.ts
// Base Account SDK 配置

import { createBaseAccountSDK, base } from '@base-org/account';

// 创建Base Account SDK实例
export const sdk = createBaseAccountSDK({
  appName: 'FoodyePay',
  appLogoUrl: '/FoodyePayLogo.png',
  appChainIds: [base.constants.CHAIN_IDS.base], // Base Mainnet
});

// 获取provider
export const provider = sdk.getProvider();
