import {
  JLPT_UNOFFICIAL_NOTICE,
  type JlptExamAttempt,
  type JlptExamResult,
  type JlptQuestionResult,
  type JlptScoreBreakdown,
} from '../types/jlptExam';

function accuracy(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

function breakdown(
  id: string,
  label: string,
  questions: JlptQuestionResult[],
): JlptScoreBreakdown {
  const correct = questions.filter(question => question.correct).length;
  const unanswered = questions.filter(question => question.selectedChoice === undefined).length;
  return {
    id,
    label,
    correct,
    total: questions.length,
    unanswered,
    accuracyPercent: accuracy(correct, questions.length),
  };
}

const LABELS: Record<string, string> = {
  vocabulary: 'Vocabulary',
  'grammar-reading': 'Grammar / Reading',
  listening: 'Listening',
  'language-knowledge': 'Language Knowledge',
  reading: 'Reading',
  'language-knowledge-reading': 'Language Knowledge / Reading',
};

function humanize(value: string): string {
  return LABELS[value] ?? value.split('-').map(part => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`).join(' ');
}

export function scoreJlptExamAttempt(attempt: JlptExamAttempt): JlptExamResult {
  if (attempt.status !== 'completed' || attempt.completedAt === undefined) {
    throw new Error('Final JLPT practice results are available only for completed attempts.');
  }
  const questionResults: JlptQuestionResult[] = attempt.sections.flatMap(section => section.questions.map(question => {
    const selectedChoice = attempt.answers[question.id];
    return {
      questionId: question.id,
      section: question.section,
      scoringGroup: question.scoringGroup,
      itemType: question.itemType,
      selectedChoice,
      correctChoice: question.correctChoice,
      correct: selectedChoice === question.correctChoice,
      explanation: question.explanation,
    };
  }));
  const correct = questionResults.filter(question => question.correct).length;
  const unanswered = questionResults.filter(question => question.selectedChoice === undefined).length;
  const completedAt = attempt.completedAt;

  const bySection = attempt.sections.map(section => breakdown(
    section.id,
    section.label,
    questionResults.filter(question => question.section === section.id),
  ));
  const scoringGroups = Array.from(new Set(questionResults.map(question => question.scoringGroup)));
  const itemTypes = Array.from(new Set(questionResults.map(question => question.itemType)));

  return {
    schemaVersion: 1,
    id: `result-${attempt.id}`,
    attemptId: attempt.id,
    level: attempt.level,
    mode: attempt.mode,
    timerPolicy: attempt.timerPolicy,
    blueprintVersion: attempt.blueprintVersion,
    contentVersion: attempt.contentVersion,
    completedAt,
    correct,
    total: questionResults.length,
    unanswered,
    accuracyPercent: accuracy(correct, questionResults.length),
    bySection,
    byScoringGroup: scoringGroups.map(group => breakdown(
      group,
      humanize(group),
      questionResults.filter(question => question.scoringGroup === group),
    )),
    byItemType: itemTypes.map(itemType => breakdown(
      itemType,
      humanize(itemType),
      questionResults.filter(question => question.itemType === itemType),
    )),
    questionResults,
    unofficialNotice: JLPT_UNOFFICIAL_NOTICE,
  };
}
