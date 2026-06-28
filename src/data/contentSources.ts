export type JapaneseContentSource = {
  id: 'jmdict-edrdg' | 'kanjidic2-edrdg' | 'tatoeba';
  name: string;
  owner: string;
  license: string;
  homepageUrl: string;
  licenseUrl: string;
  downloadUrl?: string;
  requiresAttribution: boolean;
  requiresUpdateProcedure: boolean;
  recommendedUse: string[];
  betaPolicy: string;
};

export const japaneseContentSources: JapaneseContentSource[] = [
  {
    id: 'jmdict-edrdg',
    name: 'JMdict / EDICT Japanese Dictionary Project',
    owner: 'Electronic Dictionary Research and Development Group (EDRDG)',
    license: 'CC BY-SA 4.0',
    homepageUrl: 'https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project',
    licenseUrl: 'https://www.edrdg.org/edrdg/licence.html',
    downloadUrl: 'http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz',
    requiresAttribution: true,
    requiresUpdateProcedure: true,
    recommendedUse: [
      'starter vocabulary meanings',
      'kana readings',
      'part-of-speech metadata',
      'source validation for curated flashcards',
    ],
    betaPolicy:
      'Use imported entries only after curation metadata is preserved and Sensei-ready learner translations are added.',
  },
  {
    id: 'kanjidic2-edrdg',
    name: 'KANJIDIC2 Kanji Dictionary Project',
    owner: 'Electronic Dictionary Research and Development Group (EDRDG)',
    license: 'CC BY-SA 4.0',
    homepageUrl: 'https://www.edrdg.org/wiki/index.php/KANJIDIC_Project',
    licenseUrl: 'https://www.edrdg.org/edrdg/licence.html',
    downloadUrl: 'http://ftp.edrdg.org/pub/Nihongo/kanjidic2.xml.gz',
    requiresAttribution: true,
    requiresUpdateProcedure: true,
    recommendedUse: [
      'N5/N4 kanji cards',
      'stroke counts',
      'on/kun readings',
      'kanji meaning metadata',
    ],
    betaPolicy:
      'Use curated kanji metadata with source IDs and avoid special reference-code fields until licensing has been rechecked.',
  },
  {
    id: 'tatoeba',
    name: 'Tatoeba sentence corpus',
    owner: 'Tatoeba contributors',
    license: 'CC BY 2.0 FR / CC0 subset',
    homepageUrl: 'https://tatoeba.org/en/downloads',
    licenseUrl: 'https://tatoeba.org/en/downloads',
    downloadUrl: 'https://downloads.tatoeba.org/exports/sentences.tar.bz2',
    requiresAttribution: true,
    requiresUpdateProcedure: false,
    recommendedUse: [
      'candidate example sentences',
      'translation-pair discovery',
      'post-import Sensei review queues',
    ],
    betaPolicy:
      'Treat as candidate-only content until sentence IDs, contributor attribution, review quality, and learner level are checked.',
  },
];

export function getContentSourceAcknowledgementText(): string {
  return [
    'Japanese Tutor uses curated Japanese-learning content informed by Creative Commons source datasets.',
    'Vocabulary metadata may include material from JMdict / EDICT, provided by the Electronic Dictionary Research and Development Group (EDRDG), under Creative Commons Attribution-ShareAlike 4.0.',
    'Kanji metadata may include material from KANJIDIC2, provided by EDRDG, under Creative Commons Attribution-ShareAlike 4.0.',
    'Example sentence candidates may be reviewed from Tatoeba, whose downloadable sentence files are released under CC BY 2.0 FR with a CC0 subset.',
    'All source-backed app content is curated for learners and should not imply endorsement by EDRDG, Tatoeba, or their contributors.',
  ].join('\n\n');
}
