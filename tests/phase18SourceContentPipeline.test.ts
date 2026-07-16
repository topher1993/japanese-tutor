import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  getContentSourceAcknowledgementText,
  japaneseContentSources,
} from '../src/data/contentSources';
import { generatedJmdictStarterVocabulary } from '../src/data/generated/jmdictStarterVocabulary';
import { generatedKanjidic2StarterKanji } from '../src/data/generated/kanjidic2StarterKanji';

describe('Phase 18A content source compliance', () => {
  it('registers approved source datasets with license and update metadata', () => {
    expect(japaneseContentSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'jmdict-edrdg',
          license: 'CC BY-SA 4.0',
          requiresAttribution: true,
          requiresUpdateProcedure: true,
        }),
        expect.objectContaining({
          id: 'kanjidic2-edrdg',
          license: 'CC BY-SA 4.0',
          requiresAttribution: true,
          requiresUpdateProcedure: true,
        }),
        expect.objectContaining({
          id: 'tatoeba',
          license: 'CC BY 2.0 FR / CC0 subset',
          requiresAttribution: true,
        }),
      ]),
    );

    for (const source of japaneseContentSources) {
      expect(source.name).toBeTruthy();
      expect(source.homepageUrl).toMatch(/^https?:\/\//);
      expect(source.licenseUrl).toMatch(/^https?:\/\//);
      expect(source.recommendedUse.length).toBeGreaterThan(0);
      expect(source.betaPolicy).toMatch(/curated|candidate|metadata/i);
      expect(source.homepageUrl).toMatch(/^https:\/\//);
      expect(source.licenseUrl).toMatch(/^https:\/\//);
      if (source.downloadUrl) expect(source.downloadUrl).toMatch(/^https:\/\//);
    }
  });

  it('makes source URLs accessible and contains external-link failures', () => {
    const screen = readFileSync('src/screens/SourcesScreen.tsx', 'utf8');
    expect(screen).toContain('await Linking.canOpenURL(url)');
    expect(screen).toContain('await Linking.openURL(url)');
    expect(screen).toContain('accessibilityRole="link"');
    expect(screen).toContain('Could not open that source link. Please try again.');
  });

  it('provides app-ready acknowledgement text for the About/Sources screen', () => {
    const acknowledgement = getContentSourceAcknowledgementText();

    expect(acknowledgement).toContain('JMdict');
    expect(acknowledgement).toContain('KANJIDIC2');
    expect(acknowledgement).toContain('Tatoeba');
    expect(acknowledgement).toContain('EDRDG');
    expect(acknowledgement).toContain('Creative Commons');
  });
});

describe('Phase 18B generated JMdict starter vocabulary', () => {
  it('contains a vetted starter deck with source metadata and learner helper translations', () => {
    expect(generatedJmdictStarterVocabulary.length).toBeGreaterThanOrEqual(20);

    const uniqueJapanese = new Set(generatedJmdictStarterVocabulary.map((entry) => entry.japanese));
    expect(uniqueJapanese.size).toBe(generatedJmdictStarterVocabulary.length);

    for (const entry of generatedJmdictStarterVocabulary) {
      expect(entry.japanese).toBeTruthy();
      expect(entry.kana).toBeTruthy();
      expect(entry.romaji).toBeTruthy();
      expect(entry.english).toBeTruthy();
      expect(entry.vietnamese).toBeTruthy();
      expect(entry.filipino).toBeTruthy();
      expect(entry.jlptLevel).toMatch(/^N[1-5]$/);
      expect(entry.source.id).toBe('jmdict-edrdg');
      expect(entry.source.license).toBe('CC BY-SA 4.0');
      expect(entry.source.sourceId).toBeTruthy();
      expect(entry.reviewStatus).toBe('sensei-ready');
    }
  });
});

describe('Phase 18C generated KANJIDIC2 starter kanji', () => {
  it('contains N5 kanji metadata with source metadata', () => {
    expect(generatedKanjidic2StarterKanji.length).toBeGreaterThanOrEqual(15);

    const uniqueKanji = new Set(generatedKanjidic2StarterKanji.map((entry) => entry.kanji));
    expect(uniqueKanji.size).toBe(generatedKanjidic2StarterKanji.length);

    for (const entry of generatedKanjidic2StarterKanji) {
      expect(entry.kanji).toMatch(/\p{Script=Han}/u);
      expect(entry.meanings.length).toBeGreaterThan(0);
      expect(entry.onReadings.length + entry.kunReadings.length).toBeGreaterThan(0);
      expect(entry.strokeCount).toBeGreaterThan(0);
      expect(entry.jlptLevel).toBe('N5');
      expect(entry.source.id).toBe('kanjidic2-edrdg');
      expect(entry.source.license).toBe('CC BY-SA 4.0');
      expect(entry.source.sourceId).toBeTruthy();
      expect(entry.reviewStatus).toBe('sensei-ready');
    }
  });
});
