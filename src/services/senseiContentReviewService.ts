import type { SenseiLesson } from '../types/lesson';
import type { SurvivalPhrase } from '../types/workplaceSurvival';
import type { Quiz } from '../types/quiz';

export type SenseiContentVerdict = 'approved-for-internal-beta' | 'blocked-content-review-required';

export interface SenseiContentReviewInput {
  lessons: SenseiLesson[];
  survivalPhrases: SurvivalPhrase[];
  quizzes: Quiz[];
}

export interface SenseiContentReview {
  verdict: SenseiContentVerdict;
  blockers: string[];
  cautions: string[];
  summary: {
    reviewedLessonCount: number;
    reviewedLessonItemCount: number;
    reviewedSurvivalPhraseCount: number;
    reviewedQuizQuestionCount: number;
    reviewedLanguages: string[];
  };
  requiredFollowUps: string[];
}

export interface InternalBetaContentPack {
  title: string;
  level: 'N5';
  lessonIds: string[];
  survivalCategoryIds: string[];
  quizIds: string[];
  testerGuidance: string;
}

const requiredLanguages = ['Japanese', 'romaji', 'English', 'Vietnamese', 'Filipino'];

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateLessons(lessons: SenseiLesson[]): string[] {
  const blockers: string[] = [];
  if (lessons.length < 5) blockers.push('At least five weekday N5 lessons are required for internal beta pack 1.');

  for (const lesson of lessons) {
    if (!hasText(lesson.title) || !hasText(lesson.objective) || !hasText(lesson.summary)) {
      blockers.push(`Lesson ${lesson.id} is missing title, objective, or summary.`);
    }
    if (lesson.level !== 'N5') blockers.push(`Lesson ${lesson.id} is not marked N5.`);
    if (lesson.items.length < 3) blockers.push(`Lesson ${lesson.id} needs at least three learner items.`);

    for (const item of lesson.items) {
      if (![item.japanese, item.romaji, item.english, item.vietnamese, item.filipino, item.exampleJapanese, item.exampleEnglish].every(hasText)) {
        blockers.push(`Lesson item ${item.id} is missing a required learner-facing language field.`);
      }
    }
  }

  return blockers;
}

function validateSurvivalPhrases(survivalPhrases: SurvivalPhrase[]): string[] {
  const blockers: string[] = [];
  if (survivalPhrases.length < 18) blockers.push('At least eighteen survival phrases are required for internal beta pack 1.');
  if (!survivalPhrases.some(phrase => phrase.priority === 'emergency')) blockers.push('Emergency survival phrases are required.');

  for (const phrase of survivalPhrases) {
    if (![phrase.japanese, phrase.romaji, phrase.english, phrase.vietnamese, phrase.filipino, phrase.usageNote].every(hasText)) {
      blockers.push(`Survival phrase ${phrase.id} is missing a required learner-facing field.`);
    }
  }

  return blockers;
}

function validateQuizzes(quizzes: Quiz[]): string[] {
  const blockers: string[] = [];
  if (quizzes.length < 1) blockers.push('At least one quiz is required for internal beta pack 1.');

  for (const quiz of quizzes) {
    if (!hasText(quiz.title) || quiz.questions.length < 3) blockers.push(`Quiz ${quiz.id} needs a title and at least three questions.`);
    for (const question of quiz.questions) {
      if (!hasText(question.prompt) || !hasText(question.explanation)) blockers.push(`Quiz question ${question.id} is missing prompt or explanation.`);
      if (question.choices.length < 4) blockers.push(`Quiz question ${question.id} needs four answer choices.`);
      if (!question.choices.some(choice => choice.id === question.correctChoice)) blockers.push(`Quiz question ${question.id} has no matching correct choice.`);
    }
  }

  return blockers;
}

export function buildSenseiContentReview(input: SenseiContentReviewInput): SenseiContentReview {
  const blockers = [
    ...validateLessons(input.lessons),
    ...validateSurvivalPhrases(input.survivalPhrases),
    ...validateQuizzes(input.quizzes),
  ];
  const reviewedLessonItemCount = input.lessons.reduce((total, lesson) => total + lesson.items.length, 0);
  const reviewedQuizQuestionCount = input.quizzes.reduce((total, quiz) => total + quiz.questions.length, 0);

  return {
    verdict: blockers.length === 0 ? 'approved-for-internal-beta' : 'blocked-content-review-required',
    blockers,
    cautions: [
      'This is a practical N5 workplace beta pack, not a full JLPT curriculum yet.',
      'Translations are suitable for beta but should still be reviewed with learner feedback from Vietnamese and Filipino speakers.',
    ],
    summary: {
      reviewedLessonCount: input.lessons.length,
      reviewedLessonItemCount,
      reviewedSurvivalPhraseCount: input.survivalPhrases.length,
      reviewedQuizQuestionCount,
      reviewedLanguages: requiredLanguages,
    },
    requiredFollowUps: [
      'Track Chris-reported minor UI issues in the beta polish queue.',
      'Collect beta learner feedback on which workplace phrases feel most useful.',
      'Expand from Week 1 N5 workplace survival into a full Week 2 content pack after beta feedback.',
    ],
  };
}

export function getInternalBetaContentPack(): InternalBetaContentPack {
  return {
    title: 'Internal Beta Pack 1 — N5 Workplace Survival',
    level: 'N5',
    lessonIds: [
      'lesson-workplace-greetings',
      'lesson-safety-stop',
      'lesson-asking-help',
      'lesson-schedule-time',
      'lesson-emergency',
    ],
    survivalCategoryIds: ['greetings', 'help', 'safety', 'schedule', 'tools', 'breaks', 'absence', 'emergency'],
    quizIds: ['quiz-workplace-greetings-1'],
    testerGuidance: 'During internal beta, focus on usefulness at work, clarity of Japanese/romaji/English/support-language text, and whether any phrase feels awkward or missing.',
  };
}
