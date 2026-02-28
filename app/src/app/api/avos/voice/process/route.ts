/**
 * AVOS Twilio Voice Process Endpoint
 * POST: Receives speech recognition results from Twilio <Gather>,
 * processes through the dialog state machine, returns AI response as TwiML
 */

import { NextRequest, NextResponse } from 'next/server';
import { callSessions } from '../route';
import { paymentProcessor } from '@/lib/avos/payment-processor';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const speechResult = formData.get('SpeechResult') as string;
    const confidence = parseFloat(formData.get('Confidence') as string || '0.8');

    console.log(`[AVOS Process] CallSid=${callSid}, Speech="${speechResult}", Confidence=${confidence}`);

    // Retrieve session
    const session = callSessions.get(callSid);
    if (!session) {
      console.error('[AVOS Process] No session found for CallSid:', callSid);
      return new NextResponse(
        twiml(`<Say voice="Polly.Joanna">Sorry, your session has expired. Please call back. Goodbye.</Say><Hangup/>`),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    let { context, stateMachine, voiceProvider, restaurantName } = session;

    if (!speechResult) {
      // No speech detected — ask again
      const processUrl = `${getBaseUrl(request)}/api/avos/voice/process`;
      return new NextResponse(
        twiml(`
          <Gather input="speech" action="${processUrl}" method="POST"
                  speechTimeout="3" timeout="10" language="${langToTwiml(context.language)}"
                  speechModel="phone_call" enhanced="true">
            <Say voice="Polly.Joanna" language="${langToTwiml(context.language)}">
              Sorry, I didn't hear anything. Could you please repeat your order?
            </Say>
          </Gather>
          <Say voice="Polly.Joanna">I still didn't catch that. Goodbye.</Say>
          <Hangup/>
        `),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Step 1: Analyze intent via voice provider (Gemini)
    let intentResult;
    try {
      intentResult = await voiceProvider.analyzeIntent(speechResult, context);
      intentResult.rawText = speechResult;
      console.log(`[AVOS Process] Intent: ${intentResult.intent}, Confidence: ${intentResult.confidence}`);
    } catch (err: any) {
      console.error('[AVOS Process] Intent analysis failed:', err.message);
      // Fallback: try to handle as ORDER_ITEM with raw text
      intentResult = {
        intent: 'UNKNOWN',
        confidence: 0.5,
        entities: {},
        rawText: speechResult,
      };
    }

    // Step 2: Process through state machine
    const result = await stateMachine.processInput(context, intentResult);

    // Step 3: Update context with new state
    context = result.context;
    context.currentState = result.nextState;

    // Update session
    session.context = context;
    session.stateMachine = stateMachine;
    callSessions.set(callSid, session);

    console.log(`[AVOS Process] New state: ${result.nextState}, Response: "${result.response.substring(0, 80)}..."`);

    // Step 4: Handle terminal states
    if (result.nextState === 'CLOSING') {
      // Order complete — clean up session after a delay
      setTimeout(() => callSessions.delete(callSid), 60000);
      return new NextResponse(
        twiml(`
          <Say voice="Polly.Joanna" language="${langToTwiml(context.language)}">${escapeXml(result.response)}</Say>
          <Pause length="1"/>
          <Say voice="Polly.Joanna" language="${langToTwiml(context.language)}">Thank you for calling ${escapeXml(restaurantName)}. Goodbye!</Say>
          <Hangup/>
        `),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    if (result.nextState === 'TRANSFER_TO_HUMAN') {
      setTimeout(() => callSessions.delete(callSid), 60000);
      // Try to get the transfer phone number from config
      const transferPhone = session.context.metadata?.transferPhone;
      if (transferPhone) {
        return new NextResponse(
          twiml(`
            <Say voice="Polly.Joanna">${escapeXml(result.response)} Let me connect you to a staff member.</Say>
            <Dial>${transferPhone}</Dial>
          `),
          { headers: { 'Content-Type': 'text/xml' } }
        );
      }
      return new NextResponse(
        twiml(`
          <Say voice="Polly.Joanna">${escapeXml(result.response)} Please call back during business hours. Goodbye.</Say>
          <Hangup/>
        `),
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Step 5: Handle payment state — generate and send payment link via SMS
    if (result.nextState === 'PAYMENT' && context.orderItems.length > 0 && !context.paymentInitiated) {
      try {
        context.paymentInitiated = true;
        session.context = context;
        callSessions.set(callSid, session);

        // Create order and generate payment link
        const avosOrder = await paymentProcessor.createAVOSOrder(
          callSid,
          context.restaurantId,
          context.customerPhone,
          context.orderItems,
          'NY', // default state for tax
          '10001'
        );

        const paymentLink = await paymentProcessor.generatePaymentLink({
          orderId: avosOrder.id,
          callId: callSid,
          restaurantId: context.restaurantId,
          customerPhone: context.customerPhone,
          items: context.orderItems,
          subtotalUsd: avosOrder.subtotal_usd,
          taxUsd: avosOrder.tax_usd,
          totalUsd: avosOrder.total_usd,
          foodyAmount: avosOrder.foody_amount,
          exchangeRate: avosOrder.exchange_rate,
        });

        // Send SMS via Twilio
        try {
          const twilio = (await import('twilio')).default;
          const client = twilio(
            process.env.TWILIO_ACCOUNT_SID!,
            process.env.TWILIO_AUTH_TOKEN!
          );
          await client.messages.create({
            body: `Your ${restaurantName} order is ready! Pay with FOODY: ${paymentLink} (expires in 30 min)`,
            from: process.env.TWILIO_PHONE_NUMBER!,
            to: context.customerPhone,
          });
          console.log(`[AVOS Process] SMS sent to ${context.customerPhone}`);
        } catch (smsErr: any) {
          console.error('[AVOS Process] SMS send failed:', smsErr.message);
        }
      } catch (payErr: any) {
        console.error('[AVOS Process] Payment processing error:', payErr.message);
      }
    }

    // Step 6: Return AI response and gather next input
    const processUrl = `${getBaseUrl(request)}/api/avos/voice/process`;
    return new NextResponse(
      twiml(`
        <Gather input="speech" action="${processUrl}" method="POST"
                speechTimeout="3" timeout="15" language="${langToTwiml(context.language)}"
                speechModel="phone_call" enhanced="true">
          <Say voice="Polly.Joanna" language="${langToTwiml(context.language)}">${escapeXml(result.response)}</Say>
        </Gather>
        <Say voice="Polly.Joanna">I didn't hear a response. Let me repeat.</Say>
        <Redirect method="POST">${processUrl}</Redirect>
      `),
      { headers: { 'Content-Type': 'text/xml' } }
    );
  } catch (error: any) {
    console.error('[AVOS Process] Error:', error.message);
    return new NextResponse(
      twiml(`<Say voice="Polly.Joanna">Sorry, something went wrong processing your order. Please try again. Goodbye.</Say><Hangup/>`),
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }
}

function twiml(content: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${content}</Response>`;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function langToTwiml(lang: string): string {
  const map: Record<string, string> = {
    'en': 'en-US',
    'zh': 'zh-CN',
    'yue': 'zh-HK',
    'es': 'es-US',
  };
  return map[lang] || 'en-US';
}

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}
