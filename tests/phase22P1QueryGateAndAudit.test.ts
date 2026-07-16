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
 *
 * Phase 43 — App.tsx split: the `__DEV__ ? createAppSearchParams` guard
 * lives in `src/app/useAppNavigation.ts`. The "must exist somewhere" scan
 * now covers App.tsx + src/app/**. The new "App.tsx must NOT contain"
 * assertion guards against future regression that re-inlines the guard.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const APP = join(ROOT, 'App.tsx');
const APP_DIR = join(ROOT, 'src', 'app');
const PKG = join(ROOT, 'package.json');
const SCRIPT = join(ROOT, 'scripts', 'audit-report.mjs');

function readPath(p: string): string {
  return readFileSync(p, 'utf8');
}

/**
 * Concatenate App.tsx + every file under src/app/ for pattern scanning.
 * Phase 43: source-grep tests no longer couple to a single file.
 */
function readAppOrAppModule(): string {
  const parts: string[] = [readPath(APP)];
  if (existsSync(APP_DIR)) {
    for (const entry of readdirSync(APP_DIR)) {
      const full = join(APP_DIR, entry);
      if (statSync(full).isFile() && (entry.endsWith('.ts') || entry.endsWith('.tsx'))) {
        parts.push(readPath(full));
      }
    }
  }
  return parts.join('\n\n');
}

describe('Phase 22 audit — query-param shell escape hatch (P1-08 fix)', () => {
  it('App shell wraps createAppSearchParams() in __DEV__ guard (now lives in src/app/useAppNavigation)', () => {
    const all = readAppOrAppModule();
    expect(all).toMatch(/__DEV__\s*\?\s*createAppSearchParams/);
    // App.tsx itself must NOT contain the pattern — it lives in the hook now.
    expect(readPath(APP)).not.toMatch(/__DEV__\s*\?\s*createAppSearchParams/);
  });

  it('params.get(...) is only called inside the getParam helper (anywhere in App shell)', () => {
    const all = readAppOrAppModule();
    // The single `params.get` call must be inside the helper definition.
    const getParamDef = /const getParam = [\s\S]*?params\.get\(/;
    const helperCount = (all.match(getParamDef) || []).length;
    expect(helperCount).toBe(1);
    // Outside the helper definition, there should be no direct calls.
    const allMinusHelper = all.replace(getParamDef, '');
    const directCalls = allMinusHelper.match(/params\.get\(/g) || [];
    expect(directCalls.length).toBe(0);
    expect(all).toContain('const getParam = ');
  });

  it('all four hatch params are accessed via getParam, not raw', () => {
    const all = readAppOrAppModule();
    expect(all).toContain("getParam('tab')");
    expect(all).toContain("getParam('onboarding')");
    expect(all).toContain("getParam('skipOnboarding')");
    // 'screen' appears ten times, including placement, JLPT mock, and Koi.
    const screenMatches = all.match(/getParam\('screen'\)/g) || [];
    expect(screenMatches.length).toBe(10);
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
