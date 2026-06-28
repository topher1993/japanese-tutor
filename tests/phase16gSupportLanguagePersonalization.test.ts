import { describe, expect, it } from 'vitest';

import { getLocalizedAdditionalLessonPhrase } from '../src/services/additionalLessonContentService';
import { getSupportLanguageDisplayName, getSupportLanguageField, getSupportTranslation } from '../src/services/supportLanguageService';
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

describe('Phase 16G support language personalization', () => {
  it('maps the onboarding support language to a display label and content field', () => {
    expect(getSupportLanguageDisplayName('en')).toBe('English');
    expect(getSupportLanguageDisplayName('vi')).toBe('Vietnamese');
    expect(getSupportLanguageDisplayName('tl')).toBe('Filipino/Tagalog');

    expect(getSupportLanguageField('en')).toBe('english');
    expect(getSupportLanguageField('vi')).toBe('vietnamese');
    expect(getSupportLanguageField('tl')).toBe('filipino');
  });

  it('selects one primary helper translation from multilingual phrase data', () => {
    expect(getSupportTranslation(phrase, 'en')).toEqual({ label: 'English', text: 'How much is this?' });
    expect(getSupportTranslation(phrase, 'vi')).toEqual({ label: 'Vietnamese', text: 'Cái này bao nhiêu tiền?' });
    expect(getSupportTranslation(phrase, 'tl')).toEqual({ label: 'Filipino/Tagalog', text: 'Magkano po ito?' });
  });

  it('localizes additional lesson phrases while preserving English fallback as the visible secondary translation', () => {
    const localized = getLocalizedAdditionalLessonPhrase(phrase, 'vi');

    expect(localized.primaryTranslation).toEqual({ label: 'Vietnamese', text: 'Cái này bao nhiêu tiền?' });
    expect(localized.secondaryTranslations).toEqual([
      { label: 'English', text: 'How much is this?' },
    ]);
  });
});
