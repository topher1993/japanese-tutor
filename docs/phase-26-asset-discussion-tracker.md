# Phase 26 Asset Generation — Discussion Tracker
**Status:** ✅ All 4 division reports received (Kaisel via Belion fallback)
**Started:** 2026-06-25
**Next:** Chris approval on consolidated work card
**Trigger:** Chris asked "can you discuss with the agent army how to generate our application assets"

---

## Chris's decisions (locked 2026-06-25)
1. **Budget:** $0 strict
2. **Brand direction:** Mascot, but minimalist
3. **Platform priority:** Both (Android + iOS)
4. **Onboarding:** Illustrated (Tier 2)
5. **Kanji policy:** Sensei's rule applies (all visible kanji must come from N5/N4 packs)

---

## Division routing — COMPLETE

| Division | Owner of | Status | Deliverable |
|---|---|---|---|
| Beru | WHAT — pedagogical asset list | ✅ Done | `docs/asset-brief-beru.md` (24.6 KB) |
| Sensei | KANJI — verified character inventory | ✅ Done | `docs/sensei-character-inventory.md` (18 KB) |
| Igris | SPEC — file paths, app.json, lint rules | ✅ Done | `C:\Users\tophe\IGRIS_ASSET_SPEC.md` (42 KB) |
| Kaisel | HOW — tool/API execution plan | ⚠️ Blocked (2 subagent failures) | Belion drafted pipeline; §5 marked "pending Kaisel validation" |

---

## Consolidated deliverable

| File | Path | Size |
|---|---|---|
| Phase 26 work card | `docs/phase-26-asset-work-card.md` | ~16 KB |

---

## Open questions for Chris (blocking execution)

| Q | Why it matters |
|---|---|
| A. Approve the plan? | Go/no-go for all 12 steps |
| B. Bundle identifier | `com.belion.japanesetutor` placeholder OK? |
| C. iOS or Android first | Apple Dev Program blocks iOS — bias Android? |
| D. Pre-flight OK on `app.json` edits | P-A protected — needs explicit sign-off at Step 10 |
| E. ComfyUI fallback OK if gpt-image-2 quota runs out | Already installed locally, $0 fallback |

---

## Pause points (per Chris's pacing preference)

Belion does NOT auto-execute. Approval flow:
1. Chris approves the consolidated plan
2. Step 1 (folders) + Step 2 (Kō mascot SVG) → checkpoint for mascot design approval
3. Step 3 (app icon) → checkpoint to pick favorite from 5–10 iterations
4. Step 6 (onboarding kanji overlay) → Tusk QC report before commit
5. Step 10 (app.json) → explicit pause for P-A sign-off
6. Final close → one consolidated report

---

## Reference

- Consolidated work card: `docs/phase-26-asset-work-card.md`
- Full discussion framework: `docs/phase-26-asset-strategy-discussion.md`
- Asset concept seeds: `src/services/assetConceptService.ts`
- Design system: `src/theme/designSystem.ts`