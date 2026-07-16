import type { KoiBackendConfig } from '../config.js';
import { MiniMaxTokenPlanProvider } from './minimaxProvider.js';
import { MockKoiProvider } from './mockProvider.js';
import type { KoiProvider } from './types.js';

export function createKoiProvider(
  config: KoiBackendConfig,
  getTokenPlanKey: () => string,
  fetchImpl: typeof fetch = fetch,
): KoiProvider {
  if (config.providerMode === 'mock') return new MockKoiProvider(config.mockRemainingPercent);
  return new MiniMaxTokenPlanProvider(config, getTokenPlanKey, fetchImpl);
}

export * from './minimaxProvider.js';
export * from './mockProvider.js';
export * from './groundingRegistry.js';
export * from './types.js';
