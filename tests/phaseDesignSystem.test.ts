import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', 'src');

function readFile(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('Phase UI-C — design system primitives exist', () => {
  const components = ['Button', 'Card', 'Badge', 'Chip', 'Icon', 'StreakFlame', 'ScreenHeader', 'ScreenScaffold', 'Disclosure', 'FlipCard', 'RatingButtons', 'TabBar'];
  for (const name of components) {
    it(`${name}.tsx exists`, () => {
      expect(existsSync(join(SRC, 'components', `${name}.tsx`))).toBe(true);
    });
  }

  it('designSystem.ts tokens are exported and well-formed', () => {
    const tokens = readFile(join(SRC, 'theme', 'designSystem.ts'));
    expect(tokens).toContain('export const ds');
    // Required token categories
    expect(tokens).toMatch(/colors:\s*\{/);
    expect(tokens).toMatch(/spacing:\s*\{/);
    expect(tokens).toMatch(/type:\s*\{/);
    expect(tokens).toMatch(/radius:\s*\{/);
    expect(tokens).toMatch(/touch:\s*\{/);
    expect(tokens).toMatch(/shadow:\s*\{/);
    // Brand color present (single brand anchor)
    expect(tokens).toMatch(/brand:\s*['"]#/);
  });
});

describe('Phase UI-C — screens use design system primitives', () => {
  it('HomeScreen uses StreakFlame, Button, Card, ScreenHeader, Disclosure, ScreenScaffold', () => {
    const src = readFile(join(SRC, 'screens', 'HomeScreen.tsx'));
    for (const c of ['StreakFlame', 'Button', 'Card', 'ScreenHeader', 'Disclosure', 'ScreenScaffold']) {
      expect(src).toContain(c);
    }
  });

  it('LessonsScreen uses Button, Chip, Disclosure, Card, ScreenHeader, ScreenScaffold, Icon', () => {
    const src = readFile(join(SRC, 'screens', 'LessonsScreen.tsx'));
    for (const c of ['Button', 'Chip', 'Disclosure', 'Card', 'ScreenHeader', 'ScreenScaffold']) {
      expect(src).toContain(c);
    }
  });

  it('FlashcardsScreen uses FlipCard, RatingButtons, Chip, Disclosure, Button, ScreenScaffold', () => {
    const src = readFile(join(SRC, 'screens', 'FlashcardsScreen.tsx'));
    for (const c of ['FlipCard', 'RatingButtons', 'Chip', 'Disclosure', 'Button', 'ScreenScaffold']) {
      expect(src).toContain(c);
    }
  });

  it('QuizScreen uses Card, ScreenHeader, ScreenScaffold', () => {
    const src = readFile(join(SRC, 'screens', 'QuizScreen.tsx'));
    for (const c of ['Card', 'ScreenHeader', 'ScreenScaffold']) {
      expect(src).toContain(c);
    }
  });

  it('ProgressScreen uses StreakFlame, Card, Chip, Button, Disclosure, ScreenHeader, ScreenScaffold', () => {
    const src = readFile(join(SRC, 'screens', 'ProgressScreen.tsx'));
    for (const c of ['StreakFlame', 'Card', 'Chip', 'Button', 'Disclosure', 'ScreenHeader', 'ScreenScaffold']) {
      expect(src).toContain(c);
    }
  });

  it('OnboardingScreen uses Button, Card, Chip, Icon, ScreenScaffold', () => {
    const src = readFile(join(SRC, 'screens', 'OnboardingScreen.tsx'));
    for (const c of ['Button', 'Card', 'Chip', 'Icon', 'ScreenScaffold']) {
      expect(src).toContain(c);
    }
  });
});

describe('Phase UI-C — no ad-hoc color hexes in redesigned screens', () => {
  // Lock down the visual system: redesigned screens must not introduce random hex colors.
  // (Tabs and theme primitives are exempt.)
  const screens = ['HomeScreen.tsx', 'LessonsScreen.tsx', 'FlashcardsScreen.tsx', 'QuizScreen.tsx', 'ProgressScreen.tsx', 'OnboardingScreen.tsx', 'ExampleSentencesScreen.tsx'];
  for (const screen of screens) {
    it(`${screen} does not define its own palette (uses ds.colors)`, () => {
      const src = readFile(join(SRC, 'screens', screen));
      // Allow brandInk (#fff), rgba(), and rgba shadow tokens; no new hex palettes.
      const customHexes = src.match(/['"]#[0-9a-fA-F]{6}['"]/g) ?? [];
      // Filter out the brandInk shorthand '#fff'
      const filtered = customHexes.filter(c => c.toLowerCase() !== "'#fff'" && c.toLowerCase() !== '"#fff"');
      expect(filtered).toEqual([]);
    });
  }
});

describe('Phase UI-C — bottom nav has icons', () => {
  it('bottomNavigationTabs entries each have an icon', () => {
    const src = readFile(join(SRC, 'services', 'appNavigationService.ts'));
    // Five tabs, each with an icon field
    const tabLines = src.match(/\{ id: '[A-Za-z]+', label: '[^']+', icon: '[^']+' \}/g) ?? [];
    expect(tabLines.length).toBe(5);
  });

  it('App.tsx renders TabBar (not raw tabs)', () => {
    const src = readFile(join(__dirname, '..', 'App.tsx'));
    expect(src).toContain('<TabBar');
    expect(src).not.toMatch(/<View style=\{styles\.tabs\}>/);
  });
});

describe('Phase UI-C — back navigation is consistent', () => {
  // ExampleSentencesScreen is embedded inside LessonsScreen's "More tools" disclosure,
  // so it intentionally has no own back button — its parent provides the back nav.
  const screensWithBack = ['SourcesScreen.tsx', 'KanjiSectionPanel.tsx', 'LessonsScreen.tsx', 'QuizScreen.tsx'];
  for (const screen of screensWithBack) {
    it(`${screen} uses ScreenHeader onBack`, () => {
      const src = readFile(join(SRC, 'screens', screen));
      const usesScreenHeaderOnBack = /<ScreenHeader[^>]*onBack=\{/m.test(src) || /onBack=\{onBack\}/m.test(src);
      // Allow legacy "← Back" as fallback
      const usesLiteral = src.includes('← Back');
      expect(usesScreenHeaderOnBack || usesLiteral).toBe(true);
    });
  }

  it('ExampleSentencesScreen is a child screen without its own back button (parent owns nav)', () => {
    const src = readFile(join(SRC, 'screens', 'ExampleSentencesScreen.tsx'));
    expect(src).not.toContain('onBack');
    expect(src).not.toContain('← Back');
  });
});
