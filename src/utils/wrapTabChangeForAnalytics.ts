/**
 * Phase 44.2 — tab-change analytics wrapper.
 *
 * The tab routing layer in App.tsx uses `nav.onTabChange` from the
 * useAppNavigation hook. We want every tab change to fire a
 * `track('tab_visited', { tab })` analytics event, but we don't want
 * to couple the navigation hook itself to analytics (separation of
 * concerns — the hook stays focused on navigation state).
 *
 * This wrapper is the seam: App.tsx passes `nav.onTabChange` through
 * `wrapTabChangeForAnalytics` and hands the result to <TabBar />. The
 * wrapper:
 *   1. Calls the original handler (preserves navigation state updates)
 *   2. Fires track('tab_visited', { tab: next }) (no-op in test mode)
 *   3. Lets exceptions from the original handler propagate (so we
 *      don't silently mask real navigation bugs)
 *
 * Why a thin wrapper and not a side-effect inside onTabChange:
 *   - The hook stays testable in isolation (no analytics module dep)
 *   - The wrapper itself is a pure function — easy to test
 *   - App.tsx becomes the explicit integration point, so grepping for
 *     "track(" in the codebase finds every analytics call site
 *
 * Phase 44.2: the queue stays in-memory. When a backend is wired in
 * (Phase 44.3+), `track()` will start flushing — no call site change
 * needed here.
 */

import { track } from '../services/analyticsService';
import type { AppTab } from '../types/navigation';

export type TabChangeHandler = (next: AppTab) => void;

/**
 * Wrap a tab-change handler so it also fires an analytics event.
 *
 * Contract:
 *   - Returns a function with the same signature as the original
 *   - Calls the original handler FIRST, then track()
 *   - Returns void (does not propagate the inner return value)
 *   - Re-throws exceptions from the original handler
 */
export function wrapTabChangeForAnalytics(original: TabChangeHandler): TabChangeHandler {
  return (next: AppTab) => {
    original(next);
    track('tab_visited', { tab: next });
  };
}