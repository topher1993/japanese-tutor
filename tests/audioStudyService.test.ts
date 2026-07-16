import { describe, expect, it, vi } from 'vitest';
import type { Voice } from 'expo-speech';
vi.mock('expo-speech', () => ({
  stop: () => Promise.resolve(),
  speak: () => undefined,
  getAvailableVoicesAsync: () => Promise.resolve([]),
}));
vi.mock('../src/services/analyticsBackend', () => ({ sendToBackend: () => undefined }));
import { AUDIO_STUDY_MEANING_DELAY_MS, AUDIO_STUDY_WORD_DELAY_MS, AUDIO_STUDY_WORD_DELAY_OPTIONS, buildAudioStudyPlaylist, selectAudioStudyVoices } from '../src/services/audioStudyService';
import type { FlashcardReviewCard } from '../src/types/flashcard';

function card(id: string, learningGroup: FlashcardReviewCard['learningGroup']): FlashcardReviewCard {
  return {
    id, lessonId: 'lesson', category: 'vocab', japanese: id, reading: id,
    romaji: id, english: `${id} meaning`, vietnamese: '', filipino: '',
    reviewCount: 0, nextReviewDate: '2026-01-01', translationReviewStatus: 'approved', learningGroup,
  };
}

describe('audio study playlist', () => {
  it('interleaves nouns, verbs, and adjectives in the requested loop', () => {
    const result = buildAudioStudyPlaylist([
      card('n1', 'noun'), card('n2', 'noun'), card('v1', 'verb'), card('a1', 'adjective'),
    ]);
    expect(result.map(item => item.id)).toEqual(['n1', 'v1', 'a1', 'n2']);
  });

  it('filters to the selected word types and removes duplicate ids', () => {
    const result = buildAudioStudyPlaylist([
      card('n1', 'noun'), card('n1', 'noun'), card('v1', 'verb'), card('a1', 'adjective'),
    ], ['verb', 'adjective']);
    expect(result.map(item => item.id)).toEqual(['v1', 'a1']);
  });
});

describe('audio study voices', () => {
  it('chooses separate enhanced Japanese and English voices when available', () => {
    const voices = selectAudioStudyVoices([
      { identifier: 'ja-default', name: 'Japanese system', quality: 'Default' as Voice['quality'], language: 'ja-JP' },
      { identifier: 'ja-enhanced', name: 'Japanese Enhanced', quality: 'Enhanced' as Voice['quality'], language: 'ja-JP' },
      { identifier: 'en-default', name: 'English system', quality: 'Default' as Voice['quality'], language: 'en-US' },
      { identifier: 'en-enhanced', name: 'English Enhanced', quality: 'Enhanced' as Voice['quality'], language: 'en-US' },
    ]);
    expect(voices.japanese).toBe('ja-enhanced');
    expect(voices.english).toBe('en-enhanced');
    expect(voices.japanese).not.toBe(voices.english);
    expect(voices.japaneseName).toBe('Japanese Enhanced');
    expect(voices.englishName).toBe('English Enhanced');
  });

  it('falls back to system language selection when voices are unavailable', () => {
    expect(selectAudioStudyVoices([])).toEqual({});
  });

  it('keeps a short meaning gap for comprehension', () => {
    expect(AUDIO_STUDY_MEANING_DELAY_MS).toBeGreaterThanOrEqual(300);
    expect(AUDIO_STUDY_MEANING_DELAY_MS).toBeLessThanOrEqual(700);
  });

  it('leaves enough processing time between loop words', () => {
    expect(AUDIO_STUDY_WORD_DELAY_MS).toBeGreaterThanOrEqual(600);
    expect(AUDIO_STUDY_WORD_DELAY_MS).toBeLessThanOrEqual(1200);
    expect(AUDIO_STUDY_WORD_DELAY_OPTIONS).toContain(AUDIO_STUDY_WORD_DELAY_MS);
    expect(AUDIO_STUDY_WORD_DELAY_OPTIONS[AUDIO_STUDY_WORD_DELAY_OPTIONS.length - 1]).toBeGreaterThan(AUDIO_STUDY_WORD_DELAY_MS);
  });
});
