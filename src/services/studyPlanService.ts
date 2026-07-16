import { addLocalDateDays, localDateKey } from '../utils/localDate';

export type StudyLevel = 'Absolute Beginner' | 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export interface StudyTask {
  id: string;
  title: string;
  minutes: number;
  category: 'review' | 'new-content' | 'quiz' | 'kanji' | 'listening';
}

export interface DailyStudyPlan {
  level: StudyLevel;
  totalMinutes: number;
  tasks: StudyTask[];
}

export interface StudyPlanTracker {
  logStudy(date: Date, minutes: number): void;
  getStreak(now?: Date): number;
  buildDailyPlan(level: StudyLevel): DailyStudyPlan;
}

function dayKey(date: Date): string {
  return localDateKey(date);
}

export function createStudyPlanTracker(): StudyPlanTracker {
  const sessions = new Set<string>();

  function buildPlan(level: StudyLevel): DailyStudyPlan {
    if (level === 'Absolute Beginner') {
      const tasks: StudyTask[] = [
        { id: `plan-${level}-review`, title: 'Review greetings and survival phrases', minutes: 10, category: 'review' },
        { id: `plan-${level}-new`, title: 'Learn kana and first sentence patterns', minutes: 10, category: 'new-content' },
        { id: `plan-${level}-listening`, title: 'Listen and repeat pronunciation', minutes: 5, category: 'listening' },
        { id: `plan-${level}-quiz`, title: 'Check your understanding', minutes: 5, category: 'quiz' },
      ];
      return { level, totalMinutes: tasks.reduce((s, t) => s + t.minutes, 0), tasks };
    }

    const baseMinutes = level === 'N5' ? 25 : level === 'N4' ? 30 : 35;
    const tasks: StudyTask[] = [
      { id: `plan-${level}-review`, title: `Spaced-repetition review (${level})`, minutes: 10, category: 'review' },
      { id: `plan-${level}-new`, title: `New vocabulary / grammar (${level})`, minutes: baseMinutes - 15, category: 'new-content' },
      { id: `plan-${level}-kanji`, title: `Kanji reading practice (${level})`, minutes: 5, category: 'kanji' },
      { id: `plan-${level}-quiz`, title: `Daily quiz (${level})`, minutes: 5, category: 'quiz' },
    ];
    return { level, totalMinutes: tasks.reduce((s, t) => s + t.minutes, 0), tasks };
  }

  return {
    logStudy(date: Date, minutes: number) {
      if (minutes <= 0) return;
      sessions.add(dayKey(date));
    },
    getStreak(now: Date = new Date()) {
      const today = dayKey(now);
      if (!sessions.has(today)) return 0;
      let count = 0;
      let cursor = today;
      while (sessions.has(cursor)) {
        count += 1;
        cursor = addLocalDateDays(cursor, -1);
        if (count > 365) break;
      }
      return count;
    },
    buildDailyPlan(level: StudyLevel) {
      return buildPlan(level);
    },
  };
}
