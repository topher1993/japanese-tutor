import { describe, expect, it } from 'vitest';

import { getKoiDomainGate } from '../src/features/koi-sensei/domain';
import { auditKoiContentEvidence } from '../src/features/koi-sensei/governance';

describe('Koi N5/N4 content-evidence release audit', () => {
  const report = auditKoiContentEvidence();

  it('audits every star domain for both earnable-candidate ranks', () => {
    expect(Object.keys(report.audits)).toEqual(['N5', 'N4']);
    expect(Object.keys(report.audits.N5)).toEqual(['vocabulary', 'grammar', 'phrases', 'quizzes']);
    expect(Object.keys(report.audits.N4)).toEqual(['vocabulary', 'grammar', 'phrases', 'quizzes']);
    expect(Object.values(report.audits).flatMap(Object.values).every(audit => (
      audit.governedItemCount <= audit.itemCount
      && audit.ready === (audit.itemCount > 0 && audit.governedItemCount === audit.itemCount)
    ))).toBe(true);
  });

  it('marks a domain earnable only when every audited item is governed', () => {
    for (const rank of ['N5', 'N4'] as const) {
      for (const domain of ['vocabulary', 'grammar', 'phrases', 'quizzes'] as const) {
        const audit = report.audits[rank][domain];
        expect(getKoiDomainGate(report.availability, rank, domain).earnable).toBe(audit.ready);
        if (audit.ready) expect(audit.blockers).toEqual([]);
        else expect(audit.blockers.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps untagged current content fail-closed instead of inventing stars', () => {
    // These assertions are intentional release tripwires. When curators add
    // sourceRefs + sensei-reviewed status to every item, update this test in
    // the same reviewed commit that activates the domain.
    expect(report.audits.N5.grammar.ready).toBe(false);
    expect(report.audits.N5.phrases.ready).toBe(false);
    expect(report.audits.N4.grammar.ready).toBe(false);
    expect(report.audits.N4.phrases.ready).toBe(false);
  });

  it('never changes N3 gating or N2/N1 preview status', () => {
    expect(report.availability.ranks.N3.releaseState).toBe('gated');
    expect(report.availability.ranks.N2.releaseState).toBe('preview');
    expect(report.availability.ranks.N1.releaseState).toBe('preview');
    expect(getKoiDomainGate(report.availability, 'N3', 'vocabulary').earnable).toBe(false);
    expect(getKoiDomainGate(report.availability, 'N2', 'grammar').reason).toBe('preview-only');
  });
});

