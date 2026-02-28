/**
 * AVOS Restaurant Configuration Endpoint
 * GET: Fetch AVOS config for a restaurant
 * POST: Create or update AVOS config
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  AVOSConfig,
  mapConfigFromDb,
  isSupportedLanguage,
  isAIEngine,
  SupportedLanguage,
  AIEngine,
  isValidE164Phone,
  isValidUUID,
} from '@/lib/avos/types';

/**
 * Validate restaurant exists
 */
async function validateRestaurantExists(restaurantId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .single();

  return !error && !!data;
}

/**
 * Validate config payload
 */
function validateConfigPayload(body: any): {
  valid: boolean;
  error?: string;
} {
  const {
    restaurantId,
    avosEnabled,
    phoneNumber,
    primaryLanguage,
    supportedLanguages,
    aiEngine,
    maxCallDurationSeconds,
  } = body;

  if (!restaurantId || !isValidUUID(restaurantId)) {
    return { valid: false, error: 'Invalid restaurantId' };
  }

  if (typeof avosEnabled !== 'boolean') {
    return { valid: false, error: 'avosEnabled must be boolean' };
  }

  if (phoneNumber && !isValidE164Phone(phoneNumber)) {
    return { valid: false, error: 'Invalid phone number format (E.164)' };
  }

  if (!isSupportedLanguage(primaryLanguage)) {
    return { valid: false, error: 'Invalid primaryLanguage' };
  }

  if (
    !Array.isArray(supportedLanguages) ||
    !supportedLanguages.every((lang) => isSupportedLanguage(lang))
  ) {
    return { valid: false, error: 'Invalid supportedLanguages array' };
  }

  if (!isAIEngine(aiEngine)) {
    return { valid: false, error: 'Invalid aiEngine' };
  }

  if (
    typeof maxCallDurationSeconds !== 'number' ||
    maxCallDurationSeconds <= 0
  ) {
    return { valid: false, error: 'maxCallDurationSeconds must be positive' };
  }

  return { valid: true };
}

/**
 * GET handler - Fetch restaurant AVOS config
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get('restaurantId');

    if (!restaurantId || !isValidUUID(restaurantId)) {
      return NextResponse.json(
        { error: 'Invalid or missing restaurantId' },
        { status: 400 }
      );
    }

    console.log(`[AVOS] Fetching config for restaurant: ${restaurantId}`);

    // Fetch AVOS config
    const { data, error } = await supabaseAdmin
      .from('avos_configs')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('[AVOS] No config found, creating default');

        // Check if restaurant exists
        const exists = await validateRestaurantExists(restaurantId);
        if (!exists) {
          return NextResponse.json(
            { error: 'Restaurant not found' },
            { status: 404 }
          );
        }

        // Return default config (doesn't exist yet)
        return NextResponse.json(
          {
            id: null,
            restaurantId,
            avosEnabled: false,
            phoneNumber: null,
            primaryLanguage: 'en',
            supportedLanguages: ['en'],
            aiEngine: 'google_gemini_2',
            greetingMessage: { en: 'Welcome! How can I help you?' },
            maxCallDurationSeconds: 600,
            enableRecording: false,
            enableUpselling: true,
            autoPaymentEnabled: false,
            smsPaymentEnabled: true,
            transferToHumanPhone: null,
            createdAt: null,
            updatedAt: null,
          },
          { status: 200 }
        );
      }

      console.error('[AVOS] Failed to fetch config:', error);
      return NextResponse.json(
        { error: 'Failed to fetch config' },
        { status: 500 }
      );
    }

    const config = mapConfigFromDb(data);
    console.log(`[AVOS] Config fetched: ${config.id}`);

    return NextResponse.json(config, { status: 200 });
  } catch (error) {
    console.error('[AVOS] Config fetch error:', error);
    return NextResponse.json(
      {
        error: 'Config fetch failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler - Create or update AVOS config
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate payload
    const validation = validateConfigPayload(body);
    if (!validation.valid) {
      console.warn(`[AVOS] Config validation failed: ${validation.error}`);
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const {
      restaurantId,
      avosEnabled,
      phoneNumber,
      primaryLanguage,
      supportedLanguages,
      aiEngine,
      greetingMessage,
      maxCallDurationSeconds,
      enableRecording,
      enableUpselling,
      autoPaymentEnabled,
      smsPaymentEnabled,
      transferToHumanPhone,
    } = body;

    console.log(`[AVOS] Creating/updating config for restaurant: ${restaurantId}`);

    // Verify restaurant exists
    const exists = await validateRestaurantExists(restaurantId);
    if (!exists) {
      console.error('[AVOS] Restaurant not found:', restaurantId);
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      );
    }

    // Check if config already exists
    const { data: existingConfig } = await supabaseAdmin
      .from('avos_configs')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .single();

    const now = new Date().toISOString();
    const configPayload = {
      restaurant_id: restaurantId,
      avos_enabled: avosEnabled,
      phone_number: phoneNumber,
      primary_language: primaryLanguage,
      supported_languages: supportedLanguages,
      ai_engine: aiEngine,
      greeting_message: greetingMessage || { en: 'Welcome!' },
      max_call_duration_seconds: maxCallDurationSeconds,
      enable_recording: enableRecording || false,
      enable_upselling: enableUpselling !== false,
      auto_payment_enabled: autoPaymentEnabled || false,
      sms_payment_enabled: smsPaymentEnabled !== false,
      transfer_to_human_phone: transferToHumanPhone,
      updated_at: now,
    };

    let result;

    if (existingConfig) {
      // Update existing config
      console.log(`[AVOS] Updating existing config: ${existingConfig.id}`);

      const { data, error } = await supabaseAdmin
        .from('avos_configs')
        .update(configPayload)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error) {
        console.error('[AVOS] Failed to update config:', error);
        return NextResponse.json(
          { error: 'Failed to update config' },
          { status: 500 }
        );
      }

      result = data;
    } else {
      // Create new config
      console.log('[AVOS] Creating new config');

      const { data, error } = await supabaseAdmin
        .from('avos_configs')
        .insert([
          {
            ...configPayload,
            created_at: now,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('[AVOS] Failed to create config:', error);
        return NextResponse.json(
          { error: 'Failed to create config' },
          { status: 500 }
        );
      }

      result = data;
    }

    const config = mapConfigFromDb(result);
    console.log(`[AVOS] Config saved: ${config.id}`);

    return NextResponse.json(
      {
        success: true,
        config,
      },
      { status: existingConfig ? 200 : 201 }
    );
  } catch (error) {
    console.error('[AVOS] Config operation error:', error);
    return NextResponse.json(
      {
        error: 'Config operation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
