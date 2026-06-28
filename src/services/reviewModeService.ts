export type ReviewLevel = 'N5' | 'N4';

export interface ReviewItem {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  jlptLevel: ReviewLevel;
  category: string;
}

export interface ReviewSessionResult {
  correctCount: number;
  percent: number;
}

export interface ReviewSession {
  items: ReviewItem[];
  totalCount: number;
  score(responses: number[]): ReviewSessionResult;
}

const ITEMS: Omit<ReviewItem, 'id'>[] = [
  { prompt: 'Meaning of 「水」', choices: ['water', 'fire', 'tree', 'gold'], correctIndex: 0, jlptLevel: 'N5', category: 'vocab' },
  { prompt: 'Meaning of 「山」', choices: ['sea', 'mountain', 'river', 'sky'], correctIndex: 1, jlptLevel: 'N5', category: 'vocab' },
  { prompt: 'Meaning of 「車」', choices: ['bus', 'train', 'car', 'bike'], correctIndex: 2, jlptLevel: 'N5', category: 'vocab' },
  { prompt: 'Meaning of 「駅」', choices: ['airport', 'station', 'port', 'bus stop'], correctIndex: 1, jlptLevel: 'N5', category: 'vocab' },
  { prompt: 'Meaning of 「病院」', choices: ['bank', 'school', 'hospital', 'post office'], correctIndex: 2, jlptLevel: 'N5', category: 'vocab' },
  { prompt: 'Polite form: 食べる', choices: ['食べた', '食べて', '食べます', '食べる'], correctIndex: 2, jlptLevel: 'N5', category: 'grammar' },
  { prompt: 'Polite form: 行く', choices: ['行く', '行きます', '行った', '行って'], correctIndex: 1, jlptLevel: 'N5', category: 'grammar' },
  { prompt: 'Polite form: 飲む', choices: ['飲んだ', '飲んで', '飲む', '飲みます'], correctIndex: 3, jlptLevel: 'N5', category: 'grammar' },
  { prompt: 'Past tense of 食べる', choices: ['食べる', '食べて', '食べた', '食べません'], correctIndex: 2, jlptLevel: 'N5', category: 'grammar' },
  { prompt: 'Particle for direction: 学校 ___ 行きます', choices: ['を', 'に', 'で', 'は'], correctIndex: 1, jlptLevel: 'N5', category: 'grammar' },
  { prompt: 'Meaning of 「連絡」', choices: ['contact', 'company', 'contract', 'commute'], correctIndex: 0, jlptLevel: 'N4', category: 'vocab' },
  { prompt: 'Meaning of 「遠慮」', choices: ['forwardness', 'restraint', 'attention', 'exercise'], correctIndex: 1, jlptLevel: 'N4', category: 'vocab' },
  { prompt: 'Meaning of 「出張」', choices: ['commute', 'business trip', 'meeting', 'overtime'], correctIndex: 1, jlptLevel: 'N4', category: 'workplace' },
  { prompt: 'Meaning of 「面接」', choices: ['meeting', 'interview', 'contract', 'salary'], correctIndex: 1, jlptLevel: 'N4', category: 'workplace' },
  { prompt: 'Meaning of 「給料」', choices: ['tax', 'salary', 'bonus', 'insurance'], correctIndex: 1, jlptLevel: 'N4', category: 'workplace' },
  { prompt: 'Meaning of 「履歴書」', choices: ['resume', 'business card', 'report', 'contract'], correctIndex: 0, jlptLevel: 'N4', category: 'workplace' },
  { prompt: 'Meaning of 「残業」', choices: ['vacation', 'overtime', 'resignation', 'training'], correctIndex: 1, jlptLevel: 'N4', category: 'workplace' },
  { prompt: 'Meaning of 「名刺」', choices: ['business card', 'resume', 'report', 'contract'], correctIndex: 0, jlptLevel: 'N4', category: 'workplace' },
  { prompt: 'Te-form of 飲む', choices: ['飲まなくて', '飲んで', '飲んだ', '飲みて'], correctIndex: 1, jlptLevel: 'N4', category: 'grammar' },
  { prompt: 'Te-form of 書く', choices: ['書いて', '書いた', '書く', '書きて'], correctIndex: 0, jlptLevel: 'N4', category: 'grammar' },
  { prompt: 'Te-form of 待つ', choices: ['待つ', '待って', '待った', '待ちて'], correctIndex: 1, jlptLevel: 'N4', category: 'grammar' },
  { prompt: 'Negative polite of 食べる', choices: ['食べない', '食べた', '食べません', '食べて'], correctIndex: 2, jlptLevel: 'N5', category: 'grammar' },
  { prompt: 'Negative polite of 行く', choices: ['行かない', '行きません', '行った', '行って'], correctIndex: 1, jlptLevel: 'N5', category: 'grammar' },
  { prompt: 'Negative polite of 見る', choices: ['見ない', '見ません', '見た', '見て'], correctIndex: 1, jlptLevel: 'N5', category: 'grammar' },
];

// Deterministic shuffle so that "all 0" → 0%
function shuffled() {
  const offsets = [2, 3, 1, 2, 3, 1, 2, 0, 3, 1, 2, 3, 1, 2, 0, 3, 2, 1, 0, 2, 3, 1, 0, 2];
  return ITEMS.map((it, i) => {
    const offset = offsets[i % offsets.length];
    const permuted = [];
    for (let k = 0; k < 4; k++) permuted.push(it.choices[(k + offset) % 4]);
    const correctText = it.choices[it.correctIndex];
    return { ...it, choices: permuted, correctIndex: permuted.indexOf(correctText) };
  });
}

const SHUFFLED = shuffled();

export function buildReviewSession(level?: ReviewLevel): ReviewSession {
  const items: ReviewItem[] = (level ? SHUFFLED.filter((it) => it.jlptLevel === level || it.jlptLevel === 'N5') : SHUFFLED)
    .map((it, i) => ({ ...it, id: `rev-${i + 1}` }));
  return {
    items,
    totalCount: items.length,
    score(responses: number[]) {
      let correct = 0;
      for (let i = 0; i < items.length; i++) {
        if (responses[i] === items[i].correctIndex) correct += 1;
      }
      const percent = items.length === 0 ? 0 : Math.round((correct / items.length) * 100);
      return { correctCount: correct, percent };
    },
  };
}