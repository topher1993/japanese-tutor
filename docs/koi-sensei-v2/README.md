# Koi Sensei 2.0

Koi Sensei is the optional, 16+ virtual-pet tutor inside Japanese Tutor. The
existing five-tab learning app remains local-first; Home opens Koi as a
full-screen overlay. Koi's online features are a capped beta for at most 50
active accounts.

## Non-negotiable boundaries

- The MiniMax credential exists only in the production secret manager. It is
  never an Expo variable, client config value, Firestore document, log field,
  crash report, fixture, or Git file.
- Only the owner's active yearly **Token Plan key** may be configured. Standard
  API keys, pay-as-you-go keys, balance top-ups, Credits fallback, provider
  failover, and silent model upgrades are forbidden.
- Live provider mode stays disabled until MiniMax gives written approval for a
  capped 50-person beta and confirms how to make the Token Plan key stop before
  it can consume Credits.
- The backend checks a fresh provider-capacity snapshot before every MiniMax
  call, globally permits at most two calls at once, and fails closed if quota
  state is stale or exhausted.
- MiniMax TTS is attempted only while a fresh, subscription-covered character
  budget can pay for the complete `spokenText`. Otherwise the app uses its
  included system voice. Raw microphone audio is never uploaded or persisted.
- Course progress stays on the device by default. A learner must separately opt
  in before a bounded learning summary can be synced to Koi.
- Koi stars and mastery cosmetics are local-first high-water marks in this
  checkpoint. The backend deliberately exposes no reward-minting callable yet:
  a server-authoritative sync must wait for a verifiable learning-evidence
  ledger, so a client cannot forge stars, cosmetics, coins, or league points.

## Runtime shape

```text
Japanese Tutor app
  local course repository ── optional summary consent ─┐
  Koi local cache (draft, 200 messages, pet snapshot) ─┼─ Firebase callable boundary
  device speech-to-text ─────────────── text only ─────┘
                                                         │
                                          Auth + App Check + 16+ consent
                                                         │
                                     Firestore transactions and kill switches
                                                         │
                                     MiniMax Token Plan guard + semaphore (2)
                                                         │
                         M2.7 text / covered Speech 2.8, or fail closed/fallback
```

The mobile boundary is transport-injected and credential-free. Firebase dev,
staging, and production projects provide the real callable transport only after
their public client configs are supplied. The deterministic mock transport is
the default and consumes no provider quota.

Cloud Functions deployment itself is not zero-cost-guaranteed: Firebase
requires the Blaze pay-as-you-go plan, and its budget alerts do not impose a
hard spending cap. Therefore this repository may run the Firebase Local
Emulator Suite, but no cloud project may be upgraded or deployed under the
owner's no-additional-cost rule. Live hosting needs a separately approved,
hard-capped solution or an explicit change to that rule.

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
