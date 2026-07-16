import type { KoiAllowanceGrantV1 } from '../../src/features/koi-sensei/api/quotaPolicy.js';

export type KoiAllowanceRefreshDecision =
  | { kind: 'cached'; grant: KoiAllowanceGrantV1 }
  | { kind: 'reserved'; ownerToken: string; expiresAtMs: number }
  | { kind: 'in_progress'; retryAtMs: number };

export interface KoiAllowanceRefreshState {
  grant: KoiAllowanceGrantV1 | null;
  lastRefreshAtMs: number | null;
  refreshOwnerToken: string | null;
  refreshExpiresAtMs: number | null;
}

export function decideKoiAllowanceRefresh(
  state: KoiAllowanceRefreshState,
  ownerToken: string,
  nowMs: number,
  cooldownMs: number,
  refreshLeaseMs: number,
): KoiAllowanceRefreshDecision {
  const usableGrant = state.grant && state.grant.expiresAtMs > nowMs ? state.grant : null;
  if (
    usableGrant
    && state.lastRefreshAtMs !== null
    && state.lastRefreshAtMs + cooldownMs > nowMs
  ) return { kind: 'cached', grant: usableGrant };

  if (
    state.refreshOwnerToken
    && state.refreshExpiresAtMs !== null
    && state.refreshExpiresAtMs > nowMs
  ) {
    // An already-issued grant is safe to return while one request refreshes it.
    if (usableGrant) return { kind: 'cached', grant: usableGrant };
    return { kind: 'in_progress', retryAtMs: state.refreshExpiresAtMs };
  }

  return { kind: 'reserved', ownerToken, expiresAtMs: nowMs + refreshLeaseMs };
}

export function ownsKoiAllowanceRefresh(
  state: Pick<KoiAllowanceRefreshState, 'refreshOwnerToken'>,
  ownerToken: string,
): boolean {
  return state.refreshOwnerToken === ownerToken;
}
