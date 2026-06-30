export type StudyLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

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
  return date.toISOString().slice(0, 10);
}

function dayDiff(a: string, b: string): number {
  const ad = new Date(a + 'T00:00:00Z').getTime();
  const bd = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((bd - ad) / 86_400_000);
}

export function createStudyPlanTracker(): StudyPlanTracker {
  const sessions = new Set<string>();

  function buildPlan(level: StudyLevel): DailyStudyPlan {
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
        const prev = new Date(cursor + 'T00:00:00Z');
        prev.setUTCDate(prev.getUTCDate() - 1);
        cursor = dayKey(prev);
        if (count > 365) break;
      }
      return count;
    },
    buildDailyPlan(level: StudyLevel) {
      return buildPlan(level);
    },
  };
}

void dayDiff;