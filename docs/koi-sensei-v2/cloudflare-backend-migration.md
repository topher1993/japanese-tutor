# Cloudflare Koi backend migration

This migration is active for personal live mode. It keeps the existing Koi
callable contracts while moving their server authority off Firebase Functions.
The mobile app calls one authenticated Worker endpoint, and the Worker routes
stateful operations to Durable Objects.

## Request boundary

`POST /v1/koi/:callableName` accepts the existing callable payload and a
Firebase ID token in `Authorization: Bearer`. The Worker verifies the token's
signature, issuer, audience, expiry, and subject before dispatching.

The MiniMax Token Plan key is a Worker secret only. No pay-as-you-go key,
Credits fallback, or client credential is supported.

## Durable Object layout

- `KoiUserObject(userId)`: registration, consent epochs, retention, memories,
  presentation, learning-context high-water marks, and per-user allowance use.
- `KoiGlobalObject("global")`: active-account admission (maximum 50), provider
  semaphore (maximum two), capacity snapshot, and kill switch.

All mutations are persisted before responses are returned. Chat records are
automatically deleted after 30 days and capped at 200 messages per user.

## Implemented migration order

1. Implement token verification and callable dispatch with deterministic
   validation against `shared/koi/contracts.ts`.
2. Implement registration, consent, allowance, and pet-presentation methods.
3. Implement chat with the global two-call semaphore, MiniMax remains check,
   personal-unlimited or future metered allowance mode, and fail-closed provider
   errors.
4. Implement memory, export/deletion, reporting, and retention alarms.
5. Add the mobile transport adapter and keep the mock transport as the default.
6. Run Worker unit tests, Firebase-independent integration tests, and a single
   personal beta request before enabling any wider account admission.

## Cost guard

Cloudflare free-tier exhaustion must reject requests. The Worker never changes
providers or creates paid resources automatically. `KOI_ACTIVE_ACCOUNT_LIMIT`
remains 50 for future beta expansion, while personal mode admits only the
owner's Firebase subject until an explicit beta switch is enabled.

`KOI_USAGE_MODE=personal_unlimited` removes Koi's app-level per-user counters;
it does not make the MiniMax subscription unlimited. Stale or exhausted Token
Plan capacity, the kill switch, and the two-request semaphore still reject
calls. Set `KOI_USAGE_MODE=metered` before any approved multi-user rollout.
