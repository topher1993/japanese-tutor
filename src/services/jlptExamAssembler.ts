import { getJlptExamBlueprint } from '../data/jlptExamBlueprints';
import type {
  JlptAssembledExam,
  JlptChoiceId,
  JlptExamBlueprint,
  JlptExamMode,
  JlptExamQuestion,
  JlptItemType,
  JlptLevel,
} from '../types/jlptExam';
import { buildJlptExamQuestionBank } from './jlptExamContentService';

export class JlptExamAssemblyError extends Error {
  constructor(
    message: string,
    readonly details: {
      level: JlptLevel;
      questionId?: string;
      itemType?: JlptItemType;
      required?: number;
      available?: number;
      validationErrors?: string[];
    },
  ) {
    super(message);
    this.name = 'JlptExamAssemblyError';
  }
}

const VALID_SOURCE_KINDS = new Set(['jmdict', 'kanjidic2', 'app-lesson', 'app-authored']);
const VALID_CHOICE_IDS = new Set(['A', 'B', 'C', 'D']);

/**
 * Runtime validation for both the built-in bank and caller-injected banks.
 * Returning all errors keeps content tooling useful without weakening assembly.
 */
export function validateJlptExamQuestion(
  question: JlptExamQuestion,
  blueprint: JlptExamBlueprint,
): string[] {
  const errors: string[] = [];
  if (!question.id?.trim()) errors.push('Question id is required.');
  if (question.level !== blueprint.level) errors.push(`Expected level ${blueprint.level}.`);
  if (question.reviewStatus !== 'approved-for-exam') errors.push('Question is not approved for exam use.');
  if (question.contentVersion !== blueprint.contentVersion) errors.push('Question content version does not match the blueprint.');

  const section = blueprint.sections.find(candidate => candidate.id === question.section);
  if (!section) errors.push(`Section ${question.section} is not in the blueprint.`);
  else if (!section.slots.some(slot => slot.itemType === question.itemType)) {
    errors.push(`Item type ${question.itemType} is not allowed in section ${question.section}.`);
  }

  if (!question.prompt?.trim()) errors.push('Question prompt is required.');
  if (!question.explanation?.trim()) errors.push('Question explanation is required.');
  if (!Array.isArray(question.choices) || question.choices.length < 3 || question.choices.length > 4) {
    errors.push('Question must have three or four choices.');
  } else {
    const choiceIds = question.choices.map(choice => choice.id);
    const choiceTexts = question.choices.map(choice => choice.text.trim().toLocaleLowerCase());
    if (choiceIds.some(id => !VALID_CHOICE_IDS.has(id))) errors.push('Question contains an invalid choice id.');
    if (new Set(choiceIds).size !== choiceIds.length) errors.push('Question choice ids must be unique.');
    if (choiceTexts.some(text => !text)) errors.push('Question choices must not be empty.');
    if (new Set(choiceTexts).size !== choiceTexts.length) errors.push('Question choice text must be unique.');
    if (!choiceIds.includes(question.correctChoice)) errors.push('Correct choice is not present in the choices.');
  }

  if (!Array.isArray(question.sourceRefs) || question.sourceRefs.length === 0) {
    errors.push('At least one source reference is required.');
  } else {
    question.sourceRefs.forEach((source, index) => {
      if (!source.sourceId?.trim()) errors.push(`Source ${index + 1} is missing an id.`);
      if (!source.license?.trim()) errors.push(`Source ${index + 1} is missing a license.`);
      if (!VALID_SOURCE_KINDS.has(source.kind)) errors.push(`Source ${index + 1} has an unsupported kind.`);
    });
  }

  if (question.itemType.startsWith('listening-') && question.stimulus?.kind !== 'audio') {
    errors.push('Listening questions require an audio stimulus.');
  }
  return errors;
}

/** Mulberry32: deterministic, compact, and sufficient for offline question ordering. */
export function createJlptSeededRandom(seed: number): () => number {
  let current = seed >>> 0;
  return () => {
    current += 0x6d2b79f5;
    let value = current;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function shuffleChoices(question: JlptExamQuestion, random: () => number): JlptExamQuestion {
  const originalCorrect = question.choices.find(choice => choice.id === question.correctChoice);
  if (!originalCorrect) return question;
  let correctChoice: JlptChoiceId = 'A';
  const shuffled = shuffle(question.choices, random).map((choice, index) => {
    const id = (['A', 'B', 'C', 'D'] as JlptChoiceId[])[index];
    if (choice.text === originalCorrect.text) correctChoice = id;
    return { id, text: choice.text };
  });
  return { ...question, choices: shuffled, correctChoice };
}

export function assembleJlptExam(
  level: JlptLevel,
  mode: JlptExamMode,
  seed: number = Date.now(),
  questionBank: JlptExamQuestion[] = buildJlptExamQuestionBank(level),
): JlptAssembledExam {
  const blueprint = getJlptExamBlueprint(level);
  const normalizedSeed = seed >>> 0;
  const random = createJlptSeededRandom(normalizedSeed);
  const approvedById = new Map<string, JlptExamQuestion>();
  for (const question of questionBank.filter(candidate => candidate.level === level)) {
    const validationErrors = validateJlptExamQuestion(question, blueprint);
    if (validationErrors.length > 0) {
      throw new JlptExamAssemblyError(
        `Invalid JLPT exam question ${question.id || '(missing id)'}.`,
        { level, questionId: question.id, validationErrors },
      );
    }
    if (approvedById.has(question.id)) {
      throw new JlptExamAssemblyError(
        `Duplicate JLPT exam question id: ${question.id}.`,
        { level, questionId: question.id },
      );
    }
    approvedById.set(question.id, question);
  }
  const approved = Array.from(approvedById.values());
  const selectedIds = new Set<string>();

  const sections = blueprint.sections.map(sectionBlueprint => {
    const questions = sectionBlueprint.slots.flatMap(slot => {
      const required = mode === 'mini' ? slot.miniCount : slot.fullCount;
      const available = approved.filter(question =>
        question.section === sectionBlueprint.id
        && question.itemType === slot.itemType
        && !selectedIds.has(question.id));
      if (available.length < required) {
        throw new JlptExamAssemblyError(
          `Not enough approved ${level} ${slot.itemType} questions for the ${mode} mock.`,
          { level, itemType: slot.itemType, required, available: available.length },
        );
      }
      const selected = shuffle(available, random).slice(0, required);
      selected.forEach(question => selectedIds.add(question.id));
      return selected.map(question => shuffleChoices(question, random));
    });
    return {
      id: sectionBlueprint.id,
      label: sectionBlueprint.label,
      durationSeconds: mode === 'mini'
        ? sectionBlueprint.miniDurationSeconds
        : sectionBlueprint.fullDurationSeconds,
      questions: shuffle(questions, random),
    };
  });

  return {
    id: `jlpt-${level.toLowerCase()}-${mode}-${blueprint.version}-${normalizedSeed}`,
    level,
    mode,
    seed: normalizedSeed,
    blueprintVersion: blueprint.version,
    contentVersion: blueprint.contentVersion,
    sections,
  };
}
