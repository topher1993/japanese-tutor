import { StyleSheet, Text, View } from 'react-native';
import type { MasteryLevel, MasteryMap, MasteryModality } from '../types/mastery';
import { learningGroupLabel, type VocabularyLearningGroup } from '../services/vocabularyTaxonomyService';
import { ds } from '../theme/designSystem';
import { Button } from './Button';
import { Card } from './Card';
import { masteryTopicLabel } from '../services/masteryService';

const MODALITY_LABELS: Record<MasteryModality, string> = {
  recognition: 'Recognition', reading: 'Reading', listening: 'Listening', production: 'Speaking',
};
const LEVEL_LABELS: Record<MasteryLevel, string> = {
  new: 'New', learning: 'Learning', familiar: 'Familiar', mastered: 'Mastered',
};

function groupLabel(group: VocabularyLearningGroup): string {
  return group === 'expression' ? 'Phrases & expressions' : `${learningGroupLabel(group)}s`;
}

export function MasteryMapCard({
  map,
  onFocusGroup,
  onFocusTopic,
  onPracticeWeak,
}: {
  map: MasteryMap;
  onFocusGroup?: (group: VocabularyLearningGroup) => void;
  onFocusTopic?: (topic: string) => void;
  onPracticeWeak?: () => void;
}) {
  const changeLabel = map.weeklyChange === 0
    ? 'Baseline week'
    : `${map.weeklyChange > 0 ? '+' : ''}${map.weeklyChange} points this week`;
  return (
    <View testID="mastery-map">
      <Card shadow="card" style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Personalized mastery map</Text>
            <Text style={styles.title}>What you can recall and use</Text>
            <Text style={styles.helper}>Mastery combines memory, reading, listening, and speaking—not lesson completion alone.</Text>
          </View>
          <View style={styles.scoreBadge}>
            <Text style={styles.score}>{map.overallScore}</Text>
            <Text style={styles.scoreLabel}>overall</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${map.overallScore}%` }]} />
        </View>
        <Text style={styles.change}>{changeLabel} • Weakest skill: {MODALITY_LABELS[map.weakestModality]}</Text>

        <View style={styles.levelRow}>
          {(Object.keys(LEVEL_LABELS) as MasteryLevel[]).map(level => (
            <View key={level} style={styles.levelPill}>
              <Text style={styles.levelCount}>{map.levelCounts[level]}</Text>
              <Text style={styles.levelLabel}>{LEVEL_LABELS[level]}</Text>
            </View>
          ))}
        </View>

        {map.items.some(item => item.evidenceCount > 0) ? (
          <>
            <Text style={styles.sectionLabel}>Next items to strengthen</Text>
            {[...map.items]
              .filter(item => item.evidenceCount > 0 && item.level !== 'mastered')
              .sort((a, b) => a.overallScore - b.overallScore || a.japanese.localeCompare(b.japanese))
              .slice(0, 3)
              .map(item => (
                <View key={item.refId} style={styles.itemRow} testID={`mastery-item-${item.refId}`}>
                  <View style={styles.groupCopy}>
                    <Text style={styles.itemJapanese}>{item.japanese} <Text style={styles.itemReading}>{item.reading}</Text></Text>
                    <Text style={styles.groupMeta}>{LEVEL_LABELS[item.level]} • {groupLabel(item.learningGroup)} • {item.topic}</Text>
                  </View>
                  <Text style={styles.groupScore}>{item.overallScore}%</Text>
                </View>
              ))}
            {onPracticeWeak ? (
              <Button
                label="Practice weakest items"
                onPress={onPracticeWeak}
                variant="secondary"
                size="md"
                testID="mastery-practice-weak"
                style={styles.focusButton}
              />
            ) : null}
          </>
        ) : null}

        <Text style={styles.sectionLabel}>Skill dimensions</Text>
        {(Object.keys(MODALITY_LABELS) as MasteryModality[]).map(modality => (
          <View key={modality} style={styles.dimensionRow}>
            <Text style={styles.dimensionLabel}>{MODALITY_LABELS[modality]}</Text>
            <View style={styles.dimensionTrack}>
              <View style={[styles.dimensionFill, { width: `${map.scores[modality]}%` }]} />
            </View>
            <Text style={styles.dimensionScore}>{map.scores[modality]}%</Text>
          </View>
        ))}

        <Text style={styles.sectionLabel}>Choose what to strengthen</Text>
        {map.groups.filter(group => group.itemCount > 0).map(group => (
          <View key={group.group} style={styles.groupRow} testID={`mastery-group-${group.group}`}>
            <View style={styles.groupHeader}>
              <View style={styles.groupCopy}>
                <Text style={styles.groupTitle}>{groupLabel(group.group)}</Text>
                <Text style={styles.groupMeta}>
                  {group.masteredCount} mastered • {group.attemptedCount}/{group.itemCount} practiced • strengthen {MODALITY_LABELS[group.weakestModality].toLowerCase()}
                </Text>
              </View>
              <Text style={styles.groupScore}>{group.score}%</Text>
            </View>
            <View style={styles.groupTrack}>
              <View style={[styles.groupFill, { width: `${group.score}%` }]} />
            </View>
            {onFocusGroup ? (
              <Button
                label={`Practice ${groupLabel(group.group).toLowerCase()}`}
                onPress={() => onFocusGroup(group.group)}
                variant="soft"
                size="md"
                testID={`mastery-focus-${group.group}`}
                style={styles.focusButton}
              />
            ) : null}
          </View>
        ))}
        {onFocusTopic && map.topics.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Weakest topics</Text>
            {map.topics.slice(0, 3).map(topic => (
              <View key={topic.topic} style={styles.topicRow} testID={`mastery-topic-${topic.topic}`}>
                <View style={styles.groupCopy}>
                  <Text style={styles.groupTitle}>{masteryTopicLabel(topic.topic)}</Text>
                  <Text style={styles.groupMeta}>{topic.score}% mastery • {topic.attemptedCount}/{topic.itemCount} practiced</Text>
                </View>
                <Button
                  label="Practice topic"
                  onPress={() => onFocusTopic(topic.topic)}
                  variant="soft"
                  size="md"
                  fullWidth={false}
                  testID={`mastery-focus-topic-${topic.topic}`}
                />
              </View>
            ))}
          </>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: ds.spacing.md, borderLeftWidth: 4, borderLeftColor: ds.colors.success },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: ds.spacing.sm },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.success, textTransform: 'uppercase' },
  title: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.text, marginTop: ds.spacing.xs },
  helper: { fontSize: ds.type.caption, lineHeight: 18, color: ds.colors.textMuted, marginTop: ds.spacing.xs },
  scoreBadge: { minWidth: 70, alignItems: 'center', padding: ds.spacing.sm, borderRadius: ds.radius.md, backgroundColor: ds.colors.successSoft },
  score: { fontSize: ds.type.title, fontWeight: '900', color: ds.colors.success },
  scoreLabel: { fontSize: ds.type.micro, color: ds.colors.textMuted },
  progressTrack: { height: 10, borderRadius: ds.radius.pill, backgroundColor: ds.colors.surfaceAlt, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: ds.radius.pill, backgroundColor: ds.colors.success },
  change: { fontSize: ds.type.caption, color: ds.colors.textMuted },
  levelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.xs },
  levelPill: { flex: 1, minWidth: 70, alignItems: 'center', borderRadius: ds.radius.md, backgroundColor: ds.colors.surfaceAlt, padding: ds.spacing.sm },
  levelCount: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.text },
  levelLabel: { fontSize: ds.type.micro, color: ds.colors.textMuted },
  sectionLabel: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase', marginTop: ds.spacing.xs },
  dimensionRow: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.sm },
  dimensionLabel: { width: 82, fontSize: ds.type.caption, color: ds.colors.text, fontWeight: '700' },
  dimensionTrack: { flex: 1, height: 7, borderRadius: ds.radius.pill, backgroundColor: ds.colors.surfaceAlt, overflow: 'hidden' },
  dimensionFill: { height: '100%', borderRadius: ds.radius.pill, backgroundColor: ds.colors.primary },
  dimensionScore: { width: 38, textAlign: 'right', fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.primary },
  groupRow: { gap: ds.spacing.xs, paddingTop: ds.spacing.sm, borderTopWidth: 1, borderTopColor: ds.colors.border },
  groupHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: ds.spacing.sm },
  groupCopy: { flex: 1, minWidth: 0 },
  groupTitle: { fontSize: ds.type.body, fontWeight: '900', color: ds.colors.text },
  groupMeta: { fontSize: ds.type.micro, lineHeight: 16, color: ds.colors.textMuted, marginTop: 2 },
  groupScore: { fontSize: ds.type.body, fontWeight: '900', color: ds.colors.primary },
  groupTrack: { height: 6, borderRadius: ds.radius.pill, backgroundColor: ds.colors.surfaceAlt, overflow: 'hidden' },
  groupFill: { height: '100%', borderRadius: ds.radius.pill, backgroundColor: ds.colors.primary },
  focusButton: { alignSelf: 'flex-start', marginTop: ds.spacing.xs },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.sm, paddingTop: ds.spacing.sm, borderTopWidth: 1, borderTopColor: ds.colors.border },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.sm, paddingVertical: ds.spacing.xs },
  itemJapanese: { fontSize: ds.type.body, fontWeight: '900', color: ds.colors.text },
  itemReading: { fontSize: ds.type.caption, fontWeight: '700', color: ds.colors.primary },
});
