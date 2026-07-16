import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Phase 44.2 — complete tab-change analytics wiring', () => {
  const app = readFileSync('App.tsx', 'utf8');
  const navigation = readFileSync('src/app/useAppNavigation.ts', 'utf8');

  it('injects one analytics callback into the navigation owner', () => {
    expect(app).toContain('const trackTabVisit = React.useCallback((tab: AppTab) => {');
    expect(app).toContain("track('tab_visited', { tab, initial: false })");
    expect(app).toContain('useAppNavigation(trackTabVisit)');
    expect(navigation).toContain('onTabVisited: (next: AppTab) => void');
  });

  it('routes raw and programmatic transitions through the same setter', () => {
    expect(navigation).toContain('const [tab, setTabState]');
    expect(navigation).toMatch(/const setTab = useCallback\([\s\S]*?setTabState\(next\);[\s\S]*?onTabVisited\(next\);/);
    for (const callback of ['onReviewDue', 'onPracticeWeak', 'onOpenGrammar', 'onOpenLesson', 'onOpenLessonTool', 'onPracticeWordGroup', 'onPracticeTopic', 'onTabChange']) {
      const body = navigation.match(new RegExp(`const ${callback} = useCallback\\([\\s\\S]*?\\n  \\}, \\[setTab\\]\\);`))?.[0];
      expect(body, `${callback} must use the centralized tab setter`).toContain('setTab(');
    }
  });

  it('lets both TabBar layouts use the centralized navigation handler', () => {
    expect(app.match(/onSelect=\{nav\.onTabChange\}/g)).toHaveLength(2);
    expect(app).not.toContain('onTabChangeWithAnalytics');
  });

  it('still records the initial visible tab separately', () => {
    expect(app).toMatch(/initialTabTracked\.current\s*=\s*true;[\s\S]*?track\(\s*['"]tab_visited['"][\s\S]*?initial:\s*true/);
  });
});
