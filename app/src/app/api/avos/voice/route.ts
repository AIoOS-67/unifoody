/**
 * AVOS Twilio Voice Endpoint
 * POST: Handles incoming Twilio calls — answers and starts voice ordering
 *
 * TWO MODES:
 *   1. ADK Mode (AGENT_SERVICE_URL set): Uses <Connect><Stream> to stream audio
 *      to the Python ADK agent service (Gemini Live API for real-time voice)
 *   2. Legacy Mode (no AGENT_SERVICE_URL): Falls back to <Gather> + TwiML flow
 *
 * Twilio sends form-encoded data with CallSid, From, To, etc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DialogStateMachine } from '@/lib/avos/dialog-state-machine';
import { createVoiceProvider } from '@/lib/avos/provider-factory';
import { DialogContext } from '@/lib/avos/types';

// ADK Agent service URL for Twilio Media Streams
const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || process.env.NEXT_PUBLIC_AGENT_URL || '';

// In-memory session store for active calls (legacy mode only)
const callSessions = new Map<string, {
  context: DialogContext;
  stateMachine: DialogStateMachine;
  voiceProvider: any;
  restaurantName: string;
}>();

// Default restaurant ID
const DEFAULT_RESTAURANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

export async function POST(request: NextRequest) {
  try {
    // Twilio sends form-encoded data
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const callerPhone = formData.get('From') as string;
    const calledNumber = formData.get('To') as string;

    console.log(`[AVOS Voice] Incoming call: CallSid=${callSid}, From=${callerPhone}, To=${calledNumber}`);

    // Look up restaurant by called number, fall back to default
    let restaurantId = DEFAULT_RESTAURANT_ID;
    let restaurantName = 'our restaurant';
    let greeting = '';
    let language = 'en';

    try {
      const { data: configByPhone } = await supabaseAdmin
        .from('avos_configs')
        .select('restaurant_id, primary_language, greeting_message')
        .eq('phone_number', calledNumber)
        .single();

      if (configByPhone) {
        restaurantId = configByPhone.restaurant_id;
        language = configByPhone.primary_language || 'en';

        // Parse greeting
        if (configByPhone.greeting_message) {
          try {
            const greetings = typeof configByPhone.greeting_message === 'string'
              ? JSON.parse(configByPhone.greeting_message)
              : configByPhone.greeting_message;
            greeting = greetings[language] || greetings['en'] || '';
          } catch {
            greeting = '';
          }
        }
      }
    } catch (e: any) {
      console.log(`[AVOS Voice] Config lookup failed, using defaults: ${e.message}`);
    }

    // Fetch restaurant name
    try {
      const { data: restaurant } = await supabaseAdmin
        .from('restaurants')
        .select('name')
        .eq('id', restaurantId)
        .single();
      if (restaurant?.name) restaurantName = restaurant.name;
    } catch {
      // Use default name
    }

    if (!greeting) {
      greeting = `Hello, thank you for calling ${restaurantName}. What would you like to order today?`;
    }

    console.log(`[AVOS Voice] Restaurant: ${restaurantName} (${restaurantId}), Mode: ${AGENT_SERVICE_URL ? 'ADK Stream' : 'Legacy Gather'}`);

    // =====================================================
    // MODE 1: ADK Agent — Twilio Media Streams
    // =====================================================
    if (AGENT_SERVICE_URL) {
      // Convert HTTPS URL to WSS for Media Streams
      const agentWsUrl = AGENT_SERVICE_URL
        .replace('https://', 'wss://')
        .replace('http://', 'ws://');

      return new NextResponse(
        twiml(`
          <Say voice="Polly.Joanna-Generative" language="${langToTwiml(language)}">${escapeXml(greeting)}</Say>
          <Connect>
            <Stream url="${agentWsUrl}/ws/twilio-stream">
              <Parameter name="restaurantId" value="${restaurantId}" />
              <Parameter name="callSid" value="${callSid}" />
              <Parameter name="callerPhone" value="${callerPhone}" />
              <Parameter name="language" value="${language}" />
            </Stream>
          </Connect>
        `),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // =====================================================
    // MODE 2: Legacy — Twilio <Gather> + TwiML
    // =====================================================

    // Fetch full config for legacy mode
    const { data: configData, error: configError } = await supabaseAdmin
      .from('avos_configs')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .single();

    if (configError || !configData) {
      console.error('[AVOS Voice] Restaurant config not found:', restaurantId);
      return new NextResponse(
        twiml(`<Say voice="Polly.Joanna-Generative">Sorry, this restaurant is not set up for voice ordering. Goodbye.</Say><Hangup/>`),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Fetch menu
    const { data: menuData } = await supabaseAdmin
      .from('avos_menu_index')
      .select('*')
      .eq('restaurant_id', restaurantId);

    // Create voice provider and state machine
    const voiceProvider = createVoiceProvider(
      configData.ai_engine || 'google_gemini_2',
      restaurantName,
      menuData || []
    );

    const stateMachine = new DialogStateMachine(
      configData,
      menuData || [],
      voiceProvider as any
    );

    // Initialize the call context
    const context = stateMachine.initializeCall(
      callSid,
      restaurantId,
      callerPhone || '+10000000000'
    );
    context.language = configData.primary_language || 'en';

    // Store session
    callSessions.set(callSid, {
      context,
      stateMachine,
      voiceProvider,
      restaurantName,
    });

    console.log(`[AVOS Voice] Legacy session created for CallSid=${callSid}`);

    // Return TwiML: greet and gather speech
    const processUrl = `${getBaseUrl(request)}/api/avos/voice/process`;
    return new NextResponse(
      twiml(`
        <Say voice="Polly.Joanna-Generative" language="${langToTwiml(context.language)}">${escapeXml(greeting)}</Say>
        <Gather input="speech" action="${processUrl}" method="POST"
                speechTimeout="3" timeout="10" language="${langToTwiml(context.language)}"
                speechModel="phone_call" enhanced="true">
          <Say voice="Polly.Joanna-Generative" language="${langToTwiml(context.language)}">I'm listening.</Say>
        </Gather>
        <Say voice="Polly.Joanna-Generative">I didn't catch that. Please call back to try again. Goodbye.</Say>
        <Hangup/>
      `),
      { headers: { 'Content-Type': 'text/xml' } }
    );
  } catch (error: any) {
    console.error('[AVOS Voice] Error:', error.message);
    return new NextResponse(
      twiml(`<Say voice="Polly.Joanna-Generative">Sorry, something went wrong. Please try again later. Goodbye.</Say><Hangup/>`),
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }
}

// Helper: wrap content in TwiML Response
function twiml(content: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${content}</Response>`;
}

// Helper: escape XML special characters
function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// Helper: map AVOS language to Twilio speech recognition language
function langToTwiml(lang: string): string {
  const map: Record<string, string> = {
    'en': 'en-US',
    'zh': 'zh-CN',
    'yue': 'zh-HK',
    'es': 'es-US',
  };
  return map[lang] || 'en-US';
}

// Helper: get base URL for Twilio callbacks
function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

// Export session store so the process endpoint can access it
export { callSessions };
