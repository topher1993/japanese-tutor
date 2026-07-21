export const KOI_AVATAR_CONTRACT_ID = 'koi-sensei-avatar/v1' as const;
export const KOI_AVATAR_ACCESSIBILITY_LABEL = 'Koi Sensei, your virtual Japanese tutor';

export const KOI_AVATAR_REQUIRED_SOCKETS = [
  'crest',
  'face',
  'back',
  'hand',
] as const;

export const KOI_AVATAR_REQUIRED_ANIMATIONS = [
  'idle',
  'blink',
  'thinking',
  'speaking',
  'celebration',
  'encouragement',
] as const;

export type KoiAvatarSocket = typeof KOI_AVATAR_REQUIRED_SOCKETS[number];
export type KoiAvatarAnimation = typeof KOI_AVATAR_REQUIRED_ANIMATIONS[number];

export interface KoiAvatarManifestV1 {
  schemaVersion: 1;
  contractId: typeof KOI_AVATAR_CONTRACT_ID;
  assetId: string;
  label: string;
  source: 'engineering-placeholder' | 'commissioned' | 'procedural-art';
  delivery: 'metadata-only' | 'bundled-glb' | 'runtime-mesh';
  format: 'glb' | 'procedural';
  assetUri: string | null;
  rootNode: string;
  bodyNode: string;
  sockets: Record<KoiAvatarSocket, string>;
  animations: Record<KoiAvatarAnimation, string>;
  fallback2dId: string;
  budgets: {
    triangleCount: number;
    drawCalls: number;
    textureDimension: number;
    fileBytes: number;
  };
  accessibilityLabel: string;
}

export const KOI_AVATAR_ASSET_BUDGETS = Object.freeze({
  triangleCount: 12_000,
  drawCalls: 64,
  textureDimension: 2_048,
  fileBytes: 4 * 1_024 * 1_024,
});

/**
 * Koi's production identity is assembled from local Three.js primitives. This
 * keeps the mascot deterministic and offline while still providing genuine
 * depth, lighting, expression animation, and socketed 3D equipment.
 */
export const KOI_AVATAR_TANUKI_MANIFEST: Readonly<KoiAvatarManifestV1> = Object.freeze({
  schemaVersion: 1,
  contractId: KOI_AVATAR_CONTRACT_ID,
  assetId: 'koi-tanuki-procedural-v1',
  label: 'Koi, the magical tanuki study companion',
  source: 'procedural-art',
  delivery: 'runtime-mesh',
  format: 'procedural',
  assetUri: null,
  rootNode: 'KoiRoot',
  bodyNode: 'KoiBody',
  sockets: Object.freeze({
    crest: 'Socket_Crest',
    face: 'Socket_Face',
    back: 'Socket_Back',
    hand: 'Socket_Hand',
  }),
  animations: Object.freeze({
    idle: 'Idle',
    blink: 'Blink',
    thinking: 'Thinking',
    speaking: 'Speaking',
    celebration: 'Celebration',
    encouragement: 'Encouragement',
  }),
  fallback2dId: 'koi-tanuki-2d-fallback',
  budgets: Object.freeze({
    triangleCount: 11_800,
    drawCalls: 58,
    textureDimension: 0,
    fileBytes: 0,
  }),
  accessibilityLabel: `${KOI_AVATAR_ACCESSIBILITY_LABEL}. A magical tanuki companion`,
});

/**
 * A tiny, non-production engineering GLB that exercises the same nodes,
 * sockets, and clips required from the final commissioned asset. Rendering may
 * still select 2D until the platform loader reports this asset ready.
 */
export const KOI_AVATAR_PLACEHOLDER_MANIFEST: Readonly<KoiAvatarManifestV1> = Object.freeze({
  schemaVersion: 1,
  contractId: KOI_AVATAR_CONTRACT_ID,
  assetId: 'koi-sensei-engineering-placeholder',
  label: 'Koi Sensei engineering placeholder',
  source: 'engineering-placeholder',
  delivery: 'bundled-glb',
  format: 'glb',
  assetUri: 'assets/koi-sensei/koi-sensei-placeholder.glb',
  rootNode: 'KoiRoot',
  bodyNode: 'KoiBody',
  sockets: Object.freeze({
    crest: 'Socket_Crest',
    face: 'Socket_Face',
    back: 'Socket_Back',
    hand: 'Socket_Hand',
  }),
  animations: Object.freeze({
    idle: 'Idle',
    blink: 'Blink',
    thinking: 'Thinking',
    speaking: 'Speaking',
    celebration: 'Celebration',
    encouragement: 'Encouragement',
  }),
  fallback2dId: 'koi-sensei-2d-base',
  budgets: Object.freeze({
    triangleCount: 6,
    drawCalls: 1,
    textureDimension: 0,
    fileBytes: 2_480,
  }),
  accessibilityLabel: KOI_AVATAR_ACCESSIBILITY_LABEL,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isBudgetValue(value: unknown, maximum: number): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= maximum;
}

export interface KoiAvatarManifestValidation {
  valid: boolean;
  renderable3d: boolean;
  issues: string[];
}

export function validateKoiAvatarManifest(value: unknown): KoiAvatarManifestValidation {
  const issues: string[] = [];
  if (!isRecord(value)) return { valid: false, renderable3d: false, issues: ['manifest:not-object'] };

  if (value.schemaVersion !== 1) issues.push('schemaVersion:unsupported');
  if (value.contractId !== KOI_AVATAR_CONTRACT_ID) issues.push('contractId:unsupported');
  if (!isNonEmptyText(value.assetId)) issues.push('assetId:required');
  if (!isNonEmptyText(value.label)) issues.push('label:required');
  if (value.format !== 'glb' && value.format !== 'procedural') issues.push('format:unsupported');
  if (!isNonEmptyText(value.rootNode)) issues.push('rootNode:required');
  if (!isNonEmptyText(value.bodyNode)) issues.push('bodyNode:required');
  if (!isNonEmptyText(value.fallback2dId)) issues.push('fallback2dId:required');
  if (!isNonEmptyText(value.accessibilityLabel)) issues.push('accessibilityLabel:required');

  if (!isRecord(value.sockets)) {
    issues.push('sockets:required');
  } else {
    for (const socket of KOI_AVATAR_REQUIRED_SOCKETS) {
      if (!isNonEmptyText(value.sockets[socket])) issues.push(`sockets.${socket}:required`);
    }
  }

  if (!isRecord(value.animations)) {
    issues.push('animations:required');
  } else {
    for (const animation of KOI_AVATAR_REQUIRED_ANIMATIONS) {
      if (!isNonEmptyText(value.animations[animation])) {
        issues.push(`animations.${animation}:required`);
      }
    }
  }

  if (!isRecord(value.budgets)) {
    issues.push('budgets:required');
  } else {
    for (const [key, maximum] of Object.entries(KOI_AVATAR_ASSET_BUDGETS)) {
      if (!isBudgetValue(value.budgets[key], maximum)) issues.push(`budgets.${key}:invalid`);
    }
  }

  const metadataOnly = value.source === 'engineering-placeholder'
    && value.delivery === 'metadata-only'
    && value.assetUri === null;
  const bundled = (value.source === 'commissioned' || value.source === 'engineering-placeholder')
    && value.delivery === 'bundled-glb'
    && value.format === 'glb'
    && isNonEmptyText(value.assetUri)
    && !/^(?:https?:|data:|file:)/iu.test(value.assetUri)
    && value.assetUri.toLowerCase().endsWith('.glb');
  const procedural = value.source === 'procedural-art'
    && value.delivery === 'runtime-mesh'
    && value.format === 'procedural'
    && value.assetUri === null;
  if (!metadataOnly && !bundled && !procedural) issues.push('delivery:invalid-source-or-uri');

  return {
    valid: issues.length === 0,
    renderable3d: issues.length === 0 && (bundled || procedural),
    issues,
  };
}

export type KoiAvatarAssetStatus = 'missing' | 'loading' | 'ready' | 'failed';

export interface KoiAvatarRenderInput {
  preferredMode: '3d' | '2d';
  reducedMotion: boolean;
  lowPowerMode: boolean;
  webGlAvailable: boolean;
  assetStatus: KoiAvatarAssetStatus;
  manifest: unknown;
  fallback2dAvailable: boolean;
}

export type KoiAvatarFallbackReason =
  | 'three-dimensional-ready'
  | 'two-dimensional-preference'
  | 'reduced-motion'
  | 'low-power-mode'
  | 'webgl-unavailable'
  | 'manifest-invalid'
  | 'asset-not-ready'
  | 'accessible-semantic-fallback';

export interface KoiAvatarRenderPlan {
  renderer: '3d' | '2d-static' | 'accessible-placeholder';
  motion: 'full' | 'none';
  reason: KoiAvatarFallbackReason;
  accessibilityLabel: string;
  fallback2dId?: string;
}

function fallbackReason(
  input: KoiAvatarRenderInput,
  validation: KoiAvatarManifestValidation,
): Exclude<KoiAvatarFallbackReason, 'three-dimensional-ready' | 'accessible-semantic-fallback'> {
  if (input.preferredMode === '2d') return 'two-dimensional-preference';
  if (input.reducedMotion) return 'reduced-motion';
  if (input.lowPowerMode) return 'low-power-mode';
  if (!input.webGlAvailable) return 'webgl-unavailable';
  if (!validation.valid) return 'manifest-invalid';
  return 'asset-not-ready';
}

/** Never leaves an empty avatar area while 3D is unsupported or loading. */
export function selectKoiAvatarRenderPlan(input: KoiAvatarRenderInput): KoiAvatarRenderPlan {
  const validation = validateKoiAvatarManifest(input.manifest);
  const manifest = isRecord(input.manifest) ? input.manifest : {};
  const accessibilityLabel = isNonEmptyText(manifest.accessibilityLabel)
    ? manifest.accessibilityLabel
    : KOI_AVATAR_ACCESSIBILITY_LABEL;
  const readyFor3d = input.preferredMode === '3d'
    && !input.reducedMotion
    && !input.lowPowerMode
    && input.webGlAvailable
    && input.assetStatus === 'ready'
    && validation.renderable3d;

  if (readyFor3d) {
    return {
      renderer: '3d',
      motion: 'full',
      reason: 'three-dimensional-ready',
      accessibilityLabel,
    };
  }

  if (input.fallback2dAvailable) {
    return {
      renderer: '2d-static',
      motion: 'none',
      reason: fallbackReason(input, validation),
      accessibilityLabel,
      fallback2dId: isNonEmptyText(manifest.fallback2dId)
        ? manifest.fallback2dId
        : 'koi-sensei-2d-base',
    };
  }

  return {
    renderer: 'accessible-placeholder',
    motion: 'none',
    reason: 'accessible-semantic-fallback',
    accessibilityLabel,
  };
}
