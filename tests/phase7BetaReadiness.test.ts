import { describe, expect, it } from 'vitest';
import { createOnboardingPreferenceStore, getOnboardingStorageKey } from '../src/services/onboardingPreferenceService';
import { buildBetaReadinessChecklist, summarizeBetaReadiness } from '../src/services/betaReadinessService';
import { analyzeNpmAuditReport, buildDependencyAuditDecision } from '../src/services/dependencyAuditService';

// Phase 22 audit fix P0-01: the onboarding store is now async (SQLite-backed
// on React Native). The mock storage adapter below mirrors that contract.
function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); },
  };
}

describe('Phase 7 beta readiness', () => {
  it('persists onboarding completion and learner language through a storage adapter', async () => {
    const storage = createMemoryStorage();
    const store = createOnboardingPreferenceStore(storage);

    await expect(store.load()).resolves.toMatchObject({ onboarded: false, language: 'en' });

    await store.save({ onboarded: true, language: 'tl' });

    expect(await storage.getItem(getOnboardingStorageKey())).toContain('tl');
    await expect(store.load()).resolves.toMatchObject({ onboarded: true, language: 'tl' });
  });

  it('falls back safely when persisted onboarding JSON is invalid', async () => {
    const storage = createMemoryStorage();
    await storage.setItem(getOnboardingStorageKey(), '{bad json');

    const store = createOnboardingPreferenceStore(storage);

    await expect(store.load()).resolves.toMatchObject({ onboarded: false, language: 'en' });
  });

  it('builds an internal beta checklist with release blockers separated from warnings', () => {
    const checklist = buildBetaReadinessChecklist();

    expect(checklist.title).toContain('Internal Beta');
    expect(checklist.items.some(item => item.category === 'device-qa')).toBe(true);
    expect(checklist.items.some(item => item.category === 'dependencies')).toBe(true);
    expect(checklist.items.some(item => item.requiredForBeta && item.status === 'blocked')).toBe(true);

    const summary = summarizeBetaReadiness(checklist);
    expect(summary.readyForInternalBeta).toBe(false);
    expect(summary.blockers.length).toBeGreaterThan(0);
    expect(summary.nextActions).toContain('complete real-device Expo Go QA pass');
  });

  it('turns npm audit JSON into a controlled dependency decision', () => {
    const audit = analyzeNpmAuditReport({
      metadata: { vulnerabilities: { info: 0, low: 0, moderate: 10, high: 0, critical: 0, total: 10 } },
      vulnerabilities: {
        demo: { name: 'demo', severity: 'moderate', isDirect: false, via: ['transitive-package'], effects: [] },
      },
    });

    expect(audit.summary).toMatchObject({ moderate: 10, high: 0, critical: 0, total: 10 });
    expect(audit.directVulnerabilities).toEqual([]);
    expect(audit.transitiveVulnerabilities).toContain('demo');

    const decision = buildDependencyAuditDecision(audit);
    expect(decision.allowAutomaticForceFix).toBe(false);
    expect(decision.recommendedAction).toContain('Do not run npm audit fix --force');
  });
});
