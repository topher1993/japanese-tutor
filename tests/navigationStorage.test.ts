import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/app/onboardingStorage', () => ({
  openOnboardingStorage: vi.fn(),
}));

import { createInMemoryKeyValueStorage } from '../src/services/keyValueStorage';
import { createNavigationStateStore } from '../src/app/navigationStorage';

describe('navigation state persistence', () => {
  it('defaults to Home when no route has been saved', async () => {
    const store = createNavigationStateStore(createInMemoryKeyValueStorage());
    await expect(store.load()).resolves.toEqual({ showDailyRush: false });
  });

  it('restores and clears the Daily Rush route', async () => {
    const store = createNavigationStateStore(createInMemoryKeyValueStorage());

    await store.save({ showDailyRush: true });
    await expect(store.load()).resolves.toEqual({ showDailyRush: true });

    await store.save({ showDailyRush: false });
    await expect(store.load()).resolves.toEqual({ showDailyRush: false });
  });
});
