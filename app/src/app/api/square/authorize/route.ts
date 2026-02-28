// /api/square/authorize — Generate Square OAuth authorization URL
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const applicationId = process.env.SQUARE_APPLICATION_ID;
    if (!applicationId) {
      return NextResponse.json(
        { error: 'Square application not configured' },
        { status: 500 }
      );
    }

    const environment = process.env.SQUARE_ENVIRONMENT || 'sandbox';
    const baseUrl = environment === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';

    // Determine redirect URI from request origin
    const origin = req.headers.get('origin') || req.headers.get('referer')?.replace(/\/[^/]*$/, '') || 'http://localhost:3000';
    const redirectUri = `${origin}/en/register/square/callback`;

    // Generate CSRF state token
    const state = crypto.randomBytes(32).toString('hex');

    // Build OAuth URL
    const params = new URLSearchParams({
      client_id: applicationId,
      scope: 'MERCHANT_PROFILE_READ ITEMS_READ',
      session: 'false',
      state,
      redirect_uri: redirectUri,
    });

    const authorizeUrl = `${baseUrl}/oauth2/authorize?${params.toString()}`;

    return NextResponse.json({
      url: authorizeUrl,
      state,
    });
  } catch (error: any) {
    console.error('[Square] Authorize error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate authorization URL' },
      { status: 500 }
    );
  }
}
