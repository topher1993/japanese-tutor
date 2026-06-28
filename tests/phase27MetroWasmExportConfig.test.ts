import { describe, expect, it } from 'vitest';

describe('Phase 27 Metro wasm export config', () => {
  it('registers wasm as a Metro asset extension for expo-sqlite web export', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require('../metro.config.js');
    expect(config.resolver.assetExts).toContain('wasm');
  });
});
