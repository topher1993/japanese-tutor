import { JLPT_EXAM_CONTENT_VERSION } from '../data/jlptExamBlueprints';
import { grammarLessons } from '../data/grammarLessons';
import { mockSenseiLessons } from '../data/mockSenseiLessons';
import { getExampleSentencesForApp } from '../data/candidates/exampleSentenceCandidatePack';
import { getN3VocabularyCandidatePack } from '../data/candidates/n3VocabularyCandidatePack';
import { getN4KanjiCandidatePack, getN4VocabularyCandidatePack } from '../data/candidates/n4CandidatePack';
import { getN5KanjiCandidatePack } from '../data/candidates/n5KanjiCandidatePack';
import { getN5VocabularyCandidatePack } from '../data/candidates/n5VocabularyCandidatePack';
import type {
  JlptChoiceId,
  JlptExamChoice,
  JlptExamQuestion,
  JlptExamSourceRef,
  JlptItemType,
  JlptLevel,
  JlptScoringGroup,
} from '../types/jlptExam';

const CHOICE_IDS: JlptChoiceId[] = ['A', 'B', 'C', 'D'];

interface VocabularySeed {
  id: string;
  level: JlptLevel;
  japanese: string;
  kana: string;
  english: string;
  partOfSpeech: string;
  source: JlptExamSourceRef;
}

interface AuthoredReadingSeed {
  id: string;
  level: JlptLevel;
  itemType: 'reading-short' | 'reading-medium' | 'reading-long' | 'information-retrieval';
  title: string;
  text: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

export const JLPT_EXAM_SOURCE_LICENSE_POLICY: Readonly<
  Record<JlptExamSourceRef['kind'], readonly string[]>
> = Object.freeze({
  jmdict: Object.freeze(['CC BY-SA 4.0']),
  kanjidic2: Object.freeze(['CC BY-SA 4.0']),
  'app-lesson': Object.freeze([
    'In-app Japanese Tutor curriculum',
    'In-app Sensei lesson content',
  ]),
  'app-authored': Object.freeze(['Original in-app content']),
});

export function isJlptExamSourceEligible(source: JlptExamSourceRef | undefined): boolean {
  if (!source || !source.sourceId.trim() || !source.license.trim()) return false;
  return JLPT_EXAM_SOURCE_LICENSE_POLICY[source.kind].includes(source.license);
}

export function isJlptExamCandidateEligible(
  reviewStatus: string,
  source: JlptExamSourceRef | undefined,
): boolean {
  return reviewStatus === 'approved-for-beta' && isJlptExamSourceEligible(source);
}

export function isJlptExamLessonItemEligible(
  translationReviewStatus: string,
  source: JlptExamSourceRef | undefined,
): boolean {
  return translationReviewStatus === 'approved' && isJlptExamSourceEligible(source);
}

function choices(correct: string, alternatives: string[]): JlptExamChoice[] | undefined {
  const unique = [correct, ...alternatives]
    .map(text => text.trim())
    .filter(Boolean)
    .filter((text, index, all) => all.indexOf(text) === index)
    .slice(0, 4);
  if (unique.length !== 4) return undefined;
  return unique.map((text, index) => ({ id: CHOICE_IDS[index], text }));
}

function distractors<T>(pool: T[], currentIndex: number, value: (entry: T) => string): string[] {
  const result: string[] = [];
  // Return a cushion instead of exactly three. The choice builder removes a
  // distractor when its text is identical to the correct answer; a larger
  // candidate window keeps otherwise-valid source rows connected.
  for (let offset = 1; offset < pool.length && result.length < 64; offset += 1) {
    const text = value(pool[(currentIndex + offset) % pool.length]).trim();
    if (text && !result.includes(text)) result.push(text);
  }
  return result;
}

function scoringGroup(level: JlptLevel, itemType: JlptItemType): JlptScoringGroup {
  if (itemType.startsWith('listening-')) return 'listening';
  if (level === 'N4' || level === 'N5') return 'language-knowledge-reading';
  if (itemType.startsWith('reading-') || itemType === 'information-retrieval') return 'reading';
  return 'language-knowledge';
}

function sourceRef(source: { id: string; sourceId?: string; license: string }): JlptExamSourceRef | undefined {
  const id = source.sourceId ?? source.id;
  const lower = `${source.id} ${source.sourceId ?? ''}`.toLowerCase();
  const kind: JlptExamSourceRef['kind'] | undefined = lower.includes('kanjidic')
    ? 'kanjidic2'
    : lower.includes('jmdict')
      ? 'jmdict'
      : source.license === 'In-app Sensei lesson content'
        || source.license === 'In-app Japanese Tutor curriculum'
        ? 'app-lesson'
        : source.license === 'Original in-app content'
          ? 'app-authored'
          : undefined;
  if (!kind) return undefined;
  const resolved: JlptExamSourceRef = {
    sourceId: id,
    license: source.license,
    kind,
    attribution: lower.includes('jmdict') || lower.includes('kanjidic') ? 'EDRDG' : 'Japanese Tutor',
  };
  return isJlptExamSourceEligible(resolved) ? resolved : undefined;
}

function vocabularySeeds(level: JlptLevel): VocabularySeed[] {
  if (level === 'N5') {
    return getN5VocabularyCandidatePack()
      .flatMap(entry => {
        const source = sourceRef(entry.source);
        if (!source || !isJlptExamCandidateEligible(entry.reviewStatus, source)) return [];
        return [{
          id: entry.id,
          level,
          japanese: entry.japanese,
          kana: entry.kana,
          english: entry.english,
          partOfSpeech: entry.partOfSpeech ?? 'expression',
          source,
        }];
      });
  }
  if (level === 'N4') {
    return getN4VocabularyCandidatePack()
      .flatMap(entry => {
        const source = sourceRef(entry.source);
        if (!source || !isJlptExamCandidateEligible(entry.reviewStatus, source)) return [];
        return [{
          id: entry.id,
          level,
          japanese: entry.japanese,
          kana: entry.kana,
          english: entry.english,
          partOfSpeech: entry.partOfSpeech,
          source,
        }];
      });
  }
  return getN3VocabularyCandidatePack()
    .flatMap(entry => {
      const source = sourceRef(entry.source);
      if (!source || !isJlptExamCandidateEligible(entry.reviewStatus, source)) return [];
      return [{
        id: entry.id,
        level,
        japanese: entry.japanese,
        kana: entry.kana,
        english: entry.english,
        partOfSpeech: entry.partOfSpeech,
        source,
      }];
    });
}

function vocabularyContext(entry: VocabularySeed): string {
  const partOfSpeech = entry.partOfSpeech.toLowerCase();
  if (partOfSpeech.includes('verb') || partOfSpeech.includes('&v')) {
    return `A: 明日は何をする予定ですか。\nB: 明日は＿＿つもりです。`;
  }
  if (partOfSpeech.includes('adjective') || partOfSpeech.includes('adj-') || partOfSpeech.includes('&adj')) {
    return `A: その場所はどうですか。\nB: とても＿＿です。`;
  }
  if (partOfSpeech.includes('noun') || partOfSpeech.includes('&n;')) {
    return `A: 今日の話題は何ですか。\nB: ＿＿についてです。`;
  }
  return `A: この場面では何と言いますか。\nB: ＿＿。`;
}

function buildVocabularyQuestions(level: JlptLevel): JlptExamQuestion[] {
  const pool = vocabularySeeds(level)
    .filter(entry => entry.japanese.trim() && entry.kana.trim() && entry.english.trim());
  const types: JlptItemType[] = level === 'N5'
    ? ['kanji-reading', 'orthography', 'contextual-expression', 'paraphrase']
    : ['kanji-reading', 'orthography', 'contextual-expression', 'paraphrase', 'vocabulary-usage'];

  return pool.flatMap((entry, index): JlptExamQuestion[] => types.flatMap((itemType): JlptExamQuestion[] => {
    let prompt: string;
    let correct: string;
    let alternatives: string[];
    if (itemType === 'kanji-reading') {
      prompt = `How is 「${entry.japanese}」 read?`;
      correct = entry.kana;
      alternatives = distractors(pool, index, candidate => candidate.kana);
    } else if (itemType === 'orthography') {
      prompt = `Which word is written 「${entry.kana}」?`;
      correct = entry.japanese;
      alternatives = distractors(pool, index, candidate => candidate.japanese);
    } else if (itemType === 'paraphrase') {
      prompt = `Choose the closest meaning of 「${entry.japanese}」.`;
      correct = entry.english;
      alternatives = distractors(pool, index, candidate => candidate.english);
    } else if (itemType === 'vocabulary-usage') {
      prompt = `${vocabularyContext(entry)}\nChoose the expression that best completes the context and means “${entry.english}”.`;
      correct = entry.japanese;
      alternatives = [
        ...distractors(pool.filter(candidate => candidate.partOfSpeech === entry.partOfSpeech), index, candidate => candidate.japanese),
        ...distractors(pool, index, candidate => candidate.japanese),
      ];
    } else {
      prompt = `${vocabularyContext(entry)}\nChoose the word that best completes the conversation and means “${entry.english}”.`;
      correct = entry.japanese;
      const contextualPool = pool.filter(candidate => candidate.partOfSpeech === entry.partOfSpeech);
      alternatives = [
        ...distractors(contextualPool, index, candidate => candidate.japanese),
        ...distractors(pool, index, candidate => candidate.japanese),
      ];
    }
    const builtChoices = choices(correct, alternatives);
    if (!builtChoices) return [];
    return [{
      id: `jlpt-${level.toLowerCase()}-vocab-${itemType}-${entry.id}`,
      level,
      section: 'vocabulary',
      scoringGroup: scoringGroup(level, itemType),
      itemType,
      prompt,
      choices: builtChoices,
      correctChoice: 'A',
      explanation: `${entry.japanese} is read ${entry.kana} and means ${entry.english}.`,
      sourceRefs: [entry.source],
      reviewStatus: 'approved-for-exam',
      contentVersion: JLPT_EXAM_CONTENT_VERSION,
    }];
  }));
}

function buildKanjiQuestions(level: 'N5' | 'N4'): JlptExamQuestion[] {
  const pool = level === 'N5'
    ? getN5KanjiCandidatePack()
      .flatMap(entry => {
        const examSource = sourceRef(entry.source);
        if (!examSource || !isJlptExamCandidateEligible(entry.reviewStatus, examSource)) return [];
        return [{ ...entry, readings: [...entry.onReadings, ...entry.kunReadings], examSource }];
      })
    : getN4KanjiCandidatePack()
      .flatMap(entry => {
        const source = { id: 'kanjidic2-edrdg', license: 'CC BY-SA 4.0' };
        const examSource = sourceRef(source);
        if (!examSource || !isJlptExamCandidateEligible(entry.reviewStatus, examSource)) return [];
        return [{ ...entry, readings: [...entry.onyomi, ...entry.kunyomi], source, examSource }];
      });
  const usable = pool.filter(entry => entry.kanji.length === 1 && entry.readings.some(reading => reading && !reading.includes('pending')));
  return usable.flatMap((entry, index): JlptExamQuestion[] => {
    const correct = entry.readings.find(Boolean) ?? '';
    const builtChoices = choices(correct, distractors(usable, index, candidate => candidate.readings.find(Boolean) ?? ''));
    if (!builtChoices) return [];
    return [{
      id: `jlpt-${level.toLowerCase()}-kanjidic-${entry.id}`,
      level,
      section: 'vocabulary',
      scoringGroup: scoringGroup(level, 'kanji-reading'),
      itemType: 'kanji-reading',
      prompt: `Choose a reading for 「${entry.kanji}」.`,
      choices: builtChoices,
      correctChoice: 'A',
      explanation: `${entry.kanji}: ${entry.meanings.join(', ')}; reading ${correct}.`,
      sourceRefs: [entry.examSource],
      reviewStatus: 'approved-for-exam',
      contentVersion: JLPT_EXAM_CONTENT_VERSION,
    }];
  });
}

function buildGrammarQuestions(level: JlptLevel): JlptExamQuestion[] {
  const lessonPool = level === 'N3'
    ? mockSenseiLessons.filter(lesson => lesson.level === 'N3')
    : grammarLessons;
  const pool = lessonPool
    .filter(lesson => lesson.level === level)
    .flatMap(lesson => {
      const examSource = sourceRef({
        id: lesson.id,
        license: 'In-app Japanese Tutor curriculum',
      });
      if (!examSource) return [];
      return lesson.items
        .filter(item => isJlptExamLessonItemEligible(item.translationReviewStatus, examSource))
        .map(item => ({ item, examSource }));
    })
    .filter(({ item }) => item.japanese && item.english && item.exampleJapanese);
  const itemTypes: Array<'grammar-form' | 'sentence-composition' | 'text-grammar'> = [
    'grammar-form',
    'sentence-composition',
    'text-grammar',
  ];
  return pool.flatMap(({ item, examSource }, index) => itemTypes.flatMap((itemType): JlptExamQuestion[] => {
    const correct = itemType === 'sentence-composition' ? item.exampleJapanese : item.japanese;
    const alternativePool = pool.filter(candidate => candidate.item.id !== item.id);
    const alternatives = distractors(alternativePool, index, candidate =>
      itemType === 'sentence-composition' ? candidate.item.exampleJapanese : candidate.item.japanese);
    const builtChoices = choices(correct, alternatives);
    if (!builtChoices) return [];
    const prompt = itemType === 'grammar-form'
      ? `Which pattern matches this rule? ${item.english}`
      : itemType === 'sentence-composition'
        ? `Which sentence correctly demonstrates this pattern? ${item.english}`
        : 'Which grammar pattern is used in the example?';
    return [{
      id: `jlpt-${level.toLowerCase()}-grammar-${itemType}-${item.id}`,
      level,
      section: 'grammar-reading',
      scoringGroup: scoringGroup(level, itemType),
      itemType,
      prompt,
      choices: builtChoices,
      correctChoice: 'A',
      explanation: `${item.english} Formation: ${item.formation ?? item.romaji}.`,
      ...(itemType === 'text-grammar' ? {
        stimulus: { kind: 'passage' as const, text: item.exampleJapanese, title: 'Example' },
      } : {}),
      sourceRefs: [examSource],
      reviewStatus: 'approved-for-exam',
      contentVersion: JLPT_EXAM_CONTENT_VERSION,
    }];
  }));
}

export const JLPT_AUTHORED_READING_EXAM_REVIEWS: Readonly<
  Record<string, { status: 'approved'; contentVersion: string }>
> = Object.freeze({
  'n5-meeting': { status: 'approved', contentVersion: JLPT_EXAM_CONTENT_VERSION },
  'n5-train': { status: 'approved', contentVersion: JLPT_EXAM_CONTENT_VERSION },
  'n5-shopping': { status: 'approved', contentVersion: JLPT_EXAM_CONTENT_VERSION },
  'n5-library': { status: 'approved', contentVersion: JLPT_EXAM_CONTENT_VERSION },
  'n4-shift': { status: 'approved', contentVersion: JLPT_EXAM_CONTENT_VERSION },
  'n4-delivery': { status: 'approved', contentVersion: JLPT_EXAM_CONTENT_VERSION },
  'n4-email': { status: 'approved', contentVersion: JLPT_EXAM_CONTENT_VERSION },
  'n4-clinic': { status: 'approved', contentVersion: JLPT_EXAM_CONTENT_VERSION },
  'n4-pool': { status: 'approved', contentVersion: JLPT_EXAM_CONTENT_VERSION },
  'n3-remote': { status: 'approved', contentVersion: JLPT_EXAM_CONTENT_VERSION },
  'n3-repair': { status: 'approved', contentVersion: JLPT_EXAM_CONTENT_VERSION },
  'n3-volunteer': { status: 'approved', contentVersion: JLPT_EXAM_CONTENT_VERSION },
  'n3-course': { status: 'approved', contentVersion: JLPT_EXAM_CONTENT_VERSION },
  'n3-feedback': { status: 'approved', contentVersion: JLPT_EXAM_CONTENT_VERSION },
  'n3-center': { status: 'approved', contentVersion: JLPT_EXAM_CONTENT_VERSION },
});

function isAuthoredReadingApproved(seed: AuthoredReadingSeed): boolean {
  const review = JLPT_AUTHORED_READING_EXAM_REVIEWS[seed.id];
  return review?.status === 'approved' && review.contentVersion === JLPT_EXAM_CONTENT_VERSION;
}

const AUTHORED_READING: AuthoredReadingSeed[] = [
  { id: 'n5-meeting', level: 'N5', itemType: 'reading-short', title: 'Meeting', text: 'あした、田中さんは八時に会社へ行きます。会議は九時からです。', prompt: '会議は何時からですか。', choices: ['九時', '八時', '十時', '七時'], correctIndex: 0, explanation: 'The passage says the meeting starts at nine.' },
  { id: 'n5-train', level: 'N5', itemType: 'reading-short', title: 'Rainy day', text: '今日は雨です。山田さんは電車で学校へ行きます。', prompt: '山田さんは何で学校へ行きますか。', choices: ['電車', 'バス', '自転車', '歩いて'], correctIndex: 0, explanation: 'Yamada goes to school by train.' },
  { id: 'n5-shopping', level: 'N5', itemType: 'reading-medium', title: 'Shopping', text: '日曜日にスーパーへ行きました。りんごを三つと牛乳を一本買いました。パンは買いませんでした。', prompt: '何を買いませんでしたか。', choices: ['パン', 'りんご', '牛乳', 'スーパー'], correctIndex: 0, explanation: 'The writer did not buy bread.' },
  { id: 'n5-library', level: 'N5', itemType: 'information-retrieval', title: 'Library notice', text: '図書館　火曜日〜日曜日　午前九時〜午後六時　月曜日は休み', prompt: '図書館が休みなのはいつですか。', choices: ['月曜日', '火曜日', '土曜日', '日曜日'], correctIndex: 0, explanation: 'The notice says the library is closed Monday.' },
  { id: 'n4-shift', level: 'N4', itemType: 'reading-short', title: 'Shift change', text: '佐藤さんへ。明日の仕事は十時からではなく、十一時からになりました。昼ご飯を食べてから来てください。', prompt: '佐藤さんは明日、何時から仕事をしますか。', choices: ['十一時', '十時', '十二時', '九時'], correctIndex: 0, explanation: 'The shift was changed to eleven.' },
  { id: 'n4-delivery', level: 'N4', itemType: 'reading-short', title: 'Delivery', text: '荷物は金曜日の午後に届く予定でしたが、雨のため土曜日の午前に変わりました。', prompt: '荷物はいつ届く予定ですか。', choices: ['土曜日の午前', '金曜日の午後', '土曜日の午後', '金曜日の午前'], correctIndex: 0, explanation: 'Rain delayed delivery until Saturday morning.' },
  { id: 'n4-email', level: 'N4', itemType: 'reading-medium', title: 'Email', text: '来週の研修についてお知らせします。月曜日はオンラインで説明を聞き、火曜日は会社で練習します。ノートパソコンは月曜日だけ必要です。', prompt: 'ノートパソコンが必要なのはいつですか。', choices: ['月曜日だけ', '火曜日だけ', '月曜日と火曜日', '必要ではない'], correctIndex: 0, explanation: 'A laptop is required only Monday.' },
  { id: 'n4-clinic', level: 'N4', itemType: 'reading-medium', title: 'Clinic appointment', text: '健康診断は予約した時間の十五分前に来てください。朝の予約の人は、検査が終わるまで朝ご飯を食べないでください。水は飲んでもかまいません。', prompt: '朝に検査を受ける人は何をしてもいいですか。', choices: ['水を飲む', '朝ご飯を食べる', '予約時間に遅れる', '検査の後も何も食べない'], correctIndex: 0, explanation: 'The notice permits water before the examination.' },
  { id: 'n4-pool', level: 'N4', itemType: 'information-retrieval', title: 'Pool schedule', text: '市民プール　平日 9:00〜20:00　土日 10:00〜18:00　水曜日は清掃のため休館', prompt: 'プールを利用できない日はいつですか。', choices: ['水曜日', '月曜日', '土曜日', '日曜日'], correctIndex: 0, explanation: 'The pool is closed Wednesday for cleaning.' },
  { id: 'n3-remote', level: 'N3', itemType: 'reading-short', title: 'Remote work', text: '来月から在宅勤務は週二日まで選べることになった。ただし、チーム会議がある水曜日は全員が出社しなければならない。', prompt: '必ず会社に行かなければならないのはいつですか。', choices: ['水曜日', '月曜日', '金曜日', '週末'], correctIndex: 0, explanation: 'Everyone must be in the office Wednesday.' },
  { id: 'n3-repair', level: 'N3', itemType: 'reading-short', title: 'Repair', text: '駅のエレベーターは工事のため今週使えない。階段を利用しにくい人は、東口のエスカレーターを使うよう案内されている。', prompt: '階段を使いにくい人はどうすればいいですか。', choices: ['東口のエスカレーターを使う', '工事が終わるまで駅を使わない', '西口のエレベーターを使う', '駅員に車で送ってもらう'], correctIndex: 0, explanation: 'The notice directs them to the east-exit escalator.' },
  { id: 'n3-volunteer', level: 'N3', itemType: 'reading-medium', title: 'Volunteer event', text: '地域の清掃活動は日曜日の朝に行われる。参加者は八時に公園へ集合し、軍手を持参する。雨の場合は翌週に延期され、連絡は当日の六時までにメールで届く。', prompt: '雨の場合、参加者はどうやって予定を確認しますか。', choices: ['当日六時までのメール', '公園の掲示板', '前日の電話', '市役所の放送'], correctIndex: 0, explanation: 'An email is sent by six on the day.' },
  { id: 'n3-course', level: 'N3', itemType: 'reading-medium', title: 'Evening course', text: '夜の日本語講座は仕事をしている人向けだ。授業は週二回だが、どちらか一日だけ参加することもできる。欠席した回の資料はオンラインで読める。', prompt: 'この講座について正しいものはどれですか。', choices: ['週一回だけ参加することもできる', '仕事をしていない人だけが参加できる', '欠席すると資料を読めない', '授業は毎日ある'], correctIndex: 0, explanation: 'Learners may attend only one of the two weekly days.' },
  { id: 'n3-feedback', level: 'N3', itemType: 'reading-long', title: 'Workplace feedback', text: '新しい作業手順を導入した直後は、以前より時間がかかるという意見が多かった。しかし、一か月後に調べると、作業ミスが減り、全体の時間も短くなっていた。管理者は、最初の不便さだけで判断せず、一定期間試してから改善点を集めることが大切だと説明した。', prompt: '管理者が最も伝えたいことは何ですか。', choices: ['新しい方法は一定期間試して評価するべきだ', '以前の手順にすぐ戻すべきだ', '作業時間だけを調べるべきだ', '意見を集める必要はない'], correctIndex: 0, explanation: 'The main point is to evaluate a new process after a meaningful trial.' },
  { id: 'n3-center', level: 'N3', itemType: 'information-retrieval', title: 'Community center', text: '会議室A: 9:00〜17:00・20人まで　会議室B: 13:00〜21:00・10人まで　予約変更は利用日の二日前まで', prompt: '十五人で午後六時から利用できる部屋はありますか。', choices: ['ない', '会議室A', '会議室B', 'どちらでもよい'], correctIndex: 0, explanation: 'A closes at five; B is limited to ten people.' },
];

function buildReadingQuestions(level: JlptLevel): JlptExamQuestion[] {
  return AUTHORED_READING.filter(seed => seed.level === level && isAuthoredReadingApproved(seed)).flatMap(seed => {
    const correctText = seed.choices[seed.correctIndex];
    const builtChoices = choices(correctText, seed.choices.filter((_, index) => index !== seed.correctIndex));
    const examSource = sourceRef({
      id: `japanese-tutor:${seed.id}`,
      license: 'Original in-app content',
    });
    if (!builtChoices || !examSource) return [];
    return [{
      id: `jlpt-${level.toLowerCase()}-reading-${seed.id}`,
      level,
      section: 'grammar-reading' as const,
      scoringGroup: scoringGroup(level, seed.itemType),
      itemType: seed.itemType,
      prompt: seed.prompt,
      choices: builtChoices,
      correctChoice: 'A' as const,
      explanation: seed.explanation,
      stimulus: { kind: seed.itemType === 'information-retrieval' ? 'notice' as const : 'passage' as const, title: seed.title, text: seed.text },
      sourceRefs: [examSource],
      reviewStatus: 'approved-for-exam' as const,
      contentVersion: JLPT_EXAM_CONTENT_VERSION,
    }];
  });
}

function completeJapaneseSentence(text: string): string {
  const trimmed = text.trim();
  return /[。！？]$/u.test(trimmed) ? trimmed : `${trimmed}。`;
}

function buildListeningQuestions(level: JlptLevel): JlptExamQuestion[] {
  const allowed: JlptItemType[] = level === 'N3'
    ? ['listening-task', 'listening-key-point', 'listening-outline', 'listening-expression', 'listening-quick-response']
    : ['listening-task', 'listening-key-point', 'listening-expression', 'listening-quick-response'];
  const approvedLessonExamples = new Set(
    mockSenseiLessons.flatMap(lesson => lesson.items
      .filter(item => item.translationReviewStatus === 'approved')
      .map(item => `lesson-example-${item.id}`)),
  );
  const pool = getExampleSentencesForApp()
    .flatMap(sentence => {
      const examSource = sourceRef(sentence.source);
      const approvedTranslation = approvedLessonExamples.has(sentence.id);
      if (!sentence.connectedToApp
        || sentence.jlptLevel !== level
        || !sentence.japanese.trim()
        || !sentence.english.trim()
        || !approvedTranslation
        || !examSource
        || !isJlptExamCandidateEligible(sentence.reviewStatus, examSource)) return [];
      return [{ ...sentence, examSource }];
    });

  return pool.flatMap((sentence, index): JlptExamQuestion[] => allowed.flatMap((itemType): JlptExamQuestion[] => {
    let audioText = sentence.japanese;
    let prompt: string;
    let correct = sentence.english;
    let alternatives = distractors(pool, index, candidate => candidate.english);
    let explanation = `${sentence.japanese} means: ${sentence.english}`;
    let sourceRefs: JlptExamSourceRef[] = [sentence.examSource];

    if (itemType === 'listening-task') {
      prompt = 'Listen to the app-reviewed script. What message or action does the speaker communicate?';
    } else if (itemType === 'listening-key-point') {
      prompt = 'Listen to the app-reviewed script. What is the speaker’s key point?';
    } else if (itemType === 'listening-outline') {
      const companion = pool[(index + 1) % pool.length];
      audioText = `${completeJapaneseSentence(sentence.japanese)} ${completeJapaneseSentence(companion.japanese)}`;
      correct = `${sentence.english} ${companion.english}`;
      alternatives = distractors(pool, index, (candidate) => {
        const candidateIndex = pool.indexOf(candidate);
        const candidateCompanion = pool[(candidateIndex + 2) % pool.length];
        return `${candidate.english} ${candidateCompanion.english}`;
      });
      prompt = 'Listen to both statements. Which option best summarizes the overall message?';
      explanation = `The two statements mean: ${correct}`;
      sourceRefs = Array.from(new Map(
        [sentence.examSource, companion.examSource].map(source => [source.sourceId, source]),
      ).values());
    } else if (itemType === 'listening-expression') {
      prompt = 'Listen to the expression. What does the speaker communicate in this situation?';
    } else {
      const text = sentence.japanese;
      if (text.includes('おはよう')) correct = 'おはようございます。';
      else if (text.includes('ありがとう')) correct = 'どういたしまして。';
      else if (text.includes('すみません')) correct = 'はい、どうしましたか。';
      else if (text.includes('ください') || text.includes('お願いします')) correct = 'はい、わかりました。';
      else correct = 'はい、わかりました。';
      alternatives = [
        'いいえ、何もしません。',
        '時間はありません。',
        'さようなら。',
        'もう食べました。',
      ].filter(candidate => candidate !== correct);
      prompt = 'Listen to the speaker. Which reply is the most natural immediate response?';
      explanation = `An appropriate immediate response is 「${correct}」`;
    }

    const builtChoices = choices(correct, alternatives);
    if (!builtChoices) return [];
    return [{
      id: `jlpt-${level.toLowerCase()}-listening-${itemType}-${sentence.id}`,
      level,
      section: 'listening',
      scoringGroup: 'listening',
      itemType,
      prompt,
      choices: builtChoices,
      correctChoice: 'A',
      explanation,
      stimulus: {
        kind: 'audio',
        title: 'Text-to-speech practice script',
        audioText,
        transcript: audioText,
      },
      sourceRefs,
      reviewStatus: 'approved-for-exam',
      contentVersion: JLPT_EXAM_CONTENT_VERSION,
      audioPlayLimit: 1,
    }];
  }));
}

export function buildJlptExamQuestionBank(level: JlptLevel): JlptExamQuestion[] {
  const bank = [
    ...buildVocabularyQuestions(level),
    ...(level === 'N5' || level === 'N4' ? buildKanjiQuestions(level) : []),
    ...buildGrammarQuestions(level),
    ...buildReadingQuestions(level),
    ...buildListeningQuestions(level),
  ];
  const byId = new Map<string, JlptExamQuestion>();
  for (const question of bank) {
    if (question.reviewStatus !== 'approved-for-exam') continue;
    if (question.choices.length < 3 || question.choices.length > 4) continue;
    if (new Set(question.choices.map(choice => choice.text.trim().toLowerCase())).size !== question.choices.length) continue;
    if (!question.choices.some(choice => choice.id === question.correctChoice)) continue;
    if (question.sourceRefs.length === 0 || !question.sourceRefs.every(isJlptExamSourceEligible)) continue;
    byId.set(question.id, question);
  }
  return Array.from(byId.values());
}

export function getJlptExamQuestionBankCounts(level: JlptLevel) {
  const questions = buildJlptExamQuestionBank(level);
  const byItemType = questions.reduce<Partial<Record<JlptItemType, number>>>((counts, question) => {
    counts[question.itemType] = (counts[question.itemType] ?? 0) + 1;
    return counts;
  }, {});
  return { total: questions.length, byItemType };
}
