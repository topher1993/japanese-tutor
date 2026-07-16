import { describe, expect, it } from 'vitest';

import { requireKoiCaller } from '../src/auth.js';
import { KOI_EMAIL_LINK_AUTH_CLAIM } from '../src/auth.js';
import { decideKoiAdmission } from '../src/store.js';

describe('Koi beta admission', () => {
  it('admits exactly the first 50 active users and waitlists the next', () => {
    expect(decideKoiAdmission(null, 49)).toEqual({ status: 'active', incrementActiveCount: true });
    expect(decideKoiAdmission(null, 50)).toEqual({ status: 'waitlisted', incrementActiveCount: false });
  });

  it('does not double-count an active user and promotes a retrying waitlisted user when a seat opens', () => {
    expect(decideKoiAdmission('active', 50)).toEqual({ status: 'active', incrementActiveCount: false });
    expect(decideKoiAdmission('waitlisted', 49)).toEqual({ status: 'active', incrementActiveCount: true });
  });
});

describe('Koi callable identity', () => {
  it('accepts only a verified email-link identity', () => {
    expect(requireKoiCaller({
      auth: {
        uid: 'learner-1',
        token: {
          email: 'learner@example.test',
          email_verified: true,
          firebase: { sign_in_provider: 'password' },
          [KOI_EMAIL_LINK_AUTH_CLAIM]: true,
        },
      },
    })).toBe('learner-1');
  });

  it('rejects missing, unverified, and non-email-link identities', () => {
    expect(() => requireKoiCaller({})).toThrow(/email link/i);
    expect(() => requireKoiCaller({
      auth: { uid: 'u', token: { email: 'x@example.test', email_verified: false } },
    })).toThrow(/verified/i);
    expect(() => requireKoiCaller({
      auth: {
        uid: 'u',
        token: {
          email: 'x@example.test',
          email_verified: true,
          firebase: { sign_in_provider: 'google.com' },
        },
      },
    })).toThrow(/email-link/i);
    expect(() => requireKoiCaller({
      auth: {
        uid: 'u',
        token: {
          email: 'x@example.test',
          email_verified: true,
          firebase: { sign_in_provider: 'password' },
        },
      },
    })).toThrow(/email-link verified/i);
  });
});
