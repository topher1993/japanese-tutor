import React, { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ScreenHeader } from '../components/ScreenHeader';
import { useLearningContext } from '../services/learningContext';
import { ds } from '../theme/designSystem';

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
}: {
  onBack: () => void;
  onReset: () => Promise<void> | void;
  onOpenReview?: () => void;
}) {
  const { ready, durable, resetAll } = useLearningContext();
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
      // App.tsx handles onboarding preference + local React state reset.
      await onReset();
      setLastResetSummary(
        srsRowsCleared > 0
          ? `Cleared ${srsRowsCleared} review card${srsRowsCleared === 1 ? '' : 's'} and all lesson progress.`
          : 'Cleared all lesson progress (no review cards to clear).',
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

      <Card shadow="card">
        <Text style={styles.sectionLabel}>Reviewer tools</Text>
        <Text style={styles.help}>
          For Sensei or native-speaker reviewers: open the translation review queue, approve drafts, and edit EN / VI / TL translations. Decisions save locally on this device.
        </Text>
        <Button
          label="Open translation review"
          onPress={() => onOpenReview?.()}
          disabled={!onOpenReview}
          icon="check"
          variant="secondary"
          testID="settings-open-review-button"
        />
      </Card>

      <Card shadow="card">
        <Text style={styles.sectionLabel}>Reset progress</Text>
        <Text style={styles.help}>
          Clears onboarding choice, all completed lessons, and every SRS review card. On durable storage this wipes the SQLite tables — the next cold start begins from onboarding.
        </Text>
        <Button
          label={resetting ? 'Resetting...' : 'Reset all progress'}
          onPress={confirmReset}
          disabled={resetting || !ready}
          icon="refresh"
          variant="secondary"
          testID="settings-reset-button"
        />
        {lastResetSummary ? (
          <Text style={styles.summary} testID="settings-reset-summary">{lastResetSummary}</Text>
        ) : null}
      </Card>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase', marginBottom: ds.spacing.xs },
  meta: { fontSize: ds.type.caption, color: ds.colors.textMuted, marginTop: ds.spacing.xs },
  help: { fontSize: ds.type.body, color: ds.colors.text, marginBottom: ds.spacing.sm, flexShrink: 1, lineHeight: 22 },
  summary: { fontSize: ds.type.caption, color: ds.colors.success, marginTop: ds.spacing.xs, fontWeight: '700' },
  backHeader: { fontSize: ds.type.body },
});