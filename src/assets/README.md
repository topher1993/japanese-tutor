# Assets — Japanese Tutor Mobile App

**Owner:** Igris (structure) + Kaisel (generation) + Tusk (QC)
**Generated:** 2026-06-25 (Phase 26)

## Layout

```
src/assets/
├── source/                          ← hand-authored, checked into git
│   ├── icon/                        (1 file:  app-icon-master-1024.png)
│   ├── splash/                      (1 file:  splash-master-1024.png)
│   ├── adaptive/                    (3 files: fg/bg/mono Android adaptive)
│   ├── illustrations/
│   │   ├── onboarding/              (3-4 files)
│   │   └── empty-state/             (3 files)
│   ├── badges/                      (8 achievement + 2 JLPT = 10 SVGs)
│   └── mascot/                      (5 SVGs: base + 4 expressions)
├── source/generated/                ← gitignored, raw AI output
├── manifest.ts                      ← single import point for screens
├── manifest.test.ts                 ← vitest, asserts every require resolves
├── types.ts                         ← AssetManifest, AssetKey
└── lint/no-direct-asset-require.js  ← eslint custom rule
```

Plus top-level `assets/` (sibling to `src/`) holds symlinks referenced by `app.json`:
`icon.png`, `splash.png`, `adaptive-icon.png`, `favicon.png`, `notification-icon.png`.

## Contracts

- Anything in `source/` is hand-authored, reviewed, and ships.
- Anything in `source/generated/` is raw AI output, never committed.
- Screens import via `manifest.ts` only. Direct `require('./assets/...')` is forbidden by ESLint.
- Adding an asset = add file + add manifest entry + add test entry.

## Phase 26 plan reference

See `docs/phase-26-asset-work-card.md` for the consolidated plan, and
`docs/phase-26-asset-strategy-discussion.md` for the original discussion framework.