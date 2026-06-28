export type BetaChecklistCategory = 'device-qa' | 'dependencies' | 'persistence' | 'navigation' | 'content' | 'release-process';
export type BetaChecklistStatus = 'complete' | 'warning' | 'blocked';

export interface BetaChecklistItem {
  id: string;
  category: BetaChecklistCategory;
  title: string;
  status: BetaChecklistStatus;
  requiredForBeta: boolean;
  evidence: string;
  nextAction?: string;
}

export interface BetaReadinessChecklist {
  title: string;
  items: BetaChecklistItem[];
}

export interface BetaReadinessSummary {
  readyForInternalBeta: boolean;
  blockers: BetaChecklistItem[];
  warnings: BetaChecklistItem[];
  nextActions: string[];
}

export function buildBetaReadinessChecklist(): BetaReadinessChecklist {
  return {
    title: 'Japanese Tutor Internal Beta Readiness Checklist',
    items: [
      {
        id: 'device-qa-real-device',
        category: 'device-qa',
        title: 'Run real-device Expo Go QA on small Android and iPhone-sized screens',
        status: 'blocked',
        requiredForBeta: true,
        evidence: 'Phase 6 and 6.5 used exported web/mobile screenshots only.',
        nextAction: 'complete real-device Expo Go QA pass',
      },
      {
        id: 'dependency-audit-controlled',
        category: 'dependencies',
        title: 'Resolve or formally accept moderate dependency audit findings',
        status: 'warning',
        requiredForBeta: false,
        evidence: 'Audit has no high/critical findings; moderate findings require controlled remediation, not force fix.',
        nextAction: 'review npm audit JSON and avoid forced Expo upgrades',
      },
      {
        id: 'onboarding-persistence',
        category: 'persistence',
        title: 'Persist onboarding completion and support language preference',
        status: 'complete',
        requiredForBeta: true,
        evidence: 'Phase 7 adds onboarding preference storage with safe fallback.',
      },
      {
        id: 'navigation-mobile-safe',
        category: 'navigation',
        title: 'Mobile navigation remains readable at 390px preview width',
        status: 'complete',
        requiredForBeta: true,
        evidence: 'Phase 6.5 changed bottom tabs to a readable 3x2 grid.',
      },
      {
        id: 'content-boundaries',
        category: 'content',
        title: 'Confirm beta content is beginner-safe and workplace-focused',
        status: 'warning',
        requiredForBeta: false,
        evidence: 'Current mock content is N5/workplace scoped; Sensei review still recommended before real learners.',
        nextAction: 'Sensei content review before beta learners use it',
      },
      {
        id: 'release-checklist',
        category: 'release-process',
        title: 'Prepare internal beta runbook and feedback checklist',
        status: 'complete',
        requiredForBeta: true,
        evidence: 'Phase 7 generates the beta checklist and completion report.',
      },
    ],
  };
}

export function summarizeBetaReadiness(checklist: BetaReadinessChecklist): BetaReadinessSummary {
  const blockers = checklist.items.filter(item => item.requiredForBeta && item.status === 'blocked');
  const warnings = checklist.items.filter(item => item.status === 'warning');
  const nextActions = checklist.items
    .map(item => item.nextAction)
    .filter((action): action is string => Boolean(action));
  return { readyForInternalBeta: blockers.length === 0, blockers, warnings, nextActions };
}
