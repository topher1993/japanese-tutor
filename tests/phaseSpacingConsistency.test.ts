import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', 'src');

function readScreen(name: string): string {
  return readFileSync(join(SRC, 'screens', name), 'utf8');
}

// Lock down the spacing rules that fix the "spacing feels off" feedback.
const ALL_SCREENS = [
  'HomeScreen.tsx',
  'LessonsScreen.tsx',
  'FlashcardsScreen.tsx',
  'QuizScreen.tsx',
  'ProgressScreen.tsx',
  'OnboardingScreen.tsx',
  'ExampleSentencesScreen.tsx',
  'KanjiSectionPanel.tsx',
  'WorkplaceSurvivalScreen.tsx',
  'BetaFeedbackScreen.tsx',
  'SourcesScreen.tsx',
  'ReviewModePanel.tsx',
  'PlacementTestPanel.tsx',
];

describe('Phase SPACING — consistent margins/padding across all screens', () => {
  describe('Foundation: primitives handle safe area and bg', () => {
    it('ScreenHeader applies safe-area top inset automatically (no caller can forget)', () => {
      const src = readFileSync(join(SRC, 'components', 'ScreenHeader.tsx'), 'utf8');
      expect(src).toContain('useSafeAreaInsets');
      expect(src).toMatch(/paddingTop:\s*insets\.top/);
    });

    it('ScreenScaffold background is transparent (App shell shows through)', () => {
      const src = readFileSync(join(SRC, 'components', 'ScreenScaffold.tsx'), 'utf8');
      expect(src).toContain("backgroundColor: 'transparent'");
    });

    it('ScreenScaffold applies gap between children (no marginTop/marginBottom needed on cards)', () => {
      // THIS IS THE KEY FIX — every screen used to have marginTop: 0 between cards,
      // making them touch. ScreenScaffold now adds `gap: ds.spacing.md` so all
      // children automatically get consistent vertical spacing.
      const src = readFileSync(join(SRC, 'components', 'ScreenScaffold.tsx'), 'utf8');
      expect(src).toMatch(/gap:\s*ds\.spacing\.md/);
    });

    it('TabBar uses the app background color (no gray seam under it)', () => {
      const src = readFileSync(join(SRC, 'components', 'TabBar.tsx'), 'utf8');
      // The shell background should be ds.colors.background, not ds.colors.surface
      expect(src).toContain('ds.colors.background');
      // And it wraps in SafeAreaView for the home indicator
      expect(src).toContain('SafeAreaView');
      expect(src).toContain("edges={['bottom']}");
    });
  });

  describe('App-level: shell background consistent with scaffold', () => {
    it('App.tsx shell background matches scaffold (no seam)', () => {
      const app = readFileSync(join(__dirname, '..', 'App.tsx'), 'utf8');
      expect(app).toContain("backgroundColor: ds.colors.background");
    });
  });

  describe('Every screen uses the ScreenScaffold primitive (no custom ScrollView)', () => {
    for (const screen of ALL_SCREENS) {
      it(`${screen} imports ScreenScaffold`, () => {
        const src = readScreen(screen);
        expect(src).toContain('ScreenScaffold');
      });
    }
  });

  describe('Every screen uses design system spacing tokens (no raw pixel margins)', () => {
    for (const screen of ALL_SCREENS) {
      it(`${screen} uses ds.spacing tokens`, () => {
        const src = readScreen(screen);
        // Has at least one ds.spacing reference
        expect(src).toMatch(/ds\.spacing\.(xs|sm|md|lg|xl)/);
      });
    }
  });

  describe('No ad-hoc hex palettes in redesigned screens', () => {
    // Already covered in phaseDesignSystem.test.ts but re-assert here for the spacing overhaul
    for (const screen of ALL_SCREENS) {
      it(`${screen} has no ad-hoc hex colors`, () => {
        const src = readScreen(screen);
        // Allow rgba() (used for translucent overlays in brand cards) and #fff shorthand for white text
        const customHexes = src.match(/['"]#[0-9a-fA-F]{6}['"]/g) ?? [];
        const filtered = customHexes.filter(c => c.toLowerCase() !== "'#fff'" && c.toLowerCase() !== '"#fff"');
        expect(filtered).toEqual([]);
      });
    }
  });

  describe('No raw numeric pixel margins (marginTop: 2, paddingVertical: 4, etc.)', () => {
    // After the spacing overhaul, every margin/padding should reference ds.spacing.* tokens
    // This locks in the rule that "raw 2px or 4px" never sneaks back in.
    for (const screen of ALL_SCREENS) {
      it(`${screen} has no raw pixel margin/padding values`, () => {
        const src = readScreen(screen);
        // Pattern: marginXXX: <number> where the number is the value (not token reference)
        // Allow: marginTop: 0, height/width numeric (e.g. card dimensions)
        // Disallow: marginTop: 2, paddingVertical: 4, marginBottom: 6, etc.
        const badMargins = src.match(/(?:margin(?:Top|Bottom|Left|Right|Vertical|Horizontal)?|padding(?:Top|Bottom|Left|Right|Vertical|Horizontal)?)\s*:\s*[1-9]\d?\b/g) ?? [];
        // Allow a few intentional ones: paddingBottom: 120 (scroll bottom buffer), explicit 0 values
        const filtered = badMargins.filter(m => !/:\s*120\b/.test(m) && !/:\s*0\b/.test(m));
        expect(filtered).toEqual([]);
      });
    }
  });

  describe('Vertical rhythm — every screen uses ds.spacing.xs/sm/md/lg scale', () => {
    for (const screen of ALL_SCREENS) {
      it(`${screen} references multiple ds.spacing tokens (vertical rhythm)`, () => {
        const src = readScreen(screen);
        const tokens = src.match(/ds\.spacing\.(xs|sm|md|lg|xl|xxl)/g) ?? [];
        // Each screen should reference at least 3 distinct spacing values
        const distinct = new Set(tokens.map(t => t.replace('ds.spacing.', '')));
        expect(distinct.size).toBeGreaterThanOrEqual(3);
      });
    }
  });

  describe('Back navigation is consistent', () => {
    // Every screen that supports back uses ScreenHeader's onBack prop (icon-based, not literal text)
    // PlacementTestPanel when shown as a result view is owned by its parent (HomeScreen's Disclosure);
    // its initial view always uses ScreenHeader (no onBack needed at the panel level).
    const screensWithBack = [
      'HomeScreen.tsx',
      'LessonsScreen.tsx',
      'QuizScreen.tsx',
      'SourcesScreen.tsx',
      'KanjiSectionPanel.tsx',
      'WorkplaceSurvivalScreen.tsx',
      'BetaFeedbackScreen.tsx',
      'ReviewModePanel.tsx',
    ];
    for (const screen of screensWithBack) {
      it(`${screen} uses ScreenHeader onBack (no literal "← Back" text)`, () => {
        const src = readScreen(screen);
        // The new design uses ScreenHeader with onBack (multi-line JSX is fine)
        const usesScreenHeaderOnBack = /<ScreenHeader[\s\S]*?onBack=\{/m.test(src) || /onBack=\{onBack\}/m.test(src);
        const hasLiteralBackText = /['"]←\s*Back['"]/.test(src);
        expect(usesScreenHeaderOnBack).toBe(true);
        expect(hasLiteralBackText).toBe(false);
      });
    }

    it('PlacementTestPanel uses ScreenHeader (no literal back text)', () => {
      // The panel is embedded in HomeScreen's "Need help?" disclosure; the parent owns back nav.
      const src = readScreen('PlacementTestPanel.tsx');
      expect(src).toContain('ScreenHeader');
      const hasLiteralBackText = /['"]←\s*Back['"]/.test(src);
      expect(hasLiteralBackText).toBe(false);
    });
  });
});
