import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getPriorityEmergencyPhrases, getSurvivalCategories, getSurvivalTopicDetail } from '../services/workplaceSurvivalService';
import { getSecondaryTranslations, getSupportLanguageDisplayName, getSupportTranslation } from '../services/supportLanguageService';
import type { SurvivalCategoryId } from '../types/workplaceSurvival';
import type { LearnerLanguage } from '../types/onboarding';
import { Card } from '../components/Card';
import { EmptyStateArt } from '../components/EmptyStateArt';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ScreenHeader } from '../components/ScreenHeader';
import { TranslationStatusBadge } from '../components/TranslationStatusBadge';
import { JishoLink } from '../components/JishoLink';
import { ds } from '../theme/designSystem';
import { Button } from '../components/Button';
import { markShadowingAttempt, speakJapanese } from '../services/speechPracticeService';

export function WorkplaceSurvivalScreen({ supportLanguage = 'en' }: { supportLanguage?: LearnerLanguage }) {
  const [selected, setSelected] = useState<SurvivalCategoryId | undefined>();
  const categories = getSurvivalCategories();
  const detail = selected ? getSurvivalTopicDetail(selected) : undefined;
  const emergency = getPriorityEmergencyPhrases().slice(0, 3);

  if (detail) {
    return (
      <ScreenScaffold>
        <ScreenHeader title={detail.title} subtitle={getSupportLanguageDisplayName(supportLanguage)} onBack={() => setSelected(undefined)} />
        <Card tone="warm">
          <Text style={styles.tipLabel}>Sensei tip</Text>
          <Text style={styles.tipBody}>{detail.coachTip}</Text>
        </Card>
        <Text style={styles.sectionTitle}>{detail.phrases.length} phrases</Text>
        {detail.phrases.map(phrase => {
          const primary = getSupportTranslation(phrase, supportLanguage);
          const secondary = getSecondaryTranslations(phrase, supportLanguage);
          return (
            <Card key={phrase.id} shadow="card">
              <View style={styles.jpRow}>
                <Text style={styles.jp}>{phrase.japanese}</Text>
                <TranslationStatusBadge status={phrase.translationReviewStatus} supportLanguage={supportLanguage} compact />
              </View>
              <View style={styles.romajiRow}>
                <Text style={styles.line}>{phrase.romaji}</Text>
                <JishoLink japanese={phrase.japanese} />
              </View>
              <View style={styles.divider} />
              <Text style={styles.bold}>{primary.label}: {primary.text}</Text>
              {secondary.map(translation => (
                <Text key={translation.label} style={styles.line}>{translation.label}: {translation.text}</Text>
              ))}
              <Text style={styles.note}>{phrase.usageNote}</Text>
              <View style={styles.actions}>
                <Button label="Listen" variant="soft" icon="play" accessibilityLabel={`Listen to the reading ${phrase.romaji}`} onPress={() => speakJapanese(phrase.romaji)} />
                <Button label="Practice aloud" variant="soft" icon="chat" accessibilityLabel={`Practice saying ${phrase.romaji} aloud`} onPress={() => { markShadowingAttempt(phrase.romaji); speakJapanese(phrase.romaji, 0.72); }} />
              </View>
            </Card>
          );
        })}
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold>
      <ScreenHeader title="Workplace Survival" subtitle={`Fast phrases for work, safety, schedules, help, and emergencies • ${getSupportLanguageDisplayName(supportLanguage)}`} />

      {categories.length === 0 ? (
        // Phase 45 Tier-2: defensive empty-state for the case where the
        // survival categories list resolves to zero. In practice the
        // data is sourced from survivalCategoryBase so this branch is
        // reachable only if the data file is empty. Mirrors the
        // ProgressScreen empty-wrap pattern (size 180 matches
        // ProgressScreen + HomeScreen's help-disclosure illustration).
        <View style={styles.emptyWrap}>
          <EmptyStateArt screen="survival" size={180} />
          <Text style={styles.emptyTitle}>No survival topics yet</Text>
          <Text style={styles.emptyBody}>
            Survival phrases will appear here once they are authored.
          </Text>
        </View>
      ) : (
        <>
          <Card tone="danger" shadow="card">
            <Text style={styles.emergencyTitle}>🚨 Emergency Quick Access</Text>
            {emergency.map(phrase => {
              const primary = getSupportTranslation(phrase, supportLanguage);
              return <Text key={phrase.id} style={styles.emergencyPhrase}>{phrase.japanese} — {primary.label}: {primary.text}</Text>;
            })}
          </Card>

          <Text style={styles.sectionTitle}>Topics</Text>
          {categories.map(category => (
            <Card
              key={category.id}
              shadow="card"
              tone={category.priority === 'emergency' ? 'danger' : 'default'}
              onPress={() => setSelected(category.id)}
            >
              <Text style={styles.cardTitle}>{category.title}</Text>
              <Text style={styles.cardBody}>{category.description}</Text>
              <Text style={styles.count}>{category.phraseCount} phrases</Text>
            </Card>
          ))}
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase', marginTop: ds.spacing.md, marginBottom: ds.spacing.xs },
  cardTitle: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.text, flexShrink: 1 },
  cardBody: { fontSize: ds.type.body, color: ds.colors.textMuted, lineHeight: 22, marginTop: ds.spacing.xs, flexShrink: 1 },
  count: { fontSize: ds.type.caption, color: ds.colors.primary, fontWeight: '900', marginTop: ds.spacing.sm },
  jpRow: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.xs, flexWrap: 'wrap' },
  romajiRow: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.sm, flexWrap: 'wrap', marginTop: ds.spacing.xs },
  emergencyTitle: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.danger, marginBottom: ds.spacing.sm, flexShrink: 1 },
  emergencyPhrase: { fontSize: ds.type.body, color: ds.colors.text, marginTop: ds.spacing.xs, lineHeight: 22, flexShrink: 1 },
  tipLabel: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.warmInk, textTransform: 'uppercase' },
  tipBody: { fontSize: ds.type.body, color: ds.colors.warmInkStrong, marginTop: ds.spacing.xs, lineHeight: 22, flexShrink: 1 },
  jp: { fontSize: ds.type.heading + 6, lineHeight: 31, fontWeight: '900', color: ds.colors.text, flexShrink: 1 },
  line: { fontSize: ds.type.body, lineHeight: 22, color: ds.colors.text, marginTop: ds.spacing.xs, flexShrink: 1 },
  bold: { fontSize: ds.type.body, fontWeight: '800', marginTop: ds.spacing.xs, lineHeight: 22, color: ds.colors.text, flexShrink: 1 },
  note: { fontSize: ds.type.caption, color: ds.colors.textMuted, marginTop: ds.spacing.sm, lineHeight: 22, flexShrink: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.sm, marginTop: ds.spacing.md },
  divider: { height: 1, backgroundColor: ds.colors.divider, marginVertical: ds.spacing.sm },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: ds.spacing.md, paddingVertical: ds.spacing.xl },
  emptyTitle: { fontSize: ds.type.title, fontWeight: '900', color: ds.colors.text, textAlign: 'center' },
  emptyBody: { fontSize: ds.type.body, color: ds.colors.textMuted, textAlign: 'center', flexShrink: 1, paddingHorizontal: ds.spacing.lg },
});
