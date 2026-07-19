import { DurableObject } from 'cloudflare:workers';

export interface Env {
  MINIMAX_TOKEN_PLAN_KEY: string;
  FIREBASE_PROJECT_ID: string;
  KOI_DAILY_REQUEST_LIMIT?: string;
  KOI_USER: DurableObjectNamespace<KoiUserObject>;
  KOI_GLOBAL: DurableObjectNamespace<KoiGlobalObject>;
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

async function verifyFirebaseToken(request: Request, projectId: string): Promise<string | null> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(base64UrlBytes(parts[0]))) as { alg?: string; kid?: string };
    const payload = JSON.parse(new TextDecoder().decode(base64UrlBytes(parts[1]))) as { aud?: string; iss?: string; sub?: string; exp?: number; iat?: number };
    if (header.alg !== 'RS256' || !header.kid || payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}` || !payload.sub || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    const jwk = (await firebaseKeySet())[header.kid];
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, key, base64UrlBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`)) ? payload.sub : null;
  } catch { return null; }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

async function providerCapacity(key: string): Promise<{ remaining: number; band: 'high' | 'normal' | 'low' | 'critical' }> {
  const response = await fetch('https://www.minimax.io/v1/token_plan/remains', { headers: { authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error('capacity_unavailable');
  const value = await response.json() as Record<string, unknown>;
  const candidates = [value.remaining, value.remaining_requests, value.remainingRequests, value.quotaRemaining].filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
  const remaining = candidates[0];
  if (remaining === undefined || remaining < 0) throw new Error('capacity_unreadable');
  return { remaining, band: remaining <= 0 ? 'critical' : remaining <= 2 ? 'low' : remaining <= 5 ? 'normal' : 'high' };
}

export class KoiUserObject extends DurableObject<Env> {
  private ready: Promise<void>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ready = ctx.blockConcurrencyWhile(async () => {
      await ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS koi_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    });
  }

  private async state(): Promise<Record<string, unknown>> {
    await this.ready;
    const row = this.ctx.storage.sql.exec<{ value: string }>('SELECT value FROM koi_state WHERE key = ?', 'state').one();
    return row ? JSON.parse(row.value) as Record<string, unknown> : {};
  }

  private async save(value: Record<string, unknown>): Promise<void> {
    await this.ready;
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO koi_state (key, value) VALUES (?, ?)', 'state', JSON.stringify(value));
  }

  async dispatch(name: string, payload: Record<string, unknown>): Promise<unknown> {
    const state = await this.state();
    const now = Date.now();
    if (name === 'submitQuizAnswer') {
      const bank: Record<string, { answer: string; domain: string; rank: string }> = {
        'n5-grammar-001': { answer: 'B', domain: 'grammar', rank: 'N5' },
        'n5-vocabulary-001': { answer: 'A', domain: 'vocabulary', rank: 'N5' },
        'n5-phrases-001': { answer: 'C', domain: 'phrases', rank: 'N5' },
        'n5-quiz-001': { answer: 'A', domain: 'quizzes', rank: 'N5' },
        'n4-grammar-001': { answer: 'C', domain: 'grammar', rank: 'N4' },
        'n4-vocabulary-001': { answer: 'B', domain: 'vocabulary', rank: 'N4' },
        'n4-phrases-001': { answer: 'A', domain: 'phrases', rank: 'N4' },
        'n4-quiz-001': { answer: 'C', domain: 'quizzes', rank: 'N4' },
      };
      const question = bank[String(payload.questionId)];
      if (!question || question.domain !== payload.domain || question.rank !== payload.rank) return { error: 'invalid_question' };
      const correct = String(payload.answer).toUpperCase() === question.answer;
      const evidence = (state.evidence as Record<string, number> | undefined) ?? {};
      const key = `${question.rank}:${question.domain}`;
      if (correct) evidence[key] = Number(evidence[key] ?? 0) + 1;
      state.evidence = evidence;
      await this.save(state);
      const practiceStars = Math.min(8, Math.floor(Number(evidence[key] ?? 0) / 1));
      const cosmeticByKey: Record<string, string> = {
        'N5:vocabulary': 'mastery-n5-vocabulary-sakura-pin',
        'N5:grammar': 'mastery-n5-grammar-reading-glasses',
        'N5:phrases': 'mastery-n5-phrases-scroll-case',
        'N5:quizzes': 'mastery-n5-quizzes-vocab-card-fan',
        'N4:vocabulary': 'mastery-n4-vocabulary-koi-fin-crest',
        'N4:grammar': 'mastery-n4-grammar-blue-reading-lens',
        'N4:phrases': 'mastery-n4-phrases-koinobori-banner',
        'N4:quizzes': 'mastery-n4-quizzes-folding-fan',
      };
      const unlockedCosmeticIds = practiceStars >= 8 && cosmeticByKey[key] ? [cosmeticByKey[key]] : [];
      return { schemaVersion: 1, requestId: payload.requestId, questionId: payload.questionId, correct, evidenceCount: Number(evidence[key] ?? 0), practiceStars, masteryStars: practiceStars >= 8 ? 1 : 0, unlockedCosmeticIds, serverTimeMs: now };
    }
    if (name === 'completeKoiRegistration') {
      state.registration = { ageBand: payload.ageBand, aiPolicyVersion: payload.aiPolicyVersion, privacyPolicyVersion: payload.privacyPolicyVersion, supportLanguage: payload.supportLanguage, consentedAtMs: now };
      await this.save(state);
      return { schemaVersion: 1, status: 'active', activeAccountLimit: 50, aiPolicyVersion: payload.aiPolicyVersion, privacyPolicyVersion: payload.privacyPolicyVersion, consentedAtMs: now, serverTimeMs: now };
    }
    if (name === 'revokeKoiConsent') {
      state.revokedAtMs = now;
      await this.save(state);
      return { schemaVersion: 1, requestId: payload.requestId, revoked: true, serverTimeMs: now };
    }
    if (name === 'setKoiDetailedProgressConsent') {
      const enabled = payload.enabled === true;
      state.detailedProgress = enabled ? { enabled: true, policyVersion: payload.policyVersion, grantedAtMs: now } : { enabled: false, policyVersion: null, grantedAtMs: now };
      await this.save(state);
      return { schemaVersion: 1, requestId: payload.requestId, enabled, policyVersion: enabled ? payload.policyVersion : null, serverTimeMs: now };
    }
    if (name === 'syncKoiPetPresentation') {
      const current = state.presentation as { revision?: number } | undefined;
      const incoming = payload.presentation as { revision?: number } | undefined;
      const revision = Number(incoming?.revision ?? 0);
      if (!current || revision >= Number(current.revision ?? 0)) { state.presentation = incoming; await this.save(state); }
      return { schemaVersion: 1, requestId: payload.requestId, acceptedRevision: Math.max(Number(current?.revision ?? 0), revision), serverTimeMs: now };
    }
    if (name === 'syncKoiLearningContext') {
      const context = payload.context as { revision?: number; consentVersion?: string } | undefined;
      const detailed = state.detailedProgress as { enabled?: boolean; policyVersion?: string } | undefined;
      if (!detailed?.enabled || detailed.policyVersion !== context?.consentVersion) return { error: 'detailed_progress_consent_required' };
      const current = state.learnerContext as { revision?: number } | undefined;
      const revision = Number(context?.revision ?? 0);
      if (!current || revision >= Number(current.revision ?? 0)) { state.learnerContext = context; await this.save(state); }
      return { schemaVersion: 1, requestId: payload.requestId, acceptedRevision: Math.max(Number(current?.revision ?? 0), revision), serverTimeMs: now };
    }
    if (name === 'getKoiAllowance') {
      if (state.revokedAtMs) return { schemaVersion: 1, requestId: payload.requestId, allowance: { schemaVersion: 1, grantedAtMs: now, expiresAtMs: now, chatLimit: 0, chatUsed: 0, voiceLimit: 0, voiceUsed: 0, capacityBand: 'paused' }, serverTimeMs: now };
      const windowStart = Number(state.allowanceWindowStartMs ?? now);
      const used = Number(state.chatUsed ?? 0);
      const activeWindow = now - windowStart < 5 * 60 * 60 * 1_000;
      const chatUsed = activeWindow ? used : 0;
      if (!activeWindow) { state.allowanceWindowStartMs = now; state.chatUsed = 0; await this.save(state); }
      return { schemaVersion: 1, requestId: payload.requestId, allowance: { schemaVersion: 1, grantedAtMs: now, expiresAtMs: (activeWindow ? windowStart : now) + 5 * 60 * 60 * 1_000, chatLimit: 12, chatUsed, voiceLimit: 4, voiceUsed: 0, capacityBand: 'normal' }, serverTimeMs: now };
    }
    if (name === 'askKoiSensei') {
      const windowStart = Number(state.allowanceWindowStartMs ?? now);
      const activeWindow = now - windowStart < 5 * 60 * 60 * 1_000;
      const chatUsed = activeWindow ? Number(state.chatUsed ?? 0) : 0;
      if (chatUsed >= 12) return { error: 'chat_allowance_exhausted' };
      return { allowed: true, chatUsed, windowStart };
    }
    if (name === 'synthesizeKoiReply') {
      const messages = Array.isArray(state.messages) ? state.messages : [];
      const message = messages.find((item) => (item as { id?: unknown }).id === payload.assistantMessageId) as { text?: string } | undefined;
      const now = Date.now();
      const allowance = { schemaVersion: 1, grantedAtMs: now, expiresAtMs: now + 5 * 60 * 60 * 1_000, chatLimit: 12, chatUsed: Number(state.chatUsed ?? 0), voiceLimit: 4, voiceUsed: 0, capacityBand: 'normal' };
      return { schemaVersion: 1, requestId: payload.requestId, status: 'system_voice_fallback', reason: 'PROVIDER_UNAVAILABLE', spokenText: String(message?.text ?? '').slice(0, 240), dailyCharacterRemaining: 4_000, allowance };
    }
    if (name === 'recordKoiChat') {
      const windowStart = Number(state.allowanceWindowStartMs ?? now);
      const activeWindow = now - windowStart < 5 * 60 * 60 * 1_000;
      state.allowanceWindowStartMs = activeWindow ? windowStart : now;
      state.chatUsed = (activeWindow ? Number(state.chatUsed ?? 0) : 0) + 1;
      const messages = Array.isArray(state.messages) ? state.messages : [];
      messages.push(payload.message);
      state.messages = messages.slice(-200);
      await this.save(state);
      return { ok: true };
    }
    if (name === 'upsertKoiMemory') {
      const memories = Array.isArray(state.memories) ? state.memories.filter((item) => (item as { id?: unknown }).id !== payload.memoryId) : [];
      const memory = { id: payload.memoryId, category: payload.category, text: payload.text, createdAtMs: now, updatedAtMs: now };
      memories.push(memory);
      state.memories = memories.slice(-20);
      await this.save(state);
      return { schemaVersion: 1, requestId: payload.requestId, memoryId: payload.memoryId, stored: true, serverTimeMs: now };
    }
    if (name === 'deleteKoiMemory') {
      state.memories = (Array.isArray(state.memories) ? state.memories : []).filter((item) => (item as { id?: unknown }).id !== payload.memoryId);
      await this.save(state);
      return { schemaVersion: 1, requestId: payload.requestId, memoryId: payload.memoryId, deleted: true, serverTimeMs: now };
    }
    if (name === 'reportKoiMessage') {
      const reports = Array.isArray(state.reports) ? state.reports : [];
      reports.push({ id: crypto.randomUUID(), messageId: payload.messageId, reason: payload.reason, ...(payload.note ? { note: payload.note } : {}), createdAtMs: now });
      state.reports = reports.slice(-200);
      await this.save(state);
      return { schemaVersion: 1, requestId: payload.requestId, accepted: true, serverTimeMs: now };
    }
    if (name === 'exportKoiData') {
      return { schemaVersion: 1, requestId: payload.requestId, exportedAtMs: now, registration: state.registration ?? null, learnerContext: state.learnerContext ?? null, messages: Array.isArray(state.messages) ? state.messages.slice(-200) : [], memories: Array.isArray(state.memories) ? state.memories.slice(-20) : [], reports: Array.isArray(state.reports) ? state.reports.slice(-200) : [] };
    }
    if (name === 'deleteKoiData') {
      await this.ctx.storage.sql.exec('DELETE FROM koi_state WHERE key = ?', 'state');
      return { schemaVersion: 1, requestId: payload.requestId, deleted: true, serverTimeMs: now };
    }
    return { error: 'not_implemented' };
  }

  async fetch(request: Request): Promise<Response> {
    const body = await request.json() as { name?: string; payload?: Record<string, unknown> };
    return Response.json(await this.dispatch(body.name ?? '', body.payload ?? {}));
  }
}

export class KoiGlobalObject extends DurableObject<Env> {
  private ready: Promise<void>;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ready = ctx.blockConcurrencyWhile(async () => {
      await ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS semaphore (key TEXT PRIMARY KEY, held INTEGER NOT NULL)');
    });
  }
  async acquire(): Promise<boolean> {
    await this.ready;
    const held = Number(this.ctx.storage.sql.exec<{ held: number }>('SELECT held FROM semaphore WHERE key = ?', 'provider').one()?.held ?? 0);
    if (held >= 2) return false;
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO semaphore (key, held) VALUES (?, ?)', 'provider', held + 1);
    return true;
  }
  async release(): Promise<void> {
    await this.ready;
    const held = Number(this.ctx.storage.sql.exec<{ held: number }>('SELECT held FROM semaphore WHERE key = ?', 'provider').one()?.held ?? 0);
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO semaphore (key, held) VALUES (?, ?)', 'provider', Math.max(0, held - 1));
  }
  async fetch(request: Request): Promise<Response> { return Response.json({ ok: true }); }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (request.method !== 'POST') return json({ error: 'not_found' }, 404);
    if (!env.MINIMAX_TOKEN_PLAN_KEY || !env.FIREBASE_PROJECT_ID) return json({ error: 'provider_not_configured' }, 503);
    const userId = await verifyFirebaseToken(request, env.FIREBASE_PROJECT_ID);
    if (!userId) return json({ error: 'unauthorized' }, 401);

    const pathname = new URL(request.url).pathname;
    if (pathname === '/v1/koi/quiz/submit') {
      const body = await request.json() as Record<string, unknown>;
      const result = await env.KOI_USER.getByName(userId).dispatch('submitQuizAnswer', body);
      return json(result, (result as { error?: string }).error ? 400 : 200);
    }
    if (pathname.startsWith('/v1/koi/')) {
      const name = pathname.slice('/v1/koi/'.length);
      const body = await request.json() as Record<string, unknown>;
      const stub = env.KOI_USER.getByName(userId);
      if (name === 'askKoiSensei') {
        const gate = await stub.dispatch(name, body);
        if ((gate as { error?: string }).error === 'chat_allowance_exhausted') return json({ error: 'chat_allowance_exhausted' }, 429);
        const global = env.KOI_GLOBAL.getByName('global');
        if (!await global.acquire()) return json({ error: 'provider_busy' }, 429);
        try {
          let capacity: { remaining: number; band: 'high' | 'normal' | 'low' | 'critical' };
          try { capacity = await providerCapacity(env.MINIMAX_TOKEN_PLAN_KEY); } catch { return json({ error: 'capacity_stale' }, 503); }
          if (capacity.remaining <= 0) return json({ error: 'token_plan_exhausted' }, 429);
          const text = String(body.text ?? '').trim();
          if (!text || text.length > 2_000) return json({ error: 'invalid_request' }, 400);
          const upstream = await fetch('https://api.minimax.io/anthropic/v1/messages', { method: 'POST', headers: { authorization: `Bearer ${env.MINIMAX_TOKEN_PLAN_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: 'MiniMax-M2.7', max_tokens: 800, messages: [{ role: 'user', content: text }] }) });
          if (!upstream.ok) return json({ error: 'provider_unavailable' }, 503);
          const result = await upstream.json() as { content?: Array<{ type?: string; text?: string }> };
          const answerText = result.content?.find((part) => part.type === 'text')?.text?.trim();
          if (!answerText) return json({ error: 'provider_unavailable' }, 503);
          const now = Date.now();
          const assistantId = crypto.randomUUID();
          await stub.dispatch('recordKoiChat', { message: { id: assistantId, conversationId: body.conversationId, role: 'assistant', text: answerText, createdAtMs: now } });
          return json({ schemaVersion: 1, status: 'answered', requestId: body.requestId, assistantMessage: { id: assistantId, conversationId: body.conversationId, text: answerText, spokenText: answerText.slice(0, 240), expression: 'base', createdAtMs: now }, citations: [], allowance: { schemaVersion: 1, grantedAtMs: now, expiresAtMs: now + 5 * 60 * 60 * 1_000, chatLimit: 12, chatUsed: Number((gate as { chatUsed?: number }).chatUsed ?? 0) + 1, voiceLimit: 4, voiceUsed: 0, capacityBand: capacity.band } });
        } finally { await global.release(); }
      }
      const response = await stub.dispatch(name, body);
      return json(response, (response as { error?: string }).error === 'not_implemented' ? 501 : 200);
    }
    if (pathname !== '/chat') return json({ error: 'not_found' }, 404);

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
