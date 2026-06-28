import type { BetaFeedbackCategory, BetaFeedbackEntry, BetaFeedbackSeverity, BetaFeedbackType } from '../types/betaFeedback';

export interface SimpleFeedbackOption {
  type: BetaFeedbackType;
  label: string;
  helperText: string;
}

export interface SimpleFeedbackMappingInput {
  type: BetaFeedbackType;
  stoppedUse?: boolean;
}

export interface SimpleFeedbackEntryInput extends SimpleFeedbackMappingInput {
  screen: string;
  note: string;
  rating: BetaFeedbackEntry['rating'];
  createdAt: string;
}

export interface SimpleFeedbackTriage {
  severity: BetaFeedbackSeverity;
  category: BetaFeedbackCategory;
}

const simpleFeedbackOptions: SimpleFeedbackOption[] = [
  {
    type: 'problem',
    label: 'Report a problem',
    helperText: 'Something broke, would not open, or did not work as expected.',
  },
  {
    type: 'confusing',
    label: 'Confusing / hard to use',
    helperText: 'The app worked, but the screen, wording, or flow was unclear.',
  },
  {
    type: 'translation',
    label: 'Translation or Japanese issue',
    helperText: 'A Japanese phrase, romaji, translation, or explanation felt wrong.',
  },
  {
    type: 'suggestion',
    label: 'Suggestion / idea',
    helperText: 'A nice-to-have improvement or lesson idea for later.',
  },
];

export function getSimpleFeedbackOptions(): SimpleFeedbackOption[] {
  return simpleFeedbackOptions;
}

export function mapSimpleFeedbackToTriage(input: SimpleFeedbackMappingInput): SimpleFeedbackTriage {
  if (input.type === 'problem') {
    return {
      severity: input.stoppedUse ? 'blocker' : 'important',
      category: 'bug',
    };
  }

  if (input.type === 'confusing') {
    return { severity: 'important', category: 'learning-flow' };
  }

  if (input.type === 'translation') {
    return { severity: 'important', category: 'content' };
  }

  return { severity: 'minor', category: 'ui-polish' };
}

export function buildSimpleFeedbackEntry(input: SimpleFeedbackEntryInput): BetaFeedbackEntry {
  const triage = mapSimpleFeedbackToTriage(input);
  return {
    screen: input.screen,
    rating: input.rating,
    note: input.note.trim() || 'No note provided',
    createdAt: input.createdAt,
    severity: triage.severity,
    category: triage.category,
    feedbackType: input.type,
  };
}
