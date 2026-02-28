// app/api/send-phone-verification/route.ts
// Sends a verification code via automated phone call (Twilio) to the
// restaurant's Google Places listed phone number.
//
// Security hardening:
// - NO echo/demo mode in production — Twilio must be configured
// - Composite session key: placeId + phone + sessionId
// - TCPA-compliant call script with consent + opt-out language
// - IP-based + phone-based rate limiting
// - 30-minute lockout after too many failed verify attempts
// - CAPTCHA token validation (when configured)
// - 90-second cooldown between calls to same number

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { generateCode } from '@/lib/businessVerification';
import crypto from 'crypto';

export const runtime = 'nodejs';

interface SendVerificationRequest {
  phoneNumber: string;       // Restaurant's phone from Google Places
  restaurantName?: string;   // For the call script
  placeId?: string;          // Google Places ID (composite key)
  sessionId?: string;        // Browser session nonce (composite key)
  channel?: 'call' | 'sms';  // Voice call or SMS
  captchaToken?: string;     // Turnstile/reCAPTCHA token
  consentGiven?: boolean;    // User checked the consent box
}

// ---------------------------------------------------------------------------
// Table setup
// ---------------------------------------------------------------------------

async function ensureTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS verification_codes (
        id SERIAL PRIMARY KEY,
        identifier TEXT NOT NULL,
        code TEXT NOT NULL,
        phone_number TEXT,
        phone_e164 TEXT,
        place_id TEXT,
        session_id TEXT,
        restaurant_name TEXT,
        ip_address TEXT,
        channel TEXT DEFAULT 'call',
        attempts INT DEFAULT 0,
        verified BOOLEAN DEFAULT false,
        locked_until TIMESTAMPTZ,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    // Migrate existing tables: add new columns if they don't exist
    const migrations = [
      `ALTER TABLE verification_codes ADD COLUMN IF NOT EXISTS phone_e164 TEXT`,
      `ALTER TABLE verification_codes ADD COLUMN IF NOT EXISTS place_id TEXT`,
      `ALTER TABLE verification_codes ADD COLUMN IF NOT EXISTS session_id TEXT`,
      `ALTER TABLE verification_codes ADD COLUMN IF NOT EXISTS ip_address TEXT`,
      `ALTER TABLE verification_codes ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'call'`,
      `ALTER TABLE verification_codes ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ`,
      `CREATE INDEX IF NOT EXISTS idx_vc_identifier ON verification_codes(identifier)`,
      `CREATE INDEX IF NOT EXISTS idx_vc_phone_e164 ON verification_codes(phone_e164)`,
      `CREATE INDEX IF NOT EXISTS idx_vc_ip ON verification_codes(ip_address)`,
      `CREATE INDEX IF NOT EXISTS idx_vc_expires ON verification_codes(expires_at)`,
    ];
    for (const sql of migrations) {
      await pool.query(sql).catch(() => {/* column/index may already exist */});
    }
  } catch (e) {
    console.warn('Table creation notice:', (e as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return digits.startsWith('+') ? digits : `+${digits}`;
}

/** Build composite identifier: placeId:phone:sessionId */
function buildIdentifier(placeId: string, phoneE164: string, sessionId: string): string {
  return `${placeId}:${phoneE164}:${sessionId}`;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '0.0.0.0'
  );
}

function isStrictlyDev(): boolean {
  return process.env.NODE_ENV === 'development';
}

/** Validate Cloudflare Turnstile token (if configured) */
async function validateCaptcha(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // Not configured — skip (will be enforced in prod later)

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    console.error('Turnstile verification failed');
    return false;
  }
}

// ---------------------------------------------------------------------------
// Build TCPA-compliant TwiML
// ---------------------------------------------------------------------------

function buildTwiml(code: string, restaurantName: string): string {
  const d = code.split('');
  // Grouped reading: "1 2 3, 4 5 6"
  const grouped = `${d[0]} ${d[1]} ${d[2]}, ${d[3]} ${d[4]} ${d[5]}`;
  // Individual with pauses: "1 ... 2 ... 3 ... 4 ... 5 ... 6"
  const individual = d.join(' <break time="600ms"/> ');

  return `<Response>
  <Say voice="Polly.Joanna" language="en-US">
    This is an automated call from FoodyePay to verify a restaurant registration
    for ${restaurantName}.
    If you did not request this verification, you may hang up now. No further action is needed.
  </Say>
  <Pause length="2"/>
  <Say voice="Polly.Joanna" language="en-US">
    Your 6-digit verification code is:
  </Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna" language="en-US">
    <prosody rate="slow">${grouped}</prosody>
  </Say>
  <Pause length="2"/>
  <Say voice="Polly.Joanna" language="en-US">
    I will now repeat the code, one digit at a time:
  </Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna" language="en-US">
    <prosody rate="x-slow">${individual}</prosody>
  </Say>
  <Pause length="2"/>
  <Say voice="Polly.Joanna" language="en-US">
    Please enter this code on the FoodyePay registration page within 5 minutes.
    This code will expire after 5 minutes or 5 incorrect attempts.
    Thank you, and goodbye.
  </Say>
</Response>`;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body: SendVerificationRequest = await request.json();
    const {
      phoneNumber,
      restaurantName = '',
      placeId = '',
      sessionId: rawSessionId,
      channel = 'call',
      captchaToken,
      consentGiven,
    } = body;

    // --- Validation ---

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, message: 'Restaurant phone number is required' },
        { status: 400 },
      );
    }

    if (!consentGiven) {
      return NextResponse.json(
        { success: false, message: 'You must consent to receiving a verification call before proceeding' },
        { status: 400 },
      );
    }

    // --- CAPTCHA (if configured) ---

    if (captchaToken) {
      const valid = await validateCaptcha(captchaToken);
      if (!valid) {
        return NextResponse.json(
          { success: false, message: 'CAPTCHA verification failed. Please try again.' },
          { status: 403 },
        );
      }
    } else if (process.env.TURNSTILE_SECRET_KEY && !isStrictlyDev()) {
      return NextResponse.json(
        { success: false, message: 'CAPTCHA token is required' },
        { status: 400 },
      );
    }

    const normalizedPhone = normalizePhone(phoneNumber);
    const sessionId = rawSessionId || crypto.randomUUID();
    const identifier = buildIdentifier(placeId || 'unknown', normalizedPhone, sessionId);
    const clientIp = getClientIp(request);

    console.log(`Verification request: phone=${normalizedPhone} place=${placeId} ip=${clientIp} channel=${channel}`);

    await ensureTable();

    // --- Rate limiting: per phone (3/hour) ---

    const phoneRateResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM verification_codes
       WHERE phone_e164 = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [normalizedPhone],
    );
    if (parseInt(phoneRateResult.rows[0]?.cnt || '0', 10) >= 3) {
      return NextResponse.json(
        { success: false, message: 'Too many verification calls to this number. Please try again in an hour.' },
        { status: 429 },
      );
    }

    // --- Rate limiting: per IP (10/hour) ---

    const ipRateResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM verification_codes
       WHERE ip_address = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [clientIp],
    );
    if (parseInt(ipRateResult.rows[0]?.cnt || '0', 10) >= 10) {
      return NextResponse.json(
        { success: false, message: 'Too many verification requests from your network. Please try again later.' },
        { status: 429 },
      );
    }

    // --- Cooldown: 90 seconds between calls to same phone ---

    const cooldownResult = await pool.query(
      `SELECT created_at FROM verification_codes
       WHERE phone_e164 = $1
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedPhone],
    );
    if (cooldownResult.rows.length > 0) {
      const lastCall = new Date(cooldownResult.rows[0].created_at);
      const elapsed = Date.now() - lastCall.getTime();
      const cooldownMs = 90_000; // 90 seconds
      if (elapsed < cooldownMs) {
        const waitSec = Math.ceil((cooldownMs - elapsed) / 1000);
        return NextResponse.json(
          { success: false, message: `Please wait ${waitSec} seconds before requesting another call.` },
          { status: 429 },
        );
      }
    }

    // --- Lockout check: if previous session was locked ---

    const lockResult = await pool.query(
      `SELECT locked_until FROM verification_codes
       WHERE phone_e164 = $1 AND locked_until > NOW()
       ORDER BY locked_until DESC LIMIT 1`,
      [normalizedPhone],
    );
    if (lockResult.rows.length > 0) {
      const lockUntil = new Date(lockResult.rows[0].locked_until);
      const mins = Math.ceil((lockUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { success: false, message: `This number is temporarily locked due to too many failed attempts. Try again in ${mins} minute(s).` },
        { status: 429 },
      );
    }

    // --- Generate code & persist ---

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes (tighter TTL)

    await pool.query(
      `INSERT INTO verification_codes
         (identifier, code, phone_number, phone_e164, place_id, session_id,
          restaurant_name, ip_address, channel, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [identifier, code, phoneNumber, normalizedPhone, placeId || null,
       sessionId, restaurantName || null, clientIp, channel, expiresAt],
    );

    // Cleanup expired codes (non-blocking)
    pool.query(`DELETE FROM verification_codes WHERE expires_at < NOW() AND verified = true`)
      .catch((e: Error) => console.warn('Cleanup:', e.message));

    // --- Delivery ---

    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

    if (twilioSid && twilioAuth && twilioFrom) {
      // --- Production: Twilio delivery ---
      try {
        const twilio = (await import('twilio')).default;
        const client = twilio(twilioSid, twilioAuth);

        if (channel === 'sms') {
          await client.messages.create({
            body: `FoodyePay verification for ${restaurantName || 'your restaurant'}: Your code is ${code}. Expires in 5 minutes. If you did not request this, please ignore.`,
            from: twilioFrom,
            to: normalizedPhone,
          });
          console.log(`SMS sent to ${normalizedPhone}`);
        } else {
          const twiml = buildTwiml(code, restaurantName || 'your restaurant');
          await client.calls.create({ twiml, from: twilioFrom, to: normalizedPhone });
          console.log(`Call initiated to ${normalizedPhone}`);
        }

        return NextResponse.json({
          success: true,
          message: channel === 'sms'
            ? `Verification code sent via SMS to ${phoneNumber}.`
            : `Calling ${phoneNumber} now. Please answer the phone at your restaurant.`,
          channel,
          sessionId,
          isTest: false,
          // NEVER echo code in production
        });
      } catch (twilioError: any) {
        console.error('Twilio error:', twilioError?.message || twilioError);

        // In dev, fall back to echo; in production, hard fail
        if (isStrictlyDev()) {
          return NextResponse.json({
            success: true,
            message: `[DEV] Twilio call failed. Code: ${code}`,
            channel,
            sessionId,
            isTest: true,
            echoedCode: code,
          });
        }

        return NextResponse.json(
          { success: false, message: 'Failed to initiate verification call. Please try again.' },
          { status: 500 },
        );
      }
    } else if (isStrictlyDev()) {
      // --- Development only: echo code ---
      console.warn('[DEV] Twilio not configured — echoing code');
      return NextResponse.json({
        success: true,
        message: `[DEV] Verification code: ${code}. In production, we would call ${phoneNumber}.`,
        channel,
        sessionId,
        isTest: true,
        echoedCode: code,
      });
    } else {
      // --- Production WITHOUT Twilio: HARD FAIL ---
      console.error('CRITICAL: Twilio credentials not configured in production!');
      return NextResponse.json(
        { success: false, message: 'Phone verification service is not available. Please contact support.' },
        { status: 503 },
      );
    }
  } catch (error: any) {
    console.error('Phone verification send error:', error);
    return NextResponse.json(
      { success: false, message: 'Verification call failed. Please try again later.' },
      { status: 500 },
    );
  }
}
