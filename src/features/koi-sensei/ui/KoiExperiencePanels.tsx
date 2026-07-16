import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { Mascot } from '../../../components/Mascot';
import { useLearningContext } from '../../../services/learningContext';
import { ds } from '../../../theme/designSystem';
import { localDateKey } from '../../../utils/localDate';
import { useKoiSenseiContext } from '../KoiSenseiContext';
import {
  KOI_COSMETICS,
  KOI_COSMETIC_SLOTS,
  getKoiUnlockedCosmetics,
  type KoiCosmeticSlot,
} from '../domain';
import {
  KOI_CARE_ACTIONS,
  KOI_LEAGUE_POINT_CAP,
  answerKoiDojoRound,
  applyKoiCareAction,
  buildGentleKoiLeagueStandings,
  buildKoiLocalDataExport,
  completeKoiDojoSession,
  createDefaultKoiPetSnapshot,
  equipKoiCosmetic,
  getKoiDojoQuestion,
  getKoiWeekKey,
  loadKoiDojoCatalog,
  prepareKoiDojoSession,
  type KoiActiveDojoSessionV1,
  type KoiDojoAnswerResult,
  type KoiDojoCatalogCard,
  type KoiDojoCompletionResult,
  type KoiLocalPreferencesV1,
  type KoiScoreBand,
} from '../data';

const SLOT_LABELS: Record<KoiCosmeticSlot, string> = {
  crest: 'Crest · vocabulary mastery',
  face: 'Face · grammar mastery',
  back: 'Back · phrase mastery',
  hand: 'Hand · quiz mastery',
};

function LoadingCard() {
  return (
    <Card tone="soft" shadow="none" style={styles.centeredCard}>
      <Mascot expression="thinking" size={72} />
      <Text style={styles.cardTitle}>Preparing Koi…</Text>
      <Text style={styles.bodyMuted}>Local progress is loading on this device.</Text>
    </Card>
  );
}

function ErrorNotice() {
  const koi = useKoiSenseiContext();
  if (!koi.error) return null;
  return <Text accessibilityRole="alert" style={styles.errorNotice}>{koi.error}</Text>;
}

export function KoiCarePanel() {
  const koi = useKoiSenseiContext();
  const [busyActionId, setBusyActionId] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState('Care is optional. Koi stays content while you are away.');
  if (!koi.state) return <LoadingCard />;

  const state = koi.state;
  const petSnapshot = state.petSnapshot ?? createDefaultKoiPetSnapshot();
  const today = localDateKey();

  const care = async (actionId: (typeof KOI_CARE_ACTIONS)[number]['id']) => {
    if (busyActionId) return;
    setBusyActionId(actionId);
    try {
      const result = applyKoiCareAction(petSnapshot, state.experience, actionId, today);
      setFeedback(result.response);
      if (result.applied) {
        await koi.saveActivityState(result.petSnapshot, result.experience, state.activeDojoSession);
      }
    } catch {
      setFeedback('Koi could not save that care moment. Your previous progress is still safe.');
    } finally {
      setBusyActionId(null);
    }
  };

  return (
    <>
      <ErrorNotice />
      <Card tone="brand" shadow="hero" style={styles.careHero}>
        <Mascot expression="happy" size={92} />
        <View style={styles.flexCopy}>
          <Text style={styles.brandEyebrow}>CALM BOND</Text>
          <Text style={styles.brandTitle}>{petSnapshot.bond} bond</Text>
          <Text style={styles.brandBody}>No hunger, no decay, and no punishment for taking a break.</Text>
        </View>
      </Card>

      <Card tone="soft" shadow="none" style={styles.feedbackCard}>
        <Text accessibilityLiveRegion="polite" style={styles.feedbackText}>{feedback}</Text>
      </Card>

      {KOI_CARE_ACTIONS.map(action => {
        const completedToday = state.experience.care.lastInteractionDateByAction[action.id] === today;
        return (
          <Pressable
            key={action.id}
            accessibilityRole="button"
            accessibilityLabel={`${action.label}. ${action.description}${completedToday ? ' Completed today.' : ''}`}
            accessibilityState={{ disabled: completedToday || busyActionId !== null }}
            disabled={completedToday || busyActionId !== null}
            onPress={() => { void care(action.id); }}
            style={({ pressed }) => [
              styles.actionCard,
              completedToday && styles.completedCard,
              pressed && styles.pressed,
            ]}
            testID={`koi-care-${action.id}`}
          >
            <View style={styles.actionCopy}>
              <Text style={styles.cardTitle}>{action.label}</Text>
              <Text style={styles.bodyMuted}>{action.description}</Text>
            </View>
            <Text style={styles.rewardLabel}>{completedToday ? 'Shared today' : `+${action.bondReward} bond`}</Text>
          </Pressable>
        );
      })}

      <Text style={styles.disclaimer}>
        Each care moment can build bond once per local day. Missing a day never removes progress.
      </Text>
    </>
  );
}

export function KoiClosetPanel() {
  const koi = useKoiSenseiContext();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState('Cosmetics are earned only through learning milestones.');
  if (!koi.state) return <LoadingCard />;

  const state = koi.state;
  const petSnapshot = state.petSnapshot ?? createDefaultKoiPetSnapshot();
  const unlocked = getKoiUnlockedCosmetics(petSnapshot.progression);
  const unlockedIds = new Set(unlocked.map(item => item.id));

  const toggleCosmetic = async (cosmetic: (typeof KOI_COSMETICS)[number]) => {
    if (busyId || !unlockedIds.has(cosmetic.id)) return;
    setBusyId(cosmetic.id);
    try {
      const wasEquipped = petSnapshot.equippedCosmeticIds[cosmetic.slot] === cosmetic.id;
      const next = equipKoiCosmetic(petSnapshot, cosmetic);
      await koi.saveActivityState(next, state.experience, state.activeDojoSession);
      setStatus(wasEquipped ? `${cosmetic.label} removed.` : `${cosmetic.label} equipped.`);
    } catch {
      setStatus('Koi could not update the closet. Your previous outfit is still safe.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <ErrorNotice />
      <Card tone="warm" shadow="none" style={styles.feedbackCard}>
        <Text style={styles.cardTitle}>{unlocked.length} of 24 unlocked</Text>
        <Text accessibilityLiveRegion="polite" style={styles.bodyMuted}>{status}</Text>
        <Text style={styles.bodyMuted}>There are no Koi cosmetic purchases and no league-only items.</Text>
      </Card>

      {KOI_COSMETIC_SLOTS.map(slot => (
        <View key={slot} style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>{SLOT_LABELS[slot]}</Text>
          {KOI_COSMETICS.filter(item => item.slot === slot).map(cosmetic => {
            const isUnlocked = unlockedIds.has(cosmetic.id);
            const selected = petSnapshot.equippedCosmeticIds[slot] === cosmetic.id;
            const requirement = cosmetic.unlock.kind === 'starter'
              ? 'Starter item'
              : `${cosmetic.unlock.rank} ${cosmetic.unlock.domain} mastery`;
            return (
              <Pressable
                key={cosmetic.id}
                accessibilityRole="button"
                accessibilityLabel={`${cosmetic.label}. ${requirement}. ${isUnlocked ? selected ? 'Equipped' : 'Unlocked' : 'Locked'}.`}
                accessibilityState={{ disabled: !isUnlocked || busyId !== null, selected }}
                disabled={!isUnlocked || busyId !== null}
                onPress={() => { void toggleCosmetic(cosmetic); }}
                style={({ pressed }) => [
                  styles.cosmeticRow,
                  selected && styles.selectedRow,
                  !isUnlocked && styles.lockedRow,
                  pressed && styles.pressed,
                ]}
                testID={`koi-cosmetic-${cosmetic.id}`}
              >
                <View style={styles.actionCopy}>
                  <Text style={styles.cardTitle}>{cosmetic.label}</Text>
                  <Text style={styles.bodyMuted}>{requirement}</Text>
                </View>
                <Text style={[styles.statusPill, selected && styles.statusPillSelected]}>
                  {selected ? 'Wearing' : isUnlocked ? 'Wear' : 'Locked'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </>
  );
}

function scoreBand(score: number): KoiScoreBand {
  const percent = score / 5;
  if (percent >= 0.8) return '80_plus';
  if (percent >= 0.7) return '70_79';
  if (percent >= 0.5) return '50_69';
  return 'under_50';
}

export function KoiDojoPanel() {
  const koi = useKoiSenseiContext();
  const learning = useLearningContext();
  const [busy, setBusy] = React.useState(false);
  const [feedback, setFeedback] = React.useState<KoiDojoAnswerResult | null>(null);
  const [completion, setCompletion] = React.useState<KoiDojoCompletionResult | null>(null);
  const [catalog, setCatalog] = React.useState<KoiDojoCatalogCard[]>([]);
  const [catalogSessionId, setCatalogSessionId] = React.useState<string | null>(null);
  const [catalogError, setCatalogError] = React.useState<string | null>(null);
  const activeSession = koi.state?.activeDojoSession ?? null;

  React.useEffect(() => {
    if (!activeSession || activeSession.currentRound >= activeSession.questionContentIds.length) {
      if (!activeSession) {
        setCatalog([]);
        setCatalogSessionId(null);
        setCatalogError(null);
      }
      return undefined;
    }
    if (catalogSessionId === activeSession.sessionId && (catalog.length > 0 || catalogError)) return undefined;
    let cancelled = false;
    setCatalogError(null);
    void loadKoiDojoCatalog(activeSession.rank).then(loaded => {
      if (cancelled) return;
      setCatalog(loaded);
      setCatalogSessionId(activeSession.sessionId);
    }).catch(() => {
      if (cancelled) return;
      setCatalog([]);
      setCatalogSessionId(activeSession.sessionId);
      setCatalogError('Koi could not reopen the governed vocabulary catalog on this device.');
    });
    return () => { cancelled = true; };
  }, [activeSession?.sessionId, activeSession?.rank, catalog.length, catalogError, catalogSessionId]);

  if (!koi.state) return <LoadingCard />;

  const state = koi.state;
  const petSnapshot = state.petSnapshot ?? createDefaultKoiPetSnapshot();
  const session = state.activeDojoSession;

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setCompletion(null);
    try {
      const prepared = await prepareKoiDojoSession(petSnapshot.progression.currentRank, {
        srs: learning.srs,
      });
      await koi.saveActivityState(petSnapshot, state.experience, prepared.session);
      setCatalog(prepared.catalog);
      setCatalogSessionId(prepared.session.sessionId);
      setCatalogError(null);
    } catch {
      // The shared context exposes the storage error without leaving an unhandled rejection.
    } finally {
      setBusy(false);
    }
  };

  const answer = async (choiceId: string) => {
    if (!session || feedback || busy || catalogSessionId !== session.sessionId) return;
    setBusy(true);
    try {
      const result = answerKoiDojoRound(session, choiceId, catalog);
      await koi.saveActivityState(petSnapshot, state.experience, result.session);
      setFeedback(result);
    } catch {
      // The round remains resumable from the last successfully persisted checkpoint.
    } finally {
      setBusy(false);
    }
  };

  const finish = async (completedSession: KoiActiveDojoSessionV1) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = completeKoiDojoSession(completedSession, petSnapshot, state.experience, {
        leagueEnabled: state.preferences.leagueParticipationEnabled,
        weekKey: getKoiWeekKey(),
      });
      await koi.saveActivityState(result.petSnapshot, result.experience, null);
      if (result.applied) {
        try {
          await koi.enqueueClaim({
            schemaVersion: 1,
            kind: 'study_reward',
            claimId: `${completedSession.sessionId}.reward`,
            eventType: 'dojo_completion',
            sourceId: completedSession.sessionId,
            occurredAt: completedSession.updatedAt,
            count: 1,
            scoreBand: scoreBand(result.score),
          });
        } catch {
          // The local result is already safe; a bounded content-free reward claim can retry later.
        }
      }
      setFeedback(null);
      setCompletion(result);
    } catch {
      // ErrorNotice reports the persistence failure; no partial UI reward is shown.
    } finally {
      setBusy(false);
    }
  };

  if (completion) {
    return (
      <>
        <ErrorNotice />
        <Card tone="success" shadow="hero" style={styles.centeredCard}>
          <Mascot expression={completion.score >= 4 ? 'celebrate' : 'encourage'} size={92} />
          <Text accessibilityRole="header" style={styles.resultScore}>{completion.score} / 5</Text>
          <Text style={styles.cardTitle}>Dojo complete</Text>
          <Text style={styles.bodyMuted}>
            +{completion.coinReward} coins · +{completion.bondReward} bond
            {completion.leaguePointReward ? ` · +${completion.leaguePointReward} league points` : ''}
          </Text>
          <Button label="Practice another five" onPress={() => { void start(); }} disabled={busy} />
        </Card>
      </>
    );
  }

  if (!session) {
    return (
      <>
        <ErrorNotice />
        <Card tone="brand" shadow="hero" style={styles.centeredCard}>
          <Mascot expression="happy" size={92} />
          <Text style={styles.brandTitle}>Five calm vocabulary rounds</Text>
          <Text style={styles.brandBody}>Untimed, offline, and one answer at a time. No AI allowance is used.</Text>
        </Card>
        <Card tone="soft" shadow="none" style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{state.experience.dojo.completedSessions}</Text>
            <Text style={styles.statLabel}>sessions</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{state.experience.dojo.bestScore}/5</Text>
            <Text style={styles.statLabel}>best score</Text>
          </View>
        </Card>
        <Button label="Begin five rounds" icon="practice" onPress={() => { void start(); }} disabled={busy} testID="koi-dojo-start" />
        <Text style={styles.disclaimer}>A started session stores only content IDs and correctness so it can resume safely.</Text>
      </>
    );
  }

  if (session.currentRound >= session.questionContentIds.length) {
    return (
      <Card tone="success" shadow="hero" style={styles.centeredCard}>
        <Text style={styles.resultScore}>{session.correctContentIds.length} / 5</Text>
        <Text style={styles.bodyMuted}>All rounds are answered. Save this result to Koi’s local progress.</Text>
        <Button label="Collect dojo result" onPress={() => { void finish(session); }} disabled={busy} testID="koi-dojo-finish" />
      </Card>
    );
  }

  if (catalogSessionId !== session.sessionId) return <LoadingCard />;

  if (catalogError) {
    return (
      <Card tone="warm" shadow="hero" style={styles.centeredCard}>
        <Mascot expression="encourage" size={84} />
        <Text accessibilityRole="alert" style={styles.cardTitle}>Vocabulary needs to be reopened</Text>
        <Text style={styles.bodyMuted}>{catalogError} Your saved checkpoint still contains IDs only.</Text>
        <Button label="Start a fresh five" onPress={() => { void start(); }} disabled={busy} />
      </Card>
    );
  }

  if (feedback) {
    const isLast = feedback.session.currentRound === feedback.session.questionContentIds.length;
    return (
      <Card tone={feedback.correct ? 'success' : 'warm'} shadow="hero" style={styles.centeredCard}>
        <Mascot expression={feedback.correct ? 'celebrate' : 'encourage'} size={84} />
        <Text accessibilityLiveRegion="assertive" style={styles.resultScore}>{feedback.correct ? 'Correct!' : 'Keep going'}</Text>
        <Text style={styles.bodyMuted}>The answer is “{feedback.correctLabel}”. Nothing is lost for a mistake.</Text>
        <Button
          label={isLast ? 'See dojo result' : 'Next round'}
          onPress={() => {
            if (isLast) void finish(feedback.session);
            else setFeedback(null);
          }}
          disabled={busy}
          testID="koi-dojo-continue"
        />
      </Card>
    );
  }

  let question;
  try {
    question = getKoiDojoQuestion(session, catalog);
  } catch {
    question = undefined;
  }
  if (!question) {
    return (
      <Card tone="warm" shadow="hero" style={styles.centeredCard}>
        <Mascot expression="encourage" size={84} />
        <Text accessibilityRole="alert" style={styles.cardTitle}>This round is no longer in the catalog</Text>
        <Text style={styles.bodyMuted}>Your ID-only checkpoint is safe. Start a fresh five from the current governed vocabulary.</Text>
        <Button label="Start a fresh five" onPress={() => { void start(); }} disabled={busy} />
      </Card>
    );
  }
  return (
    <>
      <View style={styles.roundHeader}>
        <Text style={styles.sectionTitle}>Round {session.currentRound + 1} of 5</Text>
        <Text style={styles.bodyMuted}>{session.correctContentIds.length} correct so far</Text>
      </View>
      <Card shadow="hero" style={styles.questionCard}>
        <Text accessibilityLabel={`${question.prompt}, ${question.reading}`} style={styles.japanesePrompt}>{question.prompt}</Text>
        <Text style={styles.reading}>{question.reading}</Text>
        <Text style={styles.bodyMuted}>Choose the meaning.</Text>
      </Card>
      <View style={styles.choiceGrid}>
        {question.choices.map(choice => (
          <Pressable
            key={choice.id}
            accessibilityRole="button"
            accessibilityLabel={choice.label}
            disabled={busy}
            onPress={() => { void answer(choice.id); }}
            style={({ pressed }) => [styles.answerChoice, pressed && styles.pressed]}
            testID={`koi-dojo-choice-${choice.id}`}
          >
            <Text style={styles.answerText}>{choice.label}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

export function KoiLeaguePanel() {
  const koi = useKoiSenseiContext();
  const [busy, setBusy] = React.useState(false);
  if (!koi.state) return <LoadingCard />;
  const state = koi.state;
  const enabled = state.preferences.leagueParticipationEnabled;
  const weekKey = getKoiWeekKey();
  const standings = buildGentleKoiLeagueStandings(state.experience, weekKey);
  const learnerPosition = standings.findIndex(item => item.isLearner) + 1;
  const learnerPoints = standings.find(item => item.isLearner)?.points ?? 0;

  const setParticipation = async (value: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await koi.savePreferences({ leagueParticipationEnabled: value });
    } catch {
      // ErrorNotice reports the failure and the prior consent choice remains in effect.
    } finally {
      setBusy(false);
    }
  };

  if (!enabled) {
    return (
      <>
        <ErrorNotice />
        <Card tone="brand" shadow="hero" style={styles.centeredCard}>
          <Mascot expression="happy" size={88} />
          <Text style={styles.brandTitle}>A gentle weekly cohort</Text>
          <Text style={styles.brandBody}>Use the pseudonym “{state.experience.league.alias}”. No real name, chat, public profile, demotion, or league cosmetics.</Text>
        </Card>
        <Button label="Join with pseudonym" onPress={() => { void setParticipation(true); }} disabled={busy} testID="koi-league-join" />
        <Text style={styles.disclaimer}>This local-first preview keeps the cohort on this device until secure league sync is available.</Text>
      </>
    );
  }

  return (
    <>
      <ErrorNotice />
      <Card tone="soft" shadow="none" style={styles.leagueSummary}>
        <View>
          <Text style={styles.cardTitle}>{state.experience.league.alias}</Text>
          <Text style={styles.bodyMuted}>{weekKey} · position {learnerPosition} of {standings.length}</Text>
        </View>
        <View style={styles.pointsBlock}>
          <Text style={styles.statValue}>{learnerPoints}</Text>
          <Text style={styles.statLabel}>of {KOI_LEAGUE_POINT_CAP} points</Text>
        </View>
      </Card>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Study cohort</Text>
        {standings.map((standing, index) => (
          <View key={standing.alias} style={[styles.standingRow, standing.isLearner && styles.selectedRow]}>
            <Text accessibilityLabel={`Position ${index + 1}`} style={styles.position}>{index + 1}</Text>
            <Text style={styles.standingAlias}>{standing.alias}{standing.isLearner ? ' · You' : ''}</Text>
            <Text style={styles.standingPoints}>{standing.points} pts</Text>
          </View>
        ))}
      </View>

      <Card tone="warm" shadow="none" style={styles.feedbackCard}>
        <Text style={styles.cardTitle}>Kind by design</Text>
        <Text style={styles.bodyMuted}>Points are capped, nobody is demoted, and rankings never unlock cosmetics. Your learning remains the goal.</Text>
      </Card>
      <Button label="Leave weekly cohort" variant="ghost" onPress={() => { void setParticipation(false); }} disabled={busy} testID="koi-league-leave" />
    </>
  );
}

function PreferenceSwitch({
  label,
  description,
  value,
  onValueChange,
  testID,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  testID: string;
}) {
  return (
    <View style={styles.preferenceRow}>
      <View style={styles.actionCopy}>
        <Text style={styles.cardTitle}>{label}</Text>
        <Text style={styles.bodyMuted}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityRole="switch"
        onValueChange={onValueChange}
        testID={testID}
        thumbColor={ds.colors.surface}
        trackColor={{ false: ds.colors.border, true: ds.colors.success }}
        value={value}
      />
    </View>
  );
}

function PreferenceChoice({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.choicePill, selected && styles.choicePillSelected, pressed && styles.pressed]}
      testID={testID}
    >
      <Text style={[styles.choicePillText, selected && styles.choicePillTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function KoiSettingsPanel() {
  const koi = useKoiSenseiContext();
  const [exportText, setExportText] = React.useState('');
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [confirmCloudDelete, setConfirmCloudDelete] = React.useState(false);
  const [status, setStatus] = React.useState('');
  if (!koi.state) return <LoadingCard />;
  const state = koi.state;
  const preferences = state.preferences;

  const save = (patch: Partial<KoiLocalPreferencesV1>) => {
    void koi.savePreferences(patch).catch(() => undefined);
  };

  const deleteLocalData = async () => {
    try {
      await koi.resetLocalState();
      setExportText('');
      setConfirmDelete(false);
      setStatus('Koi data was deleted from this device.');
    } catch {
      setStatus('Koi data could not be deleted. Nothing was partially cleared.');
    }
  };

  const prepareCloudExport = async () => {
    try {
      setExportText(await koi.exportCloudData());
      setStatus('A selectable cloud Koi export is ready below.');
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : 'Cloud Koi data could not be exported.');
    }
  };

  const deleteCloudData = async () => {
    try {
      await koi.deleteCloudAccount();
      setExportText('');
      setConfirmCloudDelete(false);
      setStatus('Cloud and local Koi account data were deleted.');
    } catch (cause) {
      setStatus(cause instanceof Error
        ? `${cause.message} A local retry marker was kept.`
        : 'Cloud deletion could not be confirmed. A local retry marker was kept.');
    }
  };

  return (
    <>
      <ErrorNotice />
      {status ? <Text accessibilityLiveRegion="polite" style={styles.successNotice}>{status}</Text> : null}

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Avatar and effects</Text>
        <Card shadow="none" style={styles.settingsCard}>
          <Text style={styles.cardTitle}>Avatar mode</Text>
          <Text style={styles.bodyMuted}>The 2D avatar remains a complete fallback when 3D is unavailable.</Text>
          <View style={styles.segmentRow}>
            <PreferenceChoice label="3D when available" selected={preferences.avatarMode === '3d'} onPress={() => save({ avatarMode: '3d' })} testID="koi-setting-avatar-3d" />
            <PreferenceChoice label="Always 2D" selected={preferences.avatarMode === '2d'} onPress={() => save({ avatarMode: '2d' })} testID="koi-setting-avatar-2d" />
          </View>
        </Card>
        <Card shadow="none" style={styles.settingsCard}>
          <Text style={styles.cardTitle}>Rank effects</Text>
          <Text style={styles.bodyMuted}>Choose full, reduced/static, or off. Learning information never depends on an effect.</Text>
          <View style={styles.segmentRow}>
            <PreferenceChoice label="Full" selected={preferences.effectPreference === 'full'} onPress={() => save({ effectPreference: 'full' })} testID="koi-setting-effects-full" />
            <PreferenceChoice label="Reduced" selected={preferences.effectPreference === 'reduced'} onPress={() => save({ effectPreference: 'reduced' })} testID="koi-setting-effects-reduced" />
            <PreferenceChoice label="Off" selected={preferences.effectPreference === 'off'} onPress={() => save({ effectPreference: 'off' })} testID="koi-setting-effects-off" />
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Voice</Text>
        <Card shadow="none" style={styles.settingsCard}>
          <PreferenceSwitch
            label="Voice playback"
            description="Allow Koi to speak replies with the included system voice fallback."
            value={preferences.voicePlaybackEnabled}
            onValueChange={value => save({ voicePlaybackEnabled: value, ...(value ? {} : { voiceAutoplayEnabled: false }) })}
            testID="koi-setting-voice-playback"
          />
          <PreferenceSwitch
            label="Autoplay replies"
            description="Play spoken replies automatically when voice playback is on."
            value={preferences.voicePlaybackEnabled && preferences.voiceAutoplayEnabled}
            onValueChange={value => save({ voiceAutoplayEnabled: preferences.voicePlaybackEnabled && value })}
            testID="koi-setting-voice-autoplay"
          />
          <PreferenceSwitch
            label="Device speech-to-text"
            description="Use the device recognizer. Raw audio is never stored by Koi."
            value={preferences.speechToTextEnabled}
            onValueChange={value => save({ speechToTextEnabled: value })}
            testID="koi-setting-stt"
          />
        </Card>
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Privacy and consent</Text>
        <Card shadow="none" style={styles.settingsCard}>
          <PreferenceSwitch
            label="Detailed learning context"
            description="Optional consent to share detailed in-app progress with Koi after secure sync is enabled. Off by default."
            value={preferences.detailedProgressConsent}
            onValueChange={value => save({ detailedProgressConsent: value })}
            testID="koi-setting-progress-consent"
          />
          <PreferenceSwitch
            label="Pseudonymous league"
            description="Join as Quiet Koi 27. No real name, chat, public profile, or cosmetic rewards."
            value={preferences.leagueParticipationEnabled}
            onValueChange={value => save({ leagueParticipationEnabled: value })}
            testID="koi-setting-league-consent"
          />
          <Text style={styles.disclaimer}>Koi memories are never saved unless you approve them individually in chat.</Text>
        </Card>
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Your data</Text>
        <Card shadow="none" style={styles.settingsCard}>
          <Text style={styles.cardTitle}>Local data export</Text>
          <Text style={styles.bodyMuted}>Prepare a selectable JSON copy of your Koi preferences, pet progress, chat, and dojo checkpoint.</Text>
          <Button
            label={exportText ? 'Refresh local export' : 'Prepare local export'}
            variant="secondary"
            onPress={() => setExportText(buildKoiLocalDataExport(state))}
            testID="koi-data-export"
          />
          {exportText ? <Text selectable style={styles.exportText} testID="koi-data-export-text">{exportText}</Text> : null}
        </Card>

        <Card tone="danger" shadow="none" style={styles.settingsCard}>
          <Text style={styles.cardTitle}>Delete Koi data on this device</Text>
          <Text style={styles.bodyMuted}>This clears local chat, pet state, care history, dojo sessions, and queued offline claims. It cannot be undone.</Text>
          {confirmDelete ? (
            <View style={styles.deleteActions}>
              <Button label="Confirm local deletion" variant="danger" onPress={() => { void deleteLocalData(); }} testID="koi-data-delete-confirm" />
              <Button label="Cancel" variant="ghost" onPress={() => setConfirmDelete(false)} />
            </View>
          ) : (
            <Button label="Delete local Koi data" variant="danger" onPress={() => setConfirmDelete(true)} testID="koi-data-delete" />
          )}
          <Text style={styles.disclaimer}>This action does not silently delete a signed-in cloud account.</Text>
        </Card>

        {koi.runtimeStage !== 'mock' && koi.liveAuth.authenticated ? (
          <Card tone="danger" shadow="none" style={styles.settingsCard}>
            <Text style={styles.cardTitle}>Signed-in cloud Koi data</Text>
            <Text style={styles.bodyMuted}>Export the server copy or delete chat, memories, reports, context, pet sync, and beta registration.</Text>
            <Button
              label="Prepare cloud export"
              variant="secondary"
              onPress={() => { void prepareCloudExport(); }}
              testID="koi-cloud-data-export"
            />
            {confirmCloudDelete ? (
              <View style={styles.deleteActions}>
                <Button label="Confirm cloud and local deletion" variant="danger" onPress={() => { void deleteCloudData(); }} testID="koi-cloud-data-delete-confirm" />
                <Button label="Cancel" variant="ghost" onPress={() => setConfirmCloudDelete(false)} />
              </View>
            ) : (
              <Button label="Delete signed-in Koi account data" variant="danger" onPress={() => setConfirmCloudDelete(true)} testID="koi-cloud-data-delete" />
            )}
            <Text style={styles.disclaimer}>A content-free retry marker remains on this device until the server confirms deletion.</Text>
          </Card>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  centeredCard: { alignItems: 'center', gap: ds.spacing.md, padding: ds.spacing.lg },
  flexCopy: { flex: 1, minWidth: 0, gap: ds.spacing.xs },
  cardTitle: { color: ds.colors.text, fontSize: ds.type.heading, fontWeight: '900', lineHeight: 24 },
  bodyMuted: { color: ds.colors.textMuted, fontSize: ds.type.caption, lineHeight: 19 },
  brandEyebrow: { color: ds.colors.warmSoft, fontSize: ds.type.micro, fontWeight: '900', letterSpacing: 0.8 },
  brandTitle: { color: ds.colors.brandInk, fontSize: ds.type.title, fontWeight: '900', textAlign: 'center' },
  brandBody: { color: ds.colors.brandInk, fontSize: ds.type.caption, lineHeight: 19, opacity: 0.92, textAlign: 'center' },
  careHero: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.md, padding: ds.spacing.lg },
  feedbackCard: { gap: ds.spacing.xs },
  feedbackText: { color: ds.colors.brandDark, fontSize: ds.type.body, lineHeight: 22, fontWeight: '700' },
  actionCard: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ds.spacing.md,
    padding: ds.spacing.md,
    borderRadius: ds.radius.lg,
    backgroundColor: ds.colors.surface,
    ...ds.shadow.card,
  },
  actionCopy: { flex: 1, minWidth: 0, gap: ds.spacing.xs },
  rewardLabel: { color: ds.colors.brandDark, fontSize: ds.type.caption, fontWeight: '900', textAlign: 'right' },
  completedCard: { backgroundColor: ds.colors.successSoft, opacity: 0.82 },
  pressed: { opacity: 0.84 },
  disclaimer: { color: ds.colors.textMuted, fontSize: ds.type.micro, lineHeight: 16, textAlign: 'center' },
  errorNotice: { color: ds.colors.danger, backgroundColor: ds.colors.dangerSoft, padding: ds.spacing.sm, borderRadius: ds.radius.md, fontSize: ds.type.caption },
  successNotice: { color: ds.colors.brandDark, backgroundColor: ds.colors.successSoft, padding: ds.spacing.sm, borderRadius: ds.radius.md, fontSize: ds.type.caption, fontWeight: '800' },
  section: { gap: ds.spacing.sm },
  sectionTitle: { color: ds.colors.text, fontSize: ds.type.heading, fontWeight: '900' },
  cosmeticRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ds.spacing.sm,
    padding: ds.spacing.md,
    borderRadius: ds.radius.lg,
    borderWidth: 1,
    borderColor: ds.colors.border,
    backgroundColor: ds.colors.surface,
  },
  selectedRow: { borderColor: ds.colors.success, backgroundColor: ds.colors.successSoft },
  lockedRow: { backgroundColor: ds.colors.surfaceAlt, opacity: 0.66 },
  statusPill: { color: ds.colors.textMuted, backgroundColor: ds.colors.surfaceAlt, borderRadius: ds.radius.pill, paddingHorizontal: ds.spacing.sm, paddingVertical: ds.spacing.xs, fontSize: ds.type.micro, fontWeight: '900', overflow: 'hidden' },
  statusPillSelected: { color: ds.colors.brandDark, backgroundColor: ds.colors.successSoft },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statBlock: { alignItems: 'center', gap: ds.spacing.xs },
  statValue: { color: ds.colors.brandDark, fontSize: ds.type.title, fontWeight: '900' },
  statLabel: { color: ds.colors.textMuted, fontSize: ds.type.micro, fontWeight: '800' },
  resultScore: { color: ds.colors.brandDark, fontSize: ds.type.display, fontWeight: '900', textAlign: 'center' },
  roundHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: ds.spacing.sm },
  questionCard: { alignItems: 'center', gap: ds.spacing.sm, padding: ds.spacing.xl },
  japanesePrompt: { color: ds.colors.text, fontSize: ds.type.kanji, fontWeight: '900' },
  reading: { color: ds.colors.brandDark, fontSize: ds.type.heading, fontWeight: '800' },
  choiceGrid: { gap: ds.spacing.sm },
  answerChoice: { minHeight: ds.touch.comfortable, alignItems: 'center', justifyContent: 'center', padding: ds.spacing.md, borderRadius: ds.radius.lg, borderWidth: 1, borderColor: ds.colors.border, backgroundColor: ds.colors.surface, ...ds.shadow.card },
  answerText: { color: ds.colors.text, fontSize: ds.type.body, fontWeight: '900' },
  leagueSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: ds.spacing.md },
  pointsBlock: { alignItems: 'flex-end' },
  standingRow: { minHeight: ds.touch.min, flexDirection: 'row', alignItems: 'center', gap: ds.spacing.sm, paddingHorizontal: ds.spacing.md, borderRadius: ds.radius.md, backgroundColor: ds.colors.surface },
  position: { width: 28, color: ds.colors.textMuted, fontSize: ds.type.caption, fontWeight: '900' },
  standingAlias: { flex: 1, color: ds.colors.text, fontSize: ds.type.body, fontWeight: '800' },
  standingPoints: { color: ds.colors.brandDark, fontSize: ds.type.caption, fontWeight: '900' },
  settingsCard: { gap: ds.spacing.md },
  preferenceRow: { minHeight: ds.touch.comfortable, flexDirection: 'row', alignItems: 'center', gap: ds.spacing.md, paddingVertical: ds.spacing.xs },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.sm },
  choicePill: { minHeight: ds.touch.min, flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: ds.spacing.md, borderRadius: ds.radius.pill, borderWidth: 1, borderColor: ds.colors.border, backgroundColor: ds.colors.surfaceAlt },
  choicePillSelected: { borderColor: ds.colors.brand, backgroundColor: ds.colors.brandSoft },
  choicePillText: { color: ds.colors.textMuted, fontSize: ds.type.caption, fontWeight: '900' },
  choicePillTextSelected: { color: ds.colors.brandDark },
  exportText: { maxHeight: 280, color: ds.colors.text, backgroundColor: ds.colors.surfaceAlt, borderRadius: ds.radius.md, padding: ds.spacing.sm, fontFamily: 'monospace', fontSize: ds.type.micro, lineHeight: 16 },
  deleteActions: { gap: ds.spacing.sm },
});
