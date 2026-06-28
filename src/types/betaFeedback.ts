export type BetaFeedbackSeverity = 'blocker' | 'important' | 'minor';
export type BetaFeedbackCategory = 'ui-polish' | 'content' | 'device-layout' | 'learning-flow' | 'bug';
export type BetaFeedbackType = 'problem' | 'confusing' | 'translation' | 'suggestion';

export interface BetaFeedbackEntry {
  screen: string;
  rating: 1 | 2 | 3 | 4 | 5;
  note: string;
  createdAt: string;
  severity?: BetaFeedbackSeverity;
  category?: BetaFeedbackCategory;
  feedbackType?: BetaFeedbackType;
}

export interface BetaFeedbackSummary {
  count: number;
  averageRating: number;
  screensNeedingReview: string[];
}

export interface BetaFeedbackStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
