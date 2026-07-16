import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Phase 28 profile screen integration.
 *
 * Phase 43 — App.tsx split: the `showProfile` state moved out of App.tsx
 * into `src/app/useAppNavigation.ts`. App.tsx still owns the route
 * registration + `<ProfileScreen>` JSX, but the state name now comes from
 * `nav.showProfile` / `nav.setShowProfile` destructured from the hook.
 *
 * The "ProfileScreen is registered" assertion still scans App.tsx (it does).
 * The `useState` line that owned `showProfile` now lives in the hook, so
 * the test must scan App.tsx + src/app/useAppNavigation.ts to find it.
 */
const appSource = readFileSync('App.tsx', 'utf8');
const navHookSource = readFileSync('src/app/useAppNavigation.ts', 'utf8');
const progressSource = readFileSync('src/screens/ProgressScreen.tsx', 'utf8');
const profileSource = readFileSync('src/screens/ProfileScreen.tsx', 'utf8');

describe('Phase 28 profile screen integration', () => {
  it('registers a ProfileScreen route in the app shell without changing bottom-tab IDs', () => {
    expect(appSource).toContain("import { ProfileScreen } from './src/screens/ProfileScreen';");
    expect(appSource).toMatch(/<ProfileScreen[\s\S]*onBack=\{\(\) => nav\.setShowProfile\(false\)\}/);
    expect(appSource).toContain('nav.setShowPlacement(true)');
    expect(appSource).toContain('nav.setShowProfile(true)');
    // The showProfile state itself now lives in the navigation hook.
    expect(navHookSource).toContain("useState(getParam('screen') === 'profile')");
  });

  it('adds a real Progress affordance for opening the learner profile', () => {
    expect(progressSource).toContain('onOpenProfile');
    expect(progressSource).toContain('Edit learner profile');
    expect(progressSource).toContain('testID="progress-open-profile"');
    const profileButton = progressSource.match(/<Button\b[\s\S]*?label="Edit learner profile"[\s\S]*?\/>/);
    expect(profileButton?.[0]).toContain('onPress={onOpenProfile}');
    expect(profileButton?.[0]).not.toMatch(/=>\s*undefined/);
  });

  it('uses the user profile context and exposes the editable Phase 1 profile fields', () => {
    expect(profileSource).toContain('useUserProfileContext');
    expect(profileSource).toContain('Helper language');
    expect(profileSource).toContain('Study goal');
    expect(profileSource).toContain('Daily target');
    expect(profileSource).toContain('JLPT target');
    expect(profileSource).toContain('Workplace context');
    expect(profileSource).toContain('updateProfile(update)');
  });
});
