import type { KoiAnswer, KoiGateway } from '../api/gateway';
import { createKoiUuid } from '../api/uuid';
import type { KoiCachedChatMessageV1, KoiSenseiRepository } from './koiSenseiRepository';

export interface KoiLocalChatOptions {
  repository: KoiSenseiRepository;
  gateway: KoiGateway;
  createId?: () => string;
  now?: () => number;
}

export interface KoiLocalChatResult {
  answer: KoiAnswer;
  userMessage: KoiCachedChatMessageV1;
  assistantMessage: KoiCachedChatMessageV1;
}

/**
 * Sends text through the validating gateway, then atomically persists only the
 * allowlisted user message and validated assistant response/source ids.
 */
export async function askAndPersistKoi(
  options: KoiLocalChatOptions,
  textValue: string,
): Promise<KoiLocalChatResult> {
  const createId = options.createId ?? createKoiUuid;
  const now = options.now ?? Date.now;
  const text = textValue.trim();
  const priorState = await options.repository.load();
  const conversationId = priorState.messages.at(-1)?.conversationId ?? createId();
  const requestId = createId();
  const userMessageId = createId();
  const answer = await options.gateway.ask({ requestId, conversationId, text });
  const completedAt = now();
  const assistantCreatedAt = Math.min(answer.assistantMessage.createdAtMs, completedAt);
  const userCreatedAt = Math.max(0, assistantCreatedAt - 1);

  const userMessage: KoiCachedChatMessageV1 = {
    schemaVersion: 1,
    id: userMessageId,
    conversationId,
    role: 'user',
    text,
    sourceIds: [],
    createdAt: userCreatedAt,
  };
  const assistantMessage: KoiCachedChatMessageV1 = {
    schemaVersion: 1,
    id: answer.assistantMessage.id,
    conversationId,
    role: 'assistant',
    text: answer.assistantMessage.text,
    spokenText: answer.assistantMessage.spokenText,
    expression: answer.assistantMessage.expression,
    sourceIds: answer.citations.map(citation => citation.sourceId),
    createdAt: assistantCreatedAt,
  };
  await options.repository.appendMessages([userMessage, assistantMessage]);
  await options.repository.saveDraft('');
  return { answer, userMessage, assistantMessage };
}
