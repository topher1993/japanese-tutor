import { KoiBackendError } from './errors.js';

export const KOI_EMAIL_LINK_AUTH_CLAIM = 'koi_email_link_verified' as const;

interface KoiCallableAuth {
  uid: string;
  token: Record<string, unknown>;
}

export interface KoiCallableIdentityInput {
  auth?: KoiCallableAuth | null;
}

export function requireKoiCaller(request: KoiCallableIdentityInput): string {
  const auth = request.auth;
  if (!auth?.uid) {
    throw new KoiBackendError('AUTH_REQUIRED', 'Sign in with an email link to use Koi Sensei.');
  }
  if (typeof auth.token.email !== 'string' || auth.token.email_verified !== true) {
    throw new KoiBackendError('AUTH_REQUIRED', 'A verified email-link account is required.');
  }
  const provider = auth.token.firebase;
  const signInProvider = typeof provider === 'object' && provider !== null && 'sign_in_provider' in provider
    ? (provider as { sign_in_provider?: unknown }).sign_in_provider
    : null;
  if (signInProvider !== 'password') {
    throw new KoiBackendError('AUTH_REQUIRED', 'Koi Sensei beta currently supports email-link sign-in only.');
  }
  // Firebase reports both password and email-link sessions as the `password`
  // provider. A trusted Auth/admin flow must stamp this custom claim; accepting
  // the provider claim alone would silently admit ordinary password accounts.
  if (auth.token[KOI_EMAIL_LINK_AUTH_CLAIM] !== true) {
    throw new KoiBackendError('AUTH_REQUIRED', 'An email-link verified Koi session is required.');
  }
  return auth.uid;
}
