import {
  type KoiAvatarMode,
  type KoiEffectAccessibilitySettings,
  type KoiEffectIntensity,
  type KoiEffectPreference,
  type KoiEffectProfile,
  type KoiEffectTheme,
  type KoiRank,
} from './types';

export const KOI_EFFECT_THEMES: Record<KoiRank, KoiEffectTheme> = {
  N5: {
    id: 'water-ripples',
    label: 'Calm Water',
    primaryColor: '#60A5FA',
    staticDescription: 'A calm blue rank rim.',
    animatedDescription: 'Calm blue water ripples.',
  },
  N4: {
    id: 'leaf-motes',
    label: 'Training Leaves',
    primaryColor: '#4ADE80',
    staticDescription: 'A green and silver rank rim.',
    animatedDescription: 'Green leaves and silver training motes.',
  },
  N3: {
    id: 'sakura-petals',
    label: 'Sakura Path',
    primaryColor: '#F9A8D4',
    staticDescription: 'A sakura-pink rank rim.',
    animatedDescription: 'Gently drifting sakura petals.',
  },
  N2: {
    id: 'moon-ink',
    label: 'Moonlit Ink',
    primaryColor: '#A78BFA',
    staticDescription: 'A violet moon rank rim.',
    animatedDescription: 'A violet moon ring with soft ink wisps.',
  },
  N1: {
    id: 'koi-scale-aura',
    label: 'Golden Koi',
    primaryColor: '#FBBF24',
    staticDescription: 'A golden koi-scale rank rim.',
    animatedDescription: 'A golden koi-scale aura.',
  },
};

export const DEFAULT_KOI_EFFECT_ACCESSIBILITY_SETTINGS: KoiEffectAccessibilitySettings = {
  effectPreference: 'full',
  reducedMotion: false,
  lowPowerMode: false,
  avatarMode: '3d',
};

function isEffectPreference(value: unknown): value is KoiEffectPreference {
  return value === 'full' || value === 'reduced' || value === 'off';
}

function isAvatarMode(value: unknown): value is KoiAvatarMode {
  return value === '3d' || value === '2d';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeKoiEffectAccessibilitySettings(
  value: unknown,
): KoiEffectAccessibilitySettings {
  if (!isRecord(value)) return { ...DEFAULT_KOI_EFFECT_ACCESSIBILITY_SETTINGS };
  return {
    effectPreference: isEffectPreference(value.effectPreference) ? value.effectPreference : 'full',
    reducedMotion: value.reducedMotion === true,
    lowPowerMode: value.lowPowerMode === true,
    avatarMode: isAvatarMode(value.avatarMode) ? value.avatarMode : '3d',
  };
}

function clampRankStars(stars: number): number {
  if (!Number.isFinite(stars)) return 0;
  return Math.min(8, Math.max(0, Math.floor(stars)));
}

export function getKoiEffectIntensity(starsValue: number): KoiEffectIntensity {
  const stars = clampRankStars(starsValue);
  if (stars === 0) return 'static';
  if (stars <= 2) return 'subtle';
  if (stars <= 4) return 'growing';
  if (stars <= 6) return 'full';
  if (stars === 7) return 'enhanced';
  return 'celebration';
}

function animatedParticleBudget(intensity: KoiEffectIntensity): number {
  if (intensity === 'subtle') return 2;
  if (intensity === 'growing') return 4;
  if (intensity === 'full' || intensity === 'enhanced' || intensity === 'celebration') return 6;
  return 0;
}

export function getKoiEffectProfile(
  rank: KoiRank,
  starsValue: number,
  settingsValue: unknown = DEFAULT_KOI_EFFECT_ACCESSIBILITY_SETTINGS,
): KoiEffectProfile {
  const stars = clampRankStars(starsValue);
  const settings = normalizeKoiEffectAccessibilitySettings(settingsValue);
  const intensity = getKoiEffectIntensity(stars);
  const forceStatic = settings.effectPreference === 'reduced'
    || settings.reducedMotion
    || settings.lowPowerMode
    || settings.avatarMode === '2d'
    || stars === 0;

  if (settings.effectPreference === 'off') {
    return {
      rank,
      stars,
      theme: KOI_EFFECT_THEMES[rank],
      intensity,
      renderMode: 'off',
      particleBudget: 0,
      maxDrawCalls: 0,
      maxTriangles: 0,
      celebrateRankCompletion: false,
      decorative: true,
    };
  }

  if (forceStatic) {
    return {
      rank,
      stars,
      theme: KOI_EFFECT_THEMES[rank],
      intensity,
      renderMode: 'static',
      particleBudget: 0,
      maxDrawCalls: 1,
      maxTriangles: 128,
      celebrateRankCompletion: false,
      decorative: true,
    };
  }

  return {
    rank,
    stars,
    theme: KOI_EFFECT_THEMES[rank],
    intensity,
    renderMode: 'animated',
    particleBudget: animatedParticleBudget(intensity),
    maxDrawCalls: 2,
    maxTriangles: 1_000,
    celebrateRankCompletion: stars === 8,
    decorative: true,
  };
}
