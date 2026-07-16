import type { KoiEffectProfile, KoiEffectThemeId } from '../domain';

export interface KoiEffectDecorationPosition {
  top?: `${number}%`;
  right?: `${number}%`;
  bottom?: `${number}%`;
  left?: `${number}%`;
}

export interface KoiEffectDecoration {
  id: string;
  shape: 'ring' | 'mote' | 'petal' | 'moon' | 'scale';
  color: string;
  position: KoiEffectDecorationPosition;
  rotation: number;
  size: number;
}

const POSITIONS: readonly KoiEffectDecorationPosition[] = [
  { top: '8%', left: '12%' },
  { top: '19%', right: '9%' },
  { top: '42%', left: '4%' },
  { top: '54%', right: '4%' },
  { bottom: '12%', left: '18%' },
  { bottom: '7%', right: '16%' },
];

const THEME_SHAPE: Record<KoiEffectThemeId, KoiEffectDecoration['shape']> = {
  'water-ripples': 'ring',
  'leaf-motes': 'mote',
  'sakura-petals': 'petal',
  'moon-ink': 'moon',
  'koi-scale-aura': 'scale',
};

/** Pure render budget used by tests and the native layer. */
export function getKoiEffectDecorations(profile: KoiEffectProfile): KoiEffectDecoration[] {
  if (profile.renderMode === 'off') return [];
  const count = Math.min(POSITIONS.length, Math.max(1, profile.particleBudget));
  const shape = THEME_SHAPE[profile.theme.id];
  return POSITIONS.slice(0, count).map((position, index) => ({
    id: `${profile.theme.id}-${index}`,
    shape,
    color: profile.theme.primaryColor,
    position,
    rotation: (index * 37) % 180,
    size: shape === 'moon' && index === 0 ? 28 : 10 + (index % 3) * 3,
  }));
}

