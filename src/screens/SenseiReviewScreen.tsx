import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  clearAllReviewDecisions,
  clearReviewDecision,
  getAllReviewablePhrases,
  getReviewProgress,
  recordReviewDecision,
  type ReviewablePhrase,
  type PhraseSource,
} from '../services/senseiReviewService';
import type { LearnerLanguage } from '../types/onboarding';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { Disclosure } from '../components/Disclosure';
import { EmptyStateArt } from '../components/EmptyStateArt';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ScreenHeader } from '../components/ScreenHeader';
import { TranslationStatusBadge } from '../components/TranslationStatusBadge';
import { ds } from '../theme/designSystem';

type Mode = 'browse' | 'review' | 'progress';

interface Props {
  supportLanguage?: LearnerLanguage;
  onBack?: () => void;
}

/**
 * Sensei Translation Review screen.
 *
 * Three modes:
 *   - browse  : list of all draft phrases, tap one to review
 *   - review  : one phrase at a time, approve/edit/skip/reject
 *   - progress: aggregate counts (total / draft / approved / overrides)
 */
export function SenseiReviewScreen({ onBack }: Props) {
  const [phrases, setPhrases] = useState<ReviewablePhrase[]>([]);
  const [progress, setProgress] = useState<{ total: number; draft: number; approved: number; overrides: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('browse');
  const [activeIndex, setActiveIndex] = useState(0);
  const [sourceFilter, setSourceFilter] = useState<PhraseSource | 'all'>('all');
  const [showOnlyDraft, setShowOnlyDraft] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editEnglish, setEditEnglish] = useState('');
  const [editVietnamese, setEditVietnamese] = useState('');
  const [editFilipino, setEditFilipino] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const actionBusyRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function refresh() {
    setLoading(true);
    setLoadError(null);
    try {
      const [all, prog] = await Promise.all([getAllReviewablePhrases(), getReviewProgress()]);
      if (!mountedRef.current) return;
      setPhrases(all);
      setProgress(prog);
    } catch {
      if (mountedRef.current) setLoadError('Could not load the review queue. Please retry.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const filtered = useMemo(() => {
    return phrases.filter(p => {
      if (showOnlyDraft && p.effectiveStatus !== 'draft') return false;
      if (sourceFilter !== 'all' && p.source !== sourceFilter) return false;
      return true;
    });
  }, [phrases, sourceFilter, showOnlyDraft]);

  const active = filtered[Math.min(activeIndex, Math.max(0, filtered.length - 1))];

  useEffect(() => {
    if (!active) { setEditing(false); return; }
    setEditEnglish(active.overrides.english ?? active.english);
    setEditVietnamese(active.overrides.vietnamese ?? active.vietnamese);
    setEditFilipino(active.overrides.filipino ?? active.filipino);
  }, [active?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setToast(null);
      toastTimerRef.current = null;
    }, 1800);
  }

  async function runReviewAction(work: () => Promise<void>) {
    if (actionBusyRef.current) return;
    actionBusyRef.current = true;
    setActionBusy(true);
    setActionError(null);
    try {
      await work();
    } catch {
      if (mountedRef.current) setActionError('That review change could not be saved. Please retry.');
    } finally {
      actionBusyRef.current = false;
      if (mountedRef.current) setActionBusy(false);
    }
  }

  async function handleApprove() {
    if (!active) return;
    await runReviewAction(async () => {
      await recordReviewDecision(active.key, {
        status: 'approved',
        editedEnglish: editEnglish !== active.english ? editEnglish : undefined,
        editedVietnamese: editVietnamese !== active.vietnamese ? editVietnamese : undefined,
        editedFilipino: editFilipino !== active.filipino ? editFilipino : undefined,
        decidedAt: new Date().toISOString(),
      });
      showToast('✅ Approved');
      setEditing(false);
      await refresh();
      if (activeIndex >= filtered.length - 1) setActiveIndex(0);
    });
  }

  async function handleReject() {
    if (!active) return;
    await runReviewAction(async () => {
      await clearReviewDecision(active.key);
      showToast('↩ Reset to draft');
      setEditing(false);
      await refresh();
    });
  }

  async function handleNext() {
    if (activeIndex < filtered.length - 1) setActiveIndex(activeIndex + 1);
    else setActiveIndex(0);
    setEditing(false);
  }

  async function handlePrev() {
    if (activeIndex > 0) setActiveIndex(activeIndex - 1);
    else setActiveIndex(filtered.length - 1);
    setEditing(false);
  }

  async function handleSaveEdits() {
    if (!active) return;
    await runReviewAction(async () => {
      await recordReviewDecision(active.key, {
        status: active.effectiveStatus,
        editedEnglish: editEnglish !== active.english ? editEnglish : undefined,
        editedVietnamese: editVietnamese !== active.vietnamese ? editVietnamese : undefined,
        editedFilipino: editFilipino !== active.filipino ? editFilipino : undefined,
        decidedAt: new Date().toISOString(),
      });
      showToast('💾 Saved edits');
      setEditing(false);
      await refresh();
    });
  }

  async function handleResetAll() {
    await runReviewAction(async () => {
      await clearAllReviewDecisions();
      showToast('🔄 All overrides cleared');
      await refresh();
      setActiveIndex(0);
    });
  }

  if (loading) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Sensei Review" onBack={onBack} />
        <Text style={styles.muted}>Loading phrases…</Text>
      </ScreenScaffold>
    );
  }

  if (loadError) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Sensei Review" onBack={onBack} />
        <Card tone="danger" shadow="card">
          <Text style={styles.emptyTitle}>Review queue unavailable</Text>
          <Text style={styles.emptyBody}>{loadError}</Text>
          <Button label="Retry" onPress={() => { void refresh(); }} variant="primary" />
        </Card>
      </ScreenScaffold>
    );
  }

  // --- Review mode ---
  if (mode === 'review') {
    if (!active) {
      return (
        <ScreenScaffold>
          <ScreenHeader title="Review" onBack={() => setMode('browse')} />
          <View style={styles.emptyWrap}>
            <EmptyStateArt screen="lessons" size={180} />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyBody}>No draft phrases match the current filter.</Text>
            <Button label="Back to list" onPress={() => setMode('browse')} variant="primary" />
          </View>
        </ScreenScaffold>
      );
    }
    return (
      <ScreenScaffold>
        <ScreenHeader title="Review" onBack={() => setMode('browse')} />
        <View style={styles.modeBar}>
          <Text style={styles.progressText}>{activeIndex + 1} of {filtered.length}</Text>
          <Chip label={active.sourceLabel} selected={false} />
          <TranslationStatusBadge status={active.effectiveStatus} />
        </View>

        <Card tone="brand" shadow="hero">
          <Text style={styles.jp}>{active.japanese}</Text>
          <Text style={styles.romaji}>{active.romaji}</Text>
        </Card>

        <Card shadow="card">
          <Text style={styles.fieldLabel}>EN</Text>
          {editing ? (
            <TextInput
              accessibilityLabel="English translation"
              style={styles.input}
              value={editEnglish}
              onChangeText={setEditEnglish}
              multiline
              testID="review-edit-en"
            />
          ) : (
            <Text style={styles.fieldValue}>{editEnglish}</Text>
          )}

          <View style={styles.divider} />

          <Text style={styles.fieldLabel}>VI</Text>
          {editing ? (
            <TextInput
              accessibilityLabel="Vietnamese translation"
              style={styles.input}
              value={editVietnamese}
              onChangeText={setEditVietnamese}
              multiline
              testID="review-edit-vi"
            />
          ) : (
            <Text style={styles.fieldValue}>{editVietnamese}</Text>
          )}

          <View style={styles.divider} />

          <Text style={styles.fieldLabel}>TL</Text>
          {editing ? (
            <TextInput
              accessibilityLabel="Filipino translation"
              style={styles.input}
              value={editFilipino}
              onChangeText={setEditFilipino}
              multiline
              testID="review-edit-tl"
            />
          ) : (
            <Text style={styles.fieldValue}>{editFilipino}</Text>
          )}
        </Card>

        {editing ? (
          <View style={styles.actionRow}>
            <Button label="Cancel" onPress={() => {
              setEditEnglish(active.overrides.english ?? active.english);
              setEditVietnamese(active.overrides.vietnamese ?? active.vietnamese);
              setEditFilipino(active.overrides.filipino ?? active.filipino);
              setEditing(false);
            }} variant="soft" />
            <Button label="Save edits" onPress={handleSaveEdits} variant="primary" testID="review-save-edits" disabled={actionBusy} />
          </View>
        ) : (
          <View style={styles.actionRow}>
            <Button label="Reset" onPress={handleReject} variant="ghost" disabled={actionBusy} />
            <Button label="Edit" onPress={() => setEditing(true)} variant="soft" />
            <Button label="Approve ✓" onPress={handleApprove} variant="primary" testID="review-approve" disabled={actionBusy} />
          </View>
        )}

        {actionError ? <Text style={styles.actionError} accessibilityLiveRegion="assertive">{actionError}</Text> : null}

        <View style={styles.navRow}>
          <Button label="← Prev" onPress={handlePrev} variant="soft" />
          <Button label="Skip →" onPress={handleNext} variant="soft" />
        </View>

        {toast ? <View style={styles.toast} accessibilityLiveRegion="polite"><Text style={styles.toastText}>{toast}</Text></View> : null}
      </ScreenScaffold>
    );
  }

  // --- Progress mode ---
  if (mode === 'progress') {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Review progress" onBack={() => setMode('browse')} />
        <Card tone="brand" shadow="hero">
          <Text style={styles.progressHero}>{progress?.approved ?? 0}</Text>
          <Text style={styles.progressHeroLabel}>of {progress?.total ?? 0} phrases approved</Text>
        </Card>
        <Card shadow="card">
          <Text style={styles.statLabel}>Approved</Text>
          <Text style={styles.statValue}>{progress?.approved ?? 0}</Text>
          <View style={styles.divider} />
          <Text style={styles.statLabel}>Draft (still need review)</Text>
          <Text style={styles.statValue}>{progress?.draft ?? 0}</Text>
          <View style={styles.divider} />
          <Text style={styles.statLabel}>Overrides saved locally</Text>
          <Text style={styles.statValue}>{progress?.overrides ?? 0}</Text>
        </Card>
        <Button label="Reset all overrides" onPress={handleResetAll} variant="danger" testID="review-reset-all" disabled={actionBusy} />
        {actionError ? <Text style={styles.actionError} accessibilityLiveRegion="assertive">{actionError}</Text> : null}
      </ScreenScaffold>
    );
  }

  // --- Browse mode (default) ---
  return (
    <ScreenScaffold>
      <ScreenHeader title="Sensei Review" onBack={onBack} />
      <Card tone="brand" shadow="hero">
        <Text style={styles.heroTitle}>Translation review queue</Text>
        <Text style={styles.heroMeta}>{progress?.draft ?? 0} draft • {progress?.approved ?? 0} approved • {progress?.overrides ?? 0} overrides</Text>
        <Text style={styles.heroNote}>Japanese phrases verified against JMDICT (Jisho.org). EN/VI/TL translations are AI-drafted and pending native-speaker review. Report issues via the Beta Feedback form.</Text>
      </Card>

      <View style={styles.modeRow}>
        <Button label={`Start review (${filtered.length})`} onPress={() => { setActiveIndex(0); setMode('review'); }} variant="primary" testID="review-start" />
        <Button label="Progress" onPress={() => setMode('progress')} variant="soft" />
      </View>

      <Disclosure title="Filters" icon="settings" open={showFilters} onToggle={() => setShowFilters(value => !value)}>
        <View style={styles.filterRow}>
          <Chip label="All sources" selected={sourceFilter === 'all'} onPress={() => setSourceFilter('all')} />
          <Chip label="Lessons" selected={sourceFilter === 'sensei-lesson'} onPress={() => setSourceFilter('sensei-lesson')} />
          <Chip label="Workplace" selected={sourceFilter === 'workplace-survival'} onPress={() => setSourceFilter('workplace-survival')} />
          <Chip label="Topics" selected={sourceFilter === 'topic-category'} onPress={() => setSourceFilter('topic-category')} />
          <Chip label="Flashcards" selected={sourceFilter === 'supplemental-flashcard'} onPress={() => setSourceFilter('supplemental-flashcard')} />
        </View>
        <Chip label={showOnlyDraft ? 'Showing draft only' : 'Showing all'} selected={showOnlyDraft} onPress={() => setShowOnlyDraft(v => !v)} />
      </Disclosure>

      <Text style={styles.sectionTitle}>{filtered.length} phrases</Text>
      {filtered.slice(0, 50).map((p, idx) => (
        <Pressable
          key={p.key}
          accessibilityRole="button"
          accessibilityLabel={`Review ${p.japanese}, ${p.romaji}, from ${p.sourceLabel}`}
          onPress={() => { setActiveIndex(idx); setMode('review'); }}
          style={({ pressed }) => [styles.listRow, { opacity: pressed ? 0.85 : 1 }]}
          testID={`review-row-${idx}`}
        >
          <Card shadow="card" style={styles.listCard}>
            <View style={styles.listHeader}>
              <Text style={styles.listSource}>{p.sourceLabel}</Text>
              <TranslationStatusBadge status={p.effectiveStatus} compact />
            </View>
            <Text style={styles.listJp}>{p.japanese}</Text>
            <Text style={styles.listRomaji}>{p.romaji}</Text>
            <Text style={styles.listEn} numberOfLines={2}>{p.english}</Text>
          </Card>
        </Pressable>
      ))}
      {filtered.length > 50 ? (
        <Text style={styles.muted}>Showing first 50 of {filtered.length}. Use filters to narrow down.</Text>
      ) : null}
      {filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyStateArt screen="lessons" size={160} />
          <Text style={styles.emptyTitle}>No drafts to review</Text>
          <Text style={styles.emptyBody}>Toggle off "draft only" or pick a different source.</Text>
        </View>
      ) : null}

      {toast ? <View style={styles.toast} accessibilityLiveRegion="polite"><Text style={styles.toastText}>{toast}</Text></View> : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  modeBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: ds.spacing.sm,
  },
  progressText: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.primary },
  jp: { fontSize: ds.type.display - 2, fontWeight: '900', color: ds.colors.brandInk, flexShrink: 1 },
  romaji: { fontSize: ds.type.body, color: ds.colors.brandInk, opacity: 0.85, marginTop: ds.spacing.xs, flexShrink: 1 },
  fieldLabel: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase' },
  fieldValue: { fontSize: ds.type.body, color: ds.colors.text, marginTop: ds.spacing.xs, lineHeight: 22 },
  input: {
    fontSize: ds.type.body, color: ds.colors.text, marginTop: ds.spacing.xs, lineHeight: 22,
    borderWidth: 1, borderColor: ds.colors.primary, borderRadius: ds.radius.sm,
    padding: ds.spacing.sm, minHeight: 44, backgroundColor: ds.colors.surface,
  },
  divider: { height: 1, backgroundColor: ds.colors.divider, marginVertical: ds.spacing.sm },
  actionRow: { flexDirection: 'row', gap: ds.spacing.sm },
  navRow: { flexDirection: 'row', gap: ds.spacing.sm, justifyContent: 'space-between' },
  toast: {
    position: 'absolute', bottom: 24, left: ds.spacing.lg, right: ds.spacing.lg,
    backgroundColor: ds.colors.text, paddingVertical: ds.spacing.sm, paddingHorizontal: ds.spacing.md,
    borderRadius: ds.radius.md, alignItems: 'center',
  },
  toastText: { color: ds.colors.surface, fontWeight: '900', fontSize: ds.type.caption },
  actionError: { color: ds.colors.danger, fontSize: ds.type.caption, lineHeight: 18, textAlign: 'center' },

  heroTitle: { fontSize: ds.type.title, fontWeight: '900', color: ds.colors.brandInk, flexShrink: 1 },
  heroMeta: { fontSize: ds.type.caption, fontWeight: '800', color: ds.colors.brandInk, opacity: 0.85, marginTop: ds.spacing.xs },
  heroNote: { fontSize: ds.type.caption, color: ds.colors.brandInk, opacity: 0.9, marginTop: ds.spacing.sm, lineHeight: 18, flexShrink: 1 },
  modeRow: { flexDirection: 'row', gap: ds.spacing.sm },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.sm, rowGap: ds.spacing.sm },
  sectionTitle: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase' },

  listRow: { marginBottom: ds.spacing.xs },
  listCard: { gap: ds.spacing.xs },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: ds.spacing.sm },
  listSource: { fontSize: ds.type.micro, color: ds.colors.textMuted, fontWeight: '800', textTransform: 'uppercase', flexShrink: 1 },
  listJp: { fontSize: ds.type.heading, fontWeight: '900', color: ds.colors.text },
  listRomaji: { fontSize: ds.type.body, color: ds.colors.primary, fontWeight: '800' },
  listEn: { fontSize: ds.type.body, color: ds.colors.textMuted, lineHeight: 20 },

  progressHero: { fontSize: ds.type.hero, fontWeight: '900', color: ds.colors.brandInk, textAlign: 'center' },
  progressHeroLabel: { fontSize: ds.type.caption, color: ds.colors.brandInk, opacity: 0.85, textAlign: 'center', marginTop: ds.spacing.xs },
  statLabel: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase' },
  statValue: { fontSize: ds.type.title, fontWeight: '900', color: ds.colors.text, marginTop: ds.spacing.xs },

  emptyWrap: { alignItems: 'center', justifyContent: 'center', gap: ds.spacing.md, paddingVertical: ds.spacing.xl },
  emptyTitle: { fontSize: ds.type.title, fontWeight: '900', color: ds.colors.text, textAlign: 'center' },
  emptyBody: { fontSize: ds.type.body, color: ds.colors.textMuted, textAlign: 'center', flexShrink: 1 },
  muted: { fontSize: ds.type.caption, color: ds.colors.textMuted, textAlign: 'center', padding: ds.spacing.md },
});
