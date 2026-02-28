/**
 * AVOS Payment Processor
 * Core payment processing for AVOS orders
 * Handles: tax calculation, FOODY conversion, SMS link generation, order recording
 */

import { supabaseAdmin } from '../supabase';
import { calculateTax, getTaxRateByState } from '../taxService';
import { getFoodyPrice, convertUsdcToFoody } from '../foodyTokenService';
import { AVOSOrder, AVOSOrderItem, PaymentLinkPayload } from './types';
import { SignJWT, jwtVerify } from 'jose';
// SMS sending - uses test mode without external provider
// Production: replace with Google Cloud Identity Platform SMS or similar

const PAYMENT_SECRET = new TextEncoder().encode(
  process.env.AVOS_WEBHOOK_SECRET || 'avos-payment-secret'
);
const PAYMENT_EXPIRY_MINUTES = parseInt(
  process.env.AVOS_SMS_PAYMENT_LINK_EXPIRY_MINUTES || '30'
);
const PAYMENT_LINK_BASE_URL =
  process.env.NEXT_PUBLIC_PAYMENT_LINK_BASE_URL || 'https://foodyepay.com/avos/payment';

export class AVOSPaymentProcessor {
  constructor() {}

  /**
   * Calculate final order total: subtotal + tax, then convert to FOODY
   */
  async calculateOrderTotal(
    items: AVOSOrderItem[],
    state: string,
    zipCode: string
  ): Promise<{
    subtotalUsd: number;
    taxUsd: number;
    totalUsd: number;
    foodyAmount: number;
    exchangeRate: number;
  }> {
    console.log('[AVOS] calculateOrderTotal: Computing totals for order');

    // 1. Calculate subtotal
    const subtotalUsd = items.reduce(
      (sum, item) => sum + item.priceUsd * item.quantity,
      0
    );
    console.log(`[AVOS] Order subtotal USD: ${subtotalUsd}`);

    // 2. Calculate tax
    let taxRateInfo: any;
    try {
      if (state && state.length === 2) {
        taxRateInfo = await getTaxRateByState(state.toUpperCase());
      } else {
        // Fallback to default (NY)
        console.warn(
          `[AVOS] Invalid state ${state}, using default tax rate`
        );
        taxRateInfo = { rate: 0.08875 };
      }
    } catch (error) {
      console.error('[AVOS] Tax rate lookup failed, using default:', error);
      taxRateInfo = { rate: 0.08875 };
    }

    const taxCalc = await calculateTax(
      subtotalUsd,
      state.toUpperCase(),
      taxRateInfo.rate
    );
    const taxUsd = taxCalc.tax_amount;
    const totalUsd = subtotalUsd + taxUsd;

    console.log(`[AVOS] Tax calculation: $${subtotalUsd} + $${taxUsd} = $${totalUsd}`);

    // 3. Get FOODY price and convert
    const foodyPrice = await getFoodyPrice();
    const foodyAmount = convertUsdcToFoody(totalUsd, foodyPrice);
    const exchangeRate = foodyPrice.foody_per_usd;

    console.log(
      `[AVOS] FOODY conversion: ${totalUsd} USD = ${foodyAmount} FOODY @ ${exchangeRate} FOODY/USD`
    );

    return {
      subtotalUsd: parseFloat(subtotalUsd.toFixed(2)),
      taxUsd: parseFloat(taxUsd.toFixed(2)),
      totalUsd: parseFloat(totalUsd.toFixed(2)),
      foodyAmount,
      exchangeRate,
    };
  }

  /**
   * Generate JWT-secured payment link token
   */
  async generatePaymentLink(payload: PaymentLinkPayload): Promise<string> {
    console.log('[AVOS] generatePaymentLink: Creating JWT token');

    try {
      const token = await new SignJWT(payload as Record<string, any>)
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(`${PAYMENT_EXPIRY_MINUTES}m`)
        .sign(PAYMENT_SECRET);

      const paymentUrl = `${PAYMENT_LINK_BASE_URL}/${token}`;
      console.log(`[AVOS] Generated payment link (length: ${token.length} chars)`);

      return paymentUrl;
    } catch (error) {
      console.error('[AVOS] Failed to generate payment link:', error);
      throw new Error('Payment link generation failed');
    }
  }

  /**
   * Verify JWT payment token and extract payload
   */
  static async verifyPaymentToken(
    token: string
  ): Promise<PaymentLinkPayload | null> {
    try {
      console.log('[AVOS] verifyPaymentToken: Verifying JWT');

      const verified = await jwtVerify(token, PAYMENT_SECRET);
      return verified.payload as unknown as PaymentLinkPayload;
    } catch (error) {
      console.error('[AVOS] Token verification failed:', error);
      return null;
    }
  }

  /**
   * Send SMS payment link via Twilio
   */
  async sendPaymentSMS(
    customerPhone: string,
    paymentLink: string,
    restaurantName: string,
    totalUsd: number
  ): Promise<boolean> {
    // SMS sending is disabled - use test mode
    // Production: integrate Google Cloud Identity Platform SMS or similar
    console.log(`[AVOS] SMS payment link for ${customerPhone}: ${paymentLink} (${restaurantName}, $${totalUsd.toFixed(2)})`);
    return false;
  }

  /**
   * Create AVOS order record in database
   */
  async createAVOSOrder(
    callId: string,
    restaurantId: string,
    customerPhone: string,
    items: AVOSOrderItem[],
    taxState: string,
    zipCode: string
  ): Promise<AVOSOrder> {
    console.log('[AVOS] createAVOSOrder: Creating order record in database');

    try {
      // Calculate totals
      const totals = await this.calculateOrderTotal(items, taxState, zipCode);

      // Generate payment token
      const paymentToken = this.generateSecureToken(32);

      // Create AVOS order payload
      const orderPayload = {
        id: this.generateUUID(),
        call_id: callId,
        restaurant_id: restaurantId,
        customer_phone: customerPhone,
        items: items,
        subtotal_usd: totals.subtotalUsd,
        tax_usd: totals.taxUsd,
        total_usd: totals.totalUsd,
        foody_amount: totals.foodyAmount,
        exchange_rate: totals.exchangeRate,
        payment_method: 'sms_link',
        payment_status: 'pending',
        payment_token: paymentToken,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabaseAdmin
        .from('avos_orders')
        .insert([orderPayload])
        .select()
        .single();

      if (error) {
        console.error('[AVOS] Failed to create order record:', error);
        throw error;
      }

      console.log(`[AVOS] Order created: ${data.id}`);

      // Map from database format to return type
      return {
        id: data.id,
        callId: data.call_id,
        restaurantId: data.restaurant_id,
        customerPhone: data.customer_phone,
        items: data.items,
        subtotalUsd: data.subtotal_usd,
        taxUsd: data.tax_usd,
        totalUsd: data.total_usd,
        foodyAmount: data.foody_amount,
        exchangeRate: data.exchange_rate,
        paymentMethod: data.payment_method,
        paymentToken: data.payment_token,
        paymentStatus: data.payment_status,
        createdAt: data.created_at,
      };
    } catch (error) {
      console.error('[AVOS] Order creation failed:', error);
      throw error;
    }
  }

  /**
   * Update payment status after customer pays
   */
  async updatePaymentStatus(
    paymentToken: string,
    status: 'completed' | 'expired' | 'failed',
    txHash?: string
  ): Promise<boolean> {
    console.log(`[AVOS] updatePaymentStatus: Setting status to ${status}`);

    try {
      const updatePayload: any = {
        payment_status: status,
      };

      if (txHash) {
        updatePayload.tx_hash = txHash;
      }

      if (status === 'completed') {
        updatePayload.confirmed_at = new Date().toISOString();
      }

      const { error } = await supabaseAdmin
        .from('avos_orders')
        .update(updatePayload)
        .eq('payment_token', paymentToken);

      if (error) {
        console.error('[AVOS] Failed to update payment status:', error);
        return false;
      }

      console.log('[AVOS] Payment status updated successfully');
      return true;
    } catch (error) {
      console.error('[AVOS] Payment status update failed:', error);
      return false;
    }
  }

  /**
   * Sync AVOS order to main order tables for restaurant dashboard
   */
  async syncToMainOrderTables(
    avosOrder: AVOSOrder,
    restaurantWallet: string,
    restaurantName: string
  ): Promise<string> {
    console.log('[AVOS] syncToMainOrderTables: Creating main order records');

    try {
      // Create placeholder diner if needed
      let dinerId = '00000000-0000-0000-0000-000000000000';
      try {
        const { data: dinerData } = await supabaseAdmin
          .from('diners')
          .select('id')
          .limit(1)
          .single();
        if (dinerData) {
          dinerId = dinerData.id;
        }
      } catch (e) {
        console.warn('[AVOS] Could not find diner record');
      }

      // Create main order record
      const mainOrderId = this.generateUUID();
      const orderData = {
        id: mainOrderId,
        restaurant_id: avosOrder.restaurantId,
        diner_id: dinerId,
        status: 'pending',
        order_number: avosOrder.id,
        subtotal: avosOrder.subtotalUsd,
        tax: avosOrder.taxUsd,
        total_amount: avosOrder.totalUsd,
        foody_amount: avosOrder.foodyAmount,
        restaurant_name: restaurantName,
        tax_rate: avosOrder.taxUsd / avosOrder.subtotalUsd,
        payment_method: 'FOODY',
        created_at: new Date().toISOString(),
      };

      const { error: orderError } = await supabaseAdmin
        .from('orders')
        .insert([orderData]);

      if (orderError) {
        console.error('[AVOS] Failed to create main order:', orderError);
        throw orderError;
      }

      // Create confirm_and_pay record
      const confirmPayData = {
        id: this.generateUUID(),
        order_id: mainOrderId,
        restaurant_id: avosOrder.restaurantId,
        restaurant_wallet: restaurantWallet,
        diner_wallet: '0x' + '0'.repeat(40), // Placeholder
        status: 'pending_customer_payment',
        foody_amount: avosOrder.foodyAmount,
        usd_value: avosOrder.totalUsd,
        created_at: new Date().toISOString(),
      };

      const { error: confirmError } = await supabaseAdmin
        .from('confirm_and_pay')
        .insert([confirmPayData]);

      if (confirmError) {
        console.error('[AVOS] Failed to create confirm_and_pay:', confirmError);
        // Don't throw - main order already created
      }

      console.log(`[AVOS] Synced to main order tables: ${mainOrderId}`);
      return mainOrderId;
    } catch (error) {
      console.error('[AVOS] Sync to main order tables failed:', error);
      throw error;
    }
  }

  /**
   * Generate secure random token
   */
  private generateSecureToken(length: number = 32): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < length; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  /**
   * Generate UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

// Export singleton instance
export const paymentProcessor = new AVOSPaymentProcessor();
