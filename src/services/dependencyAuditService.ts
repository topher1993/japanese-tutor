export interface AuditCounts {
  info?: number;
  low?: number;
  moderate: number;
  high: number;
  critical: number;
  total: number;
}

export interface NpmAuditVulnerability {
  name?: string;
  severity?: string;
  isDirect?: boolean;
  via?: unknown[];
  effects?: string[];
}

export interface NpmAuditJson {
  metadata?: {
    vulnerabilities?: Partial<AuditCounts>;
  };
  vulnerabilities?: Record<string, NpmAuditVulnerability>;
}

export interface DependencyAuditAnalysis {
  summary: AuditCounts;
  directVulnerabilities: string[];
  transitiveVulnerabilities: string[];
  hasHighOrCritical: boolean;
}

export interface DependencyAuditDecision {
  allowAutomaticForceFix: boolean;
  riskLevel: 'low' | 'moderate' | 'high';
  recommendedAction: string;
}

function getCounts(report: NpmAuditJson): AuditCounts {
  const counts = report.metadata?.vulnerabilities ?? {};
  return {
    info: counts.info ?? 0,
    low: counts.low ?? 0,
    moderate: counts.moderate ?? 0,
    high: counts.high ?? 0,
    critical: counts.critical ?? 0,
    total: counts.total ?? 0,
  };
}

export function analyzeNpmAuditReport(report: NpmAuditJson): DependencyAuditAnalysis {
  const vulnerabilities = report.vulnerabilities ?? {};
  const directVulnerabilities = Object.entries(vulnerabilities)
    .filter(([, value]) => value.isDirect === true)
    .map(([key, value]) => value.name ?? key)
    .sort();
  const transitiveVulnerabilities = Object.entries(vulnerabilities)
    .filter(([, value]) => value.isDirect !== true)
    .map(([key, value]) => value.name ?? key)
    .sort();
  const summary = getCounts(report);
  return {
    summary,
    directVulnerabilities,
    transitiveVulnerabilities,
    hasHighOrCritical: summary.high > 0 || summary.critical > 0,
  };
}

export function buildDependencyAuditDecision(analysis: DependencyAuditAnalysis): DependencyAuditDecision {
  if (analysis.hasHighOrCritical) {
    return {
      allowAutomaticForceFix: false,
      riskLevel: 'high',
      recommendedAction: 'Escalate before beta; do not run npm audit fix --force until Expo compatibility is reviewed.',
    };
  }
  if (analysis.summary.total > 0) {
    return {
      allowAutomaticForceFix: false,
      riskLevel: 'moderate',
      recommendedAction: 'Do not run npm audit fix --force; inspect direct/transitive packages and prefer Expo-compatible patch updates.',
    };
  }
  return {
    allowAutomaticForceFix: false,
    riskLevel: 'low',
    recommendedAction: 'No vulnerabilities reported; keep dependency lockfile unchanged unless a controlled update is needed.',
  };
}
