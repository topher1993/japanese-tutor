import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Koi Sensei navigation foundation', () => {
  it('preserves the five-tab public navigation contract', () => {
    const source = read('src/types/navigation.ts');
    expect(source).toContain("export type AppTab = 'Home' | 'Lessons' | 'Flashcards' | 'Quiz' | 'Progress'");
    expect(source).not.toMatch(/KoiSensei[^\n]*AppTab|AppTab[^\n]*KoiSensei/);
  });

  it('uses a Home-launched full-screen overlay', () => {
    const app = read('App.tsx');
    const navigation = read('src/app/useAppNavigation.ts');
    const renderer = read('src/app/renderTab.tsx');
    const home = read('src/screens/HomeScreen.tsx');

    expect(navigation).toContain("getParam('screen') === 'koi-sensei'");
    expect(navigation).toContain('showKoiSensei');
    expect(app).toContain('if (nav.showKoiSensei)');
    expect(app).toContain('<KoiSenseiScreen');
    expect(renderer).toContain('onOpenKoiSensei={props.onOpenKoiSensei}');
    expect(home).toContain('testID="home-open-koi-sensei"');
    expect(home).toContain('testID="home-koi-mascot"');
  });

  it('keeps chat text visible and treats 2D as a functional fallback', () => {
    const screen = read('src/features/koi-sensei/ui/KoiSenseiScreen.tsx');
    const avatar = read('src/features/koi-sensei/ui/KoiAvatarStage.tsx');
    const chat = read('src/features/koi-sensei/ui/KoiChatPanel.tsx');
    expect(screen).toContain('<KoiAvatarStage');
    expect(avatar).toContain('<Mascot expression={expression');
    expect(avatar).toContain("plan.renderer === '3d'");
    expect(screen).toContain('<KoiChatPanel');
    expect(chat).toContain('Question for Koi Sensei');
    expect(chat).toContain('message.text');
    expect(chat).toContain('LOCAL MOCK · ZERO PROVIDER COST');
    expect(chat).toContain('koi-consent-ai-data');
    expect(chat).toContain('koi-consent-us-processing');
    expect(chat).toContain('koi-chat-revoke-confirm');
    expect(screen).toContain('BackHandler.addEventListener');
    expect(screen).toContain('title="Koi Sensei"');
    expect(screen).toContain('Koi personal live mode');
    expect(screen).not.toContain("title={route === 'home' ? 'Back'");
  });
});
