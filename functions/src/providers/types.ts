import type { KoiCitation, KoiLearnerContext } from '../../../shared/koi/contracts.js';
import type { KoiProviderCapacitySnapshot } from '../../../src/features/koi-sensei/api/quotaPolicy.js';

export type KoiProviderCitation = KoiCitation;

export interface KoiProviderAnswerInput {
  question: string;
  learnerContext: KoiLearnerContext | null;
  approvedMemories: ReadonlyArray<{
    category: 'goal' | 'preference' | 'recurring_mistake' | 'useful_phrase';
    text: string;
  }>;
}

export interface KoiProviderAnswer {
  status: 'answered' | 'out_of_scope' | 'not_grounded';
  text: string;
  spokenText: string;
  expression: 'base' | 'happy' | 'thinking' | 'celebrate' | 'encourage';
  citations: KoiProviderCitation[];
}

export interface KoiProviderTtsCapacitySnapshot {
  remainingCharacters: number;
  fetchedAtMs: number;
  retryAtMs?: number;
}

export interface KoiProviderCapacityBundle {
  chat: KoiProviderCapacitySnapshot;
  tts: KoiProviderTtsCapacitySnapshot;
  fetchedAtMs: number;
}

export interface KoiProviderAudio {
  audioUrl: string;
  expiresAtMs: number;
}

export interface KoiProvider {
  readonly mode: 'mock' | 'live';
  /**
   * Returns a deterministic, no-provider answer when a question must fail
   * closed. A null result means the question may proceed to allowance checks
   * and the shared provider lease.
   */
  preflightAnswer(question: string): KoiProviderAnswer | null;
  /** One shared Token Plan remains request supplies both chat and TTS capacity. */
  getCapacityBundle(nowMs: number): Promise<KoiProviderCapacityBundle>;
  answer(input: KoiProviderAnswerInput): Promise<KoiProviderAnswer>;
  synthesize(text: string, nowMs: number): Promise<KoiProviderAudio>;
}
