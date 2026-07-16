/**
 * Asset manifest — single source of truth for every asset reference.
 *
 * All screens must import via this module. Direct `require('./assets/...')`
 * is forbidden by the `local/no-direct-asset-require` ESLint rule.
 *
 * Adding a new asset:
 *   1. Add the file under src/assets/source/{category}/
 *   2. Add a typed export below
 *   3. Add a test entry to manifest.test.ts
 */

export type AssetCategory =
  | 'icon'
  | 'splash'
  | 'adaptive'
  | 'onboarding'
  | 'emptyState'
  | 'badge'
  | 'tabIcon'
  | 'mascot'
  | 'logo'
  | 'jisho'
  | 'avatar';

export interface AssetEntry {
  /** Stable key, e.g. "icon.master", "onboarding.welcome" */
  key: string;
  /** Relative path from project root, used by the lint test to verify the file exists */
  path: string;
  /** For size validation */
  maxBytes?: number;
}

export const manifest = {
  icon: {
    master1024: {
      key: 'icon.master1024',
      path: 'src/assets/source/icon/app-icon-master-1024.png',
      maxBytes: 2_000_000,
    },
  },
  splash: {
    background: {
      key: 'splash.background',
      path: 'src/assets/source/splash/splash-background-1242x2436.png',
      maxBytes: 100_000,
    },
    icon: {
      key: 'splash.icon',
      path: 'src/assets/source/splash/splash-icon-1024.png',
      maxBytes: 2_000_000,
    },
    composed: {
      key: 'splash.composed',
      path: 'src/assets/source/splash/splash-composed-1242x2436.png',
      maxBytes: 1_500_000,
    },
  },
  adaptive: {
    foreground: {
      key: 'adaptive.foreground',
      path: 'src/assets/source/adaptive/android-adaptive-foreground-1080.png',
      maxBytes: 1_500_000,
    },
    background: {
      key: 'adaptive.background',
      path: 'src/assets/source/adaptive/android-adaptive-background-1080.png',
      maxBytes: 50_000,
    },
    monochrome: {
      key: 'adaptive.monochrome',
      path: 'src/assets/source/adaptive/android-adaptive-monochrome-1080.png',
      maxBytes: 50_000,
    },
  },
  onboarding: {
    welcome: {
      key: 'onboarding.welcome',
      path: 'src/assets/source/illustrations/onboarding/onboarding-01-welcome.png',
      maxBytes: 2_500_000,
    },
    welcomeFinal: {
      key: 'onboarding.welcomeFinal',
      path: 'src/assets/source/illustrations/onboarding/onboarding-01-welcome-final.png',
      maxBytes: 2_500_000,
    },
    workplace: {
      key: 'onboarding.workplace',
      path: 'src/assets/source/illustrations/onboarding/onboarding-03-workplace.png',
      maxBytes: 2_500_000,
    },
    workplaceFinal: {
      key: 'onboarding.workplaceFinal',
      path: 'src/assets/source/illustrations/onboarding/onboarding-03-workplace-final.png',
      maxBytes: 2_500_000,
    },
    habit: {
      key: 'onboarding.habit',
      path: 'src/assets/source/illustrations/onboarding/onboarding-04-habit.png',
      maxBytes: 2_500_000,
    },
    habitFinal: {
      key: 'onboarding.habitFinal',
      path: 'src/assets/source/illustrations/onboarding/onboarding-04-habit-final.png',
      maxBytes: 2_500_000,
    },
  },
  emptyState: {
    home: {
      key: 'emptyState.home',
      path: 'src/assets/source/illustrations/empty-state/empty-no-home.png',
      maxBytes: 1_500_000,
    },
    lessons: {
      key: 'emptyState.lessons',
      path: 'src/assets/source/illustrations/empty-state/empty-no-lessons.png',
      maxBytes: 1_500_000,
    },
    progress: {
      key: 'emptyState.progress',
      path: 'src/assets/source/illustrations/empty-state/empty-no-progress.png',
      maxBytes: 1_500_000,
    },
    flashcards: {
      key: 'emptyState.flashcards',
      path: 'src/assets/source/illustrations/empty-state/empty-no-flashcards.png',
      maxBytes: 1_500_000,
    },
    quiz: {
      key: 'emptyState.quiz',
      path: 'src/assets/source/illustrations/empty-state/empty-no-quiz.png',
      maxBytes: 1_500_000,
    },
    survival: {
      key: 'emptyState.survival',
      path: 'src/assets/source/illustrations/empty-state/empty-no-survival.png',
      maxBytes: 1_500_000,
    },
  },
  badge: {
    firstLesson: {
      key: 'badge.firstLesson',
      path: 'src/assets/source/badges/badge-first-lesson.png',
      maxBytes: 200_000,
    },
    streak7: {
      key: 'badge.streak7',
      path: 'src/assets/source/badges/badge-streak-7.png',
      maxBytes: 200_000,
    },
    streak30: {
      key: 'badge.streak30',
      path: 'src/assets/source/badges/badge-streak-30.png',
      maxBytes: 200_000,
    },
    firstKanji: {
      key: 'badge.firstKanji',
      path: 'src/assets/source/badges/badge-first-kanji.png',
      maxBytes: 200_000,
    },
    vocab100: {
      key: 'badge.vocab100',
      path: 'src/assets/source/badges/badge-vocab-100.png',
      maxBytes: 200_000,
    },
    levelUp: {
      key: 'badge.levelUp',
      path: 'src/assets/source/badges/badge-level-up.png',
      maxBytes: 200_000,
    },
    survivalComplete: {
      key: 'badge.survivalComplete',
      path: 'src/assets/source/badges/badge-survival-complete.png',
      maxBytes: 200_000,
    },
    perfectQuiz: {
      key: 'badge.perfectQuiz',
      path: 'src/assets/source/badges/badge-perfect-quiz.png',
      maxBytes: 200_000,
    },
    jlptN5: {
      key: 'badge.jlptN5',
      path: 'src/assets/source/badges/badge-jlpt-n5.png',
      maxBytes: 200_000,
    },
    jlptN4: {
      key: 'badge.jlptN4',
      path: 'src/assets/source/badges/badge-jlpt-n4.png',
      maxBytes: 200_000,
    },
    jlptN3: {
      key: 'badge.jlptN3',
      path: 'src/assets/source/badges/badge-jlpt-n3.png',
      maxBytes: 200_000,
    },
  },
  tabIcon: {
    home: {
      key: 'tabIcon.home',
      path: 'src/assets/source/tab-icons/tab-home.png',
      maxBytes: 100_000,
    },
    lessons: {
      key: 'tabIcon.lessons',
      path: 'src/assets/source/tab-icons/tab-lessons.png',
      maxBytes: 100_000,
    },
    flashcards: {
      key: 'tabIcon.flashcards',
      path: 'src/assets/source/tab-icons/tab-flashcards.png',
      maxBytes: 100_000,
    },
    quiz: {
      key: 'tabIcon.quiz',
      path: 'src/assets/source/tab-icons/tab-quiz.png',
      maxBytes: 100_000,
    },
    progress: {
      key: 'tabIcon.progress',
      path: 'src/assets/source/tab-icons/tab-progress.png',
      maxBytes: 100_000,
    },
  },
  mascot: {
    basePng: {
      key: 'mascot.basePng',
      path: 'src/assets/source/mascot/mascot-base.png',
      maxBytes: 2_500_000,
    },
    happyPng: {
      key: 'mascot.happyPng',
      path: 'src/assets/source/mascot/mascot-happy.png',
      maxBytes: 2_500_000,
    },
    thinkingPng: {
      key: 'mascot.thinkingPng',
      path: 'src/assets/source/mascot/mascot-thinking.png',
      maxBytes: 2_500_000,
    },
    celebratePng: {
      key: 'mascot.celebratePng',
      path: 'src/assets/source/mascot/mascot-celebrate.png',
      maxBytes: 2_500_000,
    },
    encouragePng: {
      key: 'mascot.encouragePng',
      path: 'src/assets/source/mascot/mascot-encourage.png',
      maxBytes: 2_500_000,
    },
  },
  logo: {
    appLogo1024: {
      key: 'logo.appLogo1024',
      path: 'src/assets/source/logo/app-logo-1024.png',
      maxBytes: 1_500_000,
    },
    appLogo: {
      key: 'logo.appLogo',
      path: 'src/assets/source/logo/app-logo.png',
      maxBytes: 1_500_000,
    },
  },
  jisho: {
    logo: {
      key: 'jisho.logo',
      path: 'src/assets/source/jisho/jisho-logo-256.png',
      maxBytes: 100_000,
    },
  },
  avatar: {
    koiPlaceholderGlb: {
      key: 'avatar.koiPlaceholderGlb',
      path: 'assets/koi-sensei/koi-sensei-placeholder.glb',
      maxBytes: 4 * 1_024 * 1_024,
    },
  },
} as const;

export type AssetManifest = typeof manifest;
