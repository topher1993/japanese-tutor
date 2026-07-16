import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { buildBetaFeedbackPrompts } from '../services/betaReleaseCandidateService';
import { createBrowserBetaFeedbackStorage, createLocalBetaFeedbackStore, summarizeBetaFeedback } from '../services/betaFeedbackService';
import { buildFeedbackPolishQueue, feedbackCategories, feedbackSeverities } from '../services/betaFeedbackTriageService';
import { betaFeedbackScreenOptions, buildFirstPolishSprint, summarizeSprintReadiness } from '../services/betaPolishSprintService';
import { getExternalBetaFeedbackFormAccess } from '../services/externalBetaFeedbackFormService';
import { localDateKey } from '../utils/localDate';
import { buildSimpleFeedbackEntry, getSimpleFeedbackOptions, mapSimpleFeedbackToTriage } from '../services/simpleFeedbackUxService';
import { ds } from '../theme/designSystem';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ScreenHeader } from '../components/ScreenHeader';
import type { BetaFeedbackCategory, BetaFeedbackEntry, BetaFeedbackSeverity, BetaFeedbackType } from '../types/betaFeedback';

const categoryLabels: Record<BetaFeedbackCategory, string> = {
  'ui-polish': 'UI polish',
  content: 'Content',
  'device-layout': 'Device layout',
  'learning-flow': 'Learning flow',
  bug: 'Bug',
};

const severityLabels: Record<BetaFeedbackSeverity, string> = {
  blocker: 'Blocker',
  important: 'Important',
  minor: 'Minor',
};

export function BetaFeedbackScreen({ onBack }: { onBack: () => void }) {
  const store = useMemo(() => createLocalBetaFeedbackStore(createBrowserBetaFeedbackStorage()), []);
  const [entries, setEntries] = useState<BetaFeedbackEntry[]>(store.list());
  const [screen, setScreen] = useState('Lessons');
  const [rating, setRating] = useState<BetaFeedbackEntry['rating']>(4);
  const [feedbackType, setFeedbackType] = useState<BetaFeedbackType>('problem');
  const [stoppedUse, setStoppedUse] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const initialTriage = mapSimpleFeedbackToTriage({ type: feedbackType, stoppedUse });
  const [severity, setSeverity] = useState<BetaFeedbackSeverity>(initialTriage.severity);
  const [category, setCategory] = useState<BetaFeedbackCategory>(initialTriage.category);
  const [note, setNote] = useState('');
  const [externalFormError, setExternalFormError] = useState<string | null>(null);
  const prompts = buildBetaFeedbackPrompts();
  const summary = summarizeBetaFeedback(entries);
  const queue = buildFeedbackPolishQueue(entries);
  const sprint = buildFirstPolishSprint(entries);
  const sprintReadiness = summarizeSprintReadiness(sprint);
  const simpleOptions = getSimpleFeedbackOptions();
  const mappedTriage = mapSimpleFeedbackToTriage({ type: feedbackType, stoppedUse });
  const externalForm = getExternalBetaFeedbackFormAccess();

  function chooseFeedbackType(type: BetaFeedbackType) {
    const nextTriage = mapSimpleFeedbackToTriage({ type, stoppedUse: type === 'problem' ? stoppedUse : undefined });
    setFeedbackType(type);
    setSeverity(nextTriage.severity);
    setCategory(nextTriage.category);
  }

  function chooseStoppedUse(value: boolean) {
    const nextTriage = mapSimpleFeedbackToTriage({ type: feedbackType, stoppedUse: value });
    setStoppedUse(value);
    setSeverity(nextTriage.severity);
    setCategory(nextTriage.category);
  }

  function saveFeedback() {
    const createdAt = localDateKey();
    const entry = showAdvanced
      ? { screen, rating, severity, category, note: note || 'No note provided', createdAt, feedbackType }
      : buildSimpleFeedbackEntry({ screen, rating, type: feedbackType, stoppedUse, note, createdAt });

    setEntries(store.add(entry));
    setNote('');
    setFeedbackType('problem');
    setStoppedUse(false);
    setSeverity('important');
    setCategory('bug');
    setRating(4);
  }

  async function openExternalForm() {
    setExternalFormError(null);
    try {
      const supported = await Linking.canOpenURL(externalForm.url);
      if (!supported) throw new Error('Unsupported URL');
      await Linking.openURL(externalForm.url);
    } catch {
      setExternalFormError('Could not open the feedback form. Copy the address below into your browser.');
    }
  }

  return (
    <ScreenScaffold>
      <ScreenHeader title="Beta Feedback" onBack={onBack} />

      <Card tone="info" shadow="card">
        <Text style={styles.cardTitle}>Full beta tester form</Text>
        <Text style={styles.line}>{externalForm.helperText}</Text>
        <View style={styles.externalFormButton}>
          <Button label={externalForm.label} onPress={() => { void openExternalForm(); }} icon="arrow-right" />
        </View>
        {externalFormError ? <Text style={styles.errorText} accessibilityLiveRegion="assertive">{externalFormError}</Text> : null}
        <Text style={styles.urlText}>{externalForm.url}</Text>
      </Card>

      <Card shadow="card">
        <Text style={styles.cardTitle}>What do you want to tell us?</Text>
        <View style={styles.optionStack}>
          {simpleOptions.map(option => (
            <Pressable
              key={option.type}
              accessibilityRole="radio"
              accessibilityLabel={`${option.label}. ${option.helperText}`}
              accessibilityState={{ checked: feedbackType === option.type }}
              style={({ pressed }) => [styles.optionCard, feedbackType === option.type && styles.optionActive, { opacity: pressed ? 0.92 : 1 }]}
              onPress={() => chooseFeedbackType(option.type)}
            >
              <Text style={[styles.optionTitle, feedbackType === option.type && styles.optionActiveText]}>{option.label}</Text>
              <Text style={[styles.optionHelp, feedbackType === option.type && styles.optionActiveHelp]}>{option.helperText}</Text>
            </Pressable>
          ))}
        </View>

        {feedbackType === 'problem' ? (
          <Card tone="warm" style={styles.problemBox}>
            <Text style={styles.label}>Did this stop you from using the app?</Text>
            <View style={styles.chipRow}>
              <Chip label="Yes, I was blocked" selected={stoppedUse} tone="danger" onPress={() => chooseStoppedUse(true)} />
              <Chip label="No, but it was a problem" selected={!stoppedUse} onPress={() => chooseStoppedUse(false)} />
            </View>
          </Card>
        ) : null}

        <Text style={styles.label}>Where did it happen?</Text>
        <TextInput accessibilityLabel="Screen where the feedback happened" style={styles.input} value={screen} onChangeText={setScreen} />
        <View style={styles.chipRow}>
          {betaFeedbackScreenOptions.map(value => (
            <Chip key={value} label={value} selected={screen === value} onPress={() => setScreen(value)} />
          ))}
        </View>

        <Text style={styles.label}>What happened?</Text>
        <TextInput
          accessibilityLabel="Describe what happened"
          style={[styles.input, styles.note]}
          multiline
          value={note}
          onChangeText={setNote}
          placeholder="Example: The translation looked wrong, or I did not know what to tap next."
          placeholderTextColor={ds.colors.textMuted}
        />

        <Text style={styles.label}>Optional rating: {rating}/5</Text>
        <View style={styles.ratingRow}>
          {([1, 2, 3, 4, 5] as const).map(value => (
            <Chip key={value} label={String(value)} selected={rating === value} onPress={() => setRating(value)} />
          ))}
        </View>

        <Card tone="success" style={styles.mappingBox}>
          <Text style={styles.mappingTitle}>Internal routing preview</Text>
          <Text style={styles.line}>{severityLabels[mappedTriage.severity]} / {categoryLabels[mappedTriage.category]}</Text>
        </Card>

        <Button label={showAdvanced ? 'Hide advanced details' : 'Advanced details for developer testers'} onPress={() => setShowAdvanced(!showAdvanced)} variant="soft" icon={showAdvanced ? 'arrow-up' : 'arrow-down'} />

        {showAdvanced ? (
          <Card tone="soft" style={styles.advancedPanel}>
            <Text style={styles.label}>Severity</Text>
            <View style={styles.chipRow}>
              {feedbackSeverities.map(value => (
                <Chip key={value} label={severityLabels[value]} selected={severity === value} onPress={() => setSeverity(value)} />
              ))}
            </View>

            <Text style={styles.label}>Category</Text>
            <View style={styles.chipRow}>
              {feedbackCategories.map(value => (
                <Chip key={value} label={categoryLabels[value]} selected={category === value} onPress={() => setCategory(value)} />
              ))}
            </View>
          </Card>
        ) : null}

        <Button label="Save local feedback" onPress={saveFeedback} variant="primary" icon="check" />
      </Card>

      <Card shadow="card">
        <Text style={styles.cardTitle}>Feedback Summary</Text>
        <Text style={styles.line}>Entries: {summary.count}</Text>
        <Text style={styles.line}>Average rating: {summary.averageRating.toFixed(1)}</Text>
        <Text style={styles.line}>Review needed: {summary.screensNeedingReview.join(', ') || 'None yet'}</Text>
      </Card>

      <Card shadow="card">
        <Text style={styles.cardTitle}>Polish Queue</Text>
        <Text style={styles.line}>Blockers: {queue.summary.blocker}</Text>
        <Text style={styles.line}>Important: {queue.summary.important}</Text>
        <Text style={styles.line}>Minor: {queue.summary.minor}</Text>
        <Text style={styles.nextAction}>{queue.nextAction}</Text>
        {queue.items.slice(0, 3).map(item => (
          <Text key={`${item.createdAt}-${item.screen}-${item.note}`} style={styles.queueItem}>• {severityLabels[item.severity]} / {categoryLabels[item.category]} — {item.screen}</Text>
        ))}
      </Card>

      <Card shadow="card">
        <Text style={styles.cardTitle}>First Polish Sprint</Text>
        <Text style={styles.nextAction}>{sprintReadiness}</Text>
        <Text style={styles.line}>Active sprint capacity: {sprint.activeItems.length}/{sprint.capacity}</Text>
        {sprint.activeItems.length === 0 && <Text style={styles.queueItem}>• Waiting for tester feedback.</Text>}
        {sprint.activeItems.map(item => (
          <Text key={`active-${item.createdAt}-${item.screen}-${item.note}`} style={styles.queueItem}>• {item.status}: {severityLabels[item.severity]} / {categoryLabels[item.category]} — {item.screen}</Text>
        ))}
        {sprint.backlogItems.length > 0 && <Text style={styles.line}>Backlog: {sprint.backlogItems.length} queued for later.</Text>}
      </Card>

      <Card shadow="card">
        <Text style={styles.cardTitle}>Tester Prompts</Text>
        {prompts.map(prompt => <Text key={prompt} style={styles.prompt}>• {prompt}</Text>)}
      </Card>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.text, marginBottom: ds.spacing.sm, flexShrink: 1 },
  line: { fontSize: ds.type.body, color: ds.colors.text, lineHeight: 22, marginTop: ds.spacing.xs, flexShrink: 1 },
  externalFormButton: { marginTop: ds.spacing.md },
  errorText: { color: ds.colors.danger, fontSize: ds.type.caption, marginTop: ds.spacing.sm, lineHeight: 18 },
  urlText: { color: ds.colors.primary, fontSize: ds.type.caption, marginTop: ds.spacing.sm, flexShrink: 1 },
  optionStack: { gap: ds.spacing.sm, marginTop: ds.spacing.xs },
  optionCard: {
    borderWidth: 1,
    borderColor: ds.colors.border,
    backgroundColor: ds.colors.surface,
    padding: ds.spacing.md,
    borderRadius: ds.radius.md,
    minHeight: ds.touch.min,
  },
  optionActive: { backgroundColor: ds.colors.brand, borderColor: ds.colors.brand },
  optionTitle: { fontSize: ds.type.body, fontWeight: '900', color: ds.colors.text, marginBottom: ds.spacing.xs },
  optionHelp: { fontSize: ds.type.caption, color: ds.colors.textMuted, lineHeight: 20 },
  optionActiveText: { color: ds.colors.brandInk },
  optionActiveHelp: { color: ds.colors.brandInk, opacity: 0.85 },
  problemBox: { marginTop: ds.spacing.md },
  label: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.text, marginTop: ds.spacing.md, marginBottom: ds.spacing.xs, textTransform: 'uppercase' },
  input: {
    minHeight: ds.touch.min,
    borderWidth: 1,
    borderColor: ds.colors.border,
    borderRadius: ds.radius.md,
    padding: ds.spacing.sm,
    backgroundColor: ds.colors.surface,
    fontSize: ds.type.body,
    color: ds.colors.text,
  },
  note: { minHeight: 88, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', gap: ds.spacing.xs, flexWrap: 'wrap' },
  ratingRow: { flexDirection: 'row', gap: ds.spacing.xs, flexWrap: 'wrap' },
  mappingBox: { marginTop: ds.spacing.md },
  mappingTitle: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.text, marginBottom: ds.spacing.xs, textTransform: 'uppercase' },
  advancedPanel: { marginTop: ds.spacing.sm },
  nextAction: { fontSize: ds.type.body, lineHeight: 22, marginTop: ds.spacing.sm, fontWeight: '900', color: ds.colors.primary },
  queueItem: { fontSize: ds.type.body, lineHeight: 22, color: ds.colors.textMuted, marginTop: ds.spacing.xs, flexShrink: 1 },
  prompt: { fontSize: ds.type.body, lineHeight: 22, color: ds.colors.textMuted, marginTop: ds.spacing.xs, flexShrink: 1 },
});
