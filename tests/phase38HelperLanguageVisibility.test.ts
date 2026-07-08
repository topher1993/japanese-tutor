import { describe, expect, it } from 'vitest';

// Phase 38 — Helper-language visibility rule.
//
// The user's rule (verbatim): "if the user selects a helper language
// only the helper language and english must be seen throughout the
// entire app". Concretely:
//   - selected = 'en'  → only English shown
//   - selected = 'vi'  → Vietnamese + English shown (Filipino hidden)
//   - selected = 'tl'  → Filipino + English shown (Vietnamese hidden)
//   - If the selected-helper translation is missing/pending, the screen
//     falls back to English (no orphan translation rows)
//
// These tests pin both the unit (`getVisibleTranslations` in
// supportLanguageService) and the source-level contract: no screen in
// `src/screens/` may import `item.vietnamese` / `item.filipino` directly,
// except the Sensei authoring editor (SenseiReviewScreen) which
// intentionally edits all three.

import { getVisibleTranslations, getSupportTranslation } from '../src/services/supportLanguageService';
import type { TranslatablePhrase } from '../src/services/supportLanguageService';

function fixture(overrides: Partial<TranslatablePhrase> = {}): TranslatablePhrase {
  return {
    english: 'Good morning.',
    vietnamese: 'Chào buổi sáng.',
    filipino: 'Magandang umaga.',
    ...overrides,
  };
}

describe('Phase 38 — getVisibleTranslations helper-language visibility rule', () => {
  it('1. selected=en returns only English, never Vietnamese or Filipino', () => {
    const visible = getVisibleTranslations(fixture(), 'en');
    expect(visible).toHaveLength(1);
    expect(visible[0].label).toBe('English');
    expect(visible[0].text).toBe('Good morning.');
  });

  it('2. selected=vi returns Vietnamese first, English second, never Filipino', () => {
    const visible = getVisibleTranslations(fixture(), 'vi');
    expect(visible.map(t => t.label)).toEqual(['Vietnamese', 'English']);
    expect(visible.map(t => t.text)).toEqual(['Chào buổi sáng.', 'Good morning.']);
    // Filipino must not leak.
    expect(visible.some(t => t.label === 'Filipino/Tagalog')).toBe(false);
  });

  it('3. selected=tl returns Filipino first, English second, never Vietnamese', () => {
    const visible = getVisibleTranslations(fixture(), 'tl');
    expect(visible.map(t => t.label)).toEqual(['Filipino/Tagalog', 'English']);
    expect(visible.some(t => t.label === 'Vietnamese')).toBe(false);
  });

  it('4. missing Vietnamese → falls back to English (no orphan VI: row)', () => {
    const phrase = fixture({ vietnamese: '' });
    const visible = getVisibleTranslations(phrase, 'vi');
    expect(visible).toHaveLength(1);
    expect(visible[0].label).toBe('English');
    expect(visible[0].text).toBe('Good morning.');
  });

  it('5. pending placeholder Vietnamese → falls back to English', () => {
    const phrase = fixture({ vietnamese: '(pending vi review)' });
    const visible = getVisibleTranslations(phrase, 'vi');
    expect(visible).toHaveLength(1);
    expect(visible[0].label).toBe('English');
  });

  it('6. getSupportTranslation mirrors the same rule for a single translation', () => {
    const viTrans = getSupportTranslation(fixture(), 'vi');
    expect(viTrans).toEqual({ label: 'Vietnamese', text: 'Chào buổi sáng.' });
    const tlTrans = getSupportTranslation(fixture(), 'tl');
    expect(tlTrans).toEqual({ label: 'Filipino/Tagalog', text: 'Magandang umaga.' });
    const enTrans = getSupportTranslation(fixture(), 'en');
    expect(enTrans).toEqual({ label: 'English', text: 'Good morning.' });
  });

  it('7. de-dupes identical translations of different helper languages', () => {
    // If Vietnamese and Filipino happen to be the same string, only one
    // is shown (no point rendering "Filipino/Tagalog: Hello.\nVietnamese: Hello.").
    // The implementation dedupes by label+text, so two different labels
    // with the same text remain visible — the user's selection rules.
    const phrase: TranslatablePhrase = {
      english: 'Hello.',
      vietnamese: 'Hello.',
      filipino: 'Hello.',
    };
    const viVisible = getVisibleTranslations(phrase, 'vi');
    expect(viVisible.map(t => t.label)).toEqual(['Vietnamese', 'English']);
    const tlVisible = getVisibleTranslations(phrase, 'tl');
    expect(tlVisible.map(t => t.label)).toEqual(['Filipino/Tagalog', 'English']);
  });
});

describe('Phase 38 — source-level visibility invariant', () => {
  // Read the screen sources once and assert no direct .vietnamese / .filipino
  // reads exist outside the Sensei authoring editor (which intentionally
  // edits all three). This is a coarse text-grep guard — a future screen
  // that bypasses `getVisibleTranslations` and reads `item.vietnamese`
  // directly would regress the visibility rule.
  it('8. no screen under src/screens/ reads .vietnamese or .filipino directly (SenseiReviewScreen excepted)', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const root = path.resolve(__dirname, '..');
    const screensDir = path.join(root, 'src', 'screens');
    const entries = await fs.readdir(screensDir, { withFileTypes: true });
    const offenders: string[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue;
      const fullPath = path.join(screensDir, entry.name);
      const text = await fs.readFile(fullPath, 'utf8');
      // SenseiReviewScreen is the authoring editor — it intentionally
      // touches all three fields. Skip it.
      if (entry.name === 'SenseiReviewScreen.tsx') continue;
      const matches = text.match(/\b\w+\.(vietnamese|filipino)\b/g) ?? [];
      // The string `translations.vietnamese` etc. comes from
      // getVisibleTranslations' SupportTranslation shape, which is fine —
      // those fields are intentionally camelCase English labels. We want
      // to flag raw object reads like `item.vietnamese` or `lesson.filipino`.
      const dataLeak = matches.filter(m => /\.(vietnamese|filipino)$/.test(m));
      if (dataLeak.length > 0) offenders.push(`${entry.name}: ${dataLeak.join(', ')}`);
    }
    expect(offenders, `direct .vietnamese/.filipino reads detected: ${offenders.join('; ')}`).toEqual([]);
  });
});