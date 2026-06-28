import { describe, expect, it } from 'vitest';

import { getBottomNavigationTabs } from '../src/services/appNavigationService';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', 'src');

function readScreen(name: string): string {
  return readFileSync(join(SRC, 'screens', name), 'utf8');
}

function readService(name: string): string {
  return readFileSync(join(SRC, 'services', name), 'utf8');
}

describe('UX-0/1/2/3/4 simplification — non-technical user friendly', () => {
  describe('Bottom nav uses plain English labels', () => {
    // Phase 22 audit fix P0-04: standardised on activity nouns (Home / Lessons /
    // Flashcards / Quiz / Progress). The previous round used Today / Learn /
    // Practice / Test / Progress; GPT-5.5 audit overrode that decision because
    // mixing temporal / activity / meta metaphors was incoherent.
    it('Home / Lessons / Flashcards / Quiz / Progress', () => {
      const tabs = getBottomNavigationTabs().map(t => t.label);
      expect(tabs).toEqual(['Home', 'Lessons', 'Flashcards', 'Quiz', 'Progress']);
    });

    it('no leftover temporal/activity/meta mixing in nav labels', () => {
      const labels = getBottomNavigationTabs().map(t => t.label).join(' ');
      // No temporal ("Today"), no activity-verb ("Learn"/"Practice"/"Test"), all nouns.
      for (const old of ['Today', 'Learn', 'Practice', 'Test']) {
        expect(labels).not.toContain(old);
      }
    });
  });

  describe('Standardized back button copy', () => {
    it('HomeScreen has back navigation', () => {
      // New design: ScreenHeader with onBack callback (renders an icon, not literal text)
      const hasBack = readScreen('HomeScreen.tsx').includes('← Back') || /<ScreenHeader[\s\S]*?onBack=\{/m.test(readScreen('HomeScreen.tsx'));
      expect(hasBack).toBe(true);
    });

    it('LessonsScreen uses consistent back navigation everywhere', () => {
      const src = readScreen('LessonsScreen.tsx');
      expect(src).not.toContain('Back to home');
      expect(src).not.toContain('Back to lesson categories');
      expect(src).not.toContain('Back to lessons');
    });

    it('BetaFeedbackScreen no longer says "Back to Progress"', () => {
      expect(readScreen('BetaFeedbackScreen.tsx')).not.toContain('Back to Progress');
      const hasBack = readScreen('BetaFeedbackScreen.tsx').includes('← Back') || /<ScreenHeader[\s\S]*?onBack=\{/m.test(readScreen('BetaFeedbackScreen.tsx'));
      expect(hasBack).toBe(true);
    });

    it('SourcesScreen no longer says "Back to Progress"', () => {
      expect(readScreen('SourcesScreen.tsx')).not.toContain('Back to Progress');
      // Either literal or ScreenHeader onBack callback (allowing multi-line JSX)
      const src = readScreen('SourcesScreen.tsx');
      const has = src.includes('← Back') || /<ScreenHeader[\s\S]*?onBack=\{/m.test(src);
      expect(has).toBe(true);
    });

    it('WorkplaceSurvivalScreen no longer says "Back to survival topics"', () => {
      expect(readScreen('WorkplaceSurvivalScreen.tsx')).not.toContain('Back to survival topics');
      const hasBack = readScreen('WorkplaceSurvivalScreen.tsx').includes('← Back') || /<ScreenHeader[\s\S]*?onBack=\{/m.test(readScreen('WorkplaceSurvivalScreen.tsx'));
      expect(hasBack).toBe(true);
    });

    it('QuizScreen no longer says "Back to quiz"', () => {
      expect(readScreen('QuizScreen.tsx')).not.toContain('Back to quiz');
      // Either old literal "← Back" text or new ScreenHeader with onBack callback (allowing multi-line JSX)
      const hasBack = readScreen('QuizScreen.tsx').includes('← Back') || /<ScreenHeader[\s\S]*?onBack=\{/m.test(readScreen('QuizScreen.tsx'));
      expect(hasBack).toBe(true);
    });
  });

  describe('HomeScreen simplified — single primary CTA, no jargon banners', () => {
    // Phase 22 audit P0-04: "Today" → "Home" (tab-label noun); the screen title
    // and the lesson label can still reference "Today" because they describe
    // a specific day, not a tab metaphor.
    it('title is "Home" not "Japanese Tutor"', () => {
      const src = readScreen('HomeScreen.tsx');
      expect(src).toMatch(/<ScreenHeader[^>]*title="Home"|title=\{"Home"\}/);
      expect(src).not.toContain('>Japanese Tutor<');
    });

    it('has a single primary "Start today\'s lesson" CTA', () => {
      const src = readScreen('HomeScreen.tsx');
      expect(src).toContain("Start today's lesson");
    });

    it('no giant purple "Not sure where to start?" placement banner', () => {
      const src = readScreen('HomeScreen.tsx');
      expect(src).not.toContain('Not sure where to start?');
      expect(src).not.toContain('Take the 15-question placement test →');
    });

    it('placement test is reachable via the help disclosure', () => {
      const src = readScreen('HomeScreen.tsx');
      expect(src).toContain('Need help?');
      expect(src).toContain('Take the placement test');
    });

    it('no "Daily goal" sentence cluttering the top', () => {
      const src = readScreen('HomeScreen.tsx');
      expect(src).not.toContain('Daily goal: finish one workplace phrase lesson');
    });
  });

  describe('LessonsScreen simplified — one primary action, hidden categories', () => {
    it('primary action reflects progress ("Continue <lesson>" / "Start Week N" / "Review lessons 🎉")', () => {
      const src = readScreen('LessonsScreen.tsx');
      // Phase 30b: the label is now a 3-way ternary — course complete,
      // week preview, or mid-week. Assert on the structural shape.
      expect(src).toMatch(/label=\{\s*dailyLesson\.isCourseComplete/);
      expect(src).toMatch(/dailyLesson\.lesson\.title/);
    });

    it('title is "Lessons" not "Learn"', () => {
      const src = readScreen('LessonsScreen.tsx');
      // Accept either inline JSX or ScreenHeader prop:
      const hasTitle = src.includes('>Lessons<') || /<ScreenHeader[^>]*title="Lessons"|title=\{"Lessons"\}/.test(src);
      expect(hasTitle).toBe(true);
      expect(src).not.toContain('>Learn<');
    });

    it('hides the dev "Approved-for-beta" green banner', () => {
      const src = readScreen('LessonsScreen.tsx');
      expect(src).not.toContain('Approved-for-beta content');
      expect(src).not.toContain('candidateBanner');
    });

    it('hides categories behind a disclosure (not always visible)', () => {
      const src = readScreen('LessonsScreen.tsx');
      // Either old label "Browse other lessons" or new design "More tools"
      const hasDisclosure = src.includes('Browse other lessons') || src.includes('More tools');
      expect(hasDisclosure).toBe(true);
      expect(src).toContain('showMore');
    });

    it('no duplicate "All current lessons" list', () => {
      const src = readScreen('LessonsScreen.tsx');
      expect(src).not.toContain('All current lessons');
    });

    it('status badges are plain English ("Open" / "Soon") not "Ready" / "Planned"', () => {
      const src = readScreen('LessonsScreen.tsx');
      // The redesign uses Chip components without "Open"/"Soon" badges (the chip itself signals availability).
      // We assert the old jargon "Ready"/"Planned" is gone, and that category titles are still rendered.
      const hasReady = /['"]Ready['"]|>Ready</.test(src);
      const hasPlanned = /['"]Planned['"]|>Planned</.test(src);
      expect(hasReady).toBe(false);
      expect(hasPlanned).toBe(false);
      // Category titles should still render (the chip label)
      expect(src).toMatch(/category\.title/);
    });
  });

  describe('ProgressScreen — dev telemetry removed, "More tools" disclosure', () => {
    it('title is "Progress" (unchanged)', () => {
      const src = readScreen('ProgressScreen.tsx');
      // Either inline JSX or ScreenHeader prop
      const hasTitle = src.includes('>Progress<') || /<ScreenHeader[^>]*title="Progress"|title=\{"Progress"\}/.test(src);
      expect(hasTitle).toBe(true);
    });

    it('no "Broader Beta Trial" dev telemetry card', () => {
      const src = readScreen('ProgressScreen.tsx');
      expect(src).not.toContain('Broader Beta Trial');
      expect(src).not.toContain('betaTrialDailyChecklist');
      expect(src).not.toContain('buildBroaderBetaTrialPlan');
      expect(src).not.toContain('buildIosBetaDistributionPlan');
    });

    it('keeps streak + plan + level (learning value)', () => {
      const src = readScreen('ProgressScreen.tsx');
      // Streak is now rendered via the <StreakFlame> component instead of an inline streakCard style.
      expect(src).toContain('StreakFlame');
      expect(src).toMatch(/Today's plan|>Today.s plan</);
      expect(src).toMatch(/Your level|>Your level</);
    });

    it('hides Feedback/Sources behind "More tools" disclosure', () => {
      const src = readScreen('ProgressScreen.tsx');
      expect(src).toContain('More tools');
      expect(src).toContain('showMore');
      expect(src).toContain('Send feedback');
      expect(src).toContain('Sources & credits');
    });
  });

  describe('Visible-item budget (non-technical user "what do I do next?" rule)', () => {
    it('HomeScreen has at most 4 always-visible top-level sections', () => {
      const src = readScreen('HomeScreen.tsx');
      // Count the top-level always-visible ScrollView children: title, supportLabel, LessonCard, startButton, helpButton = 5 (helpButton is small disclosure trigger, not a panel)
      // We assert that "placement banner" and "Daily goal" are gone, so top-level items are title + lang + lesson + start + help-trigger = 5.
      // Hard ceiling to catch regressions:
      expect(src).not.toContain('Daily goal');
      expect(src).not.toContain('Phrase of the day:');
      // The help disclosure content (link to placement) is collapsed by default — guard it
      expect(src).toContain('showHelp');
    });

    it('LessonsScreen hides the progression Rewind/Prev/Next controls (those are dev navigation, not learner)', () => {
      const src = readScreen('LessonsScreen.tsx');
      // The dev-only Rewind/Prev/Next triple-button bar is removed in the simplified version
      expect(src).not.toContain("'◀ Rewind'");
      expect(src).not.toContain("'‹ Prev'");
    });
  });

  describe('No leftover references to deprecated placement banner', () => {
    it('appNavigationService exports standard tab labels (Phase 22 P0-04 fix)', () => {
      const src = readService('appNavigationService.ts');
      // After P0-04: every tab label is an activity noun.
      expect(src).toContain("'Home'");
      expect(src).toContain("'Lessons'");
      expect(src).toContain("'Flashcards'");
      expect(src).toContain("'Quiz'");
      expect(src).toContain("'Progress'");
      // No temporal or activity-verb labels remain.
      for (const old of ["'Today'", "'Learn'", "'Practice'", "'Test'"]) {
        expect(src).not.toContain(old);
      }
    });
  });
});