/**
 * AVOS Test Call Endpoint
 * POST: Simulate an AVOS call for testing and development
 * Runs through DialogStateMachine with provided messages
 * Only available in development environment
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DialogStateMachine } from '@/lib/avos/dialog-state-machine';
import { createVoiceProvider } from '@/lib/avos/provider-factory';
import {
  DialogContext,
  SupportedLanguage,
  TranscriptEntry,
  isSupportedLanguage,
  isValidUUID,
  isValidE164Phone,
} from '@/lib/avos/types';
import { paymentProcessor } from '@/lib/avos/payment-processor';

/**
 * Validate test call request
 */
function validateTestCallRequest(body: any): {
  valid: boolean;
  error?: string;
  data?: {
    restaurantId: string;
    callerPhone: string;
    language: SupportedLanguage;
    messages: Array<{ role: 'customer' | 'ai'; text: string }>;
  };
} {
  const { restaurantId, callerPhone, language, messages } = body;

  if (!restaurantId || !isValidUUID(restaurantId)) {
    return { valid: false, error: 'Invalid restaurantId' };
  }

  if (!callerPhone || !isValidE164Phone(callerPhone)) {
    return { valid: false, error: 'Invalid callerPhone format (E.164)' };
  }

  if (!isSupportedLanguage(language)) {
    return { valid: false, error: 'Unsupported language' };
  }

  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > 50
  ) {
    return {
      valid: false,
      error: 'messages array must have 1-50 items',
    };
  }

  for (const msg of messages) {
    if (!msg.text || typeof msg.text !== 'string' || msg.text.length === 0) {
      return { valid: false, error: 'All messages must have non-empty text' };
    }
  }

  return {
    valid: true,
    data: { restaurantId, callerPhone, language, messages },
  };
}

/**
 * POST handler - Simulate test call
 */
export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      console.warn('[AVOS] Test call endpoint blocked in production');
      return NextResponse.json(
        { error: 'Test endpoint not available in production' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate request
    const validation = validateTestCallRequest(body);
    if (!validation.valid) {
      console.warn(`[AVOS] Test call validation failed: ${validation.error}`);
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { restaurantId, callerPhone, language, messages } = validation.data!;

    console.log(
      `[AVOS] Starting test call for restaurant: ${restaurantId}, messages: ${messages.length}`
    );

    // Generate test call ID
    const callId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Fetch restaurant config
    const { data: configData, error: configError } = await supabaseAdmin
      .from('avos_configs')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .single();

    if (configError || !configData) {
      console.error('[AVOS] Restaurant config not found:', restaurantId);
      return NextResponse.json(
        { error: 'Restaurant config not found' },
        { status: 404 }
      );
    }

    // Fetch menu items
    const { data: menuData } = await supabaseAdmin
      .from('avos_menu_index')
      .select('*')
      .eq('restaurant_id', restaurantId);

    // Initialize voice provider
    const voiceProvider = createVoiceProvider(
      configData.ai_engine,
      configData.restaurants?.name || 'Test Restaurant',
      menuData || []
    );

    // Initialize dialog state machine
    const stateMachine = new DialogStateMachine(
      {
        id: configData.id,
        restaurantId: configData.restaurant_id,
        avosEnabled: configData.avos_enabled,
        phoneNumber: configData.phone_number,
        primaryLanguage: configData.primary_language,
        supportedLanguages: configData.supported_languages || ['en'],
        aiEngine: configData.ai_engine,
        greetingMessage: configData.greeting_message || {},
        maxCallDurationSeconds: configData.max_call_duration_seconds,
        enableRecording: configData.enable_recording,
        enableUpselling: configData.enable_upselling,
        autoPaymentEnabled: configData.auto_payment_enabled,
        smsPaymentEnabled: configData.sms_payment_enabled,
        transferToHumanPhone: configData.transfer_to_human_phone,
        createdAt: configData.created_at,
        updatedAt: configData.updated_at,
      },
      menuData || [],
      voiceProvider as any
    );

    // Initialize dialog context
    let context: DialogContext = stateMachine.initializeCall(
      callId,
      restaurantId,
      callerPhone
    );
    context.language = language;

    // Track conversation
    const transcript: TranscriptEntry[] = [];

    // Process messages through state machine
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      console.log(
        `[AVOS] Test call - message ${i + 1}/${messages.length}: ${message.text.substring(0, 50)}...`
      );

      // Analyze intent
      const intentResult = await voiceProvider.analyzeIntent(
        message.text,
        context
      );

      // Process through state machine
      const result = await stateMachine.processInput(context, intentResult);

      // Add to transcript
      transcript.push({
        role: 'customer',
        text: message.text,
        language: context.language,
        timestamp: new Date().toISOString(),
        confidence: intentResult.confidence || 0.9,
      });

      transcript.push({
        role: 'ai',
        text: result.response,
        language: context.language,
        timestamp: new Date().toISOString(),
      });

      // Update context for next iteration
      context = result.context;
    }

    console.log(
      `[AVOS] Test call complete - final state: ${context.currentState}`
    );

    // If order was created, generate payment link
    let paymentLink: string | null = null;
    if (context.orderItems.length > 0 && context.currentState === 'PAYMENT') {
      try {
        // For test, create a minimal order
        const totals = await paymentProcessor.calculateOrderTotal(
          context.orderItems,
          'NY',
          '10001'
        );

        const payload = {
          callId,
          orderId: `test-order-${Date.now()}`,
          restaurantId,
          restaurantName: 'Test Restaurant',
          restaurantWallet: '0x' + '0'.repeat(40),
          items: context.orderItems,
          subtotalUsd: totals.subtotalUsd,
          taxUsd: totals.taxUsd,
          totalUsd: totals.totalUsd,
          foodyAmount: totals.foodyAmount,
          exchangeRate: totals.exchangeRate,
          customerPhone: callerPhone,
          expiresAt: Math.floor(Date.now() / 1000) + 30 * 60,
        };

        paymentLink = await paymentProcessor.generatePaymentLink(payload);
        console.log('[AVOS] Test payment link generated');
      } catch (error) {
        console.error('[AVOS] Failed to generate test payment link:', error);
      }
    }

    return NextResponse.json(
      {
        success: true,
        testCall: {
          callId,
          restaurantId,
          callerPhone,
          language,
          finalState: context.currentState,
          orderItems: context.orderItems,
          subtotalUsd: context.subtotalUsd,
          transcript,
          paymentLink,
          context: {
            orderItems: context.orderItems.length,
            errorCount: context.errorCount,
            upsellOffered: context.upsellOffered,
            orderConfirmed: context.orderConfirmed,
            paymentInitiated: context.paymentInitiated,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[AVOS] Test call error:', error);
    return NextResponse.json(
      {
        error: 'Test call failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET for health check
 */
export async function GET(request: NextRequest) {
  // Only show endpoint exists in development
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.json({
      status: 'ok',
      service: 'AVOS test call simulation (development only)',
      environment: process.env.NODE_ENV,
    });
  }

  return NextResponse.json(
    { error: 'Not available in production' },
    { status: 403 }
  );
}
