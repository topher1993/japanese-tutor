export interface LessonWeek {
  id: string;
  weekNumber: number;
  label: string;
  theme: string;
  objectives: string[];
  recommendedMinutes: number;
}

export interface LessonProgression {
  weeks: LessonWeek[];
  currentWeek: number;
  advance(): LessonProgression;
  rewind(): LessonProgression;
  jumpTo(weekNumber: number): LessonProgression;
  currentWeekDetails(): LessonWeek;
}

const WEEKS: Omit<LessonWeek, 'weekNumber'>[] = [
  {
    id: 'week-1-greetings',
    label: 'Week 1 — Greetings & Self-Introduction',
    theme: 'greetings',
    objectives: ['basic greetings', 'introducing yourself', 'politeness markers'],
    recommendedMinutes: 30,
  },
  {
    id: 'week-2-numbers-time',
    label: 'Week 2 — Numbers & Time',
    theme: 'numbers',
    objectives: ['counting 1-1000', 'telling time', 'days and months'],
    recommendedMinutes: 30,
  },
  {
    id: 'week-3-daily-life',
    label: 'Week 3 — Daily Life Vocabulary',
    theme: 'daily-life',
    objectives: ['food vocabulary', 'house vocabulary', 'common verbs'],
    recommendedMinutes: 35,
  },
  {
    id: 'week-4-particles',
    label: 'Week 4 — Particles & Basic Grammar',
    theme: 'grammar',
    objectives: ['は/が/を/に/で/へ', 'basic sentence order', 'questions'],
    recommendedMinutes: 40,
  },
  {
    id: 'week-5-verbs-past',
    label: 'Week 5 — Verb Forms & Past Tense',
    theme: 'verbs',
    objectives: ['masu-form', 'te-form', 'past tense'],
    recommendedMinutes: 40,
  },
  {
    id: 'week-6-workplace',
    label: 'Week 6 — Workplace Survival',
    theme: 'workplace',
    objectives: ['workplace greetings', 'meeting phrases', 'asking for clarification'],
    recommendedMinutes: 45,
  },
  {
    id: 'week-7-safety',
    label: 'Week 7 — Safety & Emergency',
    theme: 'safety',
    objectives: ['emergency phrases', 'giving directions', 'calling for help'],
    recommendedMinutes: 45,
  },
  {
    id: 'week-8-hr',
    label: 'Week 8 — HR & Interview',
    theme: 'hr',
    objectives: ['interview vocabulary', 'resume basics', 'contract phrases'],
    recommendedMinutes: 45,
  },
  {
    id: 'week-9-kanji-basics',
    label: 'Week 9 — Kanji Basics',
    theme: 'kanji',
    objectives: ['numbers in kanji', 'days in kanji', 'common radicals'],
    recommendedMinutes: 50,
  },
  {
    id: 'week-10-review',
    label: 'Week 10 — Review & Checkpoint',
    theme: 'review',
    objectives: ['spaced repetition', 'self-quiz', 'checkpoint test'],
    recommendedMinutes: 50,
  },
  {
    id: 'week-11-shopping',
    label: 'Week 11 — Shopping & Daily Errands',
    theme: 'shopping',
    objectives: ['asking prices', 'bargaining', 'counting items'],
    recommendedMinutes: 40,
  },
  {
    id: 'week-12-travel',
    label: 'Week 12 — Travel & Directions',
    theme: 'travel',
    objectives: ['train vocabulary', 'asking directions', 'hotel phrases'],
    recommendedMinutes: 45,
  },
];

function build(currentWeek: number): LessonProgression {
  const weeks: LessonWeek[] = WEEKS.map((w, i) => ({ ...w, weekNumber: i + 1 }));
  const safeCurrent = Math.max(1, Math.min(currentWeek, weeks.length));
  return {
    weeks,
    currentWeek: safeCurrent,
    advance() {
      return build(Math.min(this.currentWeek + 1, weeks.length));
    },
    rewind() {
      return build(Math.max(this.currentWeek - 1, 1));
    },
    jumpTo(weekNumber: number) {
      return build(weekNumber);
    },
    currentWeekDetails() {
      return weeks.find((w) => w.weekNumber === this.currentWeek) ?? weeks[0];
    },
  };
}

export function buildLessonProgression(): LessonProgression {
  return build(1);
}