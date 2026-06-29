import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const appSource = readFileSync('App.tsx', 'utf8');
const progressSource = readFileSync('src/screens/ProgressScreen.tsx', 'utf8');
const profileSource = readFileSync('src/screens/ProfileScreen.tsx', 'utf8');

describe('Phase 28 profile screen integration', () => {
  it('registers a ProfileScreen route in the app shell without changing bottom-tab IDs', () => {
    expect(appSource).toContain("import { ProfileScreen } from './src/screens/ProfileScreen';");
    expect(appSource).toContain("const [showProfile, setShowProfile] = useState(getParam('screen') === 'profile');");
    expect(appSource).toContain('<ProfileScreen onBack={() => setShowProfile(false)} />');
    expect(appSource).toContain("setShowProfile(true)");
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
