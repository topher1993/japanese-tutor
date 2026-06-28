import { describe, expect, it } from 'vitest';
import {
  getExternalBetaFeedbackFormAccess,
  isGoogleFormsResponderUrl,
} from '../src/services/externalBetaFeedbackFormService';

describe('Phase 17B external beta feedback form access', () => {
  it('exposes the live Google Form responder URL for beta testers', () => {
    const access = getExternalBetaFeedbackFormAccess();

    expect(access.label).toBe('Open full beta tester form');
    expect(access.url).toBe('https://docs.google.com/forms/d/e/1FAIpQLScU5_buXQqNTOvhqerBUqPZkbqZ3EPXJBIvo-TkzDM7KMcSmQ/viewform');
    expect(isGoogleFormsResponderUrl(access.url)).toBe(true);
  });

  it('explains screenshot fallback when Google file upload is not available in-app', () => {
    const access = getExternalBetaFeedbackFormAccess();

    expect(access.helperText).toContain('screenshots');
    expect(access.helperText).toContain('send screenshots directly');
  });
});
