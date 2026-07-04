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

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <UserProfileProvider>
      <LearningRepositoryProvider>{children}</LearningRepositoryProvider>
    </UserProfileProvider>
  );
}