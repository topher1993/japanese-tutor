// Phase 42 / P1-1 — App providers extracted from App.tsx.
//
// Wraps the app in the two context providers that almost every screen needs:
// - UserProfileProvider for the learner's profile (language, weekly progress)
// - LearningRepositoryProvider for the SQLite learning repository
//
// Anything that's a pure provider chain lives here. Anything that's app-shell
// layout (safe area, status bar, width cap) lives in AppShell.tsx.

import React from 'react';
import { LearningRepositoryProvider } from '../services/learningContext';
import { UserProfileProvider } from '../services/userProfileContext';
import { KoiSenseiProvider } from '../features/koi-sensei/KoiSenseiContext';
import {
  resolveKoiFirebaseLiveConfig,
  resolveKoiPublicRuntimeConfig,
  type KoiPublicEnvironment,
} from '../features/koi-sensei/api';

const koiPublicEnvironment: KoiPublicEnvironment = {
  EXPO_PUBLIC_KOI_STAGE: process.env.EXPO_PUBLIC_KOI_STAGE,
  EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_DATABASE_URL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  EXPO_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY: process.env.EXPO_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY,
  EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION: process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION,
  EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_ORIGIN: process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_ORIGIN,
  EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_ORIGIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_ORIGIN,
  EXPO_PUBLIC_KOI_EMAIL_LINK_URL: process.env.EXPO_PUBLIC_KOI_EMAIL_LINK_URL,
  EXPO_PUBLIC_KOI_WORKER_URL: process.env.EXPO_PUBLIC_KOI_WORKER_URL,
  // These forbidden names are referenced deliberately so an accidental Expo
  // public provider secret fails startup instead of being silently bundled.
  EXPO_PUBLIC_MINIMAX_TOKEN_PLAN_KEY: process.env.EXPO_PUBLIC_MINIMAX_TOKEN_PLAN_KEY,
  EXPO_PUBLIC_MINIMAX_API_KEY: process.env.EXPO_PUBLIC_MINIMAX_API_KEY,
  EXPO_PUBLIC_TOKEN_PLAN_KEY: process.env.EXPO_PUBLIC_TOKEN_PLAN_KEY,
};
const koiRuntimeConfig = resolveKoiPublicRuntimeConfig(koiPublicEnvironment);
const koiFirebaseLiveConfig = resolveKoiFirebaseLiveConfig(koiPublicEnvironment, koiRuntimeConfig);

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <UserProfileProvider>
      <LearningRepositoryProvider>
        <KoiSenseiProvider
          runtimeStage={koiRuntimeConfig.stage}
          liveConfig={koiFirebaseLiveConfig}
        >
          {children}
        </KoiSenseiProvider>
      </LearningRepositoryProvider>
    </UserProfileProvider>
  );
}
