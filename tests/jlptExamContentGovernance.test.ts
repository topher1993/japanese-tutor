import { describe, expect, it } from 'vitest';
import { JLPT_EXAM_CONTENT_VERSION } from '../src/data/jlptExamBlueprints';
import { getVerbVocabularyCandidatePack } from '../src/data/candidates/verbVocabularyCandidatePack';
import { grammarLessons } from '../src/data/grammarLessons';
import { mockSenseiLessons } from '../src/data/mockSenseiLessons';
import {
  JLPT_AUTHORED_READING_EXAM_REVIEWS,
  buildJlptExamQuestionBank,
  isJlptExamCandidateEligible,
  isJlptExamLessonItemEligible,
  isJlptExamSourceEligible,
} from '../src/services/jlptExamContentService';
import type { JlptExamSourceRef, JlptLevel } from '../src/types/jlptExam';

const levels: JlptLevel[] = ['N5', 'N4', 'N3'];

describe('JLPT exam content governance', () => {
  for (const level of levels) {
    it(`${level} uses every approved source-backed verb in the exam candidate bank`, () => {
      const bankIds = buildJlptExamQuestionBank(level).map(question => question.id);
      const verbs = getVerbVocabularyCandidatePack(level).filter(entry => entry.reviewStatus === 'approved-for-beta');
      const expectedTypes = level === 'N5'
        ? ['kanji-reading', 'orthography', 'contextual-expression', 'paraphrase']
        : ['kanji-reading', 'orthography', 'contextual-expression', 'paraphrase', 'vocabulary-usage'];
      const missing = verbs.flatMap(verb => expectedTypes
        .filter(itemType => !bankIds.includes(`jlpt-${level.toLowerCase()}-vocab-${itemType}-${verb.id}`))
        .map(itemType => `${verb.id}:${itemType}`));
      expect(missing, `Missing verb-backed task variants: ${missing.join(', ')}`).toEqual([]);
      const verbContexts = buildJlptExamQuestionBank(level).filter(question =>
        question.itemType === 'contextual-expression'
        && verbs.some(verb => question.id.endsWith(verb.id)));
      expect(verbContexts.every(question => question.prompt.includes('明日は何をする予定ですか'))).toBe(true);
    });

    it(`${level} listening content is original/app-reviewed and has a one-play mock policy`, () => {
      const listening = buildJlptExamQuestionBank(level).filter(question => question.section === 'listening');
      expect(listening.length).toBeGreaterThan(0);
      expect(listening.every(question => question.stimulus?.kind === 'audio')).toBe(true);
      expect(listening.every(question => Boolean(question.stimulus?.audioText && question.stimulus.transcript))).toBe(true);
      expect(listening.every(question => question.stimulus?.title === 'Text-to-speech practice script')).toBe(true);
      expect(listening.every(question => question.audioPlayLimit === 1)).toBe(true);
      expect(listening.flatMap(question => question.sourceRefs).every(source => !/jlpt\.jp|official jlpt/i.test(source.sourceId))).toBe(true);

      const quickResponses = listening.filter(question => question.itemType === 'listening-quick-response');
      expect(quickResponses.length).toBeGreaterThanOrEqual(2);
      expect(quickResponses.every(question => /natural immediate response/i.test(question.prompt))).toBe(true);
      expect(quickResponses.every(question => question.choices.every(choice => /[ぁ-んァ-ン一-龯]/u.test(choice.text)))).toBe(true);

      if (level === 'N3') {
        const outlines = listening.filter(question => question.itemType === 'listening-outline');
        expect(outlines.length).toBeGreaterThanOrEqual(2);
        expect(outlines.every(question => /both statements|overall message/i.test(question.prompt))).toBe(true);
        expect(outlines.every(question => (question.stimulus?.audioText?.match(/[。！？]/g)?.length ?? 0) >= 2)).toBe(true);
      }
    });

    it(`${level} contextual vocabulary tasks contain an actual completion context`, () => {
      const contextual = buildJlptExamQuestionBank(level).filter(question =>
        question.itemType === 'contextual-expression' || question.itemType === 'vocabulary-usage');
      expect(contextual.length).toBeGreaterThan(0);
      expect(contextual.every(question => question.prompt.includes('＿＿'))).toBe(true);
      expect(contextual.every(question => /A:|B:/.test(question.prompt))).toBe(true);
    });
  }

  it('keeps provenance and licensing on every learner-visible exam question', () => {
    const questions = levels.flatMap(buildJlptExamQuestionBank);
    const sourceRefs = questions.flatMap(question => question.sourceRefs);
    expect(sourceRefs.length).toBeGreaterThanOrEqual(questions.length);
    expect(sourceRefs.every(source => source.sourceId.trim() && source.license.trim())).toBe(true);
    expect(sourceRefs.every(source => ['jmdict', 'kanjidic2', 'app-lesson', 'app-authored'].includes(source.kind))).toBe(true);
    expect(sourceRefs.every(isJlptExamSourceEligible)).toBe(true);
  });

  it('rejects unknown licenses and underlying content that has not reached its approved state', () => {
    const jmdict: JlptExamSourceRef = {
      sourceId: 'JMdict:1000000',
      license: 'CC BY-SA 4.0',
      kind: 'jmdict',
    };
    const unknownLicense: JlptExamSourceRef = { ...jmdict, license: 'unknown' };
    const lesson: JlptExamSourceRef = {
      sourceId: 'lesson-test',
      license: 'In-app Japanese Tutor curriculum',
      kind: 'app-lesson',
    };
    expect(isJlptExamSourceEligible(jmdict)).toBe(true);
    expect(isJlptExamSourceEligible(unknownLicense)).toBe(false);
    expect(isJlptExamCandidateEligible('approved-for-beta', jmdict)).toBe(true);
    expect(isJlptExamCandidateEligible('sensei-review-needed', jmdict)).toBe(false);
    expect(isJlptExamCandidateEligible('approved-for-beta', unknownLicense)).toBe(false);
    expect(isJlptExamLessonItemEligible('approved', lesson)).toBe(true);
    expect(isJlptExamLessonItemEligible('draft', lesson)).toBe(false);
  });

  it('admits original reading passages only through the explicit versioned review registry', () => {
    const readings = levels.flatMap(buildJlptExamQuestionBank)
      .filter(question => question.sourceRefs.some(source => source.kind === 'app-authored'));
    expect(readings.length).toBeGreaterThan(0);
    for (const question of readings) {
      const source = question.sourceRefs.find(candidate => candidate.kind === 'app-authored')!;
      const seedId = source.sourceId.replace('japanese-tutor:', '');
      expect(JLPT_AUTHORED_READING_EXAM_REVIEWS[seedId]).toEqual({
        status: 'approved',
        contentVersion: JLPT_EXAM_CONTENT_VERSION,
      });
    }
    expect(readings).toHaveLength(Object.keys(JLPT_AUTHORED_READING_EXAM_REVIEWS).length);
  });

  it('derives grammar and listening questions only from translation-approved lesson items', () => {
    const lessonItems = [...grammarLessons, ...mockSenseiLessons]
      .flatMap(lesson => lesson.items.map(item => ({ lessonId: lesson.id, item })));
    const lessonQuestions = levels.flatMap(buildJlptExamQuestionBank)
      .filter(question => question.section === 'listening'
        || question.itemType === 'grammar-form'
        || question.itemType === 'sentence-composition'
        || question.itemType === 'text-grammar');

    for (const question of lessonQuestions) {
      const matchingItem = lessonItems.find(({ lessonId, item }) =>
        question.sourceRefs.some(source => source.sourceId === lessonId)
        && (question.id.endsWith(item.id) || question.id.endsWith(`lesson-example-${item.id}`)));
      expect(matchingItem, `Missing approved lesson item for ${question.id}`).toBeDefined();
      expect(matchingItem?.item.translationReviewStatus).toBe('approved');
    }
  });
});
