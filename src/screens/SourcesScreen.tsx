import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { getContentSourceAcknowledgementText, japaneseContentSources } from '../data/contentSources';
import { Card } from '../components/Card';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ScreenHeader } from '../components/ScreenHeader';
import { ds } from '../theme/designSystem';

export function SourcesScreen({ onBack }: { onBack: () => void }) {
  const [linkError, setLinkError] = useState<string | null>(null);

  async function openSourceLink(url: string) {
    setLinkError(null);
    try {
      if (!await Linking.canOpenURL(url)) throw new Error('unsupported URL');
      await Linking.openURL(url);
    } catch {
      setLinkError('Could not open that source link. Please try again.');
    }
  }

  return (
    <ScreenScaffold>
      <ScreenHeader title="Sources & credits" onBack={onBack} />

      <Text style={styles.intro}>{getContentSourceAcknowledgementText()}</Text>
      {linkError ? (
        <Text style={styles.error} accessibilityLiveRegion="assertive">{linkError}</Text>
      ) : null}

      {japaneseContentSources.map((source) => (
        <Card key={source.id} shadow="card">
          <Text style={styles.cardTitle}>{source.name}</Text>
          <Text style={styles.line}>Owner: {source.owner}</Text>
          <Text style={styles.line}>License: {source.license}</Text>
          {[
            { label: 'Source', url: source.homepageUrl },
            { label: 'License', url: source.licenseUrl },
            ...(source.downloadUrl ? [{ label: 'Download', url: source.downloadUrl }] : []),
          ].map(link => (
            <Pressable
              key={`${source.id}-${link.label}`}
              onPress={() => { void openSourceLink(link.url); }}
              accessibilityRole="link"
              accessibilityLabel={`Open ${source.name} ${link.label.toLowerCase()}`}
            >
              <Text style={[styles.line, styles.link]}>{link.label}: {link.url}</Text>
            </Pressable>
          ))}
          <Text style={styles.sectionLabel}>How we use it</Text>
          {source.recommendedUse.map((use) => (
            <Text key={use} style={styles.bullet}>• {use}</Text>
          ))}
          <Text style={styles.note}>{source.betaPolicy}</Text>
        </Card>
      ))}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: ds.type.body, color: ds.colors.text, lineHeight: 22, marginBottom: ds.spacing.md, flexShrink: 1 },
  cardTitle: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.text, marginBottom: ds.spacing.sm, flexShrink: 1 },
  line: { color: ds.colors.text, fontSize: ds.type.body, lineHeight: 22, marginBottom: ds.spacing.xs, flexShrink: 1 },
  link: { color: ds.colors.primary, textDecorationLine: 'underline' },
  error: { color: ds.colors.danger, fontSize: ds.type.body, lineHeight: 22, marginBottom: ds.spacing.md, fontWeight: '700' },
  sectionLabel: { marginTop: ds.spacing.sm, marginBottom: ds.spacing.xs, fontWeight: '900', color: ds.colors.primary, fontSize: ds.type.caption, textTransform: 'uppercase' },
  bullet: { color: ds.colors.text, fontSize: ds.type.body, lineHeight: 22, marginBottom: ds.spacing.xs, flexShrink: 1 },
  note: { color: ds.colors.textMuted, fontSize: ds.type.caption, lineHeight: 20, marginTop: ds.spacing.sm, fontWeight: '700', flexShrink: 1 },
});
