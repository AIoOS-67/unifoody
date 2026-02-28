// lib/fiatRewardService.ts
// Bridge between fiat payments (Apple Pay / Google Pay / Card / Terminal)
// and FOODY token rewards. Adapts the existing calculateRewards() logic
// from Uniswap v4 hooks for fiat payment scenarios.

import { getFoodyPrice, convertUsdcToFoody } from './foodyTokenService';
import {
  calculateRewards,
  buildDefaultLoyaltyProfile,
} from './uniswap-v4/hooks';
import { FALLBACK_FOODY_PER_USD } from './uniswap-v4/constants';
import type { LoyaltyProfile, SettlementResult } from './uniswap-v4/types';

export interface FiatRewardResult {
  foodyRewardAmount: number;
  foodyPerUSD: number;
  breakdown: string[];
  loyaltyTier: string;
  walletConnected: boolean;
}

/**
 * Calculate FOODY reward for a fiat payment.
 * Works whether or not the customer has a connected wallet.
 *
 * @param amountUSD - Total payment in USD
 * @param walletAddress - Optional crypto wallet (if customer connected one)
 * @param restaurantId - Restaurant receiving the payment
 * @param isFirstPayment - Is this the customer's first payment?
 */
export async function calculateFiatPaymentReward(
  amountUSD: number,
  walletAddress?: string,
  restaurantId?: string,
  isFirstPayment: boolean = false
): Promise<FiatRewardResult> {
  try {
    // Get current FOODY price
    const foodyPrice = await getFoodyPrice();
    const foodyPerUSD = foodyPrice.foody_per_usd;

    // Build loyalty profile (default for non-wallet users)
    const loyalty: LoyaltyProfile = walletAddress
      ? buildDefaultLoyaltyProfile(walletAddress)
      : buildDefaultLoyaltyProfile('0x0000000000000000000000000000000000000000');

    // Use existing reward calculation
    const settlement: SettlementResult = calculateRewards(
      walletAddress || '0x0000000000000000000000000000000000000000',
      amountUSD,
      loyalty,
      foodyPerUSD,
      isFirstPayment,
      restaurantId
    );

    // Filter out restaurant cashback — only customer-facing rewards
    const customerRewards = settlement.rewards.filter(
      (r) => r.rewardType !== 'cashback_restaurant'
    );
    const totalCustomerReward = customerRewards.reduce(
      (sum, r) => sum + r.foodyAmount,
      0
    );

    return {
      foodyRewardAmount: Math.round(totalCustomerReward * 100) / 100,
      foodyPerUSD,
      breakdown: customerRewards.map((r) => r.description),
      loyaltyTier: settlement.loyaltyProfile.tier,
      walletConnected: !!walletAddress,
    };
  } catch (error) {
    console.error('[FiatReward] Error calculating reward:', error);
    // Fallback: simple 2% reward
    const fallbackReward = amountUSD * FALLBACK_FOODY_PER_USD * 0.02;
    return {
      foodyRewardAmount: Math.round(fallbackReward * 100) / 100,
      foodyPerUSD: FALLBACK_FOODY_PER_USD,
      breakdown: ['2% swap bonus (fallback)'],
      loyaltyTier: 'none',
      walletConnected: !!walletAddress,
    };
  }
}

/**
 * Estimate FOODY reward for display purposes (before payment).
 * Faster than full calculation — uses cached price.
 */
export async function estimateFoodyReward(amountUSD: number): Promise<number> {
  try {
    const foodyPrice = await getFoodyPrice();
    // Simple 2% swap bonus estimate
    return Math.round(amountUSD * foodyPrice.foody_per_usd * 0.02 * 100) / 100;
  } catch {
    return Math.round(amountUSD * FALLBACK_FOODY_PER_USD * 0.02 * 100) / 100;
  }
}
