import type { BetaFeedbackCategory, BetaFeedbackEntry, BetaFeedbackSeverity, BetaFeedbackStorageAdapter, BetaFeedbackSummary, BetaFeedbackType } from '../types/betaFeedback';

const BETA_FEEDBACK_KEY = 'japanese-tutor:beta-feedback:v1';

export function getBetaFeedbackStorageKey(): string {
  return BETA_FEEDBACK_KEY;
}

export function createBrowserBetaFeedbackStorage(): BetaFeedbackStorageAdapter | undefined {
  if (typeof window === 'undefined' || !window.localStorage) return undefined;
  return window.localStorage;
}

function normalizeSeverity(severity: BetaFeedbackEntry['severity']): BetaFeedbackSeverity | undefined {
  if (severity === 'blocker' || severity === 'important' || severity === 'minor') return severity;
  return undefined;
}

function normalizeCategory(category: BetaFeedbackEntry['category']): BetaFeedbackCategory | undefined {
  if (category === 'ui-polish' || category === 'content' || category === 'device-layout' || category === 'learning-flow' || category === 'bug') return category;
  return undefined;
}

function normalizeFeedbackType(feedbackType: BetaFeedbackEntry['feedbackType']): BetaFeedbackType | undefined {
  if (feedbackType === 'problem' || feedbackType === 'confusing' || feedbackType === 'translation' || feedbackType === 'suggestion') return feedbackType;
  return undefined;
}

function normalizeEntry(entry: BetaFeedbackEntry): BetaFeedbackEntry {
  const rating = Math.min(5, Math.max(1, entry.rating)) as BetaFeedbackEntry['rating'];
  return {
    screen: entry.screen.trim() || 'Unknown',
    rating,
    note: entry.note.trim(),
    createdAt: entry.createdAt,
    severity: normalizeSeverity(entry.severity),
    category: normalizeCategory(entry.category),
    feedbackType: normalizeFeedbackType(entry.feedbackType),
  };
}

function parseEntries(raw: string | null): BetaFeedbackEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => item && typeof item === 'object').map(item => normalizeEntry(item as BetaFeedbackEntry));
  } catch {
    return [];
  }
}

export function createLocalBetaFeedbackStore(storage?: BetaFeedbackStorageAdapter) {
  return {
    list(): BetaFeedbackEntry[] {
      return parseEntries(storage?.getItem(BETA_FEEDBACK_KEY) ?? null);
    },
    add(entry: BetaFeedbackEntry): BetaFeedbackEntry[] {
      const next = [...parseEntries(storage?.getItem(BETA_FEEDBACK_KEY) ?? null), normalizeEntry(entry)];
      storage?.setItem(BETA_FEEDBACK_KEY, JSON.stringify(next));
      return next;
    },
    clear(): void {
      storage?.removeItem(BETA_FEEDBACK_KEY);
    },
  };
}

export function summarizeBetaFeedback(entries: BetaFeedbackEntry[]): BetaFeedbackSummary {
  if (entries.length === 0) return { count: 0, averageRating: 0, screensNeedingReview: [] };
  const averageRating = entries.reduce((sum, entry) => sum + entry.rating, 0) / entries.length;
  const screensNeedingReview = Array.from(new Set(entries.filter(entry => entry.rating <= 3).map(entry => entry.screen))).sort();
  return { count: entries.length, averageRating, screensNeedingReview };
}
