/**
 * API Proxy: POST /api/agent/chat
 *
 * Proxies chat requests from the frontend to the Cloud Run agent service.
 * Handles authentication via Google Cloud identity tokens when the
 * org policy requires authenticated access to Cloud Run.
 */
import { NextRequest, NextResponse } from 'next/server';

const AGENT_URL = process.env.AGENT_SERVICE_URL || 'https://foodyepay-agent-443906211776.us-east1.run.app';

// Cache identity token (they last ~1 hour)
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getIdentityToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) return cachedToken;

  // When running on Cloud Run, use the metadata server to get an identity token
  const metadataUrl = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${AGENT_URL}`;
  try {
    const resp = await fetch(metadataUrl, {
      headers: { 'Metadata-Flavor': 'Google' },
    });
    if (resp.ok) {
      cachedToken = await resp.text();
      tokenExpiry = now + 50 * 60 * 1000; // Refresh 10 min before expiry
      return cachedToken;
    }
  } catch {
    // Not running on GCP — might be local dev
  }

  // For local dev, try using gcloud CLI token via env var
  if (process.env.AGENT_ID_TOKEN) {
    return process.env.AGENT_ID_TOKEN;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add auth token if available
    const token = await getIdentityToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const resp = await fetch(`${AGENT_URL}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`[Agent Proxy] Error ${resp.status}: ${text}`);
      return NextResponse.json(
        { error: `Agent service returned ${resp.status}`, response: 'Sorry, the AI agent is temporarily unavailable.' },
        { status: resp.status }
      );
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Agent Proxy] Error:', error);
    return NextResponse.json(
      { error: error.message, response: 'Sorry, I could not connect to the AI agent.' },
      { status: 502 }
    );
  }
}
