/**
 * AVOS Process Order Endpoint
 * Finalizes and processes an AVOS order after voice conversation
 * Calculates tax, converts to FOODY, generates SMS payment link, sends SMS
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { paymentProcessor } from '@/lib/avos/payment-processor';
import { AVOSOrderItem, PaymentLinkPayload, isValidE164Phone, isValidUUID } from '@/lib/avos/types';

/**
 * Validate request body
 */
function validateRequest(body: any): {
  valid: boolean;
  error?: string;
  data?: {
    callId: string;
    restaurantId: string;
    customerPhone: string;
    items: AVOSOrderItem[];
    state: string;
    zipCode: string;
  };
} {
  const { callId, restaurantId, customerPhone, items, state, zipCode } = body;

  if (!callId || !isValidUUID(callId)) {
    return { valid: false, error: 'Invalid callId' };
  }

  if (!restaurantId || !isValidUUID(restaurantId)) {
    return { valid: false, error: 'Invalid restaurantId' };
  }

  if (!customerPhone || !isValidE164Phone(customerPhone)) {
    return { valid: false, error: 'Invalid customerPhone format' };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { valid: false, error: 'Order must contain at least one item' };
  }

  // Validate items
  for (const item of items) {
    if (!item.menuItemId || !isValidUUID(item.menuItemId)) {
      return { valid: false, error: 'Invalid menuItemId' };
    }
    if (typeof item.quantity !== 'number' || item.quantity <= 0) {
      return { valid: false, error: 'Invalid item quantity' };
    }
    if (typeof item.priceUsd !== 'number' || item.priceUsd <= 0) {
      return { valid: false, error: 'Invalid item price' };
    }
  }

  if (!state || state.length !== 2) {
    return { valid: false, error: 'Invalid state code' };
  }

  if (!zipCode || !/^\d{5}(-\d{4})?$/.test(zipCode)) {
    return { valid: false, error: 'Invalid zip code format' };
  }

  return { valid: true, data: { callId, restaurantId, customerPhone, items, state, zipCode } };
}

/**
 * POST handler
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validation = validateRequest(body);
    if (!validation.valid) {
      console.warn(`[AVOS] Order validation failed: ${validation.error}`);
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { callId, restaurantId, customerPhone, items, state, zipCode } = validation.data!;

    console.log(
      `[AVOS] Processing order for call ${callId}, restaurant ${restaurantId}`
    );

    // Verify restaurant exists and get details
    const { data: restaurantData, error: restaurantError } = await supabaseAdmin
      .from('restaurants')
      .select('id, name, owner_wallet')
      .eq('id', restaurantId)
      .single();

    if (restaurantError || !restaurantData) {
      console.error('[AVOS] Restaurant not found:', restaurantId);
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      );
    }

    const restaurantWallet = restaurantData.owner_wallet || '';
    const restaurantName = restaurantData.name;

    console.log(`[AVOS] Processing for restaurant: ${restaurantName}`);

    // 1. Create AVOS order record
    let avosOrder;
    try {
      avosOrder = await paymentProcessor.createAVOSOrder(
        callId,
        restaurantId,
        customerPhone,
        items,
        state,
        zipCode
      );
      console.log(`[AVOS] Order record created: ${avosOrder.id}`);
    } catch (error) {
      console.error('[AVOS] Failed to create order:', error);
      return NextResponse.json(
        { error: 'Failed to create order record' },
        { status: 500 }
      );
    }

    // 2. Generate payment link token
    let paymentLinkUrl: string;
    try {
      const payload: PaymentLinkPayload = {
        callId,
        orderId: avosOrder.id,
        restaurantId,
        restaurantName,
        restaurantWallet,
        items,
        subtotalUsd: avosOrder.subtotalUsd,
        taxUsd: avosOrder.taxUsd,
        totalUsd: avosOrder.totalUsd,
        foodyAmount: avosOrder.foodyAmount,
        exchangeRate: avosOrder.exchangeRate,
        customerPhone,
        expiresAt: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes from now
      };

      paymentLinkUrl = await paymentProcessor.generatePaymentLink(payload);
      console.log('[AVOS] Payment link generated');
    } catch (error) {
      console.error('[AVOS] Failed to generate payment link:', error);
      return NextResponse.json(
        { error: 'Failed to generate payment link' },
        { status: 500 }
      );
    }

    // 3. Send SMS with payment link
    const smsSent = await paymentProcessor.sendPaymentSMS(
      customerPhone,
      paymentLinkUrl,
      restaurantName,
      avosOrder.totalUsd
    );

    if (!smsSent) {
      console.warn('[AVOS] SMS sending failed or not configured');
    }

    // 4. Sync to main order tables for dashboard
    try {
      const mainOrderId = await paymentProcessor.syncToMainOrderTables(
        avosOrder,
        restaurantWallet,
        restaurantName
      );
      console.log(`[AVOS] Synced to main order: ${mainOrderId}`);
    } catch (error) {
      console.error('[AVOS] Failed to sync to main order tables:', error);
      // Don't fail the whole request - AVOS order is already created
    }

    console.log(`[AVOS] Order processing complete: ${avosOrder.id}`);

    return NextResponse.json(
      {
        success: true,
        order: {
          id: avosOrder.id,
          callId: avosOrder.callId,
          restaurantId: avosOrder.restaurantId,
          restaurantName,
          customerPhone,
          items,
          subtotalUsd: avosOrder.subtotalUsd,
          taxUsd: avosOrder.taxUsd,
          totalUsd: avosOrder.totalUsd,
          foodyAmount: avosOrder.foodyAmount,
          exchangeRate: avosOrder.exchangeRate,
          paymentLink: paymentLinkUrl,
          paymentToken: avosOrder.paymentToken,
          smsSent,
          createdAt: avosOrder.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[AVOS] Order processing error:', error);
    return NextResponse.json(
      {
        error: 'Order processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET for health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'AVOS order processing',
  });
}
