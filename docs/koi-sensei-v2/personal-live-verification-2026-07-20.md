# Koi personal-live verification — 2026-07-20

Scope: one verified owner account, `KOI_BETA_ENABLED=false`,
`KOI_USAGE_MODE=personal_unlimited`, no pay-as-you-go fallback, no Firebase
Functions deployment, and App Check optional only for this development build.

## Automated evidence

- Mobile TypeScript passed.
- Mobile Vitest passed 176 files and 1,297 tests in the final release suite.
- Firebase-compatible contract backend passed 9 files, 44 tests, and TypeScript.
- Cloudflare Worker TypeScript and Wrangler dry-run bundle passed.
- Android debug bundle built, installed on `emulator-5554`, and launched from
  its embedded JavaScript bundle without Metro.
- Placeholder GLB, 2D fallback, reduced-motion/effect, retention, progression,
  privacy, gateway, and model-output contracts are covered by Koi suites.

## Live evidence

- The Firebase email-link session survived rebuild and was accepted only as a
  verified-email token by the Worker.
- Home opened the full-screen Koi hub; 3D canvas/fallback, N5 eight-star frame,
  4/24 starter cosmetics, care, closet, dojo, league, and settings rendered.
- The allowance banner showed no app-imposed reply limit while clearly keeping
  Token Plan availability authoritative.
- The current Token Plan `general` percentage response was parsed after the
  prior exact-model/count-only parser correctly failed closed.
- A live M2.7 request returned through Cloudflare and persisted in local chat.
  No provider key appeared in the device, repository, response, or UI.
- Output is normalized to plain text and evaluated after normalization. Hangul
  leakage, duplicated polite forms, secret-like content, and remaining raw
  markup produce a safe `not_grounded` response instead of being taught.
- The mobile repository also normalizes assistant messages on read, so replies
  cached before the server-side guard render as clean plain text after upgrade.

## Deployment evidence

- Worker origin: `https://koi-sensei-personal.swtopherpid09.workers.dev`
- Final deployment containing the deterministic output evaluator, concise
  answer guard, and complete Markdown-link normalization:
  `4311db5b-e24b-499a-8c72-db3e7b933475`
- Wrangler confirmed secret names; values were never read or printed.

## Deliberately deferred shared-beta gates

- Keep App Check optional only for personal development; enforce it before a
  shared beta.
- Keep `KOI_BETA_ENABLED=false` and do not admit other users without explicit
  owner approval plus MiniMax sharing/Credits hard-stop confirmation.
- Replace the engineering placeholder only with a commissioned, licensed GLB
  that passes the checked-in manifest and budget validator.
