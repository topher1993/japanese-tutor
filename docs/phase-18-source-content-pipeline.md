# Phase 18A-C — Safe Japanese Content Source Pipeline

Owner: Igris / Engineering Division
Date: 2026-06-20
Status: Complete

## Scope

Implemented the recommended safe content expansion foundation:

- Phase 18A: source compliance and attribution layer
- Phase 18B: JMdict starter vocabulary pack and importer
- Phase 18C: KANJIDIC2 starter kanji pack and importer

Tatoeba is intentionally not imported yet. It remains candidate-only for a later reviewed sentence phase.

## Added / changed files

- `src/data/contentSources.ts`
- `src/data/generated/jmdictStarterVocabulary.ts`
- `src/data/generated/kanjidic2StarterKanji.ts`
- `src/screens/SourcesScreen.tsx`
- `src/screens/ProgressScreen.tsx`
- `App.tsx`
- `scripts/import-jmdict-vocab.mjs`
- `scripts/import-kanjidic2.mjs`
- `tests/phase18SourceContentPipeline.test.ts`
- `tests/phase18ImportScripts.test.ts`
- `docs/content-sources.md`
- `package.json`
- `package-lock.json`
- `tsconfig.json`

## App behavior

The app now exposes source attribution through:

```text
Stats → Open sources and credits
```

The Sources/Credits screen displays:

- JMdict / EDRDG attribution
- KANJIDIC2 / EDRDG attribution
- Tatoeba attribution and candidate-only policy
- license links
- usage policy for each source

## Generated starter packs

JMdict starter vocabulary:

- 20 N5 learner-ready vocabulary entries
- Japanese, kana, romaji, English, Vietnamese, Filipino/Tagalog
- source metadata
- review status: `sensei-ready`

KANJIDIC2 starter kanji:

- 16 N5 kanji entries
- meanings, on readings, kun readings, stroke count, grade where applicable
- source metadata
- review status: `sensei-ready`

## Import scripts

Scripts are discoverable through npm:

```bash
npm run import:jmdict -- --dry-run
npm run import:kanjidic2 -- --dry-run
```

They require explicit local input files for actual extraction. They do not auto-download network data by default, keeping imports intentional and reviewable.

## Validation

Passed:

```text
Focused Phase 18 tests: 5 passed
Typecheck: passed
Full tests: 27 files passed / 89 tests passed
Expo web export: passed
Expo install check: passed
Expo Doctor: 18/18 passed
Browser smoke: passed
```

Browser smoke verified the Sources/Credits screen renders source names, owners, licenses, links, and usage policies.

## Notes

`npm install --save-dev @types/node` was added so importer-script tests and TypeScript can typecheck Node-based script harnesses.

`npm install` reported 17 moderate vulnerabilities from the existing dependency graph. No forced audit fix was applied because that can introduce breaking Expo dependency changes.

## Next recommended phase

Phase 18D — integrate the generated starter packs into visible Flashcards/Kanji UI behind tests, then have Sensei review wording before broader beta exposure.
