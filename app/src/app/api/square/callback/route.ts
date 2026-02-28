// /api/square/callback — Exchange OAuth code for merchant data
import { NextRequest, NextResponse } from 'next/server';
import { Client, Environment } from 'square';

export async function POST(req: NextRequest) {
  try {
    const { code, redirectUri } = await req.json();

    if (!code) {
      return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
    }

    const applicationId = process.env.SQUARE_APPLICATION_ID;
    const applicationSecret = process.env.SQUARE_APPLICATION_SECRET;
    const environment = process.env.SQUARE_ENVIRONMENT || 'sandbox';

    if (!applicationId || !applicationSecret) {
      return NextResponse.json({ error: 'Square not configured' }, { status: 500 });
    }

    // Initialize Square client (no access token yet — we're obtaining one)
    const client = new Client({
      environment: environment === 'production' ? Environment.Production : Environment.Sandbox,
    });

    // Exchange authorization code for access token
    const tokenResponse = await client.oAuthApi.obtainToken({
      clientId: applicationId,
      clientSecret: applicationSecret,
      grantType: 'authorization_code',
      code,
      redirectUri,
    });

    const accessToken = tokenResponse.result.accessToken;
    const merchantId = tokenResponse.result.merchantId;

    if (!accessToken || !merchantId) {
      return NextResponse.json({ error: 'Failed to obtain access token' }, { status: 500 });
    }

    // Create authenticated client to fetch merchant details
    const authenticatedClient = new Client({
      accessToken,
      environment: environment === 'production' ? Environment.Production : Environment.Sandbox,
    });

    // Fetch merchant profile
    let merchantName = '';
    let merchantCountry = '';
    let merchantStatus = 'active';
    try {
      const merchantResponse = await authenticatedClient.merchantsApi.retrieveMerchant(merchantId);
      const merchant = merchantResponse.result.merchant;
      merchantName = merchant?.businessName || '';
      merchantCountry = merchant?.country || 'US';
      merchantStatus = merchant?.status || 'ACTIVE';
    } catch (e: any) {
      console.warn('[Square] Failed to fetch merchant profile:', e.message);
    }

    // Fetch locations (stores)
    let locations: Array<{
      id: string;
      name: string;
      address: string;
      phone: string;
      status: string;
    }> = [];
    try {
      const locationsResponse = await authenticatedClient.locationsApi.listLocations();
      locations = (locationsResponse.result.locations || []).map((loc) => ({
        id: loc.id || '',
        name: loc.name || '',
        address: [
          loc.address?.addressLine1,
          loc.address?.locality,
          loc.address?.administrativeDistrictLevel1,
          loc.address?.postalCode,
        ].filter(Boolean).join(', '),
        phone: loc.phoneNumber || '',
        status: loc.status || 'ACTIVE',
      }));
    } catch (e: any) {
      console.warn('[Square] Failed to fetch locations:', e.message);
    }

    return NextResponse.json({
      merchantId,
      merchantName,
      merchantCountry,
      merchantStatus,
      locations,
      // Don't return access token to the frontend for security
    });
  } catch (error: any) {
    console.error('[Square] Callback error:', error);

    // Handle Square API specific errors
    const message = error.result?.errors?.[0]?.detail || error.message || 'Square OAuth failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
