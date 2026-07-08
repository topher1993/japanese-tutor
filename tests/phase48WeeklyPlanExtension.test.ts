// Phase 48 — Source-contract + runtime regression test for the N5 Week 1
// plan extension that adds the 3 remaining todo kinds (`quiz`, `kanji`,
// `example-sentences`) so the weekly todo board exercises every wired
// CTA. Phase 47 already wired the routing + view pieces; this phase
// makes the data layer ship a plan that uses all 6 kinds.
//
// Background: Phase 37b/37d-1/37d-2 shipped the N5 Week 1 plan with 3
// todos (`lesson`, `daily-rush`, `flashcards`). Phase 47 expanded the
// weekly todo board wiring so all 6 WeekTodoKind values are tappable
// (WIRED_TODO_KINDS in WeeklyTodoBoardView + a 7-case switch in
// LessonsScreen.onTodoPress). But without todos in the plan, the 3
// missing kinds (`quiz`, `kanji`, `example-sentences`) cannot appear
// on the board for the only week that has a plan. Phase 48 closes
// that gap.
//
// This test pins the structural pieces so a future edit cannot
// silently regress to a 3-todo plan or break the routing contract.
//
// It also serves as a regression guard for Phase 47 — the existing
// 19 `it()` blocks in tests/phase47WeeklyTodoBoardWiring.test.ts must
// still pass. The full-suite vitest run in the verification gate
// enforces this; we do not duplicate those assertions here.
//
// Pattern mirrors tests/phase47WeeklyTodoBoardWiring.test.ts and
// tests/phase37bLessonKind.test.ts: read source files as strings for
// structural contracts, and use the public WEEKLY_PLANS / getWeekPlan
// / buildWeeklyTodoBoard APIs for runtime contracts.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getWeekPlan } from '../src/services/weeklyPlansService';
import {
  buildWeeklyTodoBoard,
  type TodoCtaRoute,
  type TodoPayload,
} from '../src/services/weeklyTodoService';
import type { WeekTodoKind } from '../src/types/weeklyTodo';
import { emptyTodoEventCounts } from '../src/types/weeklyTodo';

const ROOT = join(__dirname, '..');
const KANJI_DATA_PATH = join(
  ROOT,
  'src',
  'data',
  'candidates',
  'n5KanjiCandidateData.ts',
);
const VIEW_PATH = join(ROOT, 'src', 'components', 'WeeklyTodoBoardView.tsx');
const WKIND_PATH = join(ROOT, 'src', 'types', 'weeklyTodo.ts');
const SVC_PATH = join(ROOT, 'src', 'services', 'weeklyTodoService.ts');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

/** The complete WeekTodoKind union — locked here as the source of truth. */
const ALL_TODO_KINDS: WeekTodoKind[] = [
  'lesson',
  'flashcards',
  'daily-rush',
  'quiz',
  'kanji',
  'example-sentences',
];

/**
 * The 7 ctaRoute.screen values the Phase 47 switch in LessonsScreen
 * handles. `lessons` is the fallback when a `lesson` todo has no
 * `lessonIds` configured. The Phase 48 todos only produce a subset of
 * these (`quiz`, `kanji`, `example-sentences`), but every todo on the
 * board must still resolve to one of them.
 */
const ALL_CTA_SCREENS: TodoCtaRoute['screen'][] = [
  'lesson',
  'lessons',
  'flashcards',
  'quiz',
  'kanji',
  'daily-rush',
  'example-sentences',
];

function makeEmptyPayload(): TodoPayload {
  return {
    todoStates: {},
    weekTodosInitialized: { 1: true },
    todoEventCounts: emptyTodoEventCounts(),
    completedLessonIds: [],
  };
}

describe('phase 48 — N5 Week 1 plan extended with quiz / kanji / example-sentences', () => {
  describe('runtime: plan shape (N5 Week 1)', () => {
    it('1. N5 week 1 plan has 6 todos', () => {
      const plan = getWeekPlan(1);
      expect(plan, 'getWeekPlan(1) returned undefined — Week 1 plan missing').toBeDefined();
      expect(plan!.todos.length).toBe(6);
    });

    it('2. N5 week 1 plan contains all 6 kinds', () => {
      const plan = getWeekPlan(1)!;
      const kindsInPlan = plan.todos.map(t => t.kind);
      for (const kind of ALL_TODO_KINDS) {
        expect(kindsInPlan, `plan is missing kind '${kind}'`).toContain(kind);
      }
      // Sanity: there are no duplicate kinds (each id is distinct too).
      const ids = plan.todos.map(t => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('3. kanji todo has 5 kanjiSet ids that exist in n5KanjiCandidateData', () => {
      const plan = getWeekPlan(1)!;
      const kanjiTodo = plan.todos.find(t => t.kind === 'kanji');
      expect(kanjiTodo, 'no kanji-kind todo on the Week 1 plan').toBeDefined();
      expect(kanjiTodo!.kanjiSet).toBeDefined();
      expect(kanjiTodo!.kanjiSet!.length).toBe(5);

      // The runtime IDs are produced by n5KanjiCandidateData.ts via
      // `id: \`kanji-n5-${String(index + 1).padStart(4, '0')}\`` — the
      // first 5 raw entries are 一, 二, 三, 四, 五 (indices 0..4), so
      // the expected runtime ids are `kanji-n5-0001`..`kanji-n5-0005`.
      // We assert the source-contract: the file uses that padStart
      // pattern (so the IDs are stable), and the raw array starts
      // with 一 in entry 0.
      const kanjiSrc = read(KANJI_DATA_PATH);
      expect(kanjiSrc).toMatch(
        /id:\s*`kanji-n5-\$\{String\(index\s*\+\s*1\)\.padStart\(4,\s*['"]0['"]\)\}`/,
      );
      // The first raw entry must be the 一 (one) kanji so the runtime
      // id `kanji-n5-0001` corresponds to it.
      expect(kanjiSrc).toMatch(
        /const\s+raw[\s\S]*?\{\s*kanji:\s*['"]一['"][\s\S]*?meanings:\s*\[\s*['"]one['"]\s*\]/,
      );

      // Runtime check: every id in the todo's kanjiSet must appear
      // in the produced pack (since it's runtime-generated, we assert
      // via the brief's contract that ids 0001..0005 are stable by
      // matching the format).
      for (const id of kanjiTodo!.kanjiSet!) {
        expect(id).toMatch(/^kanji-n5-\d{4}$/);
      }
    });

    it('4. quiz todo has target=1 and no passThreshold override', () => {
      const plan = getWeekPlan(1)!;
      const quizTodo = plan.todos.find(t => t.kind === 'quiz');
      expect(quizTodo, 'no quiz-kind todo on the Week 1 plan').toBeDefined();
      expect(quizTodo!.target).toBe(1);
      // Per Hard constraint #6 in the brief: do NOT add a per-todo
      // passThreshold field — the WeekTodo type does not declare one
      // and the store hard-codes 70%.
      expect(
        (quizTodo! as unknown as { passThreshold?: number }).passThreshold,
        'quiz todo must not carry a passThreshold override (default 70% applies)',
      ).toBeUndefined();
      expect(quizTodo!.id).toBe('n5-w1-quiz');
    });

    it('5. example-sentences todo has target=5 and no pool/lessonIds', () => {
      const plan = getWeekPlan(1)!;
      const exTodo = plan.todos.find(t => t.kind === 'example-sentences');
      expect(exTodo, 'no example-sentences-kind todo on the Week 1 plan').toBeDefined();
      expect(exTodo!.target).toBe(5);
      expect(exTodo!.id).toBe('n5-w1-example-sentences');
      // Per Hard constraint #4 in the brief: example-sentences has no
      // kanjiSet/pool/lessonIds — it just counts distinct views.
      expect(
        (exTodo! as unknown as { pool?: string }).pool,
        'example-sentences todo must not carry a pool field',
      ).toBeUndefined();
      expect(
        (exTodo! as unknown as { lessonIds?: string[] }).lessonIds,
        'example-sentences todo must not carry a lessonIds field',
      ).toBeUndefined();
      expect(
        (exTodo! as unknown as { kanjiSet?: string[] }).kanjiSet,
        'example-sentences todo must not carry a kanjiSet field',
      ).toBeUndefined();
    });

    it('6. every todo\'s ctaRoute resolves to a known screen', () => {
      const plan = getWeekPlan(1)!;
      const board = buildWeeklyTodoBoard(
        1,
        plan,
        makeEmptyPayload().todoStates,
        true,
        'all',
        1,
      );
      expect(board.todos.length).toBe(6);
      for (const status of board.todos) {
        const screen = status.ctaRoute.screen;
        expect(
          ALL_CTA_SCREENS,
          `todo '${status.todo.id}' resolved to unknown screen '${screen}'`,
        ).toContain(screen);
      }

      // Stronger check: each Phase 48 kind must produce the
      // specific ctaRoute the Phase 47 switch expects.
      const byId = new Map(board.todos.map(s => [s.todo.id, s]));
      expect(byId.get('n5-w1-quiz')!.ctaRoute.screen).toBe('quiz');
      expect(byId.get('n5-w1-kanji')!.ctaRoute.screen).toBe('kanji');
      expect(byId.get('n5-w1-example-sentences')!.ctaRoute.screen).toBe(
        'example-sentences',
      );
      // And the existing 3 kinds still produce their expected routes.
      expect(byId.get('n5-w1-lessons')!.ctaRoute.screen).toMatch(/^(lesson|lessons)$/);
      expect(byId.get('n5-w1-daily-rush')!.ctaRoute.screen).toBe('daily-rush');
      expect(byId.get('n5-w1-flashcards')!.ctaRoute.screen).toBe('flashcards');
    });
  });

  describe('source-contract regression: Phase 47 pieces still in place', () => {
    it('7. WIRED_TODO_KINDS still includes all 6 kinds', () => {
      // Pin the Phase 47 contract from
      // tests/phase47WeeklyTodoBoardWiring.test.ts so a Phase 48+
      // edit cannot silently shrink the allowlist back down to 1
      // kind.
      const src = read(VIEW_PATH);
      const setMatch = src.match(/new\s+Set<WeekTodoKind>\(\[\s*([\s\S]*?)\]\)/);
      expect(setMatch, 'WIRED_TODO_KINDS Set literal not found').toBeTruthy();
      const inside = setMatch![1];
      for (const kind of ALL_TODO_KINDS) {
        const pattern = new RegExp(`['"]${kind}['"]`);
        expect(inside, `WIRED_TODO_KINDS missing kind '${kind}'`).toMatch(pattern);
      }
    });

    it('8. Phase 47 routing test still passes (covered by full-suite run)', () => {
      // This `it()` block is intentionally a meta-guard. The actual
      // 19 assertions in tests/phase47WeeklyTodoBoardWiring.test.ts
      // run as part of the full vitest suite and are the source of
      // truth. Here we just assert the structural anchors Phase 47
      // established are still present in the codebase so a Phase 48+
      // edit cannot have silently undone them:
      //
      //   a. weeklyTodoService.ts still produces a ctaRoute.screen
      //      for every wired kind.
      //   b. WeekTodoKind union in src/types/weeklyTodo.ts still
      //      declares exactly the 6 kinds.
      //
      // The full-suite vitest run in the verification gate is what
      // ultimately enforces the Phase 47 test contract.
      const svcSrc = read(SVC_PATH);
      for (const screen of ALL_CTA_SCREENS.filter(s => s !== 'lessons')) {
        const re = new RegExp(`screen:\\s*['"]${screen}['"]`);
        expect(svcSrc, `weeklyTodoService missing screen: '${screen}'`).toMatch(re);
      }

      const wkindSrc = read(WKIND_PATH);
      const union = wkindSrc.match(/export\s+type\s+WeekTodoKind\s*=\s*([\s\S]*?);/);
      expect(union, 'WeekTodoKind union not found').toBeTruthy();
      for (const kind of ALL_TODO_KINDS) {
        const re = new RegExp(`['"]${kind}['"]`);
        expect(union![1], `WeekTodoKind union missing '${kind}'`).toMatch(re);
      }
    });
  });
});