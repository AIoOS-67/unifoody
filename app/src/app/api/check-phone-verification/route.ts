// app/api/check-phone-verification/route.ts
// Verifies a code delivered via phone call to the restaurant's listed phone.
//
// Security:
// - Composite identifier lookup (placeId + phone + sessionId)
// - 5 max attempts, then 30-minute lockout on the phone number
// - Audit trail: all attempts logged with IP

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export const runtime = 'nodejs';

interface CheckVerificationRequest {
  phoneNumber: string;
  code: string;
  placeId?: string;
  sessionId?: string;
  walletAddress?: string;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return digits.startsWith('+') ? digits : `+${digits}`;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '0.0.0.0'
  );
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckVerificationRequest = await request.json();
    const { phoneNumber, code, placeId, sessionId, walletAddress } = body;

    if (!phoneNumber || !code) {
      return NextResponse.json(
        { success: false, message: 'Phone number and verification code are required' },
        { status: 400 },
      );
    }

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { success: false, message: 'Verification code must be 6 digits' },
        { status: 400 },
      );
    }

    const normalizedPhone = normalizePhone(phoneNumber);
    const clientIp = getClientIp(request);

    console.log(`Verify attempt: phone=${normalizedPhone} ip=${clientIp}`);

    // --- Lockout check ---

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
        {
          success: false,
          verified: false,
          message: `This number is temporarily locked. Try again in ${mins} minute(s).`,
        },
        { status: 429 },
      );
    }

    // --- Find the most recent active code ---
    // Try composite identifier first, fall back to phone_e164

    let result;

    if (sessionId && placeId) {
      const identifier = `${placeId}:${normalizedPhone}:${sessionId}`;
      result = await pool.query(
        `SELECT id, code, attempts, expires_at
         FROM verification_codes
         WHERE identifier = $1
           AND verified = false
           AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [identifier],
      );
    }

    // Fallback: match by phone number if composite didn't match
    if (!result || result.rows.length === 0) {
      result = await pool.query(
        `SELECT id, code, attempts, expires_at
         FROM verification_codes
         WHERE phone_e164 = $1
           AND verified = false
           AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [normalizedPhone],
      );
    }

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          message: 'No active verification code found. The code may have expired (5 min TTL). Please request a new call.',
        },
        { status: 400 },
      );
    }

    const record = result.rows[0];

    // --- Max attempts check (5 allowed) ---

    if (record.attempts >= 5) {
      // Lock the phone number for 30 minutes
      const lockUntil = new Date(Date.now() + 30 * 60 * 1000);
      await pool.query(
        `UPDATE verification_codes SET verified = true, locked_until = $2 WHERE id = $1`,
        [record.id, lockUntil],
      );
      return NextResponse.json(
        {
          success: false,
          verified: false,
          message: 'Too many incorrect attempts. This number is locked for 30 minutes.',
        },
        { status: 429 },
      );
    }

    // Increment attempt counter
    await pool.query(
      `UPDATE verification_codes SET attempts = attempts + 1 WHERE id = $1`,
      [record.id],
    );

    // --- Check code ---

    if (record.code !== code) {
      const attemptsUsed = record.attempts + 1;
      const attemptsLeft = 5 - attemptsUsed;

      // If this was the last attempt, lock immediately
      if (attemptsLeft <= 0) {
        const lockUntil = new Date(Date.now() + 30 * 60 * 1000);
        await pool.query(
          `UPDATE verification_codes SET verified = true, locked_until = $2 WHERE id = $1`,
          [record.id, lockUntil],
        );
        return NextResponse.json(
          {
            success: false,
            verified: false,
            message: 'Too many incorrect attempts. This number is locked for 30 minutes.',
          },
          { status: 429 },
        );
      }

      return NextResponse.json(
        {
          success: false,
          verified: false,
          message: `Incorrect code. ${attemptsLeft} attempt(s) remaining before lockout.`,
        },
        { status: 400 },
      );
    }

    // --- Success ---

    await pool.query(
      `UPDATE verification_codes SET verified = true WHERE id = $1`,
      [record.id],
    );

    if (walletAddress) {
      try {
        await pool.query(
          `UPDATE restaurants SET phone_verified = true, updated_at = NOW()
           WHERE wallet_address = $1`,
          [walletAddress],
        );
        console.log(`phone_verified=true for wallet ${walletAddress}`);
      } catch (dbErr) {
        console.warn('Could not update restaurant phone_verified:', dbErr);
      }
    }

    console.log(`Verification SUCCESS for ${normalizedPhone}`);

    return NextResponse.json({
      success: true,
      verified: true,
      message: 'Phone verification successful! Your restaurant ownership has been confirmed.',
      isTest: false,
    });
  } catch (error: any) {
    console.error('Phone verification check error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Verification failed. Please try again later.',
        verified: false,
      },
      { status: 500 },
    );
  }
}
