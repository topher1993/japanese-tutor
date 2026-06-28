import { describe, expect, it } from 'vitest';

import { getSecondaryTranslations, getVisibleTranslations } from '../src/services/supportLanguageService';
import type { AdditionalLessonPhrase } from '../src/types/additionalLessonContent';

const phrase: AdditionalLessonPhrase = {
  id: 'sample',
  japanese: 'これはいくらですか',
  romaji: 'kore wa ikura desu ka',
  english: 'How much is this?',
  vietnamese: 'Cái này bao nhiêu tiền?',
  filipino: 'Magkano po ito?',
  usageNote: 'Point to the item while asking.',
  translationReviewStatus: 'approved',
};

describe('Phase 16H translation visibility preferences', () => {
  it('shows only English for English helper language', () => {
    expect(getVisibleTranslations(phrase, 'en')).toEqual([
      { label: 'English', text: 'How much is this?' },
    ]);
  });

  it('shows Vietnamese plus English fallback, hiding Filipino/Tagalog, for Vietnamese helper language', () => {
    expect(getVisibleTranslations(phrase, 'vi')).toEqual([
      { label: 'Vietnamese', text: 'Cái này bao nhiêu tiền?' },
      { label: 'English', text: 'How much is this?' },
    ]);
  });

  it('shows Filipino/Tagalog plus English fallback, hiding Vietnamese, for Filipino helper language', () => {
    expect(getVisibleTranslations(phrase, 'tl')).toEqual([
      { label: 'Filipino/Tagalog', text: 'Magkano po ito?' },
      { label: 'English', text: 'How much is this?' },
    ]);
  });

  it('uses the same compact visibility rules for secondary translations', () => {
    expect(getSecondaryTranslations(phrase, 'tl')).toEqual([
      { label: 'English', text: 'How much is this?' },
    ]);
    expect(getSecondaryTranslations(phrase, 'vi')).toEqual([
      { label: 'English', text: 'How much is this?' },
    ]);
    expect(getSecondaryTranslations(phrase, 'en')).toEqual([]);
  });
});
