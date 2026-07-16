export type JlptLevel = 'N5' | 'N4' | 'N3';
export type JlptExamMode = 'mini' | 'full';
export type JlptTimerPolicy = 'strict' | 'practice';
export type JlptSectionId = 'vocabulary' | 'grammar-reading' | 'listening';
export type JlptScoringGroup = 'language-knowledge' | 'reading' | 'language-knowledge-reading' | 'listening';

export type JlptItemType =
  | 'kanji-reading'
  | 'orthography'
  | 'contextual-expression'
  | 'paraphrase'
  | 'vocabulary-usage'
  | 'grammar-form'
  | 'sentence-composition'
  | 'text-grammar'
  | 'reading-short'
  | 'reading-medium'
  | 'reading-long'
  | 'information-retrieval'
  | 'listening-task'
  | 'listening-key-point'
  | 'listening-outline'
  | 'listening-expression'
  | 'listening-quick-response';

export type JlptChoiceId = 'A' | 'B' | 'C' | 'D';

export interface JlptExamChoice {
  id: JlptChoiceId;
  text: string;
}

export interface JlptExamSourceRef {
  sourceId: string;
  license: string;
  kind: 'jmdict' | 'kanjidic2' | 'app-lesson' | 'app-authored';
  attribution?: string;
}

export interface JlptExamStimulus {
  kind: 'passage' | 'notice' | 'audio';
  text?: string;
  audioText?: string;
  /** Hidden during an active mock and revealed only in completed review. */
  transcript?: string;
  title?: string;
}

export interface JlptExamQuestion {
  id: string;
  level: JlptLevel;
  section: JlptSectionId;
  scoringGroup: JlptScoringGroup;
  itemType: JlptItemType;
  prompt: string;
  choices: JlptExamChoice[];
  correctChoice: JlptChoiceId;
  explanation: string;
  stimulus?: JlptExamStimulus;
  sourceRefs: JlptExamSourceRef[];
  reviewStatus: 'approved-for-exam';
  contentVersion: string;
  audioPlayLimit?: number;
}

export interface JlptBlueprintSlot {
  itemType: JlptItemType;
  miniCount: number;
  fullCount: number;
}

export interface JlptSectionBlueprint {
  id: JlptSectionId;
  label: string;
  fullDurationSeconds: number;
  miniDurationSeconds: number;
  slots: JlptBlueprintSlot[];
}

export interface JlptExamBlueprint {
  level: JlptLevel;
  version: string;
  contentVersion: string;
  sections: JlptSectionBlueprint[];
}

export interface JlptAssembledExam {
  id: string;
  level: JlptLevel;
  mode: JlptExamMode;
  seed: number;
  blueprintVersion: string;
  contentVersion: string;
  sections: Array<{
    id: JlptSectionId;
    label: string;
    durationSeconds: number;
    questions: JlptExamQuestion[];
  }>;
}

export type JlptExamAttemptStatus = 'active' | 'paused' | 'section-break' | 'completed' | 'abandoned';
export type JlptSectionCompletionReason = 'submitted' | 'timeout';

export interface JlptSectionSubmission {
  sectionId: JlptSectionId;
  submittedAt: number;
  reason: JlptSectionCompletionReason;
  elapsedSeconds: number;
}

export interface JlptAudioPlaybackState {
  plays: number;
  startedAt?: number;
  completedAt?: number;
  failed?: boolean;
}

export interface JlptExamAttempt {
  schemaVersion: 1;
  id: string;
  level: JlptLevel;
  mode: JlptExamMode;
  timerPolicy: JlptTimerPolicy;
  seed: number;
  blueprintVersion: string;
  contentVersion: string;
  sections: JlptAssembledExam['sections'];
  status: JlptExamAttemptStatus;
  currentSectionIndex: number;
  currentQuestionIndex: number;
  answers: Record<string, JlptChoiceId>;
  flaggedQuestionIds: string[];
  sectionSubmissions: JlptSectionSubmission[];
  audioPlayback: Record<string, JlptAudioPlaybackState>;
  sectionStartedAt: number;
  sectionDeadlineAt?: number;
  pausedAt?: number;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface JlptQuestionResult {
  questionId: string;
  section: JlptSectionId;
  scoringGroup: JlptScoringGroup;
  itemType: JlptItemType;
  selectedChoice?: JlptChoiceId;
  correctChoice: JlptChoiceId;
  correct: boolean;
  explanation: string;
}

export interface JlptScoreBreakdown {
  id: string;
  label: string;
  correct: number;
  total: number;
  unanswered: number;
  accuracyPercent: number;
}

export interface JlptExamResult {
  schemaVersion: 1;
  id: string;
  attemptId: string;
  level: JlptLevel;
  mode: JlptExamMode;
  timerPolicy: JlptTimerPolicy;
  blueprintVersion: string;
  contentVersion: string;
  completedAt: number;
  correct: number;
  total: number;
  unanswered: number;
  accuracyPercent: number;
  bySection: JlptScoreBreakdown[];
  byScoringGroup: JlptScoreBreakdown[];
  byItemType: JlptScoreBreakdown[];
  questionResults: JlptQuestionResult[];
  unofficialNotice: string;
}

export const JLPT_UNOFFICIAL_NOTICE =
  'Unofficial JLPT-style practice. This is not an official JLPT score and is not affiliated with or endorsed by the Japan Foundation or JEES.';
