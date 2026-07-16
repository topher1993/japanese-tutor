import { describe, expect, it } from 'vitest';
import { createJlptExamAttemptRepository, JLPT_EXAM_STORAGE_KEYS } from '../src/repositories/jlptExamAttemptRepository';
import { createInMemoryKeyValueStorage } from '../src/services/keyValueStorage';
import { assembleJlptExam } from '../src/services/jlptExamAssembler';
import { scoreJlptExamAttempt } from '../src/services/jlptExamScoringService';
import {
  abandonJlptExam,
  continueJlptExam,
  createJlptExamAttempt,
  pauseJlptExam,
  submitCurrentJlptSection,
} from '../src/services/jlptExamSessionService';

function completedAttempt(seed: number, completedAt: number) {
  let attempt = createJlptExamAttempt(assembleJlptExam('N5', 'mini', seed), 'strict', completedAt - 1_000);
  for (let index = 0; index < attempt.sections.length; index += 1) {
    attempt = submitCurrentJlptSection(attempt, 'submitted', completedAt + index);
    if (index < attempt.sections.length - 1) attempt = continueJlptExam(attempt, completedAt + index);
  }
  return attempt;
}

describe('JLPT exam attempt repository', () => {
  it('round-trips an exact active attempt without leaking mutable references', async () => {
    const storage = createInMemoryKeyValueStorage();
    const repository = createJlptExamAttemptRepository(storage);
    const attempt = createJlptExamAttempt(assembleJlptExam('N4', 'mini', 44), 'practice', 1_000);
    await repository.saveActiveAttempt(attempt);
    const loaded = await repository.loadActiveAttempt();
    expect(loaded).toEqual(attempt);
    loaded!.answers.injected = 'A';
    expect((await repository.loadActiveAttempt())!.answers).not.toHaveProperty('injected');
  });

  it('round-trips every state emitted by the current session service', async () => {
    const storage = createInMemoryKeyValueStorage();
    const repository = createJlptExamAttemptRepository(storage);
    const active = createJlptExamAttempt(assembleJlptExam('N5', 'mini', 45), 'practice', 1_000);
    const paused = pauseJlptExam(active, 2_000);
    const sectionBreak = submitCurrentJlptSection(active, 'submitted', 2_000);
    const completed = completedAttempt(46, 10_000);
    const abandonedWithinSection = abandonJlptExam(active, 2_000);
    const abandonedBetweenSections = abandonJlptExam(sectionBreak, 2_500);

    for (const attempt of [active, paused, sectionBreak, completed, abandonedWithinSection, abandonedBetweenSections]) {
      await repository.saveActiveAttempt(attempt);
      expect(await repository.loadActiveAttempt()).toEqual(attempt);
    }
  });

  it('fails closed for malformed and incompatible active payloads', async () => {
    const storage = createInMemoryKeyValueStorage();
    const repository = createJlptExamAttemptRepository(storage);
    await storage.setItem(JLPT_EXAM_STORAGE_KEYS.active, '{broken');
    expect(await repository.loadActiveAttempt()).toBeNull();
    await storage.setItem(JLPT_EXAM_STORAGE_KEYS.active, JSON.stringify({ schemaVersion: 999, attempt: {} }));
    expect(await repository.loadActiveAttempt()).toBeNull();

    const attempt = createJlptExamAttempt(assembleJlptExam('N5', 'mini', 18), 'strict', 1_000);
    const corrupt = JSON.parse(JSON.stringify(attempt)) as typeof attempt;
    corrupt.sections[0].questions[0].sourceRefs = [];
    await storage.setItem(JLPT_EXAM_STORAGE_KEYS.active, JSON.stringify({ schemaVersion: 1, attempt: corrupt }));
    expect(await repository.loadActiveAttempt()).toBeNull();
    await expect(repository.saveActiveAttempt(corrupt)).rejects.toThrow('invalid JLPT exam attempt');
  });

  it('rejects status-inconsistent attempts and invalid listening state', async () => {
    const storage = createInMemoryKeyValueStorage();
    const repository = createJlptExamAttemptRepository(storage);
    const active = createJlptExamAttempt(assembleJlptExam('N5', 'mini', 19), 'practice', 1_000);

    const activeWithoutDeadline = structuredClone(active);
    delete activeWithoutDeadline.sectionDeadlineAt;
    await expect(repository.saveActiveAttempt(activeWithoutDeadline)).rejects.toThrow('invalid JLPT exam attempt');

    const pausedWithoutTimestamp = pauseJlptExam(active, 2_000);
    delete pausedWithoutTimestamp.pausedAt;
    await expect(repository.saveActiveAttempt(pausedWithoutTimestamp)).rejects.toThrow('invalid JLPT exam attempt');

    const completedWithoutTimestamp = completedAttempt(20, 20_000);
    delete completedWithoutTimestamp.completedAt;
    await expect(repository.saveActiveAttempt(completedWithoutTimestamp)).rejects.toThrow('invalid JLPT exam attempt');

    const outOfOrderSubmissions = completedAttempt(21, 21_000);
    [outOfOrderSubmissions.sectionSubmissions[0], outOfOrderSubmissions.sectionSubmissions[1]] = [
      outOfOrderSubmissions.sectionSubmissions[1],
      outOfOrderSubmissions.sectionSubmissions[0],
    ];
    await expect(repository.saveActiveAttempt(outOfOrderSubmissions)).rejects.toThrow('invalid JLPT exam attempt');

    const listeningWithoutAudio = structuredClone(active);
    listeningWithoutAudio.sections[2].questions[0].stimulus = undefined;
    await expect(repository.saveActiveAttempt(listeningWithoutAudio)).rejects.toThrow('invalid JLPT exam attempt');

    const playbackForNonAudioQuestion = structuredClone(active);
    playbackForNonAudioQuestion.audioPlayback[playbackForNonAudioQuestion.sections[0].questions[0].id] = { plays: 1 };
    await expect(repository.saveActiveAttempt(playbackForNonAudioQuestion)).rejects.toThrow('invalid JLPT exam attempt');
  });

  it('stores completed results once, newest first, and enforces bounded history', async () => {
    const storage = createInMemoryKeyValueStorage();
    const repository = createJlptExamAttemptRepository(storage, { maxHistory: 2 });
    const first = scoreJlptExamAttempt(completedAttempt(1, 1_000));
    const second = scoreJlptExamAttempt(completedAttempt(2, 2_000));
    const third = scoreJlptExamAttempt(completedAttempt(3, 3_000));
    await repository.addResult(first);
    await repository.addResult(second);
    await repository.addResult(second);
    await repository.addResult(third);
    const history = await repository.listResults();
    expect(history.map(result => result.id)).toEqual([third.id, second.id]);

    history[0].questionResults[0].explanation = 'mutated outside storage';
    expect((await repository.listResults())[0].questionResults[0].explanation).not.toBe('mutated outside storage');
  });

  it('rejects invalid history options and fails closed for incompatible or corrupt results', async () => {
    const storage = createInMemoryKeyValueStorage();
    expect(() => createJlptExamAttemptRepository(storage, { maxHistory: Number.POSITIVE_INFINITY })).toThrow('finite positive');
    expect(() => createJlptExamAttemptRepository(storage, { maxHistory: Number.NaN })).toThrow('finite positive');
    expect(() => createJlptExamAttemptRepository(storage, { maxHistory: 0 })).toThrow('finite positive');

    const repository = createJlptExamAttemptRepository(storage);
    await storage.setItem(JLPT_EXAM_STORAGE_KEYS.history, JSON.stringify({ schemaVersion: 999, results: [] }));
    expect(await repository.listResults()).toEqual([]);

    const result = scoreJlptExamAttempt(completedAttempt(20, 20_000));
    const corrupt = JSON.parse(JSON.stringify(result)) as typeof result;
    corrupt.bySection[0].accuracyPercent = Number.POSITIVE_INFINITY;
    await expect(repository.addResult(corrupt)).rejects.toThrow('invalid JLPT exam result');
  });

  it('rejects internally inconsistent result correctness, percentages, and breakdown totals', async () => {
    const repository = createJlptExamAttemptRepository(createInMemoryKeyValueStorage());
    const result = scoreJlptExamAttempt(completedAttempt(22, 22_000));

    const incorrectFlag = structuredClone(result);
    incorrectFlag.questionResults[0].correct = !incorrectFlag.questionResults[0].correct;
    await expect(repository.addResult(incorrectFlag)).rejects.toThrow('invalid JLPT exam result');

    const incorrectPercentage = structuredClone(result);
    incorrectPercentage.accuracyPercent = incorrectPercentage.accuracyPercent === 100 ? 99 : 100;
    await expect(repository.addResult(incorrectPercentage)).rejects.toThrow('invalid JLPT exam result');

    const incorrectBreakdown = structuredClone(result);
    incorrectBreakdown.bySection[0].total += 1;
    incorrectBreakdown.bySection[0].accuracyPercent = Math.round(
      (incorrectBreakdown.bySection[0].correct / incorrectBreakdown.bySection[0].total) * 100,
    );
    await expect(repository.addResult(incorrectBreakdown)).rejects.toThrow('invalid JLPT exam result');
  });

  it('caps oversized stored history on read and de-duplicates different result ids for one attempt', async () => {
    const storage = createInMemoryKeyValueStorage();
    const repository = createJlptExamAttemptRepository(storage, { maxHistory: 2 });
    const results = [1, 2, 3].map(seed => scoreJlptExamAttempt(completedAttempt(seed, seed * 1_000)));
    await storage.setItem(JLPT_EXAM_STORAGE_KEYS.history, JSON.stringify({ schemaVersion: 1, results }));
    expect((await repository.listResults()).map(result => result.completedAt)).toEqual([3_002, 2_002]);

    const duplicateAttempt = { ...results[2], id: `${results[2].id}-replacement`, completedAt: 9_000 };
    await repository.addResult(duplicateAttempt);
    expect((await repository.listResults()).filter(result => result.attemptId === results[2].attemptId)).toHaveLength(1);
  });

  it('serializes concurrent result appends without losing attempts', async () => {
    const storage = createInMemoryKeyValueStorage();
    const repository = createJlptExamAttemptRepository(storage, { maxHistory: 5 });
    const results = [31, 32, 33].map(seed => scoreJlptExamAttempt(completedAttempt(seed, seed * 1_000)));
    await Promise.all(results.map(result => repository.addResult(result)));
    expect((await repository.listResults()).map(result => result.attemptId).sort()).toEqual(
      results.map(result => result.attemptId).sort(),
    );
  });

  it('clears active and history records together', async () => {
    const storage = createInMemoryKeyValueStorage();
    const repository = createJlptExamAttemptRepository(storage);
    const attempt = completedAttempt(9, 9_000);
    await repository.saveActiveAttempt(attempt);
    await repository.addResult(scoreJlptExamAttempt(attempt));
    await repository.clearAll();
    expect(await repository.loadActiveAttempt()).toBeNull();
    expect(await repository.listResults()).toEqual([]);
  });
});
