/**
 * Asset → require() map.
 *
 * React Native's bundler needs `require()` to receive a LITERAL string at
 * compile time so it can include the asset in the bundle. You cannot build
 * the path dynamically from the manifest and `require()` it at runtime.
 *
 * This file is the bridge: it statically requires every asset we ship, then
 * exposes them as a typed map keyed by the manifest key. Screens import from
 * here, never from `require()` directly.
 *
 * Adding a new asset:
 *   1. Add it to manifest.ts
 *   2. Add a `require()` line below
 *   3. Add a test entry
 */

/* eslint-disable @typescript-eslint/no-var-requires */

export const assetRequireMap = {
  // Icon
  'icon.master1024': require('../assets/source/icon/app-icon-master-1024.png'),

  // Splash
  'splash.background': require('../assets/source/splash/splash-background-1242x2436.png'),
  'splash.icon': require('../assets/source/splash/splash-icon-1024.png'),
  'splash.composed': require('../assets/source/splash/splash-composed-1242x2436.png'),

  // Android adaptive
  'adaptive.foreground': require('../assets/source/adaptive/android-adaptive-foreground-1080.png'),
  'adaptive.background': require('../assets/source/adaptive/android-adaptive-background-1080.png'),
  'adaptive.monochrome': require('../assets/source/adaptive/android-adaptive-monochrome-1080.png'),

  // Onboarding illustrations (base scenes)
  'onboarding.welcome': require('../assets/source/illustrations/onboarding/onboarding-01-welcome.png'),
  'onboarding.workplace': require('../assets/source/illustrations/onboarding/onboarding-03-workplace.png'),
  'onboarding.habit': require('../assets/source/illustrations/onboarding/onboarding-04-habit.png'),

  // Onboarding illustrations (with kanji overlay — these are what users see)
  'onboarding.welcomeFinal': require('../assets/source/illustrations/onboarding/onboarding-01-welcome-final.png'),
  'onboarding.workplaceFinal': require('../assets/source/illustrations/onboarding/onboarding-03-workplace-final.png'),
  'onboarding.habitFinal': require('../assets/source/illustrations/onboarding/onboarding-04-habit-final.png'),

  // Empty-state illustrations
  'emptyState.home': require('../assets/source/illustrations/empty-state/empty-no-home.png'),
  'emptyState.lessons': require('../assets/source/illustrations/empty-state/empty-no-lessons.png'),
  'emptyState.progress': require('../assets/source/illustrations/empty-state/empty-no-progress.png'),
  'emptyState.flashcards': require('../assets/source/illustrations/empty-state/empty-no-flashcards.png'),
  'emptyState.quiz': require('../assets/source/illustrations/empty-state/empty-no-quiz.png'),
  'emptyState.survival': require('../assets/source/illustrations/empty-state/empty-no-survival.png'),

  // Tab bar icons (Home / Lessons / Flashcards / Quiz / Progress)
  'tabIcon.home': require('../assets/source/tab-icons/tab-home.png'),
  'tabIcon.lessons': require('../assets/source/tab-icons/tab-lessons.png'),
  'tabIcon.flashcards': require('../assets/source/tab-icons/tab-flashcards.png'),
  'tabIcon.quiz': require('../assets/source/tab-icons/tab-quiz.png'),
  'tabIcon.progress': require('../assets/source/tab-icons/tab-progress.png'),

  // Mascot expressions (5 PNGs for direct Image rendering)
  'mascot.basePng': require('../assets/source/mascot/mascot-base.png'),
  'mascot.happyPng': require('../assets/source/mascot/mascot-happy.png'),
  'mascot.thinkingPng': require('../assets/source/mascot/mascot-thinking.png'),
  'mascot.celebratePng': require('../assets/source/mascot/mascot-celebrate.png'),
  'mascot.encouragePng': require('../assets/source/mascot/mascot-encourage.png'),

  // Jisho logo (used by the JishoLink component to display the Jisho.org brand mark)
  'jisho.logo': require('../assets/source/jisho/jisho-logo-256.png'),

  // App logo (chibi-samurai "に helmet" + にほんご wordmark) — used in headers and hero
  'logo.appLogo': require('../assets/source/logo/app-logo.png'),
  'logo.appLogo1024': require('../assets/source/logo/app-logo-1024.png'),

  // Badges (8 achievement + 2 JLPT — PNG renderings of the hand-authored SVGs)
  'badge.firstLesson': require('../assets/source/badges/badge-first-lesson.png'),
  'badge.streak7': require('../assets/source/badges/badge-streak-7.png'),
  'badge.streak30': require('../assets/source/badges/badge-streak-30.png'),
  'badge.firstKanji': require('../assets/source/badges/badge-first-kanji.png'),
  'badge.vocab100': require('../assets/source/badges/badge-vocab-100.png'),
  'badge.levelUp': require('../assets/source/badges/badge-level-up.png'),
  'badge.survivalComplete': require('../assets/source/badges/badge-survival-complete.png'),
  'badge.perfectQuiz': require('../assets/source/badges/badge-perfect-quiz.png'),
  'badge.jlptN5': require('../assets/source/badges/badge-jlpt-n5.png'),
  'badge.jlptN4': require('../assets/source/badges/badge-jlpt-n4.png'),
  'badge.jlptN3': require('../assets/source/badges/badge-jlpt-n3.png'),
} as const;

export type AssetKey = keyof typeof assetRequireMap;

/** Convenience: typed getter. Throws if key not registered. */
export function getAsset(key: AssetKey): number {
  const value = assetRequireMap[key];
  if (value == null) {
    throw new Error(`[assetRequireMap] missing require() for key="${key}"`);
  }
  return value as number;
}