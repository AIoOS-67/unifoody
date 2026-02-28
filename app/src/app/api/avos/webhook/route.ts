/**
 * AVOS Google CCAI Webhook Handler
 * Processes incoming voice call events from Google Conversational Call AI
 * Validates webhook signatures and routes events to appropriate handlers
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DialogStateMachine } from '@/lib/avos/dialog-state-machine';
import { createVoiceProvider } from '@/lib/avos/provider-factory';
import {
  CCAIWebhookEvent,
  DialogContext,
  AVOSCall,
  mapCallFromDb,
} from '@/lib/avos/types';
import crypto from 'crypto';

const WEBHOOK_SECRET = process.env.AVOS_WEBHOOK_SECRET || 'avos-webhook-secret';

/**
 * Validate webhook signature from CCAI
 */
function validateWebhookSignature(
  request: NextRequest,
  body: string
): boolean {
  const signature = request.headers.get('x-google-webhook-signature');
  if (!signature) {
    console.log('[AVOS] No webhook signature in headers');
    return false;
  }

  const hash = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(body)
    .digest('base64');

  const isValid = signature === hash;
  console.log(
    `[AVOS] Webhook signature validation: ${isValid ? 'PASS' : 'FAIL'}`
  );

  return isValid;
}

/**
 * Handle call_initiated event
 */
async function handleCallInitiated(
  event: CCAIWebhookEvent
): Promise<{ greeting: string; audioUrl?: string }> {
  console.log(
    `[AVOS] Handling call_initiated for call: ${event.callId}`
  );

  try {
    const { callerPhone, calledPhone } = event.data;

    if (!callerPhone || !calledPhone) {
      throw new Error('Missing caller or called phone in event');
    }

    // Find restaurant by phone number
    const { data: configData, error: configError } = await supabaseAdmin
      .from('avos_configs')
      .select('*, restaurants(id, name)')
      .eq('phone_number', calledPhone)
      .single();

    if (configError || !configData) {
      console.error('[AVOS] Restaurant config not found for phone:', calledPhone);
      return {
        greeting: 'Sorry, this restaurant is not registered with AVOS.',
      };
    }

    const config = configData;
    const restaurantId = config.restaurant_id;

    // Create avos_calls record
    const callRecord = {
      id: event.callId,
      restaurant_id: restaurantId,
      caller_phone: callerPhone,
      restaurant_phone: calledPhone,
      language: config.primary_language,
      call_status: 'initiated',
      ai_engine: config.ai_engine,
      dialog_state: 'GREETING',
      started_at: new Date().toISOString(),
      transcript: [],
      duration_seconds: 0,
      created_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabaseAdmin
      .from('avos_calls')
      .insert([callRecord]);

    if (insertError) {
      console.error('[AVOS] Failed to create call record:', insertError);
      return {
        greeting: 'We are experiencing technical difficulties. Please try again.',
      };
    }

    // Get greeting message from config
    const greeting =
      config.greeting_message?.[config.primary_language] ||
      `Welcome to ${config.restaurants.name}. How can we help you today?`;

    console.log(`[AVOS] Call initiated: ${event.callId}`);

    return { greeting };
  } catch (error) {
    console.error('[AVOS] Error handling call_initiated:', error);
    return {
      greeting: 'We are experiencing technical difficulties. Please try again.',
    };
  }
}

/**
 * Handle transcript_update event
 */
async function handleTranscriptUpdate(
  event: CCAIWebhookEvent
): Promise<{ response: string; action?: string }> {
  console.log(
    `[AVOS] Handling transcript_update for call: ${event.callId}`
  );

  try {
    const { transcript, language } = event.data;

    if (!transcript) {
      console.warn('[AVOS] No transcript in event');
      return { response: '' };
    }

    // Fetch call record
    const { data: callData, error: callError } = await supabaseAdmin
      .from('avos_calls')
      .select('*')
      .eq('id', event.callId)
      .single();

    if (callError || !callData) {
      console.error('[AVOS] Call record not found:', event.callId);
      return { response: 'System error. Please try again.' };
    }

    // Fetch restaurant config
    const { data: configData, error: configError } = await supabaseAdmin
      .from('avos_configs')
      .select('*')
      .eq('restaurant_id', callData.restaurant_id)
      .single();

    if (configError || !configData) {
      console.error('[AVOS] Config not found');
      return { response: 'System error. Please try again.' };
    }

    // Get menu items for fuzzy matching
    const { data: menuData } = await supabaseAdmin
      .from('avos_menu_index')
      .select('*')
      .eq('restaurant_id', callData.restaurant_id);

    // Initialize dialog state machine
    const voiceProvider = createVoiceProvider(
      configData.ai_engine,
      configData.restaurants?.name || 'Restaurant',
      menuData || []
    );
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

    // Initialize or restore context
    let context: DialogContext = {
      callId: event.callId,
      restaurantId: callData.restaurant_id,
      currentState: (callData.dialog_state as any) || 'GREETING',
      language: (language as any) || configData.primary_language,
      orderItems: callData.transcript?.orderItems || [],
      customerPhone: callData.caller_phone,
      subtotalUsd: 0,
      conversationHistory: callData.transcript || [],
      errorCount: 0,
      maxErrors: 3,
      upsellOffered: false,
      orderConfirmed: false,
      paymentInitiated: false,
      metadata: {},
    };

    // Analyze intent
    const intentResult = await voiceProvider.analyzeIntent(transcript, context);

    // Process through state machine
    const result = await stateMachine.processInput(context, intentResult);

    // Update call record with new transcript entry
    const updatedTranscript = [
      ...callData.transcript,
      {
        role: 'customer',
        text: transcript,
        language: context.language,
        timestamp: new Date().toISOString(),
        confidence: event.data.confidence || 0.9,
      },
      {
        role: 'ai',
        text: result.response,
        language: context.language,
        timestamp: new Date().toISOString(),
      },
    ];

    const { error: updateError } = await supabaseAdmin
      .from('avos_calls')
      .update({
        dialog_state: result.nextState,
        transcript: updatedTranscript,
        call_status: 'in_progress',
      })
      .eq('id', event.callId);

    if (updateError) {
      console.error('[AVOS] Failed to update call record:', updateError);
    }

    return {
      response: result.response,
      action: result.nextState === 'PAYMENT' ? 'collect_payment' : undefined,
    };
  } catch (error) {
    console.error('[AVOS] Error handling transcript_update:', error);
    return {
      response:
        'I did not understand that. Could you please repeat your request?',
    };
  }
}

/**
 * Handle call_ended event
 */
async function handleCallEnded(event: CCAIWebhookEvent): Promise<void> {
  console.log(
    `[AVOS] Handling call_ended for call: ${event.callId}`
  );

  try {
    const { duration, endReason } = event.data;

    const { error } = await supabaseAdmin
      .from('avos_calls')
      .update({
        call_status: 'completed',
        ended_at: new Date().toISOString(),
        duration_seconds: duration || 0,
      })
      .eq('id', event.callId);

    if (error) {
      console.error('[AVOS] Failed to update call end status:', error);
    }

    console.log(
      `[AVOS] Call ended: ${event.callId}, duration: ${duration}s, reason: ${endReason}`
    );
  } catch (error) {
    console.error('[AVOS] Error handling call_ended:', error);
  }
}

/**
 * POST webhook endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // Validate signature
    if (!validateWebhookSignature(request, body)) {
      console.warn('[AVOS] Webhook signature validation failed');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const event: CCAIWebhookEvent = JSON.parse(body);

    console.log(`[AVOS] Webhook received: ${event.eventType}`);

    // Route to appropriate handler
    switch (event.eventType) {
      case 'call_initiated': {
        const result = await handleCallInitiated(event);
        return NextResponse.json({ success: true, ...result });
      }

      case 'transcript_update': {
        const result = await handleTranscriptUpdate(event);
        return NextResponse.json({ success: true, ...result });
      }

      case 'call_ended': {
        await handleCallEnded(event);
        return NextResponse.json({ success: true });
      }

      case 'call_failed': {
        console.error('[AVOS] Call failed:', event.data);
        await supabaseAdmin
          .from('avos_calls')
          .update({
            call_status: 'failed',
            ended_at: new Date().toISOString(),
          })
          .eq('id', event.callId);
        return NextResponse.json({ success: true });
      }

      default:
        console.warn(`[AVOS] Unknown event type: ${event.eventType}`);
        return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('[AVOS] Webhook processing error:', error);
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
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
  return NextResponse.json({ status: 'ok', service: 'AVOS webhook handler' });
}
