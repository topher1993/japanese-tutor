import { useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter, NativeModules, PermissionsAndroid, Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { Card } from './Card';
import { Chip } from './Chip';
import { Icon } from './Icon';
import type { FlashcardReviewCard } from '../types/flashcard';
import { AUDIO_STUDY_GROUPS, AUDIO_STUDY_WORD_DELAY_MS, AUDIO_STUDY_WORD_DELAY_OPTIONS, buildAudioStudyPlaylist, getAudioStudyVoices, speakAudioStudyItem, type AudioStudyVoices } from '../services/audioStudyService';
import { learningGroupLabel, type VocabularyLearningGroup } from '../services/vocabularyTaxonomyService';
import { readingForSpeech } from '../services/speechPracticeService';
import { useUserProfileContext } from '../services/userProfileContext';
import { ds } from '../theme/designSystem';

type NativeAudioStudyService = {
  startLoop: (items: Array<{ reading: string; english: string }>, startIndex: number, loop: boolean, wordDelayMs: number) => Promise<void>;
  stopLoop: () => void;
};

const nativeAudioStudyService = Platform.OS === 'android'
  ? NativeModules.AudioStudyService as NativeAudioStudyService | undefined
  : undefined;

async function requestBackgroundAudioPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return true;
  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  if (await PermissionsAndroid.check(permission)) return true;
  const result = await PermissionsAndroid.request(permission, {
    title: 'Allow background audio?',
    message: 'Japanese Tutor uses a playback notification to keep an audio study loop running when you switch apps.',
    buttonPositive: 'Allow',
    buttonNegative: 'Use in-app audio',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export function AudioStudyPanel({ cards }: { cards: FlashcardReviewCard[] }) {
  const { profile, updateProfile } = useUserProfileContext();
  const [groups, setGroups] = useState<VocabularyLearningGroup[]>([...AUDIO_STUDY_GROUPS]);
  const [loop, setLoop] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [index, setIndex] = useState(0);
  const [wordDelayMs, setWordDelayMs] = useState(AUDIO_STUDY_WORD_DELAY_MS);
  const [voices, setVoices] = useState<AudioStudyVoices>({});
  const [playbackNotice, setPlaybackNotice] = useState<string | null>(null);
  const tokenRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playlist = useMemo(() => buildAudioStudyPlaylist(cards, groups), [cards, groups]);
  const current = playlist[index];

  useEffect(() => {
    const savedDelay = profile?.static.audioStudyDelayMs;
    if (savedDelay) setWordDelayMs(savedDelay);
  }, [profile?.static.audioStudyDelayMs]);

  useEffect(() => () => {
    tokenRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    nativeAudioStudyService?.stopLoop();
    void import('expo-speech').then(Speech => Speech.stop()).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!nativeAudioStudyService) return;
    const subscription = DeviceEventEmitter.addListener('AudioStudyProgress', (event: { index: number; playing: boolean }) => {
      setIndex(event.index);
      setStarting(false);
      setPlaying(event.playing);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let active = true;
    void getAudioStudyVoices().then(availableVoices => {
      if (active) setVoices(availableVoices);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (index >= playlist.length) setIndex(0);
    if (playing || starting) {
      tokenRef.current += 1;
      setStarting(false);
      setPlaying(false);
      nativeAudioStudyService?.stopLoop();
      void import('expo-speech').then(Speech => Speech.stop()).catch(() => undefined);
    }
  }, [groups, playlist.length]);

  function stop() {
    tokenRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setStarting(false);
    setPlaying(false);
    nativeAudioStudyService?.stopLoop();
    void import('expo-speech').then(Speech => Speech.stop()).catch(() => undefined);
  }

  function playWithExpo(cardIndex: number, token: number) {
    if (tokenRef.current !== token) return;
    setPlaying(true);
    speakAudioStudyItem(playlist[cardIndex], () => {
      if (tokenRef.current !== token) return;
      const next = cardIndex + 1;
      if (next < playlist.length) {
        timerRef.current = setTimeout(() => playFrom(next), wordDelayMs);
      } else if (loop) {
        timerRef.current = setTimeout(() => playFrom(0), wordDelayMs);
      } else {
        setPlaying(false);
      }
    }, () => {
      if (tokenRef.current === token) {
        setPlaying(false);
        setPlaybackNotice('Audio playback could not start on this device.');
      }
    }, voices, () => tokenRef.current !== token);
  }

  async function playWithNative(cardIndex: number, token: number) {
    if (!nativeAudioStudyService) return;
    setStarting(true);
    try {
      const permissionGranted = await requestBackgroundAudioPermission();
      if (tokenRef.current !== token) return;
      if (!permissionGranted) {
        setStarting(false);
        setPlaying(false);
        setPlaybackNotice('Notification permission was not granted, so this loop will continue only while in-app audio is available.');
        playWithExpo(cardIndex, token);
        return;
      }
      await nativeAudioStudyService.startLoop(
        playlist.map(item => ({
          reading: readingForSpeech(item.reading ?? item.romaji),
          english: item.english,
        })),
        cardIndex,
        loop,
        wordDelayMs,
      );
      if (tokenRef.current !== token) {
        nativeAudioStudyService.stopLoop();
        return;
      }
      setStarting(false);
      setPlaying(true);
    } catch {
      if (tokenRef.current !== token) return;
      setStarting(false);
      setPlaying(false);
      setPlaybackNotice('Background playback could not start, so the loop is continuing with in-app audio.');
      playWithExpo(cardIndex, token);
    }
  }

  function playFrom(cardIndex: number) {
    if (playlist.length === 0) return;
    const token = tokenRef.current + 1;
    tokenRef.current = token;
    setIndex(cardIndex);
    setPlaybackNotice(null);
    if (nativeAudioStudyService) {
      void playWithNative(cardIndex, token);
      return;
    }
    playWithExpo(cardIndex, token);
  }

  function toggleGroup(group: VocabularyLearningGroup) {
    setGroups(currentGroups => currentGroups.includes(group)
      ? currentGroups.filter(item => item !== group)
      : [...currentGroups, group]);
  }

  return (
    <Card shadow="card" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.icon}><Icon name="play" size={20} /></View>
        <View style={styles.copy}>
          <Text style={styles.title}>Audio study loop</Text>
          <Text style={styles.subtitle}>Japanese word first, then its English meaning. It can continue while you switch apps when the device allows background TTS.</Text>
        </View>
      </View>

      <Text style={styles.label}>Word types</Text>
      <View style={styles.chips}>
        {AUDIO_STUDY_GROUPS.map(group => (
          <Chip key={group} label={learningGroupLabel(group)} selected={groups.includes(group)} onPress={() => toggleGroup(group)} />
        ))}
        <Chip label="Loop" selected={loop} onPress={() => setLoop(value => !value)} />
      </View>

      <Text style={styles.label}>Processing delay</Text>
      <View style={styles.chips}>
        {AUDIO_STUDY_WORD_DELAY_OPTIONS.map(delay => (
          <Chip
            key={delay}
            label={`${delay / 1000}s`}
            selected={wordDelayMs === delay}
            onPress={() => {
              stop();
              setWordDelayMs(delay);
              void updateProfile({ static: { audioStudyDelayMs: delay } });
            }}
          />
        ))}
      </View>
      <Text style={styles.voiceInfo}>Choose a longer gap when you need more time to repeat each word.</Text>

      {nativeAudioStudyService ? (
        <Text style={styles.voiceInfo}>
          Background loop: Android system Japanese and English voices. In-app fallback: {voices.japaneseName ?? 'system Japanese'} / {voices.englishName ?? 'system English'}.
        </Text>
      ) : (
        <Text style={styles.voiceInfo}>
          Japanese voice: {voices.japaneseName ?? 'System voice'} / English voice: {voices.englishName ?? 'System voice'}
        </Text>
      )}
      {playbackNotice ? <Text style={styles.notice} accessibilityLiveRegion="polite">{playbackNotice}</Text> : null}

      {current ? (
        <View style={styles.current} accessibilityLiveRegion="polite">
          <Text style={styles.progress}>{index + 1} of {playlist.length}</Text>
          <Text style={styles.japanese}>{current.japanese}</Text>
          <Text style={styles.reading}>{current.reading ?? current.romaji}</Text>
          <Text style={styles.meaning}>{current.english}</Text>
        </View>
      ) : (
        <Text style={styles.empty}>Choose at least one word type to build the audio loop.</Text>
      )}

      <View style={styles.actions}>
        <Button
          fullWidth={false}
          style={styles.action}
          label={starting ? 'Starting loop…' : playing ? 'Pause loop' : 'Play loop'}
          icon="play"
          onPress={() => playing ? stop() : playFrom(index)}
          disabled={playlist.length === 0 || starting}
          testID="audio-study-play"
        />
        <Button fullWidth={false} style={styles.action} label="Stop" variant="soft" onPress={stop} disabled={!playing && !starting} testID="audio-study-stop" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: ds.spacing.sm, borderLeftWidth: 4, borderLeftColor: ds.colors.info },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: ds.spacing.sm },
  icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: ds.colors.infoSoft, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: ds.type.body, fontWeight: '900', color: ds.colors.text },
  subtitle: { fontSize: ds.type.caption, color: ds.colors.textMuted, lineHeight: 18, marginTop: ds.spacing.xs },
  label: { fontSize: ds.type.micro, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase' },
  voiceInfo: { fontSize: ds.type.micro, color: ds.colors.textMuted },
  notice: { fontSize: ds.type.micro, color: ds.colors.warningInk },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.xs },
  current: { alignItems: 'center', padding: ds.spacing.md, borderRadius: ds.radius.md, backgroundColor: ds.colors.surfaceAlt },
  progress: { fontSize: ds.type.micro, color: ds.colors.primary, fontWeight: '900', textTransform: 'uppercase' },
  japanese: { fontSize: 34, color: ds.colors.text, fontWeight: '900', marginTop: ds.spacing.xs },
  reading: { fontSize: ds.type.body, color: ds.colors.primary, fontWeight: '800' },
  meaning: { fontSize: ds.type.body, color: ds.colors.textMuted, textAlign: 'center', marginTop: ds.spacing.xs },
  empty: { fontSize: ds.type.caption, color: ds.colors.textMuted, paddingVertical: ds.spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.sm },
  action: { flex: 1, minWidth: 140, maxWidth: 320 },
});
