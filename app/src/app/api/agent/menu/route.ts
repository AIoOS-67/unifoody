/**
 * API Proxy: GET /api/agent/menu?restaurantId=...&category=...
 *
 * Fetches the visual menu directly from the agent service's /api/menu endpoint.
 * Returns structured menu data grouped by category for VisualMenu rendering.
 */
import { NextRequest, NextResponse } from 'next/server';

const AGENT_URL = process.env.AGENT_SERVICE_URL || 'https://foodyepay-agent-443906211776.us-east1.run.app';

// Reuse cached token from the chat route
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getIdentityToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) return cachedToken;

  const metadataUrl = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${AGENT_URL}`;
  try {
    const resp = await fetch(metadataUrl, {
      headers: { 'Metadata-Flavor': 'Google' },
    });
    if (resp.ok) {
      cachedToken = await resp.text();
      tokenExpiry = now + 50 * 60 * 1000;
      return cachedToken;
    }
  } catch {
    // Not on GCP
  }

  if (process.env.AGENT_ID_TOKEN) {
    return process.env.AGENT_ID_TOKEN;
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get('restaurantId');
    const category = searchParams.get('category') || '';

    if (!restaurantId) {
      return NextResponse.json(
        { error: 'restaurantId is required' },
        { status: 400 }
      );
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = await getIdentityToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = new URL(`${AGENT_URL}/api/menu`);
    url.searchParams.set('restaurant_id', restaurantId);
    if (category) url.searchParams.set('category', category);

    const resp = await fetch(url.toString(), { headers });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`[Agent Menu Proxy] Error ${resp.status}: ${text}`);
      return NextResponse.json(
        { error: `Agent service returned ${resp.status}`, categories: {} },
        { status: resp.status }
      );
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Agent Menu Proxy] Error:', error);
    return NextResponse.json(
      { error: error.message, categories: {}, total_items: 0 },
      { status: 502 }
    );
  }
}
