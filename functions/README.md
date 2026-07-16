# Koi Sensei backend scaffold

This directory is an emulator-first Firebase Functions scaffold. It contains no
Firebase project credentials, MiniMax key, native Firebase configuration, or
deployment authorization.

## Zero-cost boundary

There is currently no honest cloud deployment that guarantees a hard `0` cost:

- Firebase Functions deployment requires the Blaze billing plan, and Firebase
  budget alerts do not stop spending.
- A MiniMax Subscription Key can use both Token Plan quota and attached Credits.
- MiniMax describes Token Plan as individual interactive use and applies traffic
  controls to multi-user sharing patterns.

For those reasons, development defaults to the deterministic mock provider and
production refuses mock mode. Live mode refuses to start unless all three
operator acknowledgements are explicitly `true`:

- `KOI_MINIMAX_MULTI_USER_APPROVED`: written MiniMax approval covers this capped
  50-user beta.
- `KOI_MINIMAX_NO_CREDITS_ATTACHED_ATTESTED`: the Subscription Key cannot draw
  from purchased/shared Credits.
- `KOI_FIREBASE_BILLING_RISK_APPROVED`: the owner accepts that Firebase Blaze has
  no hard cost cap, or the implementation has moved to a genuinely hard-capped
  host.

There is no pay-as-you-go fallback. Standard MiniMax/pay-go environment variable
names are rejected. The only accepted live credential name is
`MINIMAX_TOKEN_PLAN_KEY`, injected by Firebase Secret Manager.

## Safety invariants

- 50 active Koi accounts maximum; additional registrations are waitlisted.
- Two concurrent MiniMax calls maximum, enforced with Firestore leases.
- Registration accepts only the policy versions exported by
  `shared/koi/contracts.ts`. Every AI-data callable revalidates that server
  consent; `revokeKoiConsent` marks it revoked and clears Koi AI data before a
  learner can explicitly re-consent to the current versions.
- Registration, revocation, and detailed-progress consent mutations use an
  immutable per-user request ledger. Replayed IDs cannot mutate a newer consent
  generation. Chat/TTS reservations are also bound to that generation.
- Provider calls hold a short per-user consent-generation lease. Revocation
  blocks new leases, drains active calls, then advances the generation and
  deletes AI data.
- Detailed learning context is accepted only after the server records the
  current detailed-progress policy grant; client `consentVersion` values cannot
  create or extend that grant.
- Chat and TTS request IDs are bound to a SHA-256 payload fingerprint and a
  transaction-owned 90-second reservation. Only the current owner may complete
  or release a request after a retry takeover.
- Dynamic chat/voice allowances use the lower rolling/weekly capacity.
- One Firestore-backed 30-second capacity cache single-flights MiniMax remains
  checks across instances. Per-user allowance refreshes have a 10-second
  cooldown and an owned refresh lease.
- MiniMax M2.7 text and Speech 2.8 HD endpoints/models are pinned.
- Speech first checks fresh provider capacity and a conservative global rolling
  24-hour 4,000-character ledger. Insufficient or stale capacity returns a
  system-voice fallback without calling MiniMax.
- Chat retention is 30 days and 200 messages; memories are user-approved and
  capped at 20. Reports contain a message reference, reason, and optional note,
  not a duplicate of message content.
- Scheduled retention deletes in 450-document batches, continues across
  batches, and returns a continuation marker when an invocation reaches its
  bounded work limit.
- Firestore and Storage client rules deny all access. Callables require verified
  email-link authentication, the trusted `koi_email_link_verified` custom
  claim, and App Check. The claim must be issued by an authoritative Auth/admin
  flow; the standard `password` provider claim alone cannot distinguish an
  email link from an ordinary password session.
- No raw microphone audio is accepted or persisted.

## Local validation (after dependency install)

From the repository root:

```powershell
npm.cmd install --prefix functions
npm.cmd run typecheck --prefix functions
npm.cmd test --prefix functions
npm.cmd run build --prefix functions
```

Copy `functions/.env.example` to the ignored `functions/.env` before starting
the emulator. Keep mock mode enabled; no MiniMax key is needed.

With Java available, run the segregated rules integration suite (it starts and
stops only demo-project Firestore and Storage emulators):

```powershell
npm.cmd run test:rules:emulator --prefix functions
```

## Dependency release gate

The pinned `firebase-functions@7.2.5` supports `firebase-admin` only through
major 13. The current production-only audit therefore reports moderate
advisories in Admin SDK 13's transitive `uuid@9.0.1`; the automated force fix
would install incompatible `firebase-admin@14`. Do not force that upgrade and
do not add a transitive major override. Re-audit before release and upgrade only
when Firebase Functions officially supports a patched Admin SDK combination.

Then use the Firebase emulators only; do not deploy until the three external
gates above are resolved and real dev/staging/prod project IDs replace the
placeholders in `.firebaserc`.

Official references:

- MiniMax Token Plan FAQ: https://platform.minimax.io/docs/token-plan/faq
- MiniMax Token Plan quick start: https://platform.minimax.io/docs/token-plan/quickstart
- MiniMax T2A HTTP API: https://platform.minimax.io/docs/api-reference/speech-t2a-http
- Firebase billing: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans

## Progression reward sync remains staged

`syncKoiLearningContext` accepts bounded aggregate learning context, not
server-verifiable lesson/quiz evidence. It therefore cannot safely mint cloud
stars, cosmetics, coins, or pet high-water state: a client could forge those
aggregates. A future `syncKoiProgressionClaims` callable must validate immutable
claim IDs against authoritative completion evidence before any cloud reward is
awarded. Until that evidence source exists, progression rewards remain local
and the backend deliberately exposes no reward-minting callable.
