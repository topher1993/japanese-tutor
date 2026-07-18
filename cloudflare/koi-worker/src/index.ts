export interface Env {
  MINIMAX_TOKEN_PLAN_KEY: string;
  KOI_ACCESS_TOKEN: string;
  KOI_DAILY_REQUEST_LIMIT?: string;
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
    if (!env.MINIMAX_TOKEN_PLAN_KEY || !env.KOI_ACCESS_TOKEN) return json({ error: 'provider_not_configured' }, 503);
    if (request.headers.get('authorization') !== `Bearer ${env.KOI_ACCESS_TOKEN}`) return json({ error: 'unauthorized' }, 401);

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
