/**
 * Phase 22 audit fix P1-08 + P1-09 — query-param gate and dependency audit.
 *
 * P1-08: query-param shell escape hatches (`?tab=`, `?screen=`,
 *        `?skipOnboarding=`, `?onboarding=`) must be gated behind `__DEV__`
 *        so production builds never honor them.
 *
 * P1-09: dependency audit script must exist, parse `npm audit --json`, and
 *        emit a markdown report. Critical/high vulnerabilities fail the
 *        release gate.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const APP = join(ROOT, 'App.tsx');
const PKG = join(ROOT, 'package.json');
const SCRIPT = join(ROOT, 'scripts', 'audit-report.mjs');

function readPath(p: string): string {
  return readFileSync(p, 'utf8');
}

describe('Phase 22 audit — query-param shell escape hatch (P1-08 fix)', () => {
  it('App.tsx wraps createAppSearchParams() in __DEV__ guard', () => {
    const src = readPath(APP);
    expect(src).toMatch(/__DEV__\s*\?\s*createAppSearchParams/);
  });

  it('App.tsx never calls params.get(...) directly at top level (only via getParam helper)', () => {
    const src = readPath(APP);
    // The single `params.get` call must be inside the helper definition.
    const getParamDef = /const getParam = [\s\S]*?params\.get\(/;
    const helperCount = (src.match(getParamDef) || []).length;
    expect(helperCount).toBe(1);
    // Outside the helper definition, there should be no direct calls.
    const srcMinusHelper = src.replace(getParamDef, '');
    const directCalls = srcMinusHelper.match(/params\.get\(/g) || [];
    expect(directCalls.length).toBe(0);
    expect(src).toContain('const getParam = ');
  });

  it('all four hatch params are accessed via getParam, not raw', () => {
    const src = readPath(APP);
    expect(src).toContain("getParam('tab')");
    expect(src).toContain("getParam('onboarding')");
    expect(src).toContain("getParam('skipOnboarding')");
    // 'screen' appears four times (feedback, sources, settings, review).
    const screenMatches = src.match(/getParam\('screen'\)/g) || [];
    expect(screenMatches.length).toBe(4);
  });
});

describe('Phase 22 audit — dependency audit script (P1-09 fix)', () => {
  it('package.json declares audit:deps and audit:report scripts', () => {
    const pkg = JSON.parse(readPath(PKG));
    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts['audit:deps']).toMatch(/npm audit.*--omit=dev/);
    expect(pkg.scripts['audit:report']).toMatch(/audit-report\.mjs/);
  });

  it('scripts/audit-report.mjs exists and parses npm audit JSON', () => {
    expect(existsSync(SCRIPT)).toBe(true);
    const src = readPath(SCRIPT);
    expect(src).toMatch(/npm audit --omit=dev --json/);
    expect(src).toMatch(/JSON\.parse/);
    expect(src).toMatch(/docs\/phase-22-dependency-audit\.md/);
  });

  it('script emits markdown with severity breakdown', () => {
    const src = readPath(SCRIPT);
    expect(src).toMatch(/Critical/);
    expect(src).toMatch(/High/);
    expect(src).toMatch(/Moderate/);
    expect(src).toMatch(/Low/);
    expect(src).toMatch(/stats\.critical\s*>\s*0\s*\|\|\s*stats\.high\s*>\s*0/);
  });

  it('caret ranges on critical packages have been replaced', () => {
    const pkg = JSON.parse(readPath(PKG));
    const reanimated = pkg.dependencies['react-native-reanimated'];
    const haptics = pkg.dependencies['expo-haptics'];
    expect(reanimated).not.toMatch(/^\^/);
    expect(haptics).not.toMatch(/^\^/);
  });
});