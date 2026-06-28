export type GeneratedJmdictStarterVocabularyEntry = {
  japanese: string;
  kana: string;
  romaji: string;
  english: string;
  vietnamese: string;
  filipino: string;
  partOfSpeech: string;
  jlptLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  source: {
    id: 'jmdict-edrdg';
    sourceId: string;
    license: 'CC BY-SA 4.0';
  };
  reviewStatus: 'sensei-ready';
};

export const generatedJmdictStarterVocabulary: GeneratedJmdictStarterVocabularyEntry[] = [
  { japanese: '私', kana: 'わたし', romaji: 'watashi', english: 'I; me', vietnamese: 'tôi', filipino: 'ako', partOfSpeech: 'pronoun', jlptLevel: 'N5', source: { id: 'jmdict-edrdg', sourceId: 'curated-seed:watashi', license: 'CC BY-SA 4.0' }, reviewStatus: 'sensei-ready' },
  { japanese: 'あなた', kana: 'あなた', romaji: 'anata', english: 'you', vietnamese: 'bạn', filipino: 'ikaw', partOfSpeech: 'pronoun', jlptLevel: 'N5', source: { id: 'jmdict-edrdg', sourceId: 'curated-seed:anata', license: 'CC BY-SA 4.0' }, reviewStatus: 'sensei-ready' },
  { japanese: '水', kana: 'みず', romaji: 'mizu', english: 'water', vietnamese: 'nước', filipino: 'tubig', partOfSpeech: 'noun', jlptLevel: 'N5', source: { id: 'jmdict-edrdg', sourceId: 'curated-seed:mizu', license: 'CC BY-SA 4.0' }, reviewStatus: 'sensei-ready' },
  { japanese: '食べる', kana: 'たべる', romaji: 'taberu', english: 'to eat', vietnamese: 'ăn', filipino: 'kumain', partOfSpeech: 'verb', jlptLevel: 'N5', source: { id: 'jmdict-edrdg', sourceId: 'curated-seed:taberu', license: 'CC BY-SA 4.0' }, reviewStatus: 'sensei-ready' },
  { japanese: '飲む', kana: 'のむ', romaji: 'nomu', english: 'to drink', vietnamese: 'uống', filipino: 'uminom', partOfSpeech: 'verb', jlptLevel: 'N5', source: { id: 'jmdict-edrdg', sourceId: 'curated-seed:nomu', license: 'CC BY-SA 4.0' }, reviewStatus: 'sensei-ready' },
  { japanese: '行く', kana: 'いく', romaji: 'iku', english: 'to go', vietnamese: 'đi', filipino: 'pumunta', partOfSpeech: 'verb', jlptLevel: 'N5', source: { id: 'jmdict-edrdg', sourceId: 'curated-seed:iku', license: 'CC BY-SA 4.0' }, reviewStatus: 'sensei-ready' },
  { japanese: '来る', kana: 'くる', romaji: 'kuru', english: 'to come', vietnamese: 'đến', filipino: 'dumating', partOfSpeech: 'verb', jlptLevel: 'N5', source: { id: 'jmdict-edrdg', sourceId: 'curated-seed:kuru', license: 'CC BY-SA 4.0' }, reviewStatus: 'sensei-ready' },
  { japanese: '見る', kana: 'みる', romaji: 'miru', english: 'to see; to look', vietnamese: 'nhìn; xem', filipino: 'tumingin; manood', partOfSpeech: 'verb', jlptLevel: 'N5', source: { id: 'jmdict-edrdg', sourceId: 'curated-seed:miru', license: 'CC BY-SA 4.0' }, reviewStatus: 'sensei-ready' },
  { japanese: '聞く', kana: 'きく', romaji: 'kiku', english: 'to hear; to ask', vietnamese: 'nghe; hỏi', filipino: 'makinig; magtanong', partOfSpeech: 'verb', jlptLevel: 'N5', source: { id: 'jmdict-edrdg', sourceId: 'curated-seed:kiku', license: 'CC BY-SA 4.0' }, reviewStatus: 'sensei-ready' },
  { japanese: '話す', kana: 'はなす', romaji: 'hanasu', english: 'to speak', vietnamese: 'nói', filipino: 'magsalita', partOfSpeech: 'verb', jlptLevel: 'N5', source: { id: 'jmdict-edrdg', sourceId: 'curated-seed:hanasu', license: 'CC BY-SA 4.0' }, reviewStatus: 'sensei-ready' },
  { japanese: '大きい', kana: 'おおきい', romaji: 'ookii', english: 'big', vietnamese: 'to; lớn', filipino: 'malaki', partOfSpeech: 'i-adjective', jlptLevel: 'N5', source: { id: 'jmdict-edrdg', sourceId: 'curated-seed:ookii', license: 'CC BY-SA 4.0' }, reviewStatus: 'sensei-ready' },
  { japanese: '小さい', kana: 'ちいさい', romaji: 'chiisai', english: 'small', vietnamese: 'nhỏ', filipino: 'maliit', partOfSpeech: 'i-adjective', jlptLevel: 'N5', source: { id: 'jmdict-edrdg', sourceId: 'curated-seed:chiisai', license: 'CC BY-SA 4.0' }, reviewStatus: 'sensei-ready' },
  { japanese: '新しい', kana: 'あたらしい', romaji: 'atarashii', english: 'new', vietnamese: 'mới', filipino: 'bago', partOfSpeech: 'i-adjective', jlptLevel: 'N5', source: { id: 'jmdict-edrdg', sourceId: 'curated-seed:atarashii', license: 'CC BY-SA 4.0' }, reviewStatus: 'sensei-ready' },
  { japanese: '古い', kana: 'ふるい', romaji: 'furui', english: 'old', vietnamese: 'cũ', filipino: 'luma', partOfSpeech: 'i-adjective', jlptLevel: 'N5', source: { id: 'jmdict-edrdg', sourceId: 'curated-seed:furui', license: 'CC BY-SA 4.0' }, reviewStatus: 'sensei-ready' },
  { japanese: '人', kana: 'ひと', romaji: 'hito', english: 'person', vietnamese: 'người', filipino: 'tao', partOfSpeech: 'noun', jlptLevel: 'N5', source: { id: 'jmdict-edrdg', sourceId: 'curated-seed:hito', license: 'CC BY-SA 4.0' }, reviewStatus: 'sensei-ready' },
  { japanese: '先生', kana: 'せんせい', romaji: 'sensei', english: 'teacher', vietnamese: 'giáo viên', filipino: 'guro', partOfSpeech: 'noun', jlptLevel: 'N5', source: { id: 'jmdict-edrdg', sourceId: 'curated-seed:sensei', license: 'CC BY-SA 4.0' }, reviewStatus: 'sensei-ready' },
  { japanese: '学生', kana: 'がくせい', romaji: 'gakusei', english: 'student', vietnamese: 'học sinh; sinh viên', filipino: 'estudyante', partOfSpeech: 'noun', jlptLevel: 'N5', source: { id: 'jmdict-edrdg', sourceId: 'curated-seed:gakusei', license: 'CC BY-SA 4.0' }, reviewStatus: 'sensei-ready' },
  { japanese: '学校', kana: 'がっこう', romaji: 'gakkou', english: 'school', vietnamese: 'trường học', filipino: 'paaralan', partOfSpeech: 'noun', jlptLevel: 'N5', source: { id: 'jmdict-edrdg', sourceId: 'curated-seed:gakkou', license: 'CC BY-SA 4.0' }, reviewStatus: 'sensei-ready' },
  { japanese: '仕事', kana: 'しごと', romaji: 'shigoto', english: 'work; job', vietnamese: 'công việc', filipino: 'trabaho', partOfSpeech: 'noun', jlptLevel: 'N5', source: { id: 'jmdict-edrdg', sourceId: 'curated-seed:shigoto', license: 'CC BY-SA 4.0' }, reviewStatus: 'sensei-ready' },
  { japanese: '休み', kana: 'やすみ', romaji: 'yasumi', english: 'rest; holiday', vietnamese: 'nghỉ; ngày nghỉ', filipino: 'pahinga; araw ng pahinga', partOfSpeech: 'noun', jlptLevel: 'N5', source: { id: 'jmdict-edrdg', sourceId: 'curated-seed:yasumi', license: 'CC BY-SA 4.0' }, reviewStatus: 'sensei-ready' },
];
