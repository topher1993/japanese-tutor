import { describe, expect, it } from 'vitest';
import { createAppSearchParams } from '../src/services/queryParamService';

describe('native-safe app query params', () => {
  it('returns empty params when native window has no location', () => {
    const params = createAppSearchParams({} as Window);

    expect(params.get('skipOnboarding')).toBeNull();
  });

  it('reads web query params when location.search exists', () => {
    const params = createAppSearchParams({ location: { search: '?skipOnboarding=1&tab=Progress' } } as Window);

    expect(params.get('skipOnboarding')).toBe('1');
    expect(params.get('tab')).toBe('Progress');
  });
});
