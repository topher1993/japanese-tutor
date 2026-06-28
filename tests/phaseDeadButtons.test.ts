import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', 'src');
const APP = join(__dirname, '..');

function readFile(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('Phase Fix-A — primary CTAs are no longer dead buttons', () => {
  describe("HomeScreen Start CTA", () => {
    const src = readFile(join(SRC, 'screens', 'HomeScreen.tsx'));

    it('has an onStartLesson prop', () => {
      expect(src).toMatch(/onStartLesson\??\s*:\s*\(\)\s*=>\s*void/);
    });

    it('the start button calls onStartLesson (not undefined)', () => {
      // The redesigned HomeScreen uses the <Button> primitive. The CTA's onPress must invoke onStartLesson.
      expect(src).toContain("Start today's lesson");
      // No `=> undefined` should be present in the Start CTA's onPress.
      // Find the Button invocation and check its onPress prop.
      const buttonBlock = src.match(/<Button[\s\S]*?label="Start today's lesson"[\s\S]*?\/>/);
      expect(buttonBlock).not.toBeNull();
      expect(buttonBlock![0]).toContain('onStartLesson');
      expect(buttonBlock![0]).not.toMatch(/=>\s*undefined/);
    });
  });

  describe('App.tsx wires Home CTA to switch to Learn tab', () => {
    const src = readFile(join(APP, 'App.tsx'));

    it('passes an onStartLesson callback that switches tabs', () => {
      const srcLines = src.split('\n').join(' ');
      // 1) onStartLesson appears in the render() signature
      expect(srcLines).toMatch(/onStartLesson:\s*\(\)\s*=>\s*void/);
      // 2) HomeScreen receives onStartLesson
      expect(srcLines).toMatch(/<HomeScreen[^>]*onStartLesson=/);
      // 3) The callback passed to render() switches tabs to 'Lessons'
      expect(srcLines).toMatch(/setTab\(['"]Lessons['"]\)/);
    });
  });

  describe("LessonsScreen primary CTA", () => {
    const src = readFile(join(SRC, 'screens', 'LessonsScreen.tsx'));

    it('the continue button opens the daily lesson (not undefined)', () => {
      // Phase 30: the primary CTA on the lessons list uses
      // `dailyLesson.lesson.id` (mid-week "Continue <title>" or
      // "Start Week N" preview). Match that button specifically so the
      // test does not pick up the secondary "Next: <lesson>" button that
      // appears inside the lesson-detail view.
      // Use a non-greedy regex that anchors on the label starting with
      // `dailyLesson.isCourseComplete` so we only match the primary CTA.
      // Phase 30b added the course-complete branch (`isCourseComplete ?
      // 'Review lessons 🎉' : isWeekPreview ? ...`).
      const primaryButton = src.match(
        /<Button\b[^>]*?\blabel=\{\s*dailyLesson\.isCourseComplete[^]*?\/>/,
      );
      expect(primaryButton, 'primary CTA button missing').not.toBeNull();
      // The onPress handler is an async multi-line arrow function, so a
      // [^}]* match won't span it; assert on the structural pieces
      // independently instead.
      expect(primaryButton![0]).toMatch(/setSelected\(dailyLesson\.lesson\.id\)/);
      expect(primaryButton![0]).not.toMatch(/=>\s*undefined/);
      expect(primaryButton![0]).toContain('store.completeCurrentLesson');
    });

    it('accepts a pendingLessonId prop and auto-opens that lesson', () => {
      expect(src).toMatch(/pendingLessonId\??\s*:\s*string/);
      expect(src).toMatch(/useEffect/);
      expect(src).toContain('pendingLessonId');
    });
  });
});

describe('Phase Fix-B — Example sentences are reachable from the UI', () => {
  it('ExampleSentencesScreen exists', () => {
    const src = readFile(join(SRC, 'screens', 'ExampleSentencesScreen.tsx'));
    expect(src).toContain('ExampleSentencesScreen');
    expect(src).toContain('getExampleSentenceCandidatePack');
    expect(src).toContain('>Example sentences<');
  });

  it('LessonsScreen exposes an "Example sentences" entry inside the disclosure', () => {
    const src = readFile(join(SRC, 'screens', 'LessonsScreen.tsx'));
    expect(src).toContain('ExampleSentencesScreen');
    // The ToolRow for Example sentences wires onPress to setShowExamples.
    // Match across newlines because the props may be on separate lines.
    const toolRow = src.match(/<ToolRow[\s\S]*?label="Example sentences"[\s\S]*?\/>/);
    expect(toolRow).not.toBeNull();
    expect(toolRow![0]).toContain('setShowExamples');
    expect(src).toContain('Example sentences');
    expect(src).toContain('200+ curated sentences by topic');
  });

  it('ExampleSentencesScreen renders candidate data without auto-wiring it into flashcards/kanji', () => {
    const src = readFile(join(SRC, 'screens', 'ExampleSentencesScreen.tsx'));
    // Read-only display: should NOT import flashcard service, kanji service, or quiz service.
    expect(src).not.toContain('flashcardService');
    expect(src).not.toContain('kanjiService');
    expect(src).not.toContain('quizService');
    expect(src).not.toContain('candidateFlashcardAdapter');
    expect(src).not.toContain('candidateKanjiAdapter');
  });
});
