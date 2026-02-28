import { NextResponse } from 'next/server';
import nacl from 'tweetnacl';
import { randomBytes } from 'crypto';

// This route generates a Coinbase Onramp session token using a backend JWT.
// It expects a POST body like:
// {
//   "address": "0x...",                // required
//   "blockchains": ["base"],           // optional, defaults to ["base"]
//   "assets": ["USDC"],                // optional, defaults to ["USDC"]
//   "partnerUserId": "user-123"        // optional, for tracking
// }

export const dynamic = 'force-dynamic';

// Increment this when making deployment-relevant changes so diag endpoint can confirm version.
const CODE_VERSION = '2025-09-30-v3';

// ================= CORS + Security =================
// Comma / space / newline separated origin allowlist. Examples:
// ONRAMP_ALLOWED_ORIGINS=https://foodyepay.com,https://app.foodyepay.com
// If empty => no browser origins allowed (mobile native fetch without Origin header still works).
function parseAllowedOrigins(raw?: string): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[\n,\s]+/)
      .map(o => o.trim())
      .filter(Boolean)
  );
}
// Build initial allowlist from env
const ALLOWED_ORIGINS = parseAllowedOrigins(process.env.ONRAMP_ALLOWED_ORIGINS);
// Fallback enhancement: if env not set or missing variants for NEXT_PUBLIC_APP_URL, derive them in-memory (does NOT leak to other routes).
try {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    const u = new URL(appUrl);
    const baseOrigin = u.origin;
    if (!ALLOWED_ORIGINS.has(baseOrigin)) {
      // If user forgot to set ONRAMP_ALLOWED_ORIGINS, add primary app origin
      if (!process.env.ONRAMP_ALLOWED_ORIGINS) {
        ALLOWED_ORIGINS.add(baseOrigin);
      }
    }
    // Ensure www/apex pair both present for app domain to reduce accidental 403s
    const host = u.host;
    if (host.startsWith('www.')) {
      const apexOrigin = `${u.protocol}//${host.slice(4)}`;
      if (ALLOWED_ORIGINS.has(baseOrigin) && !ALLOWED_ORIGINS.has(apexOrigin)) {
        ALLOWED_ORIGINS.add(apexOrigin);
      }
    } else {
      const wwwOrigin = `${u.protocol}//www.${host}`;
      if (ALLOWED_ORIGINS.has(baseOrigin) && !ALLOWED_ORIGINS.has(wwwOrigin)) {
        ALLOWED_ORIGINS.add(wwwOrigin);
      }
    }
  }
} catch { /* ignore malformed NEXT_PUBLIC_APP_URL */ }

function extractOrigin(req: Request): string | null {
  const o = req.headers.get('origin');
  if (!o) return null; // native mobile or curl typically has no origin
  try { return new URL(o).origin; } catch { return null; }
}

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true; // treat non-browser (no Origin header) requests as allowed
  if (!ALLOWED_ORIGINS.size) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Allow implicit apex/www pairing: if "https://foo.com" is allowlisted, accept "https://www.foo.com" and vice versa.
  try {
    const u = new URL(origin);
    const host = u.host; // includes port if any
    if (host.startsWith('www.')) {
      const apexHost = host.slice(4);
      const apexOrigin = `${u.protocol}//${apexHost}`;
      if (ALLOWED_ORIGINS.has(apexOrigin)) return true;
    } else {
      const wwwOrigin = `${u.protocol}//www.${host}`;
      if (ALLOWED_ORIGINS.has(wwwOrigin)) return true;
    }
  } catch { /* ignore malformed origin */ }
  return false;
}

function buildCorsHeaders(origin: string | null) {
  if (!origin) return {}; // no-origin request (native app) => do not set ACAO
  if (!isOriginAllowed(origin)) return {}; // not allowed => no CORS headers
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '600'
  } as Record<string,string>;
}

function extractClientIp(req: Request): string | undefined {
  const h = req.headers;
  const xff = h.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }
  const real = h.get('x-real-ip');
  if (real) return real.trim();
  return undefined; // Next.js runtime doesn't expose remoteAddress directly
}

type RequestBody = {
  address?: string;
  blockchains?: string[];
  assets?: string[];
  partnerUserId?: string;
  forceNacl?: boolean; // debug: force tweetnacl signing
  forceRebuild?: boolean; // debug: force using rebuilt (seed+derivedPublic) base64
};

function getEnv(name: string): string | undefined {
  const v = process.env[name];
  return (typeof v === 'string' && v.length > 0) ? v : undefined;
}

type KeyAnalysis = {
  source: 'json' | 'pem' | 'base64' | 'unknown';
  normalized?: string; // value we will pass to SDK
  isBase64: boolean;
  isPem: boolean;
  length: number;
  raw?: string; // original trimmed env value
};

function parsePrivateKey(raw?: string): string | undefined {
  if (!raw) return undefined;

  const unescapeNewlines = (s: string) => s.replace(/\\n/g, '\n').trim();
  const stripAllWhitespace = (s: string) => s.replace(/\s+/g, '').trim();

  try {
    // Handle JSON-wrapped format: {"privateKey":"-----BEGIN EC PRIVATE KEY-----\n..."}
    if (raw.trim().startsWith('{')) {
      const obj = JSON.parse(raw);
      const inner = obj.privateKey || obj.private_key || '';
      if (typeof inner === 'string' && inner.length > 0) {
        return unescapeNewlines(inner);
      }
    }
  } catch {
    // ignore JSON parse errors and continue
  }

  // Handle plain PEM with escaped or real newlines stored directly in env
  if (/BEGIN (EC|PRIVATE) KEY/.test(raw)) {
    return unescapeNewlines(raw);
  }

  // Handle Ed25519 base64 secrets (no PEM header). Remove inner whitespace.
  const base64Clean = stripAllWhitespace(raw);
  if (/^[A-Za-z0-9+/=]+$/.test(base64Clean)) {
    return base64Clean;
  }

  // Otherwise return trimmed value
  return raw.trim();
}

function analyzeKey(raw?: string): KeyAnalysis {
  const empty: KeyAnalysis = { source: 'unknown', isBase64: false, isPem: false, length: 0 };
  if (!raw) return empty;

  const val = raw.trim();

  // JSON-wrapped {"privateKey":"..."}
  if (val.startsWith('{')) {
    try {
      const obj = JSON.parse(val);
      const inner = String(obj.privateKey || obj.private_key || '');
      const stripped = inner.replace(/\s+/g, '');
      const isB64 = /^[A-Za-z0-9+/=]+$/.test(stripped);
      return {
        source: 'json',
        isBase64: isB64,
        isPem: false,
        length: stripped.length,
        normalized: isB64 ? stripped : undefined, // pass inner base64 to SDK
        raw: val,
      };
    } catch {
      return empty;
    }
  }

  // PEM ECDSA key
  if (/BEGIN (EC|PRIVATE) KEY/.test(val)) {
    const unescaped = val.replace(/\\n/g, '\n').trim();
    return { source: 'pem', isBase64: false, isPem: true, length: unescaped.length, normalized: unescaped, raw: val };
  }

  // Bare base64 Ed25519 secret
  const stripped = val.replace(/\s+/g, '');
  const isB64 = /^[A-Za-z0-9+/=]+$/.test(stripped);
  return { source: 'base64', isBase64: isB64, isPem: false, length: stripped.length, normalized: isB64 ? stripped : undefined, raw: val };
}

// Convert an Ed25519 raw private key (32 or 64 bytes) to PKCS#8 DER buffer per RFC 8410.
// Many providers export 32-byte seeds; some export 64-byte expanded keys. We support both.
function ed25519RawToPkcs8Der_OpenSSL(raw: Uint8Array): Uint8Array {
  const keyLen = raw.length;
  if (keyLen !== 32 && keyLen !== 64) {
    throw new Error(`Unsupported Ed25519 key length: ${keyLen}; expected 32 or 64 bytes`);
  }

  // PKCS#8 PrivateKeyInfo ASN.1 (RFC 8410):
  // SEQUENCE {
  //   INTEGER 0,
  //   SEQUENCE { OID 1.3.101.112 },
  //   OCTET STRING (contains: OCTET STRING (32 or 64 bytes raw key))
  // }
  // Static header up to the outer OCTET STRING length
  // We'll compute dynamic lengths for 32 vs 64.

  const innerLen = keyLen; // 32 or 64
  const innerOctetLen = 2 /*0x04, len*/ + innerLen; // e.g., 34 or 66
  const outerOctetLen = 2 /*0x04, len*/ + innerOctetLen; // e.g., 36 or 68
  const seqBodyLen = 3 /*02 01 00*/ + 7 /*30 05 06 03 2b 65 70*/ + outerOctetLen; // 3 + 7 + (36|68)

  const totalLen = 2 /*30,len*/ + seqBodyLen;

  const der = new Uint8Array(totalLen);
  let o = 0;
  der[o++] = 0x30; // SEQUENCE
  der[o++] = seqBodyLen; // short-form length (fits in one byte: <= 127)

  // INTEGER 0
  der[o++] = 0x02; der[o++] = 0x01; der[o++] = 0x00;

  // SEQUENCE { OID 1.3.101.112 } (Ed25519)
  der[o++] = 0x30; der[o++] = 0x05; der[o++] = 0x06; der[o++] = 0x03; der[o++] = 0x2b; der[o++] = 0x65; der[o++] = 0x70;

  // OUTER OCTET STRING (wraps the inner OCTET STRING)
  der[o++] = 0x04; der[o++] = innerOctetLen;

  // INNER OCTET STRING: raw private key bytes (32 or 64)
  der[o++] = 0x04; der[o++] = innerLen;
  der.set(raw, o); o += innerLen;

  return der;
}

// Variant without the inner OCTET wrapper (some toolchains expect this form)
function ed25519RawToPkcs8Der_Raw(raw: Uint8Array): Uint8Array {
  const keyLen = raw.length;
  if (keyLen !== 32 && keyLen !== 64) {
    throw new Error(`Unsupported Ed25519 key length: ${keyLen}; expected 32 or 64 bytes`);
  }

  const outerOctetLen = 2 /*0x04,len*/ + keyLen; // no inner wrapper, store raw directly
  const seqBodyLen = 3 /*02 01 00*/ + 7 /*alg id*/ + outerOctetLen;
  const totalLen = 2 /*30,len*/ + seqBodyLen;

  const der = new Uint8Array(totalLen);
  let o = 0;
  der[o++] = 0x30; der[o++] = seqBodyLen;
  der[o++] = 0x02; der[o++] = 0x01; der[o++] = 0x00; // version 0
  der[o++] = 0x30; der[o++] = 0x05; der[o++] = 0x06; der[o++] = 0x03; der[o++] = 0x2b; der[o++] = 0x65; der[o++] = 0x70; // Ed25519 OID
  der[o++] = 0x04; der[o++] = keyLen + 2; // length of inner content: 0x04, len, raw
  der[o++] = 0x04; der[o++] = keyLen;
  der.set(raw, o); o += keyLen;
  return der;
}

function derToPem(der: Uint8Array): string {
  const b64 = Buffer.from(der).toString('base64');
  const lines = b64.match(/.{1,64}/g) || [b64];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`;
}

// Produce candidate secrets to try with the CDP SDK, in priority order.
// If input is base64 Ed25519, we return PEM variants (32-byte seed first, then 64-byte) to maximize compatibility.
function buildSecretCandidates(analysis: KeyAnalysis): string[] {
  if (analysis.isPem && analysis.normalized) {
    return [analysis.normalized];
  }
  if (analysis.isBase64 && analysis.normalized) {
    try {
      const raw = Buffer.from(analysis.normalized, 'base64');
      const candidates: string[] = [];
      // Rebuild a valid 64-byte (seed + public) base64 using derived public key from the seed
      if (raw.length >= 32) {
        const seed = raw.subarray(0, 32);
        const kp = nacl.sign.keyPair.fromSeed(seed);
        const rebuilt = Buffer.concat([Buffer.from(seed), Buffer.from(kp.publicKey)]);
        candidates.push(rebuilt.toString('base64'));
      }
      if (raw.length >= 32) {
        // Seed guess 1: first 32 bytes
        const seedA = raw.subarray(0, 32);
        candidates.push(derToPem(ed25519RawToPkcs8Der_OpenSSL(seedA))); // OpenSSL-style inner OCTET
        candidates.push(derToPem(ed25519RawToPkcs8Der_Raw(seedA)));     // Raw-in-outer variant
      }
      if (raw.length >= 64) {
        // Seed guess 2: last 32 bytes
        const seedB = raw.subarray(raw.length - 32);
        candidates.push(derToPem(ed25519RawToPkcs8Der_OpenSSL(seedB)));
        candidates.push(derToPem(ed25519RawToPkcs8Der_Raw(seedB)));
        // Full 64 as a last resort
        candidates.push(derToPem(ed25519RawToPkcs8Der_OpenSSL(raw.subarray(0, 64))));
      }
      // Also try raw base64 last (in case SDK added support)
      candidates.push(analysis.normalized);
      // And try JSON-wrapped forms that mirror the downloaded key file
      try {
        const kid = getEnv('CDP_API_KEY_ID');
        candidates.push(JSON.stringify({ privateKey: analysis.normalized }));
        if (kid) {
          candidates.push(JSON.stringify({ id: kid, privateKey: analysis.normalized }));
        }
      } catch { /* ignore */ }
      return candidates;
    } catch {
      // Fallback to original normalized value
      return [analysis.normalized];
    }
  }
  return analysis.normalized ? [analysis.normalized] : [];
}

async function generateCdpJwt(host: string, path: string, opts?: { forceNacl?: boolean; forceRebuild?: boolean }) {
  const apiKeyId = getEnv('CDP_API_KEY_ID');
  const apiKeySecretRaw = getEnv('CDP_API_PRIVATE_KEY');
  const analysis = analyzeKey(apiKeySecretRaw);
  let candidates = buildSecretCandidates(analysis);

  // If forcing rebuild, move any non-PEM candidate behind the rebuilt base64 (first candidate is rebuilt in buildSecretCandidates)
  if (opts?.forceRebuild && analysis.isBase64 && analysis.normalized) {
    // candidates already begins with rebuilt base64 from seed; keep as-is
  }

  if (!apiKeyId || candidates.length === 0) {
    throw new Error('Missing CDP_API_KEY_ID or CDP_API_PRIVATE_KEY in server environment');
  }

  // Import lazily to avoid bundling on the client
  const { generateJwt } = await import('@coinbase/cdp-sdk/auth');

  let lastErr: any = null;
  const triedKinds: string[] = [];
  if (!opts?.forceNacl) {
    for (const secret of candidates) {
      try {
        const kind = secret.startsWith('-----BEGIN') ? 'pem' : (secret.trim().startsWith('{') ? 'json' : (/[A-Za-z0-9+/=]+/.test(secret) ? 'base64' : 'other'));
        triedKinds.push(kind);
        // Per CDP docs, pass method/host/path so the JWT is scoped correctly
        const token = await generateJwt({
          apiKeyId,
          apiKeySecret: secret,
          requestMethod: 'POST',
          requestHost: host,
          requestPath: path,
        } as any);
        return token as string;
      } catch (e: any) {
        lastErr = e;
        // Try next candidate
      }
    }
  }

  // If we reach here, all candidates failed
  const meta = { source: analysis.source, isBase64: analysis.isBase64, isPem: analysis.isPem, length: analysis.length };
  // As a last resort, if we have a base64 Ed25519 secret, build the JWT using tweetnacl (avoids WebCrypto import issues on some platforms)
  if (analysis.isBase64 && analysis.normalized) {
    try {
      return await generateEd25519JwtWithTweetNacl(analysis.normalized, apiKeyId, host, path);
    } catch (e: any) {
      throw new Error(`Failed to generate JWT with provided key candidates. ${lastErr?.message || lastErr || ''} | diag=${JSON.stringify(meta)} | tried=${triedKinds.join(',')} | naclFallback=${e?.message || e}`);
    }
  }

  throw new Error(`Failed to generate JWT with provided key candidates. ${lastErr?.message || lastErr || ''} | diag=${JSON.stringify(meta)} | tried=${triedKinds.join(',')}`);
}

function toBase64Url(buf: Uint8Array): string {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function generateEd25519JwtWithTweetNacl(base64Key: string, apiKeyId: string, host: string, requestPath: string, expiresIn: number = 120): Promise<string> {
  const decoded = Buffer.from(base64Key, 'base64');
  if (decoded.length < 32) {
    throw new Error(`Ed25519 key too short: ${decoded.length}`);
  }
  const seed = decoded.subarray(0, 32);
  const kp = nacl.sign.keyPair.fromSeed(seed);
  const now = Math.floor(Date.now() / 1000);
  const claims: any = {
    sub: apiKeyId,
    iss: 'cdp',
    aud: ['cdp_service'],
    uris: [`POST ${host}${requestPath}`],
    iat: now,
    nbf: now,
    exp: now + expiresIn,
  };
  const header = { alg: 'EdDSA', kid: apiKeyId, typ: 'JWT', nonce: Buffer.from(randomBytes(16)).toString('hex') } as any;
  const enc = new TextEncoder();
  const h64 = toBase64Url(enc.encode(JSON.stringify(header)));
  const p64 = toBase64Url(enc.encode(JSON.stringify(claims)));
  const signingInput = enc.encode(`${h64}.${p64}`);
  const sig = nacl.sign.detached(signingInput, kp.secretKey);
  const s64 = toBase64Url(sig);
  return `${h64}.${p64}.${s64}`;
}

export async function POST(req: Request) {
  const origin = extractOrigin(req);
  const corsHeaders = buildCorsHeaders(origin);
  if (!isOriginAllowed(origin)) {
    return new NextResponse(JSON.stringify({ error: 'Origin not allowed' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
  try {
    // Support debug diagnostics via ?debug=1
    const url = new URL(req.url);
    const debug = url.searchParams.get('debug') === '1';

    let parsedBody: RequestBody | undefined;
    try {
      parsedBody = (await req.json()) as RequestBody;
    } catch (parseErr: any) {
      return new NextResponse(JSON.stringify({
        error: 'Invalid JSON body',
        details: parseErr?.message || String(parseErr),
      }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const { address, blockchains, assets, partnerUserId, forceNacl, forceRebuild } = parsedBody || {};

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Missing required field: address' }, { status: 400 });
    }

    const host = 'api.developer.coinbase.com';
    const path = '/onramp/v1/token';
  const jwt = await generateCdpJwt(host, path, { forceNacl, forceRebuild });

    const payload: any = {
      addresses: [
        {
          address,
          blockchains: Array.isArray(blockchains) && blockchains.length > 0 ? blockchains : ['base'],
        },
      ],
    };

    if (Array.isArray(assets) && assets.length > 0) {
      payload.assets = assets;
    } else {
      payload.assets = ['USDC'];
    }

    if (partnerUserId) {
      payload.partnerUserId = partnerUserId;
    }

    const projectId = getEnv('CDP_PROJECT_ID');
    let clientIp = extractClientIp(req);
    // Ensure we always send something in development (Coinbase may require clientIp)
    if (!clientIp && process.env.NODE_ENV !== 'production') {
      clientIp = '127.0.0.1';
    }
    if (clientIp) {
      (payload as any).clientIp = clientIp;
    }

    const resp = await fetch(`https://${host}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        ...(projectId ? { 'X-Cdp-Project-Id': projectId } : {}),
      },
      body: JSON.stringify(payload),
      // Ensure we don't accidentally cache
      cache: 'no-store',
    });

    const text = await resp.text();
    if (!resp.ok) {
      // Try to return structured error when possible
      let err: any = undefined;
      try { err = JSON.parse(text); } catch { /* ignore */ }
      return NextResponse.json(
        {
          error: 'Failed to create session token',
          status: resp.status,
          statusText: resp.statusText,
          response: err ?? text,
          upstreamRaw: debug ? text : undefined,
          debug: debug ? {
            clientIp,
            projectIdSuffix: projectId ? projectId.slice(-6) : null,
          } : undefined,
        },
        { status: 502 },
      );
    }

    const data = JSON.parse(text);
    // Expecting shape: { token: string, channel_id?: string }
    return new NextResponse(JSON.stringify({
      token: data.token,
      channel_id: data.channel_id ?? '',
      onrampUrl: `https://pay.coinbase.com/buy/select-asset?sessionToken=${encodeURIComponent(data.token)}`,
      debug: debug ? { clientIp } : undefined,
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e: any) {
    const origin = extractOrigin(req);
    const corsHeaders = buildCorsHeaders(origin);
    return new NextResponse(JSON.stringify({
      error: e?.message ?? 'Unknown error',
      hint: 'Verify CDP_API_PRIVATE_KEY format (JSON from portal for Ed25519, or PEM for ECDSA).',
    }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}

export async function GET(req: Request) {
  // Health check + optional diagnostics (no secrets).
  const url = new URL(req.url);
  if (url.searchParams.get('diag') === '1') {
    const kid = getEnv('CDP_API_KEY_ID');
    const raw = getEnv('CDP_API_PRIVATE_KEY');
    const a = analyzeKey(raw);
    const allowed = Array.from(ALLOWED_ORIGINS.values());
    return NextResponse.json({
      status: 'ok',
      codeVersion: CODE_VERSION,
      keyDiagnostics: {
        source: a.source,
        isBase64: a.isBase64,
        isPem: a.isPem,
        length: a.length,
        kidSuffix: kid ? kid.slice(-6) : null,
      },
      cors: {
        configuredAllowedOrigins: allowed,
        sampleCheck: {
          apexAllowed: isOriginAllowed('https://foodyepay.com'),
          wwwAllowed: isOriginAllowed('https://www.foodyepay.com'),
        }
      }
    });
  }
  if (url.searchParams.get('verify') === 'ed25519') {
    const raw = getEnv('CDP_API_PRIVATE_KEY');
    const a = analyzeKey(raw);
    if (!a.isBase64 || !a.normalized) {
      return NextResponse.json({ status: 'bad-key', reason: 'not-base64' }, { status: 400 });
    }
    try {
      const buf = Buffer.from(a.normalized, 'base64');
      let match = false;
      if (buf.length >= 32) {
        const seed = buf.subarray(0, 32);
        const kp = nacl.sign.keyPair.fromSeed(seed);
        if (buf.length >= 64) {
          const pubGiven = buf.subarray(32, 64);
          match = Buffer.compare(Buffer.from(kp.publicKey), Buffer.from(pubGiven)) === 0;
        }
      }
      return NextResponse.json({ status: 'ok', decodedLen: buf.length, pubMatchesDerived: match });
    } catch (e: any) {
      return NextResponse.json({ status: 'error', message: e?.message || String(e) }, { status: 500 });
    }
  }
  return NextResponse.json({ status: 'ok' });
}

// Preflight CORS handler
export async function OPTIONS(req: Request) {
  const origin = extractOrigin(req);
  const allowed = isOriginAllowed(origin);
  const corsHeaders = buildCorsHeaders(origin);
  if (!allowed) {
    return new NextResponse(null, { status: 204 }); // silently ignore for disallowed origins
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
