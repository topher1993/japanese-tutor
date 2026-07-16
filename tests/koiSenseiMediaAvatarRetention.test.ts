import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  KOI_AVATAR_PLACEHOLDER_MANIFEST,
  KOI_CHAT_RETENTION_MS,
  KOI_MAX_APPROVED_MEMORIES,
  KOI_MAX_RETAINED_MESSAGES,
  applyKoiChatRetention,
  retainKoiApprovedMemories,
  selectKoiAvatarRenderPlan,
  selectKoiProgressDisclosure,
  validateKoiAvatarManifest,
  type KoiAvatarManifestV1,
  type KoiMemoryCandidate,
} from '../src/features/koi-sensei/media';

const NOW = 10_000_000_000;

function commissionedManifest(): KoiAvatarManifestV1 {
  return {
    ...KOI_AVATAR_PLACEHOLDER_MANIFEST,
    source: 'commissioned',
    delivery: 'bundled-glb',
    assetId: 'koi-sensei-v1',
    assetUri: 'assets/koi-sensei/koi-sensei-v1.glb',
    sockets: { ...KOI_AVATAR_PLACEHOLDER_MANIFEST.sockets },
    animations: { ...KOI_AVATAR_PLACEHOLDER_MANIFEST.animations },
    budgets: {
      triangleCount: 9_500,
      drawCalls: 6,
      textureDimension: 2_048,
      fileBytes: 3_000_000,
    },
  };
}

describe('Koi Sensei avatar delivery contract', () => {
  it('ships a valid bundled engineering placeholder using the final GLB contract', () => {
    expect(validateKoiAvatarManifest(KOI_AVATAR_PLACEHOLDER_MANIFEST)).toEqual({
      valid: true,
      renderable3d: true,
      issues: [],
    });
    expect(KOI_AVATAR_PLACEHOLDER_MANIFEST).toMatchObject({
      source: 'engineering-placeholder',
      delivery: 'bundled-glb',
      format: 'glb',
      assetUri: 'assets/koi-sensei/koi-sensei-placeholder.glb',
      fallback2dId: 'koi-sensei-2d-base',
    });
  });

  it('parses the checked-in GLB and verifies all contract nodes and animation clips', () => {
    const glb = readFileSync(resolve('assets/koi-sensei/koi-sensei-placeholder.glb'));
    expect(glb.length).toBe(KOI_AVATAR_PLACEHOLDER_MANIFEST.budgets.fileBytes);
    expect(glb.readUInt32LE(0)).toBe(0x46546c67);
    expect(glb.readUInt32LE(4)).toBe(2);
    expect(glb.readUInt32LE(8)).toBe(glb.length);
    const jsonLength = glb.readUInt32LE(12);
    expect(glb.readUInt32LE(16)).toBe(0x4e4f534a);
    const document = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8')) as {
      asset: { extras: { contractId: string; nonProduction: boolean } };
      nodes: Array<{ name: string }>;
      animations: Array<{ name: string }>;
      meshes: unknown[];
    };
    expect(document.asset.extras).toEqual({
      contractId: 'koi-sensei-avatar/v1',
      nonProduction: true,
    });
    expect(document.nodes.map(node => node.name)).toEqual(expect.arrayContaining([
      'KoiRoot', 'KoiBody', 'Socket_Crest', 'Socket_Face', 'Socket_Back', 'Socket_Hand',
    ]));
    expect(document.animations.map(animation => animation.name)).toEqual([
      'Idle', 'Blink', 'Thinking', 'Speaking', 'Celebration', 'Encouragement',
    ]);
    expect(document.meshes).toHaveLength(1);
  });

  it('accepts a local commissioned GLB that satisfies sockets, animations, and budgets', () => {
    const manifest = commissionedManifest();
    expect(validateKoiAvatarManifest(manifest)).toEqual({
      valid: true,
      renderable3d: true,
      issues: [],
    });
    expect(selectKoiAvatarRenderPlan({
      preferredMode: '3d',
      reducedMotion: false,
      lowPowerMode: false,
      webGlAvailable: true,
      assetStatus: 'ready',
      manifest,
      fallback2dAvailable: true,
    })).toMatchObject({
      renderer: '3d',
      motion: 'full',
      reason: 'three-dimensional-ready',
    });
  });

  it('rejects remote, over-budget, or incomplete commissioned manifests', () => {
    const manifest = commissionedManifest();
    const invalid = {
      ...manifest,
      assetUri: 'https://example.com/koi.glb',
      animations: { ...manifest.animations, speaking: '' },
      budgets: { ...manifest.budgets, triangleCount: 12_001 },
    };
    const result = validateKoiAvatarManifest(invalid);
    expect(result.valid).toBe(false);
    expect(result.renderable3d).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      'animations.speaking:required',
      'budgets.triangleCount:invalid',
      'delivery:invalid-source-or-uri',
    ]));
  });

  it.each([
    ['2D preference', { preferredMode: '2d' as const }, 'two-dimensional-preference'],
    ['reduced motion', { reducedMotion: true }, 'reduced-motion'],
    ['low power', { lowPowerMode: true }, 'low-power-mode'],
    ['missing WebGL', { webGlAvailable: false }, 'webgl-unavailable'],
    ['loading asset', { assetStatus: 'loading' as const }, 'asset-not-ready'],
  ])('uses a static 2D fallback for %s', (_label, patch, reason) => {
    const plan = selectKoiAvatarRenderPlan({
      preferredMode: '3d',
      reducedMotion: false,
      lowPowerMode: false,
      webGlAvailable: true,
      assetStatus: 'ready',
      manifest: commissionedManifest(),
      fallback2dAvailable: true,
      ...patch,
    });
    expect(plan).toMatchObject({
      renderer: '2d-static',
      motion: 'none',
      reason,
      fallback2dId: 'koi-sensei-2d-base',
    });
    expect(plan.accessibilityLabel).toContain('Koi Sensei');
  });

  it('uses 2D for the metadata-only placeholder and a semantic fallback if 2D is absent', () => {
    const base = {
      preferredMode: '3d' as const,
      reducedMotion: false,
      lowPowerMode: false,
      webGlAvailable: true,
      assetStatus: 'missing' as const,
      manifest: KOI_AVATAR_PLACEHOLDER_MANIFEST,
    };
    expect(selectKoiAvatarRenderPlan({ ...base, fallback2dAvailable: true }))
      .toMatchObject({ renderer: '2d-static', motion: 'none', reason: 'asset-not-ready' });
    expect(selectKoiAvatarRenderPlan({ ...base, fallback2dAvailable: false }))
      .toMatchObject({
        renderer: 'accessible-placeholder',
        motion: 'none',
        reason: 'accessible-semantic-fallback',
      });
  });
});

describe('Koi Sensei retention and consent helpers', () => {
  it('enforces the rolling 30-day and newest-200 chat limits and drops raw audio', () => {
    const recent = Array.from({ length: KOI_MAX_RETAINED_MESSAGES + 2 }, (_, index) => ({
      id: `message-${index.toString().padStart(3, '0')}`,
      createdAt: NOW - 10_000 + index,
      text: `Message ${index}`,
    }));
    const retained = applyKoiChatRetention([
      { id: 'expired', createdAt: NOW - KOI_CHAT_RETENTION_MS - 1, text: 'old' },
      { id: 'future', createdAt: NOW + 1, text: 'future' },
      { id: 'unsafe-audio', createdAt: NOW, text: 'unsafe', rawAudio: new Uint8Array([1]) },
      ...recent,
    ], NOW);
    expect(retained).toHaveLength(KOI_MAX_RETAINED_MESSAGES);
    expect(retained[0]?.id).toBe('message-002');
    expect(retained.at(-1)?.id).toBe('message-201');
    expect(retained.map(message => message.id)).not.toEqual(expect.arrayContaining([
      'expired', 'future', 'unsafe-audio',
    ]));
  });

  it('retains at most twenty explicitly approved, non-revoked memories', () => {
    const candidates: KoiMemoryCandidate[] = Array.from(
      { length: KOI_MAX_APPROVED_MEMORIES + 2 },
      (_, index) => ({
        id: `memory-${index.toString().padStart(2, '0')}`,
        kind: 'learning-goal',
        text: `  Goal ${index}  `,
        createdAt: 1_000 + index,
        approvedAt: 2_000 + index,
        approvedByUser: true,
      }),
    );
    candidates.push({
      id: 'not-approved',
      kind: 'custom',
      text: 'Do not retain',
      createdAt: 3_000,
      approvedByUser: false,
    });
    candidates.push({
      id: 'revoked',
      kind: 'custom',
      text: 'Forget this',
      createdAt: 3_001,
      approvedAt: 3_002,
      approvedByUser: true,
      revokedAt: 3_003,
    });

    const retained = retainKoiApprovedMemories(candidates);
    expect(retained).toHaveLength(KOI_MAX_APPROVED_MEMORIES);
    expect(retained[0]?.id).toBe('memory-02');
    expect(retained.at(-1)?.id).toBe('memory-21');
    expect(retained[0]).toEqual({
      schemaVersion: 1,
      id: 'memory-02',
      kind: 'learning-goal',
      text: 'Goal 2',
      createdAt: 1_002,
      approvedAt: 2_002,
      approval: 'explicit-user',
    });
  });

  it('omits detailed learner progress unless the user opts in', () => {
    const summary = { rank: 'N5', stars: 3 };
    const details = { weakVocabularyIds: ['vocab-1'], recentMistakes: ['mistake-1'] };
    expect(selectKoiProgressDisclosure(summary, details, false)).toEqual({
      summary,
      detailConsentApplied: false,
    });
    expect(selectKoiProgressDisclosure(summary, details, true)).toEqual({
      summary,
      detailedProgress: details,
      detailConsentApplied: true,
    });
  });
});
