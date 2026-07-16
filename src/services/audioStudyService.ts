import * as Speech from 'expo-speech';
import type { Voice } from 'expo-speech';
import type { FlashcardReviewCard } from '../types/flashcard';
import type { VocabularyLearningGroup } from './vocabularyTaxonomyService';
import { readingForSpeech } from './speechPracticeService';
import { track } from './analyticsService';

export const AUDIO_STUDY_GROUPS: VocabularyLearningGroup[] = ['noun', 'verb', 'adjective'];
/** Short comprehension gap between the Japanese pronunciation and its meaning. */
export const AUDIO_STUDY_MEANING_DELAY_MS = 450;
/** Processing gap between one completed word and the next word in the loop. */
export const AUDIO_STUDY_WORD_DELAY_MS = 800;
export const AUDIO_STUDY_WORD_DELAY_OPTIONS = [600, 800, 1200, 1600] as const;

export interface AudioStudyVoices {
  japanese?: string;
  english?: string;
  japaneseName?: string;
  englishName?: string;
}

function chooseVoice(voices: Voice[], language: string, preferredLocale: string, excluded?: string): Voice | undefined {
  return voices
    .filter(voice => voice.identifier !== excluded && new RegExp(`^${language}(?:-|$)`, 'i').test(voice.language))
    .sort((left, right) => {
      const qualityScore = (right.quality === 'Enhanced' ? 1 : 0) - (left.quality === 'Enhanced' ? 1 : 0);
      if (qualityScore !== 0) return qualityScore;
      return Number(right.language.toLowerCase() === preferredLocale.toLowerCase())
        - Number(left.language.toLowerCase() === preferredLocale.toLowerCase());
    })[0];
}

/** Pick separate, preferably enhanced, voices for the Japanese and English halves of the loop. */
export function selectAudioStudyVoices(voices: Voice[]): AudioStudyVoices {
  const japanese = chooseVoice(voices, 'ja', 'ja-JP');
  const english = chooseVoice(voices, 'en', 'en-US', japanese?.identifier);
  return {
    japanese: japanese?.identifier,
    english: english?.identifier,
    japaneseName: japanese?.name,
    englishName: english?.name,
  };
}

/** Load device voices; language options still provide a safe system fallback if this fails. */
export async function getAudioStudyVoices(): Promise<AudioStudyVoices> {
  try {
    return selectAudioStudyVoices(await Speech.getAvailableVoicesAsync());
  } catch {
    return {};
  }
}

/** Build a mixed audio deck so one word type does not dominate the loop. */
export function buildAudioStudyPlaylist(
  cards: FlashcardReviewCard[],
  groups: VocabularyLearningGroup[] = AUDIO_STUDY_GROUPS,
): FlashcardReviewCard[] {
  const allowed = new Set(groups.filter(group => AUDIO_STUDY_GROUPS.includes(group)));
  const buckets = AUDIO_STUDY_GROUPS
    .filter(group => allowed.has(group))
    .map(group => cards.filter(card => (card.learningGroup ?? 'expression') === group));
  const result: FlashcardReviewCard[] = [];
  const seen = new Set<string>();
  let index = 0;
  while (buckets.some(bucket => index < bucket.length)) {
    for (const bucket of buckets) {
      const card = bucket[index];
      if (card && !seen.has(card.id)) {
        seen.add(card.id);
        result.push(card);
      }
    }
    index += 1;
  }
  return result;
}

/** Speak Japanese first, then the learner's English meaning. */
export function speakAudioStudyItem(
  card: Pick<FlashcardReviewCard, 'reading' | 'romaji' | 'english'>,
  onDone: () => void,
  onError?: (error: Error) => void,
  voices: AudioStudyVoices = {},
  shouldCancel: () => boolean = () => false,
): void {
  const reading = readingForSpeech(card.reading ?? card.romaji);
  const fail = (error: Error) => onError?.(error);
  void Speech.stop().catch(() => undefined);
  Speech.speak(reading, {
    language: 'ja-JP',
    voice: voices.japanese,
    rate: 0.78,
    pitch: 1,
    useApplicationAudioSession: false,
    onDone: () => {
      setTimeout(() => {
        if (shouldCancel()) return;
        Speech.speak(card.english, {
          language: 'en-US',
          voice: voices.english,
          rate: 0.92,
          pitch: 1,
          useApplicationAudioSession: false,
          onDone,
          onError: fail,
        });
      }, AUDIO_STUDY_MEANING_DELAY_MS);
    },
    onError: fail,
  });
  track('japanese_audio_played', { text_length: reading.length, rate: 0.78, mode: 'audio_study_loop' });
}
