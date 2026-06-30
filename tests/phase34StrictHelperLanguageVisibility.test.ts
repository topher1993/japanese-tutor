import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { getAllLessons } from '../src/services/lessonService';
import { createFlashcardDeck } from '../src/services/flashcardService';
import { getVisibleTranslations, getSecondaryTranslations, getSupportTranslation } from '../src/services/supportLanguageService';
type Translatable = { id?: string; english: string; vietnamese: string; filipino: string };

const REPO_ROOT = join(__dirname, '..');

function labelsFor(item: Translatable, language: 'en' | 'vi' | 'tl'): string[] {
  return getVisibleTranslations(item, language).map(translation => translation.label);
}

describe('Phase 34 strict helper-language visibility', () => {
  it('language visibility service never returns unrelated helper languages', () => {
    const item = getAllLessons()[0].items[0];

    expect(labelsFor(item, 'en')).toEqual(['English']);
    expect(labelsFor(item, 'vi')).toEqual(['Vietnamese', 'English']);
    expect(labelsFor(item, 'tl')).toEqual(['Filipino/Tagalog', 'English']);

    expect(labelsFor(item, 'vi')).not.toContain('Filipino/Tagalog');
    expect(labelsFor(item, 'tl')).not.toContain('Vietnamese');
    expect(getSecondaryTranslations(item, 'vi').map(t => t.label)).toEqual(['English']);
    expect(getSecondaryTranslations(item, 'tl').map(t => t.label)).toEqual(['English']);
  });

  it('falls back to correctly labeled English when selected helper-language text is missing', () => {
    const phrase = {
      english: 'Please check the shift.',
      vietnamese: '',
      filipino: '',
    };

    expect(getSupportTranslation(phrase, 'vi')).toEqual({ label: 'English', text: 'Please check the shift.' });
    expect(getSupportTranslation(phrase, 'tl')).toEqual({ label: 'English', text: 'Please check the shift.' });
    expect(getVisibleTranslations(phrase, 'vi')).toEqual([{ label: 'English', text: 'Please check the shift.' }]);
    expect(getVisibleTranslations(phrase, 'tl')).toEqual([{ label: 'English', text: 'Please check the shift.' }]);
  });

  it('lesson and flashcard data paths obey selected-language plus English visibility', () => {
    const lessonItems = getAllLessons().flatMap(lesson => lesson.items);
    const flashcards = createFlashcardDeck(getAllLessons()).cards;
    const leaks = [...lessonItems, ...flashcards].flatMap(item => {
      const viLabels = labelsFor(item, 'vi');
      const tlLabels = labelsFor(item, 'tl');
      return [
        viLabels.includes('Filipino/Tagalog') ? `${item.id}: Vietnamese mode leaked Filipino` : null,
        tlLabels.includes('Vietnamese') ? `${item.id}: Filipino mode leaked Vietnamese` : null,
      ].filter(Boolean);
    });

    expect(leaks).toEqual([]);
  });

  it('learner screens do not render raw VI/TL helper rows directly', () => {
    const learnerScreens = [
      'src/screens/HomeScreen.tsx',
      'src/screens/LessonsScreen.tsx',
      'src/screens/DailyLessonScreen.tsx',
      'src/screens/FlashcardsScreen.tsx',
      'src/screens/WorkplaceSurvivalScreen.tsx',
      'src/screens/DailyRushScreen.tsx',
      'src/screens/SettingsScreen.tsx',
    ];

    const leaks = learnerScreens.flatMap(relativePath => {
      const src = readFileSync(join(REPO_ROOT, relativePath), 'utf8');
      const directFieldLeak = /item\.(vietnamese|filipino)|phrase\.(vietnamese|filipino)|card\.(vietnamese|filipino)/g;
      const hardcodedLabelLeak = /\b(VI|TL):\s*\{/g;
      return [
        ...Array.from(src.matchAll(directFieldLeak)).map(match => `${relativePath}: direct ${match[0]}`),
        ...Array.from(src.matchAll(hardcodedLabelLeak)).map(match => `${relativePath}: hardcoded ${match[0]}`),
      ];
    });

    expect(leaks).toEqual([]);
  });

  it('reviewer-only translation tooling is gated away from normal learner mode', () => {
    const appSource = readFileSync(join(REPO_ROOT, 'App.tsx'), 'utf8');
    const settingsSource = readFileSync(join(REPO_ROOT, 'src/screens/SettingsScreen.tsx'), 'utf8');

    expect(appSource).toContain("const reviewerMode = getParam('reviewer') === '1'");
    expect(appSource).toContain("useState(reviewerMode && getParam('screen') === 'review')");
    expect(appSource).toContain('showReviewerTools={reviewerMode}');
    expect(appSource).toContain('onOpenReview={reviewerMode ?');
    expect(settingsSource).toContain('showReviewerTools && onOpenReview');
    expect(settingsSource).not.toContain('EN / VI / TL');
  });
});
