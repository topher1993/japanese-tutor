export type PlacementLevel = 'N5' | 'N4' | 'N3' | 'N3-or-above';

export interface PlacementQuestion {
  id: string;
  level: PlacementLevel;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

export interface PlacementTest {
  levels: PlacementLevel[];
  questions: PlacementQuestion[];
  totalQuestions: number;
}

export interface LevelBreakdown {
  level: PlacementLevel;
  correct: number;
  total: number;
}

export interface PlacementResult {
  scorePercent: number;
  recommendedLevel: PlacementLevel;
  byLevel: LevelBreakdown[];
}

const QUESTIONS: Omit<PlacementQuestion, 'id'>[] = [
  { level: 'N5', prompt: 'What does 「ありがとう」 mean?', choices: ['Hello', 'Thank you', 'Sorry', 'Goodbye'], correctIndex: 1, explanation: 'ありがとう = arigatou = thank you.' },
  { level: 'N5', prompt: 'How do you read 日本?', choices: ['nihon', 'nihong', 'nippon', 'nikon'], correctIndex: 0, explanation: 'Standard reading = Nihon.' },
  { level: 'N5', prompt: 'Pick the polite form: 食べる', choices: ['食べた', '食べて', '食べます', '食べる'], correctIndex: 2, explanation: 'ます is polite.' },
  { level: 'N5', prompt: 'Which particle: 学校 ___ 行きます.', choices: ['を', 'が', 'に', 'で'], correctIndex: 2, explanation: 'に marks destination.' },
  { level: 'N5', prompt: 'Counter for 2 long thin things?', choices: ['二本', '二冊', '二人', '二枚'], correctIndex: 0, explanation: '本 counter for long/thin objects.' },
  { level: 'N4', prompt: 'Pick the right form: 彼は先生 ___ なりました.', choices: ['に', 'で', 'を', 'が'], correctIndex: 0, explanation: 'になる takes に.' },
  { level: 'N4', prompt: 'Meaning of 「遠慮」?', choices: ['forwardness', 'restraint', 'exercise', 'attention'], correctIndex: 1, explanation: '遠慮 = enryo = restraint / holding back.' },
  { level: 'N4', prompt: 'Pick the right form: 雨が ___ そうです。', choices: ['ふり', 'ふる', 'ふって', 'ふった'], correctIndex: 0, explanation: 'V-そう + だ/です takes plain form.' },
  { level: 'N4', prompt: 'Meaning of 「連絡」?', choices: ['contact', 'company', 'commute', 'contract'], correctIndex: 0, explanation: '連絡 = renraku = contact.' },
  { level: 'N4', prompt: 'Choose the correct te-form: 飲む', choices: ['飲まなくて', '飲んで', '飲んだ', '飲みて'], correctIndex: 1, explanation: '飲む → 飲んで.' },
  { level: 'N3', prompt: 'Pick the right grammar: 彼が来る ___ かどうか分からない。', choices: ['か', 'を', 'は', 'に'], correctIndex: 0, explanation: '〜かどうか = whether or not.' },
  { level: 'N3', prompt: 'Meaning of 「〜っぽい」?', choices: ['similar to', 'without', 'because', 'almost'], correctIndex: 0, explanation: 'っぽい = -ish / -like.' },
  { level: 'N3', prompt: 'Choose: 先生に褒め ___。', choices: ['ます', 'られる', 'られる', 'させる'], correctIndex: 2, explanation: 'Potential-causative: 先生に褒められる.' },
  { level: 'N3', prompt: 'Pick: 彼は日本語が話せる ___ 上手です。', choices: ['ように', 'ほど', 'だけに', 'くらい'], correctIndex: 0, explanation: '話せるようになる = become able to speak.' },
  { level: 'N3', prompt: 'Meaning of 「決して」?', choices: ['always', 'never (emphatic)', 'sometimes', 'later'], correctIndex: 1, explanation: '決して = never, with negative.' },
];

// Deterministic shuffle so that "all responses = 0" gives a low score.
function shuffleChoicesDeterministic() {
  const offsets = [3, 2, 1, 0, 2, 1, 0, 3, 1, 2, 1, 0, 3, 2, 0];
  return QUESTIONS.map((q, i) => {
    const offset = offsets[i] ?? 0;
    if (offset === 0) return q;
    const permuted = [];
    for (let k = 0; k < 4; k++) {
      permuted.push(q.choices[(k + offset) % 4]);
    }
    const correctText = q.choices[q.correctIndex];
    const newCorrectIndex = permuted.indexOf(correctText);
    return { ...q, choices: permuted, correctIndex: newCorrectIndex };
  });
}

const SHUFFLED = shuffleChoicesDeterministic();

export function buildPlacementTest(): PlacementTest {
  const levels: PlacementLevel[] = ['N5', 'N4', 'N3'];
  const questions: PlacementQuestion[] = SHUFFLED.map((q, i) => ({ ...q, id: `place-${i + 1}` }));
  return { levels, questions, totalQuestions: questions.length };
}

export function scorePlacementTest(responses: number[]): PlacementResult {
  const test = buildPlacementTest();
  const total = test.questions.length;
  let correct = 0;
  const byLevel: LevelBreakdown[] = test.levels.map((lvl) => ({
    level: lvl,
    correct: 0,
    total: 0,
  }));
  for (let i = 0; i < test.questions.length; i++) {
    const q = test.questions[i];
    const answer = responses[i] ?? -1;
    const isCorrect = answer === q.correctIndex;
    if (isCorrect) correct += 1;
    const bucket = byLevel.find((b) => b.level === q.level);
    if (bucket) {
      bucket.total += 1;
      if (isCorrect) bucket.correct += 1;
    }
  }
  const scorePercent = Math.round((correct / total) * 100);
  let recommended: PlacementLevel = 'N5';
  if (scorePercent >= 80) recommended = 'N3-or-above';
  else if (scorePercent >= 60) recommended = 'N3';
  else if (scorePercent >= 40) recommended = 'N4';
  return { scorePercent, recommendedLevel: recommended, byLevel };
}