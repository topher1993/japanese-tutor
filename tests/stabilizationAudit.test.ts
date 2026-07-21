import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('production stabilization regressions', () => {
  it('keeps the Sensei filters interactive and handles load failure visibly', () => {
    const source = readFileSync('src/screens/SenseiReviewScreen.tsx', 'utf8');
    expect(source).toContain('const [showFilters, setShowFilters]');
    expect(source).toContain('open={showFilters}');
    expect(source).toContain('setShowFilters(value => !value)');
    expect(source).toContain('Review queue unavailable');
    expect(source).toContain('label="Retry"');
    expect(source).toContain('const [actionBusy, setActionBusy]');
    expect(source).toContain('runReviewAction');
    expect(source).toContain('review change could not be saved');
  });

  it('cancels stale toast timers and announces feedback accessibly', () => {
    const reviewer = readFileSync('src/screens/SenseiReviewScreen.tsx', 'utf8');
    const toasts = readFileSync('src/components/CompletionToast.tsx', 'utf8');
    expect(reviewer).toContain('toastTimerRef');
    expect(reviewer).toContain('clearTimeout(toastTimerRef.current)');
    expect(toasts.match(/hideTimerRef/g)?.length).toBeGreaterThan(6);
    expect(toasts).toContain('accessibilityLiveRegion="polite"');
    expect(toasts).toContain('accessibilityLiveRegion="assertive"');
  });

  it('removes unnecessary permissions, blocks backup leakage, gates API-33 splash resources, and forbids implicit debug signing', () => {
    const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
    const gradle = readFileSync('android/app/build.gradle', 'utf8');
    const baseStyles = readFileSync('android/app/src/main/res/values/styles.xml', 'utf8');
    const api33Styles = readFileSync('android/app/src/main/res/values-v33/styles.xml', 'utf8');
    const backupRules = readFileSync('android/app/src/main/res/xml/backup_rules.xml', 'utf8');
    const extractionRules = readFileSync('android/app/src/main/res/xml/data_extraction_rules.xml', 'utf8');
    expect(manifest).not.toContain('READ_EXTERNAL_STORAGE');
    expect(manifest).not.toContain('WRITE_EXTERNAL_STORAGE');
    expect(manifest).not.toContain('SYSTEM_ALERT_WINDOW');
    expect(manifest).toContain('android:allowBackup="false"');
    expect(manifest).toContain('android:fullBackupContent="@xml/backup_rules"');
    expect(manifest).toContain('android:dataExtractionRules="@xml/data_extraction_rules"');
    expect(backupRules).toContain('<exclude domain="database" path="." />');
    expect(extractionRules).toContain('<device-transfer>');
    expect(baseStyles).not.toContain('android:windowSplashScreenBehavior');
    expect(api33Styles).toContain('android:windowSplashScreenBehavior');
    expect(gradle).toContain('hasProductionSigning');
    expect(gradle).toContain('allowDebugReleaseSigning');
    expect(gradle).toContain('verifyReleaseSigningPolicy');
  });

  it('provides roles, state, and labels for shared interactive controls', () => {
    const chip = readFileSync('src/components/Chip.tsx', 'utf8');
    const disclosure = readFileSync('src/components/Disclosure.tsx', 'utf8');
    const lessonRow = readFileSync('src/screens/lessons/LessonPathRow.tsx', 'utf8');
    const feedback = readFileSync('src/screens/BetaFeedbackScreen.tsx', 'utf8');
    expect(chip).toContain("accessibilityRole={onPress ? 'button' : undefined}");
    expect(chip).toContain('accessibilityState={onPress ? { selected } : undefined}');
    expect(disclosure).toContain('accessibilityState={{ expanded: open }}');
    expect(lessonRow).toContain('accessibilityState={{ disabled: item.state === \'locked\', selected: item.state === \'current\' }}');
    expect(feedback).toContain('accessibilityRole="radio"');
    expect(feedback).toContain('accessibilityLabel="Describe what happened"');
  });

  it('surfaces profile-save and external-link failures instead of leaking rejected promises', () => {
    const profile = readFileSync('src/screens/ProfileScreen.tsx', 'utf8');
    const feedback = readFileSync('src/screens/BetaFeedbackScreen.tsx', 'utf8');
    expect(profile).toContain('could not be saved. Please retry.');
    expect(feedback).toContain('await Linking.canOpenURL');
    expect(feedback).toContain('Could not open the feedback form.');
    expect(feedback).toContain('accessibilityLiveRegion="assertive"');
  });

  it('describes storage truthfully across native and web and contains reset failures', () => {
    const settings = readFileSync('src/screens/SettingsScreen.tsx', 'utf8');
    expect(settings).toContain('On-device durable storage');
    expect(settings).not.toContain('SQLite (durable)');
    expect(settings).toContain('Reset did not finish. Some data may already be cleared; please retry.');
  });

  it('keeps test sessions focused, randomizes answer positions, and allows another attempt', () => {
    const session = readFileSync('src/services/quizSessionService.ts', 'utf8');
    const screen = readFileSync('src/screens/QuizScreen.tsx', 'utf8');
    expect(session).toContain('QUIZ_SESSION_SIZE = 10');
    expect(session).toContain('shuffleQuestionChoices');
    expect(screen).toContain('label="Try another test"');
    expect(screen).toContain('const completedMode = session.mode');
    expect(screen).toContain('const completedSource = session.source');
    expect(screen).toContain('mode: completedMode');
    expect(screen).toContain('source: completedSource');
  });

  it('resolves kanji requirements during hydration and describes adaptive quiz work accurately', () => {
    const progress = readFileSync('src/services/practiceProgressStore.ts', 'utf8');
    const plan = readFileSync('src/services/adaptiveDailyPlanService.ts', 'utf8');
    expect(progress).toContain("if (todo.kind === 'kanji')");
    expect(progress).toContain('resolveKanjiSet(todo.kanjiSet)');
    expect(plan).toContain("unit: 'test'");
  });
});
