export interface Env {
  MINIMAX_TOKEN_PLAN_KEY: string;
  FIREBASE_PROJECT_ID: string;
  KOI_DAILY_REQUEST_LIMIT?: string;
}

let keyCache: { expiresAt: number; keys: Record<string, JsonWebKey> } | undefined;

async function firebaseKeySet(): Promise<Record<string, JsonWebKey>> {
  if (keyCache && keyCache.expiresAt > Date.now()) return keyCache.keys;
  const response = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!response.ok) throw new Error('firebase_keys_unavailable');
  const keys = await response.json() as { keys: Array<JsonWebKey & { kid?: string }> };
  const mapped = Object.fromEntries(keys.keys.filter((key) => key.kid).map((key) => [key.kid as string, key]));
  keyCache = { expiresAt: Date.now() + 3_600_000, keys: mapped };
  return mapped;
}

const base64UrlBytes = (value: string) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), (char) => char.charCodeAt(0));

async function verifyFirebaseToken(request: Request, projectId: string): Promise<boolean> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return false;
  const token = authorization.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const header = JSON.parse(new TextDecoder().decode(base64UrlBytes(parts[0]))) as { alg?: string; kid?: string };
    const payload = JSON.parse(new TextDecoder().decode(base64UrlBytes(parts[1]))) as { aud?: string; iss?: string; sub?: string; exp?: number; iat?: number };
    if (header.alg !== 'RS256' || !header.kid || payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}` || !payload.sub || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return false;
    const jwk = (await firebaseKeySet())[header.kid];
    if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    return crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, key, base64UrlBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  } catch { return false; }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/chat') return json({ error: 'not_found' }, 404);
    if (!env.MINIMAX_TOKEN_PLAN_KEY || !env.FIREBASE_PROJECT_ID) return json({ error: 'provider_not_configured' }, 503);
    if (!(await verifyFirebaseToken(request, env.FIREBASE_PROJECT_ID))) return json({ error: 'unauthorized' }, 401);

    let body: Record<string, unknown>;
    try { body = await request.json() as Record<string, unknown>; } catch { return json({ error: 'invalid_json' }, 400); }
    if (!Array.isArray(body.messages) || body.messages.length === 0) return json({ error: 'messages_required' }, 400);

    const upstream = await fetch('https://api.minimax.io/anthropic/v1/messages', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.MINIMAX_TOKEN_PLAN_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'MiniMax-M2.7', max_tokens: 800, messages: body.messages }),
    });
    const response = new Response(upstream.body, { status: upstream.status, headers: { 'content-type': 'application/json; charset=utf-8' } });
    return response;
  },
};
