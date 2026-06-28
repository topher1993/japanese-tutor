// Centralized design system tokens. Replace ad-hoc colors across screens.
// Inspired by Duolingo/Babbel/Memrise visual language:
//   - One strong brand color, one warm accent, one cool accent, plus neutrals.
//   - Pill-shaped CTAs, large rounded cards, generous tap targets.
//   - Strict type scale (4 sizes) and spacing scale (5 steps).
//   - Soft shadows instead of borders to feel "lifted".

export const ds = {
  colors: {
    // Brand
    primary: '#2A6F97',       // alias of brand (used by screens that say "primary")
    primarySoft: '#E0F2FE',    // alias of brandSoft
    primaryInk: '#FFFFFF',     // alias of brandInk
    brand: '#2A6F97',         // deep ocean blue (calm, trustworthy)
    brandDark: '#014F86',
    brandSoft: '#E0F2FE',     // light tint for surfaces
    brandInk: '#FFFFFF',      // text on brand

    // Accents
    warm: '#F4A261',          // amber for streak/highlights
    warmSoft: '#FFF4E6',
    warmInk: '#92400E',       // text on warmSoft (brown-700)
    warmInkStrong: '#7C2D12', // text on warmSoft for stronger emphasis (brown-800)
    warning: '#F4A261',       // draft/pending translation badge (alias of warm)
    warningInk: '#7C2D12',    // text on warning background (alias of warmInkStrong)
    success: '#2A9D8F',       // teal-green for "correct"/progress
    successSoft: '#DCFCE7',
    danger: '#D95F43',        // emergency / "again"
    dangerSoft: '#FEE2E2',
    info: '#7E57C2',          // kanji / "easy"
    infoSoft: '#EDE9FE',

    // Neutrals
    background: '#F4F7FA',
    surface: '#FFFFFF',
    surfaceAlt: '#F8FAFC',
    surfaceMuted: '#F8FAFC',  // alias of surfaceAlt (back-face tint)
    text: '#0F172A',
    textMuted: '#64748B',
    border: '#E2E8F0',
    divider: '#EEF2F6',
  },

  // 5-step spacing scale (xs=4, sm=8, md=16, lg=24, xl=32)
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const,

  // Strict type scale (no in-between sizes)
  type: {
    hero: 52,       // flashcard front Japanese (huge)
    kanji: 40,      // secondary kanji / large numbers
    display: 32,    // big streak number, hero
    title: 22,      // screen titles
    heading: 18,    // card titles
    body: 15,       // default reading
    caption: 13,    // meta / labels
    micro: 11,      // badges only
  },

  // One border-radius scale
  radius: {
    sm: 10,
    md: 16,
    lg: 22,
    xl: 28,
    pill: 9999,
  },

  // Tap target minimum (HIG/Material)
  touch: {
    min: 48,        // Apple HIG minimum
    comfortable: 56,
  },

  shadow: {
    card: {
      shadowColor: '#0F172A',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    hero: {
      shadowColor: '#0F172A',
      shadowOpacity: 0.10,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
  },
} as const;

export type DesignSystem = typeof ds;
