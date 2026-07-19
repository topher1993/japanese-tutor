# Koi Sensei release runbook

## Stage 0 — deterministic mock

- Koi opens from Home and all existing five tabs still work.
- No Firebase or MiniMax credential is required.
- The 2D avatar, reduced-motion effects, care, closet, dojo, league, and data
  controls pass their local tests.
- N5/N4 reward claims remain unawardable until content-evidence review is
  complete.

## Stage 1 — staff development

- Run Auth, Firestore, Storage, and Functions in the Firebase Local Emulator
  Suite. Do not upgrade or deploy a cloud project while the zero-additional-cost
  rule is active; Firebase Functions requires Blaze billing and has no hard
  budget cap.
- Load the default-deny rules and indexes/functions into the emulators.
- Use the deterministic server provider. Test registration, the 50-account cap,
  retention, export, deletion, reporting, duplicate request IDs, and offline
  claim replay.
- Confirm analytics contain event names and coarse result bands only—never
  prompts, answers, memory text, raw progress, email addresses, or audio.

## Stage 1.5 — personal live mode

- Keep `KOI_BETA_ENABLED=false` and `KOI_USAGE_MODE=personal_unlimited`.
- Admit only the first verified Firebase subject as the personal owner.
- Do not enforce app-level chat/voice counters. Continue to fail closed on
  stale or exhausted MiniMax Token Plan capacity, provider disablement, or more
  than two simultaneous provider requests.
- Verify the app displays "no app-imposed reply limit" and never describes the
  MiniMax subscription itself as unlimited.
- Detailed-progress sharing remains off by default and must be granted or
  revoked through the authenticated Worker before any learning summary sync.

## Stage 2 — staging provider verification

- Before creating a cloud staging project, the owner must either approve its
  non-zero billing risk or select a host with an enforceable zero-spend ceiling.
- Record MiniMax's written approval and Credits hard-stop confirmation.
- Store the Token Plan key in the staging secret manager and nowhere else.
- Start with one staff account, global concurrency one, voice disabled, and the
  provider kill switch ready.
- Validate `token_plan/remains` parsing against the real account without logging
  the response or key. Force stale, exhausted, timeout, 429, invalid-key, and
  malformed-response cases; every case must fail closed.
- Enable at most two concurrent calls. Verify that a third call is rejected or
  queued without reaching MiniMax.
- Test Speech 2.8 only after its included character balance is confirmed. When
  it is low, stale, or absent, verify the device system voice is selected.

## Stage 3 — capped production beta

- Create a separate production Firebase project; never reuse dev/staging data.
- Enforce App Check, email-link authentication, 16+ confirmation, current AI
  and privacy consent, a 50-active-account transaction, and server kill
  switches before any provider call.
- Admit 5, then 15, then at most 50 active accounts. Hold each cohort for at
  least one full provider reset window and inspect only content-free operational
  metrics.
- Dynamic rolling 24-hour allowances may rise when capacity recovers but do not
  fall mid-window, except for the emergency stale/exhausted cutoff. Provider
  capacity always overrides a displayed allowance.
- Chat history expires after 30 days and is capped at 200 messages. Approved
  memories are capped at 20. Deletion removes server data and leaves a local
  retry tombstone until acknowledged.

## Immediate rollback conditions

Set the server provider kill switch before investigating if any of these occur:

- MiniMax indicates possible paid/Credits consumption.
- Provider approval is withdrawn, expires, or is contradicted by updated terms.
- Quota state is stale beyond five minutes or cannot be interpreted safely.
- Global concurrency exceeds two.
- A secret, prompt, answer, email, memory, or raw audio reaches logs/analytics.
- App Check, auth, consent, age, user-cap, retention, or reward-authority checks
  can be bypassed.
- Crash rate, response correctness, or safety evaluation breaches the recorded
  release threshold.

Rollback disables online chat/TTS while leaving the local course app and Koi's
safe local experiences available.
