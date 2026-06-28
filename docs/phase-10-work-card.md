# Japanese Tutor Mobile App — Phase 10 Work Card

**Date:** 2026-06-18  
**Owner:** Igris / Engineering Division  
**Content Reviewer:** Sensei role / Japanese learning quality gate  
**Phase:** 10 — Sensei Content Review  
**Status:** Implemented and ready for validation

## Objective

Convert the project from device-ready to learner-content-ready for internal beta by reviewing the first N5 workplace survival content pack.

## Scope

- Add a Sensei content review service.
- Add tests for content review verdict and internal beta content pack definition.
- Verify N5 workplace lessons include learner-facing Japanese, romaji, English, Vietnamese, and Filipino fields.
- Verify workplace survival phrases include multilingual text and usage notes.
- Verify quiz content has explanations and valid answer choices.
- Add one practical emergency phrase to satisfy the internal beta survival content threshold.

## Content Added

Added emergency phrase:

```text
火事です
romaji: kaji desu
English: There is a fire.
Vietnamese: Có cháy.
Filipino: May sunog po.
```

## Files Added / Updated

```text
src/services/senseiContentReviewService.ts
tests/phase10SenseiContentReview.test.ts
src/data/workplaceSurvivalPhrases.ts
docs/phase-10-work-card.md
docs/content/phase-10-sensei-content-review.md
```

## Quality Gate

The review service blocks internal beta content if:

- fewer than five N5 weekday lessons exist
- fewer than eighteen survival phrases exist
- emergency phrases are missing
- learner-facing Japanese/romaji/English/Vietnamese/Filipino text is missing
- quiz choices or explanations are incomplete

## Expected Verdict

```text
approved-for-internal-beta
```
