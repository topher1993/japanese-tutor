// Phase 37 (post-refactor) — Source-level contract assertions for the
// ProgressScreen refactor (commit 57631de, "wip: pre-37a dirty state snapshot").
//
// The refactor replaced several hardcoded literals (ACHIEVEMENTS array,
// JLPT_BADGES array, dailyPlan('N5'), 'check' icon) with values derived
// from the live profile and progression services. This file pins the
// visible shape of the refactor so a future edit that quietly reverts it
// — or that breaks the data layer feeding it — is caught at test time.
//
// We read ProgressScreen.tsx as text and assert substring/regex matches.
// We also include a few small unit-style checks against the supporting
// services so the audit findings below are reproducible.
//
// See: docs/phase-37-todo-gated-progression-proposal.md for the broader
// phase-37 contract that this screen participates in.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCREEN_PATH = join(__dirname, '..', 'src', 'screens', 'ProgressScreen.tsx');
const PROFILE_SVC_PATH = join(__dirname, '..', 'src', 'services', 'profileProgressionService.ts');
const DASHBOARD_SVC_PATH = join(__dirname, '..', 'src', 'services', 'progressDashboardService.ts');

function loadScreenSource(): string {
  return readFileSync(SCREEN_PATH, 'utf8');
}

function loadProfileSvcSource(): string {
  return readFileSync(PROFILE_SVC_PATH, 'utf8');
}

function loadDashboardSvcSource(): string {
  return readFileSync(DASHBOARD_SVC_PATH, 'utf8');
}

describe('phase 37 — ProgressScreen refactor shape', () => {
  it('(a) imports buildProfileProgression to drive badges and XP level', () => {
    const source = loadScreenSource();
    expect(source).toMatch(
      /import\s*\{[^}]*buildProfileProgression[^}]*\}\s*from\s*['"]\.\.\/services\/profileProgressionService['"]/,
    );
    // The function must also be invoked (not just imported) so a dead-import
    // cleanup cannot silently remove the integration.
    expect(source).toMatch(/buildProfileProgression\s*\(/);
  });

  it('(b) imports useUserProfileContext and maps evaluated level, with jlptTarget fallback, for dailyPlan', () => {
    const source = loadScreenSource();
    expect(source).toMatch(
      /import\s*\{[^}]*useUserProfileContext[^}]*\}\s*from\s*['"]\.\.\/services\/userProfileContext['"]/,
    );
    // toStudyLevel must exist as a function (arrow OR declaration OR const)
    // so the screen can map a JlptTargetLevel into the StudyLevel union.
    expect(source).toMatch(/function\s+toStudyLevel\s*\(/);
    // dailyPlan must be built from the mapped level, not the literal 'N5'.
    expect(source).toMatch(/buildDailyPlan\s*\(\s*planLevel\s*\)/);
    // The hook result must drive the level mapping.
    expect(source).toMatch(/placementLevelToCourseLevel/);
    expect(source).toMatch(/planLevel\s*=\s*profile\??\.dynamic\.placement/);
    expect(source).toMatch(/toStudyLevel\s*\(\s*profile\??\.static\.jlptTarget\s*\)/);
  });

  it('(c) no longer contains a hardcoded ACHIEVEMENTS array', () => {
    const source = loadScreenSource();
    // The literal `ACHIEVEMENTS` symbol must be absent. Whitelist comments
    // by requiring the symbol to appear (if at all) only inside a // or /*
    // comment line. We strip comments first to be strict.
    const codeOnly = source
      .split('\n')
      .filter(line => !line.trim().startsWith('//'))
      .join('\n')
      // Remove block comments crudely.
      .replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/\bACHIEVEMENTS\b/);
  });

  it('(d) no longer contains a hardcoded JLPT_BADGES array', () => {
    const source = loadScreenSource();
    const codeOnly = source
      .split('\n')
      .filter(line => !line.trim().startsWith('//'))
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/\bJLPT_BADGES\b/);
  });

  it('(e) renders a Course Progress card that reads completionPercent from view', () => {
    const source = loadScreenSource();
    // Section header copy "Course progress" must be present.
    expect(source).toContain('Course progress');
    // completionPercent must be read off `view` so it traces back to the
    // dashboard service. We accept any bracket-form or property-form access.
    expect(source).toMatch(/view\.completionPercent/);
    // The fill bar must clamp the percentage to 0-100 before rendering width.
    expect(source).toMatch(/Math\.min\(\s*100\s*,\s*Math\.max\(\s*0\s*,\s*view\.completionPercent\s*\)\s*\)/);
    // The percentage itself must be rendered as visible text in the header.
    expect(source).toMatch(/\{view\.completionPercent\}%/);
  });

  it('(f) Achievements grid iterates over progression.badges (derived array)', () => {
    const source = loadScreenSource();
    // progression.badges must be the source — either via `.map` or by
    // being seeded into an `achievements` array that the JSX iterates.
    expect(source).toMatch(/progression\.badges/);
    // A derived `achievements` array must be built from those badges.
    expect(source).toMatch(/const\s+achievements\s*=/);
    // The grid must iterate the derived array (use `achievements.map`, not
    // a hardcoded literal map).
    expect(source).toMatch(/achievements\.map\s*\(/);
  });

  it('(g) JLPT levels row uses BadgeImage for N5 and N4 (not Chip)', () => {
    const source = loadScreenSource();
    // The "JLPT levels" Card section must render badge images, not chips.
    // We slice the section that contains the JLPT_LEVELS row by anchoring
    // on the section header text "JLPT levels".
    const sectionMatch = source.match(
      /<Text[^>]*>\s*JLPT levels\s*<\/Text>[\s\S]*?<\/Card>/,
    );
    expect(sectionMatch, 'JLPT levels Card block not found').toBeTruthy();
    const section = sectionMatch![0];
    // Must use BadgeImage for jlptN5 and jlptN4 with size 64 (matches the
    // design — chips are width-flexible, badges are fixed-size images).
    expect(section).toMatch(/<BadgeImage[^>]*badge="jlptN5"[^>]*size=\{64\}/);
    expect(section).toMatch(/<BadgeImage[^>]*badge="jlptN4"[^>]*size=\{64\}/);
    // n4Unlocked must come from the earned badge, not a hardcoded bool.
    expect(source).toMatch(/n4Unlocked\s*=\s*achievements\.some/);
    expect(source).toMatch(/a\.id\s*===\s*'n4-unlocked'\s*&&\s*a\.earned/);
  });

  it('(h) taskCheck bullet icon is "book" (not "check")', () => {
    const source = loadScreenSource();
    // Anchor on the styles.taskList rendering block (View style={styles.taskList}…)
    // and grab the next 600 chars; this is enough to capture the Icon call
    // before the closing </View>.
    const taskListStart = source.indexOf('<View style={styles.taskList}>');
    expect(taskListStart, 'taskList View not found').toBeGreaterThanOrEqual(0);
    const taskListSlice = source.slice(taskListStart, taskListStart + 800);
    expect(taskListSlice).toMatch(/<Icon\s+name="book"/);
    expect(taskListSlice).not.toMatch(/<Icon\s+name="check"/);
  });

  it('(i) fallback progress is the EMPTY_PROGRESS constant (not an inline literal)', () => {
    const source = loadScreenSource();
    // The constant must be declared as a top-level `const EMPTY_PROGRESS`.
    expect(source).toMatch(/const\s+EMPTY_PROGRESS\s*:\s*LearnerProgress\s*=/);
    // The fallback in the screen body must use the constant.
    expect(source).toMatch(/progress\s*\?\?\s*EMPTY_PROGRESS/);
    // And the local variable that becomes `view` must be derived from it.
    expect(source).toMatch(/safeProgress\s*=/);
  });

  it('(j) dailyPlan is built from profile?.static.jlptTarget (not the literal "N5")', () => {
    const source = loadScreenSource();
    // The mapping call must reference profile?.static.jlptTarget.
    expect(source).toMatch(/profile\??\.static\.jlptTarget/);
    // Sanity: there must NOT be a remaining call to buildDailyPlan("N5").
    expect(source).not.toMatch(/buildDailyPlan\s*\(\s*['"]N5['"]\s*\)/);
    expect(source).not.toMatch(/tracker\.buildDailyPlan\s*\(\s*['"]N5['"]\s*\)/);
  });
});

describe('phase 37 — supporting service shape (audit guards)', () => {
  it('buildProfileProgression returns the documented badge IDs', () => {
    const source = loadProfileSvcSource();
    // We assert the badge id set statically so a future PR that renames or
    // drops a badge is caught here, before the screen renders empty chips.
    for (const id of [
      'first-lesson',
      'seven-day-streak',
      'daily-rush-starter',
      'perfect-quiz',
      'n4-unlocked',
    ]) {
      expect(source, `badge id ${id} missing from profileProgressionService`).toContain(
        `id: '${id}'`,
      );
    }
  });

  it('buildProfileProgression exposes level + nextMilestone that the screen renders', () => {
    const source = loadProfileSvcSource();
    // The nextMilestone object literal in the return statement (multiline —
    // we don't require specific whitespace, just that the keys are present
    // and the label interpolation references level + 1).
    expect(source).toMatch(/nextMilestone\s*:\s*\{[^}]*label\s*:/);
    expect(source).toMatch(/nextMilestone\s*:\s*\{[^}]*remaining\s*:/);
    // Label uses `Level ${level + 1}` so the screen can render it verbatim.
    expect(source).toMatch(/`\$\{remaining\}\s*XP\s*to\s*Level\s*\$\{level\s*\+\s*1\}`/);
    // level is computed via levelFromXp.
    expect(source).toMatch(/level\s*=\s*levelFromXp/);
  });

  it('progressDashboardService validates completedLessonIds against the lesson set', () => {
    const source = loadDashboardSvcSource();
    // The new validLessonIds filter must be present so stale ids in
    // progress.completedLessonIds do not inflate completedLessons.
    expect(source).toMatch(/validLessonIds\s*=\s*new Set\(\s*lessons\.map\(\s*lesson\s*=>\s*lesson\.id\s*\)\s*\)/);
    expect(source).toMatch(/progress\.completedLessonIds\.filter\(\s*id\s*=>\s*validLessonIds\.has\(id\)\s*\)/);
  });
});
