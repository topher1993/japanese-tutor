import { KoiBackendError } from '../errors.js';
import type { KoiProvider, KoiProviderAnswer, KoiProviderAnswerInput } from './types.js';

const stableHash = (value: string): number => {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const previewAnswers = [
  'Let’s break that Japanese question into one small step. Start by identifying the topic, then the particle, then the action.',
  'A useful study move is to say the sentence once slowly, check the particle, and repeat it at natural speed.',
  'Try making one short example of your own. Koi Sensei can help you compare the meaning and grammar pattern.',
] as const;

export class MockKoiProvider implements KoiProvider {
  readonly mode = 'mock' as const;

  constructor(private readonly remainingPercent = 100) {}

  preflightAnswer(): null {
    return null;
  }

  async getCapacityBundle(nowMs: number) {
    return {
      chat: {
        rollingRemainingPercent: this.remainingPercent,
        weeklyRemainingPercent: this.remainingPercent,
        fetchedAtMs: nowMs,
      },
      tts: { remainingCharacters: 0, fetchedAtMs: nowMs },
      fetchedAtMs: nowMs,
    };
  }

  async answer(input: KoiProviderAnswerInput): Promise<KoiProviderAnswer> {
    const answer = previewAnswers[stableHash(input.question) % previewAnswers.length];
    return {
      status: 'answered',
      text: `[Preview brain] ${answer}`,
      spokenText: answer.slice(0, 240),
      expression: 'encourage',
      citations: [],
    };
  }

  async synthesize(): Promise<never> {
    throw new KoiBackendError('PROVIDER_UNAVAILABLE', 'Cloud speech is disabled in mock mode.');
  }
}
