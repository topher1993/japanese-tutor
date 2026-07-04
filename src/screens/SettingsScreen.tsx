import React, { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ScreenHeader } from '../components/ScreenHeader';
import { useLearningContext } from '../services/learningContext';
import { useUserProfileContext } from '../services/userProfileContext';
import { ds } from '../theme/designSystem';
// Phase 44.2: analytics debug — read the in-memory queue so devs can
// inspect what would be transmitted to a backend (once one is wired).
// track() is a no-op in test mode, so this view stays empty under
// Vitest and the import has no effect on production builds.
import {
  clearQueuedEvents,
  getQueuedEvents,
  isAnalyticsEnabled,
} from '../services/analyticsService';

// Phase 37g — dev-only feature-flag toggle. The helper lives in src/dev/ and
// is gated behind `__DEV__` at the render site below so release builds
// tree-shake the import out of the bundle.
import {
  disableWeeklyTodos,
  enableWeeklyTodos,
} from '../dev/featureFlagDevMenu';

// React Native injects `__DEV__` at runtime; declare it for TS so the dev
// section can be hidden in production builds without a typecheck error.
declare const __DEV__: boolean | undefined;

/**
 * Phase 22 audit fix P1-06 + Phase 25 audit fix P0-2: minimal Settings screen
 * with a "Reset all progress" affordance.
 *
 * The reset wipes (via the LearningRepositoryProvider context):
 *   1. Onboarding preference (delegated to App.tsx via onReset callback)
 *   2. Every persisted lesson-completion (store.reset → repo.deleteAllProgress)
 *   3. Every SRS review card (srs.clearAll)
 *   4. In-memory caches so the next read returns the cleared state
 */
export function SettingsScreen({
  onBack,
  onReset,
  onOpenReview,
  showReviewerTools = false,
}: {
  onBack: () => void;
  onReset: () => Promise<void> | void;
  onOpenReview?: () => void;
  showReviewerTools?: boolean;
}) {
  const { ready, durable, resetAll } = useLearningContext();
  const { ready: profileReady, resetProfile } = useUserProfileContext();
  const [resetting, setResetting] = useState(false);
  const [lastResetSummary, setLastResetSummary] = useState<string | null>(null);

  async function doReset() {
    setResetting(true);
    setLastResetSummary(null);
    try {
      // Phase 25 / P0-2: the real reset — wipe SRS rows + practice progress
      // via the durable SQLite-backed stores. Runs BEFORE onReset so the
      // counts the user sees reflect actual persisted state cleared.
      const { srsRowsCleared } = await resetAll();
      const { profileRowsCleared } = await resetProfile();
      // App.tsx handles onboarding preference + local React state reset.
      await onReset();
      const profileSummary = profileRowsCleared > 0 ? ` Profile row reset too.` : '';
      setLastResetSummary(
        srsRowsCleared > 0
          ? `Cleared ${srsRowsCleared} review card${srsRowsCleared === 1 ? '' : 's'} and all lesson progress.${profileSummary}`
          : `Cleared all lesson progress (no review cards to clear).${profileSummary}`,
      );
    } finally {
      setResetting(false);
    }
  }

  function confirmReset() {
    Alert.alert(
      'Reset all progress?',
      'This clears your onboarding choice, all completed lessons, and every review card. There is no undo.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset everything', style: 'destructive', onPress: doReset },
      ],
      { cancelable: true },
    );
  }

  return (
    <ScreenScaffold>
      <ScreenHeader title="Settings" onBack={onBack} titleStyle={styles.backHeader} />

      <Card shadow="card">
        <Text style={styles.sectionLabel}>Storage</Text>
        <Text style={styles.meta}>Backend: {durable ? 'SQLite (durable)' : 'In-memory (session only)'}</Text>
        <Text style={styles.meta}>Ready: {ready ? 'Yes' : 'Loading...'}</Text>
      </Card>

      {showReviewerTools && onOpenReview ? (
        <Card shadow="card">
          <Text style={styles.sectionLabel}>Reviewer tools</Text>
          <Text style={styles.help}>
            Dev/native-speaker review only: open the translation review queue, approve drafts, and edit English plus helper-language translations. Decisions save locally on this device.
          </Text>
          <Button
            label="Open translation review"
            onPress={() => onOpenReview()}
            icon="check"
            variant="secondary"
            testID="settings-open-review-button"
          />
        </Card>
      ) : null}

      <Card shadow="card">
        <Text style={styles.sectionLabel}>Reset progress</Text>
        <Text style={styles.help}>
          Clears onboarding choice, all completed lessons, and every SRS review card. On durable storage this wipes the SQLite tables — the next cold start begins from onboarding.
        </Text>
        <Button
          label={resetting ? 'Resetting...' : 'Reset all progress'}
          onPress={confirmReset}
          disabled={resetting || !ready || !profileReady}
          icon="refresh"
          variant="secondary"
          testID="settings-reset-button"
        />
        {lastResetSummary ? (
          <Text style={styles.summary} testID="settings-reset-summary">{lastResetSummary}</Text>
        ) : null}
      </Card>

      {/* Phase 37g — dev-only flag toggle. Hidden in production builds via the
          `__DEV__` guard so the bundle tree-shakes the dev-menu helper out of
          release builds. Mirrors the existing Card + sectionLabel style. */}
      {typeof __DEV__ !== 'undefined' && __DEV__ ? (
        <Card shadow="card">
          <Text style={styles.sectionLabel}>Dev</Text>
          <Text style={styles.help}>
            Phase 37g rollout controls. Toggling the flag here flips the weekly-todos gate on/off in this session — useful for QA before promoting to Tier 2/3/4. See docs/phase-37-rollout.md.
          </Text>
          <Button
            label="Enable weekly todos"
            onPress={() => {
              enableWeeklyTodos();
              Alert.alert('Weekly todos', 'Flag enabled for this session.');
            }}
            icon="check"
            variant="secondary"
            testID="settings-dev-enable-weekly-todos-button"
          />
          <Button
            label="Disable weekly todos"
            onPress={() => {
              disableWeeklyTodos();
              Alert.alert('Weekly todos', 'Flag disabled for this session.');
            }}
            icon="cross"
            variant="secondary"
            testID="settings-dev-disable-weekly-todos-button"
          />
        </Card>
      ) : null}

      {/* Phase 44.2 — analytics debug queue. Visible only in dev builds
          that have NO analytics backend configured. Once
          EXPO_PUBLIC_ANALYTICS_KEY is set, the backend's own debug UI
          takes over and this section hides itself to avoid clutter. */}
      {typeof __DEV__ !== 'undefined' && __DEV__ && !isAnalyticsEnabled() ? (
              <Card shadow="card">
                <Text style={styles.sectionLabel}>Analytics (dev)</Text>
                <Text style={styles.help}>
                  In-memory event queue. These events WOULD be sent to a
                  analytics backend if EXPO_PUBLIC_ANALYTICS_KEY were set.
                  Set the env var to disable this section and use the
                  backend's own debug UI.
                </Text>
                <AnalyticsDebugQueue />
              </Card>
            ) : null}
    </ScreenScaffold>
  );
}

/**
 * Phase 44.2 — render the last 20 queued events + a Clear button.
 * Pure presentational helper; the Card wrapper above controls visibility
 * via __DEV__ + isAnalyticsEnabled().
 */
function AnalyticsDebugQueue() {
  // We re-read the queue on every render. The queue is small (capped
  // at 100 entries), so a read on every paint is fine and avoids a
  // useEffect + interval. The button re-renders when clearQueuedEvents
  // fires because SettingsScreen owns no state around this — React's
  // natural re-render on parent state change covers it.
  const events = getQueuedEvents().slice(-20);
  const queueLen = getQueuedEvents().length;
  return (
    <>
      <Text style={styles.meta}>
        Queue: {queueLen} event{queueLen === 1 ? '' : 's'}
        {queueLen > 20 ? ' (showing last 20)' : ''}
      </Text>
      {events.length === 0 ? (
        <Text style={styles.meta}>No events queued. Trigger one (switch tab, open a lesson) and come back.</Text>
      ) : (
        events.slice().reverse().map((e, i) => (
          <Text key={`${e.ts}-${i}`} style={styles.meta} testID={`settings-analytics-event-${i}`}>
            {new Date(e.ts).toISOString().slice(11, 19)} · {e.event} · {JSON.stringify(e.props)}
          </Text>
        ))
      )}
      <Button
        label="Clear queue"
        onPress={clearQueuedEvents}
        icon="cross"
        variant="secondary"
        testID="settings-analytics-clear-button"
      />
    </>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase', marginBottom: ds.spacing.xs },
  meta: { fontSize: ds.type.caption, color: ds.colors.textMuted, marginTop: ds.spacing.xs },
  help: { fontSize: ds.type.body, color: ds.colors.text, marginBottom: ds.spacing.sm, flexShrink: 1, lineHeight: 22 },
  summary: { fontSize: ds.type.caption, color: ds.colors.success, marginTop: ds.spacing.xs, fontWeight: '700' },
  backHeader: { fontSize: ds.type.body },
});