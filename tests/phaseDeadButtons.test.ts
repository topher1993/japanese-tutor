import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', 'src');
const APP = join(__dirname, '..');

function readFile(path: string): string {
  return readFileSync(path, 'utf8');
}

/**
 * Phase Fix-A — primary CTAs are no longer dead buttons.
 *
 * Phase 43 — App.tsx split: the `onStartLesson` callback that switches
 * tabs to 'Lessons' now lives in App.tsx as an inline arrow passed to
 * renderTab (`onStartLesson: () => nav.setTab('Lessons')`). The setTab
 * call itself is in useAppNavigation.ts.
 *
 * Test 3 "App.tsx wires Home CTA to switch to Learn tab" now scans
 * App.tsx + src/app/useAppNavigation.ts because the literal
 * `setTab('Lessons')` lives in the hook. The `<HomeScreen onStartLesson=`
 * render still lives in App.tsx (inside renderTab call).
 */
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
    const appSrc = readFile(join(APP, 'App.tsx'));
    const hookSrc = readFile(join(APP, 'src/app/useAppNavigation.ts'));
    const renderTabSrc = readFile(join(APP, 'src/app/renderTab.tsx'));

    it('passes an onStartLesson callback that switches tabs', () => {
      // Phase 43: App.tsx passes onStartLesson to renderTab as
      // `onStartLesson: () => nav.setTab('Lessons')`. The setTab call
      // lives in useAppNavigation.
      const appShell = [appSrc, hookSrc, renderTabSrc].join('\n\n');

      // 1) HomeScreen accepts onStartLesson (covered by describe above)
      // 2) renderTab wires onStartLesson to <HomeScreen>
      expect(renderTabSrc).toMatch(/<HomeScreen[^>]*onStartLesson=/);
      // 3) App.tsx uses the navigation helper so a pending lesson destination
      // can be carried into the Lessons tab instead of only changing tabs.
      expect(appSrc).toMatch(/onStartLesson:\s*\(\)\s*=>\s*nav\.onOpenLesson\(\)/);
      // 4) setTab lives in the hook (defensive — guards against inline re-implementation)
      expect(hookSrc).toMatch(/setTab\s*[:=]/);
      // Combined check: the literal `setTab('Lessons')` exists in the app shell.
      expect(appShell).toMatch(/setTab\(['"]Lessons['"]\)/);
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
      // Phase 40: the label first handles the todo-gate blocker, then
      // falls through to the prior Phase 30b three-way ternary.
      const primaryButton = src.match(
        /<Button\b[^>]*?\blabel=\{\s*todoGateBlocksCurrentLessonWeek[^]*?testID="learn-continue-button"[^]*?\/>/,
      );
      expect(primaryButton, 'primary CTA button missing').not.toBeNull();
      // The onPress handler is an async multi-line arrow function, so a
      // [^}]* match won't span it; assert on the structural pieces
      // independently instead.
      expect(primaryButton![0]).toMatch(/setSelected\(dailyLesson\.lesson\.id\)/);
      expect(primaryButton![0]).not.toMatch(/=>\s*undefined/);
      // Phase 38: opening/continuing a lesson must not complete it.
      // Completion is now explicit from the lesson detail screen after study.
      expect(primaryButton![0]).not.toContain('store.completeCurrentLesson');
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
    expect(src).toContain('getExampleSentencesForApp');
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
