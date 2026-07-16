import type { JlptBlueprintSlot, JlptExamBlueprint, JlptItemType, JlptLevel, JlptSectionBlueprint } from '../types/jlptExam';

export const JLPT_EXAM_BLUEPRINT_VERSION = '2026.07.1';
export const JLPT_EXAM_CONTENT_VERSION = '2026.07.1';

function slot(itemType: JlptItemType, miniCount: number, fullCount: number): JlptBlueprintSlot {
  return { itemType, miniCount, fullCount };
}

function section(
  id: JlptSectionBlueprint['id'],
  label: string,
  fullMinutes: number,
  miniMinutes: number,
  slots: JlptBlueprintSlot[],
): JlptSectionBlueprint {
  return {
    id,
    label,
    fullDurationSeconds: fullMinutes * 60,
    miniDurationSeconds: miniMinutes * 60,
    slots,
  };
}

const SHARED_LISTENING = [
  slot('listening-task', 1, 2),
  slot('listening-key-point', 1, 2),
  slot('listening-expression', 1, 2),
  slot('listening-quick-response', 1, 2),
];

export const JLPT_EXAM_BLUEPRINTS: Record<JlptLevel, JlptExamBlueprint> = {
  N5: {
    level: 'N5',
    version: JLPT_EXAM_BLUEPRINT_VERSION,
    contentVersion: JLPT_EXAM_CONTENT_VERSION,
    sections: [
      section('vocabulary', 'Vocabulary', 20, 8, [
        slot('kanji-reading', 1, 4),
        slot('orthography', 1, 3),
        slot('contextual-expression', 1, 4),
        slot('paraphrase', 1, 3),
      ]),
      section('grammar-reading', 'Grammar / Reading', 40, 12, [
        slot('grammar-form', 1, 5),
        slot('sentence-composition', 1, 3),
        slot('text-grammar', 1, 2),
        slot('reading-short', 1, 2),
        slot('reading-medium', 1, 1),
        slot('information-retrieval', 1, 1),
      ]),
      section('listening', 'Listening', 30, 10, SHARED_LISTENING),
    ],
  },
  N4: {
    level: 'N4',
    version: JLPT_EXAM_BLUEPRINT_VERSION,
    contentVersion: JLPT_EXAM_CONTENT_VERSION,
    sections: [
      section('vocabulary', 'Vocabulary', 25, 9, [
        slot('kanji-reading', 1, 4),
        slot('orthography', 1, 3),
        slot('contextual-expression', 1, 4),
        slot('paraphrase', 1, 3),
        slot('vocabulary-usage', 1, 2),
      ]),
      section('grammar-reading', 'Grammar / Reading', 55, 14, [
        slot('grammar-form', 1, 6),
        slot('sentence-composition', 1, 3),
        slot('text-grammar', 1, 2),
        slot('reading-short', 1, 2),
        slot('reading-medium', 1, 2),
        slot('information-retrieval', 1, 1),
      ]),
      section('listening', 'Listening', 35, 10, SHARED_LISTENING),
    ],
  },
  N3: {
    level: 'N3',
    version: JLPT_EXAM_BLUEPRINT_VERSION,
    contentVersion: JLPT_EXAM_CONTENT_VERSION,
    sections: [
      section('vocabulary', 'Vocabulary', 30, 10, [
        slot('kanji-reading', 1, 4),
        slot('orthography', 1, 3),
        slot('contextual-expression', 1, 4),
        slot('paraphrase', 1, 3),
        slot('vocabulary-usage', 1, 2),
      ]),
      section('grammar-reading', 'Grammar / Reading', 70, 16, [
        slot('grammar-form', 1, 6),
        slot('sentence-composition', 1, 3),
        slot('text-grammar', 1, 2),
        slot('reading-short', 1, 2),
        slot('reading-medium', 1, 2),
        slot('reading-long', 1, 1),
        slot('information-retrieval', 1, 1),
      ]),
      section('listening', 'Listening', 40, 12, [
        slot('listening-task', 1, 2),
        slot('listening-key-point', 1, 2),
        slot('listening-outline', 1, 2),
        slot('listening-expression', 1, 2),
        slot('listening-quick-response', 1, 2),
      ]),
    ],
  },
};

export function getJlptExamBlueprint(level: JlptLevel): JlptExamBlueprint {
  return JLPT_EXAM_BLUEPRINTS[level];
}

export function getJlptSectionQuestionCount(sectionBlueprint: JlptSectionBlueprint, mode: 'mini' | 'full'): number {
  return sectionBlueprint.slots.reduce(
    (total, current) => total + (mode === 'mini' ? current.miniCount : current.fullCount),
    0,
  );
}
