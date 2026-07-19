# Koi Sensei 2.0

Koi Sensei is the optional, 16+ virtual-pet tutor inside Japanese Tutor. The
existing five-tab learning app remains local-first; Home opens Koi as a
full-screen overlay. Live mode currently admits one personal owner account;
the architecture can later be switched to a capped beta of at most 50 active
accounts.

## Non-negotiable boundaries

- The MiniMax credential exists only in the production secret manager. It is
  never an Expo variable, client config value, Firestore document, log field,
  crash report, fixture, or Git file.
- Only the owner's active yearly **Token Plan key** may be configured. Standard
  API keys, pay-as-you-go keys, balance top-ups, Credits fallback, provider
  failover, and silent model upgrades are forbidden.
- Personal live mode uses only the owner's Token Plan key. A future shared beta
  stays disabled until MiniMax gives written approval and confirms how to stop
  the Token Plan key before it can consume Credits.
- The backend checks a fresh provider-capacity snapshot before every MiniMax
  call, globally permits at most two calls at once, and fails closed if quota
  state is stale or exhausted.
- Personal mode currently uses the included device system voice. MiniMax TTS
  stays disabled until its separate subscription character budget can be
  checked fresh and atomically before a request. Raw microphone audio is never
  uploaded or persisted.
- Course progress stays on the device by default. A learner must separately opt
  in before a bounded learning summary can be synced to Koi.
- Governed N5/N4 Dojo answers are checked by Cloudflare and deduplicated before
  they can mint practice/mastery evidence or cosmetics. Ungoverned domains and
  N3-N1 remain fail-closed.
- Personal mode has no app-imposed per-user chat or voice counter. MiniMax Token
  Plan availability, the provider kill switch, and the global two-call
  semaphore remain authoritative. Future shared mode can restore metering with
  `KOI_USAGE_MODE=metered`.

## Runtime shape

```text
Japanese Tutor app
  local course repository -- optional bounded summary consent --+
  Koi local cache (draft, 200 messages, pet snapshot) -----------+-- Cloudflare Worker
  device speech-to-text --------------------------- text only --+       |
                                                                  Firebase ID token
                                                                  + optional App Check
                                                                  + 16+ consent
                                                                         |
                                                              Durable Objects authority
                                                                         |
                                                       Token Plan guard + 2-call leases
                                                                         |
                                                          M2.7 text or fail closed
```

The mobile boundary is transport-injected and credential-free. Firebase dev,
staging, and production projects provide the real callable transport only after
their public client configs are supplied. The deterministic mock transport is
the default and consumes no provider quota.

Firebase supplies email-link identity, while Koi state, retention, consent,
rewards, and provider controls live in the Cloudflare Worker/Durable Objects.
Firebase Functions are retained only as a contract-compatible emulator and are
not deployed under the owner's no-additional-cost rule.

As of 2026-07-20, personal live mode is deployed with verified-email Firebase
claims, strict 32 KiB/exact-key payload validation, expiring two-call provider
leases, server-authoritative detailed-progress consent, and the current generic
percentage shape returned by MiniMax's Token Plan usage endpoint. App Check is
optional in personal development and remains mandatory before any approved
shared beta.

## Progression

Ranks are `N5`, `N4`, `N3`, `N2`, and `N1`. Every rank has exactly eight
permanent stars: practice and mastery for vocabulary, grammar, phrases, and
quizzes. Mastery unlocks one cosmetic in its domain slot:

| Domain | Slot |
| --- | --- |
| Vocabulary | Crest |
| Grammar | Face |
| Phrases | Back |
| Quizzes | Hand |

Four starter items plus one mastery item for each rank/domain make 24 total.
Items cannot be bought. N5/N4 remain fail-closed until their content evidence is
explicitly governed. N3 remains gated while incomplete; N2/N1 are previews.

## Current provider facts to re-check before live activation

MiniMax's official documentation currently describes the Plus Token Plan as a
4,500-request-equivalent five-hour text window with an additional weekly window,
and Speech 2.8 as 4,000 included characters per day. It also states that Token
Plan keys can use Credits and recommends pay-as-you-go for production. These
facts can change, so deployment must re-check the official pages and record the
date in the release evidence:

- <https://platform.minimax.io/docs/token-plan/intro>
- <https://platform.minimax.io/docs/token-plan/faq>
- <https://platform.minimax.io/docs/api-reference/text-anthropic-api>
- <https://platform.minimax.io/docs/api-reference/api-overview>
- <https://firebase.google.com/docs/functions>
- <https://firebase.google.com/docs/projects/billing/avoid-surprise-bills>

The design intentionally does **not** follow the production pay-as-you-go
recommendation because the product owner disallows additional cost. If MiniMax
does not approve subscription-only shared use, production Koi chat remains off.
