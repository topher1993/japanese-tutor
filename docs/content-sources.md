# Content sources, attribution, and refresh procedure

Japanese Tutor uses curated content packs that may be informed by open Japanese-language datasets. Source-backed content must keep source metadata and must be reviewed before beta release.

## Approved sources

### JMdict / EDICT — EDRDG

- Homepage: https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html
- License statement: https://www.edrdg.org/edrdg/licence.html
- Starter download: https://www.edrdg.org/pub/Nihongo/JMdict_e.gz
- License: Creative Commons Attribution-ShareAlike 4.0
- Recommended use: vocabulary meanings, kana/readings, part-of-speech metadata, source validation for flashcards.

Compliance requirements:

- Acknowledge EDRDG/JMdict in app sources, documentation, and release notes where content is used.
- Preserve source metadata in generated content.
- Maintain an update procedure for source-backed generated data.
- Do not imply EDRDG endorses the app.

### KANJIDIC2 — EDRDG

- Homepage: https://www.edrdg.org/wiki/KANJIDIC_Project.html
- License statement: https://www.edrdg.org/edrdg/licence.html
- Download: https://ftp.edrdg.org/pub/Nihongo/kanjidic2.xml.gz
- License: Creative Commons Attribution-ShareAlike 4.0
- Recommended use: kanji meanings, readings, stroke counts, grade/JLPT-style learner metadata.

Compliance requirements are the same as JMdict/EDRDG. For beta, use only common learner-facing fields and avoid special reference-code fields until licensing and usefulness are rechecked.

### Tatoeba

- Downloads: https://tatoeba.org/en/downloads
- License summary from downloads page: CC BY 2.0 FR, with a CC0 subset.
- Recommended use: candidate example sentences only.

Compliance requirements:

- Track sentence IDs and attribution metadata.
- Treat exports as candidate data until Sensei reviews learner level and quality.
- Do not reuse audio unless each audio item has a reusable contributor license and attribution URL.

## In-app acknowledgement

The Sources & credits screen renders `getContentSourceAcknowledgementText()` and provides accessible links to each source, license, and download.

## Import policy

1. Raw datasets are downloaded by scripts, not hand-copied into UI code.
2. Import scripts generate curated starter packs under `src/data/generated/`.
3. Generated items must include source ID, source license, and review status.
4. Vietnamese and Filipino/Tagalog helper translations are required before app exposure.
5. Sensei review remains required before a generated pack becomes lesson-critical beta content.

## EDRDG monthly refresh runbook

EDRDG requires software using JMdict or KANJIDIC2 data to have a regular update procedure. Run this check on the first business day of each month and before every content release, whichever comes first.

1. Download `JMdict_e.gz` and `kanjidic2.xml.gz` from the HTTPS URLs above into a temporary directory outside `src/`.
2. Record the download date, the generation date from the archive/XML header when present, and a SHA-256 hash (`Get-FileHash <file> -Algorithm SHA256`).
3. Verify the importer contract without writing content:

   ```powershell
   npm run import:jmdict -- --dry-run
   npm run import:kanjidic2 -- --dry-run
   ```

4. Generate review-only artifacts; do not overwrite learner-visible TypeScript directly:

   ```powershell
   npm run import:jmdict -- --input C:\tmp\edrdg\JMdict_e.gz --output src\data\imports\jmdict-refresh.json
   npm run import:kanjidic2 -- --input C:\tmp\edrdg\kanjidic2.xml.gz --output src\data\imports\kanjidic2-refresh.json
   ```

5. Diff entry IDs, readings, meanings, and license/source metadata against the current curated packs. A human reviewer must approve learner level, English meaning, romaji, and Vietnamese/Filipino helper translations before any row is connected to the app.
6. Run `npm run validate:v11`. Record the reviewer, hashes, source generation dates, changed source IDs, and validation result in the release audit. Keep no raw third-party archive in the repository.

## JMdict verb snapshot — 2026-07-14

The current verb candidate pack was generated from EDRDG's official `JMdict_e.gz` distribution. The archive was downloaded on 2026-07-15, reports `JMdict created: 2026-07-14`, and has SHA-256 `F78BBA9D1ADE4D7327BCA7CFC9E9BA5B5F796F69EB7868358B98307F453C3989`.

The generated expansion contains 685 source-backed verbs: 55 placed in N5, 130 in N4, and 500 in N3. These are Japanese Tutor curriculum placements, not an official JLPT vocabulary list. JMdict supplies the stable dictionary entry ID, spelling, reading, English sense, and part-of-speech metadata, but it does not assign JLPT levels. Each row therefore records JMdict provenance separately from the app's placement evidence.

The N5 and N4 additions come from curated app placement lists. The N3 set contains high-priority modern JMdict verb candidates after existing, N5, and N4 vocabulary is excluded. Keep these candidates in the content-review workflow, particularly for level placement and helper-language translation review. The raw archive is temporary source material and is not committed.

The older small starter packs preserve per-entry source IDs, but their original archive dates and hashes were not retained. They must not be described as a current mirror of EDRDG; the dated and hashed boundary above applies specifically to the generated verb pack.
