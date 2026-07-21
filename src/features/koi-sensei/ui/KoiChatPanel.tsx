import React from 'react';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import {
  EncodingType,
  cacheDirectory,
  deleteAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { ScreenScaffold } from '../../../components/ScreenScaffold';
import {
  speakKoiReplyText,
} from '../../../services/speechPracticeService';
import { koiLatencyBucket, trackKoiEvent } from '../analytics';
import { createKoiUuid, getKoiSystemVoiceText } from '../api';
import {
  KOI_DEFAULT_SPEECH_INPUT_LOCALE,
  createExpoKoiDeviceSttAdapter,
  prepareKoiCloudAudioSource,
  type KoiDeviceSttSession,
} from '../media';
import { ds } from '../../../theme/designSystem';
import { useKoiSenseiContext } from '../KoiSenseiContext';
import {
  KOI_CURRENT_AI_POLICY_VERSION,
  KOI_CURRENT_PRIVACY_POLICY_VERSION,
  type KoiAgeBand,
} from '../data';

export function KoiChatPanel({ onBack }: { onBack: () => void }) {
  const koi = useKoiSenseiContext();

  if (!koi.ready || !koi.state) {
    return (
      <ScreenScaffold>
        <ScreenHeader title="Koi Sensei" subtitle="Preparing private local storage" onBack={onBack} />
        <Card><Text style={styles.body}>Preparing Koi chat…</Text></Card>
      </ScreenScaffold>
    );
  }

  if (!koi.eligibility.eligible) {
    if (koi.eligibility.reason === 'under16') {
      return <Under16Notice onBack={onBack} />;
    }
    return <KoiEligibilityForm onBack={onBack} />;
  }

  if (koi.runtimeStage !== 'mock' && !koi.liveAuth.authenticated) {
    return <KoiEmailLinkGate onBack={onBack} />;
  }

  if (koi.runtimeStage !== 'mock' && koi.liveAuth.enrollmentStatus !== 'active') {
    return <KoiEnrollmentGate onBack={onBack} />;
  }

  return <EligibleKoiChat onBack={onBack} />;
}

function KoiEmailLinkGate({ onBack }: { onBack: () => void }) {
  const koi = useKoiSenseiContext();
  const [email, setEmail] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState('');

  const act = async (kind: 'send' | 'complete') => {
    if (busy) return;
    setBusy(true);
    setStatus('');
    try {
      if (kind === 'send') {
        await koi.sendEmailSignInLink(email);
        setStatus('Sign-in link sent. Open it on this device, then return here.');
      } else {
        await koi.completeEmailSignIn(email);
        setStatus('Email verified. Joining the capped Koi beta…');
      }
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : 'Koi email-link sign-in could not complete.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenScaffold>
      <ScreenHeader title="Koi Sensei" subtitle="Verified email-link sign-in" onBack={onBack} />
      <Card tone="brand" shadow="hero" style={styles.sectionCard}>
        <Text accessibilityRole="header" style={styles.brandTitle}>Sign in for the 50-person Koi beta</Text>
        <Text style={styles.body}>
          Firebase sends a passwordless link. Your email identifies the private account but is never sent to MiniMax, Koi prompts, or analytics.
        </Text>
      </Card>
      <TextInput
        accessibilityLabel="Email address for Koi sign-in"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="you@example.com"
        style={styles.input}
        value={email}
        testID="koi-live-email"
      />
      <Button
        label={busy ? 'Please wait…' : 'Send secure sign-in link'}
        disabled={busy || !email.trim()}
        onPress={() => { void act('send'); }}
        testID="koi-live-email-send"
      />
      {koi.pendingEmailLink ? (
        <Button
          label={busy ? 'Verifying…' : 'Complete sign-in from opened link'}
          disabled={busy || !email.trim()}
          onPress={() => { void act('complete'); }}
          variant="secondary"
          testID="koi-live-email-complete"
        />
      ) : null}
      {status ? <Text accessibilityLiveRegion="polite" style={styles.caption}>{status}</Text> : null}
      <Text style={styles.caption}>No password, birth date, or MiniMax key is requested or stored by this screen.</Text>
    </ScreenScaffold>
  );
}

function KoiEnrollmentGate({ onBack }: { onBack: () => void }) {
  const koi = useKoiSenseiContext();
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState('');
  const waitlisted = koi.liveAuth.enrollmentStatus === 'waitlisted';

  const retry = async () => {
    if (busy) return;
    setBusy(true);
    setStatus('');
    try {
      const result = await koi.registerLiveAccount();
      setStatus(result === 'active'
        ? 'Koi beta access is active.'
        : 'The beta is full. This account remains safely waitlisted.');
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : 'Koi beta registration could not complete.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenScaffold>
      <ScreenHeader title="Koi Sensei" subtitle="Capped beta admission" onBack={onBack} />
      <Card tone={waitlisted ? 'warm' : 'soft'} shadow="none" style={styles.sectionCard}>
        <Text accessibilityRole="header" style={styles.title}>
          {waitlisted ? 'The 50-person beta is currently full' : 'Finishing secure Koi registration'}
        </Text>
        <Text style={styles.body}>
          {waitlisted
            ? 'Lessons and local pet activities still work. AI calls stay disabled while this account is waitlisted.'
            : 'Koi is verifying the current consent versions and available beta seat.'}
        </Text>
      </Card>
      <Button
        label={busy ? 'Checking…' : waitlisted ? 'Check for an open seat' : 'Retry registration'}
        disabled={busy}
        onPress={() => { void retry(); }}
        testID="koi-live-registration-retry"
      />
      <Button label="Sign out" variant="ghost" onPress={() => { void koi.signOutLiveAccount(); }} />
      {status ? <Text accessibilityLiveRegion="polite" style={styles.caption}>{status}</Text> : null}
    </ScreenScaffold>
  );
}

function Under16Notice({ onBack }: { onBack: () => void }) {
  const koi = useKoiSenseiContext();
  const [busy, setBusy] = React.useState(false);
  return (
    <ScreenScaffold>
      <ScreenHeader title="Koi Sensei" subtitle="AI chat eligibility" onBack={onBack} />
      <Card tone="soft" shadow="none" style={styles.sectionCard}>
        <Text accessibilityRole="header" style={styles.title}>Koi AI chat is for ages 16+</Text>
        <Text style={styles.body}>
          You can keep using the Japanese lessons and local pet activities, but Koi cannot answer AI questions for an under-16 learner.
        </Text>
        <Text style={styles.caption}>Only the age range is saved. Koi never asks for or stores a birth date.</Text>
      </Card>
      <Button
        label="Review age selection"
        variant="secondary"
        disabled={busy}
        onPress={() => {
          setBusy(true);
          void koi.revokeAiConsent().finally(() => setBusy(false));
        }}
        testID="koi-eligibility-review-age"
      />
    </ScreenScaffold>
  );
}

function KoiEligibilityForm({ onBack }: { onBack: () => void }) {
  const koi = useKoiSenseiContext();
  const storedAge = koi.state?.eligibility?.ageBand;
  const [ageBand, setAgeBand] = React.useState<KoiAgeBand | null>(storedAge ?? null);
  const [aiConsent, setAiConsent] = React.useState(false);
  const [usAcknowledged, setUsAcknowledged] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const needsConsent = ageBand === '16_17' || ageBand === '18_plus';
  const canContinue = ageBand !== null && (!needsConsent || (aiConsent && usAcknowledged));

  const submit = async () => {
    if (!ageBand || !canContinue || busy) return;
    setBusy(true);
    setError('');
    try {
      await koi.completeEligibility({
        ageBand,
        aiDataConsent: needsConsent && aiConsent,
        usProcessingAcknowledged: needsConsent && usAcknowledged,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Koi eligibility could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenScaffold>
      <ScreenHeader title="Koi Sensei" subtitle="Age and AI-data consent" onBack={onBack} />
      <Card tone="brand" shadow="hero" style={styles.sectionCard}>
        <Text style={styles.modeEyebrow}>LOCAL MOCK · ZERO PROVIDER COST</Text>
        <Text accessibilityRole="header" style={styles.brandTitle}>Before Koi answers questions</Text>
        <Text style={styles.brandBody}>
          The current mock uses fixed Japanese lesson examples on this device. It makes no MiniMax, Firebase, or other network request.
        </Text>
      </Card>

      {koi.eligibility.reason === 'policy_stale' ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          Koi's AI or privacy notice changed. Please review and consent again before chatting.
        </Text>
      ) : null}

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.title}>1. Choose your age range</Text>
        <Text style={styles.caption}>Do not enter a birth date. Koi stores only this range.</Text>
        <View style={styles.choiceGroup}>
          <AgeChoice label="Under 16" value="under16" selected={ageBand === 'under16'} onSelect={setAgeBand} />
          <AgeChoice label="16–17" value="16_17" selected={ageBand === '16_17'} onSelect={setAgeBand} />
          <AgeChoice label="18 or older" value="18_plus" selected={ageBand === '18_plus'} onSelect={setAgeBand} />
        </View>
      </View>

      {needsConsent ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.title}>2. Review AI and privacy consent</Text>
          <Card shadow="none" style={styles.sectionCard}>
            <ConsentChoice
              checked={aiConsent}
              label="I agree that my Koi questions and Koi's replies may be processed by AI under the current AI-data notice."
              onToggle={() => setAiConsent(value => !value)}
              testID="koi-consent-ai-data"
            />
            <ConsentChoice
              checked={usAcknowledged}
              label="I understand that Koi AI data may be processed in the United States under the current privacy notice."
              onToggle={() => setUsAcknowledged(value => !value)}
              testID="koi-consent-us-processing"
            />
            <Text style={styles.versionText}>
              AI notice: {KOI_CURRENT_AI_POLICY_VERSION}{'\n'}Privacy notice: {KOI_CURRENT_PRIVACY_POLICY_VERSION}
            </Text>
          </Card>
        </View>
      ) : null}

      {ageBand === 'under16' ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          Koi AI chat will stay unavailable, but the rest of the learning app and local pet activities remain available.
        </Text>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Button
        label={ageBand === 'under16' ? 'Save age eligibility' : 'Agree and start mock chat'}
        disabled={!canContinue || busy}
        onPress={() => { void submit(); }}
        testID="koi-consent-submit"
      />
    </ScreenScaffold>
  );
}

function AgeChoice({
  label,
  value,
  selected,
  onSelect,
}: {
  label: string;
  value: KoiAgeBand;
  selected: boolean;
  onSelect: (value: KoiAgeBand) => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => onSelect(value)}
      style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && styles.pressed]}
      testID={`koi-consent-age-${value}`}
    >
      <View style={[styles.radio, selected && styles.radioSelected]} />
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function ConsentChoice({
  checked,
  label,
  onToggle,
  testID,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onToggle}
      style={({ pressed }) => [styles.consentRow, pressed && styles.pressed]}
      testID={testID}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        <Text style={styles.checkmark}>{checked ? '✓' : ''}</Text>
      </View>
      <Text style={styles.consentText}>{label}</Text>
    </Pressable>
  );
}

function EligibleKoiChat({ onBack }: { onBack: () => void }) {
  const koi = useKoiSenseiContext();
  const [draft, setDraft] = React.useState(koi.state?.draft ?? '');
  const [sending, setSending] = React.useState(false);
  const [chatError, setChatError] = React.useState('');
  const [confirmRevoke, setConfirmRevoke] = React.useState(false);
  const [reportTargetId, setReportTargetId] = React.useState<string | null>(null);
  const [reportReason, setReportReason] = React.useState<'incorrect' | 'unsafe' | 'offensive' | 'privacy' | 'other'>('incorrect');
  const [reportStatus, setReportStatus] = React.useState('');
  const [memoryText, setMemoryText] = React.useState('');
  const [memoryCategory, setMemoryCategory] = React.useState<'goal' | 'preference' | 'recurring_mistake' | 'useful_phrase'>('goal');
  const [memoryStatus, setMemoryStatus] = React.useState('');
  const [savingMemory, setSavingMemory] = React.useState(false);
  const [dictating, setDictating] = React.useState(false);
  const [voiceBusyMessageId, setVoiceBusyMessageId] = React.useState<string | null>(null);
  const [voiceStatus, setVoiceStatus] = React.useState('');
  const speechSession = React.useRef<KoiDeviceSttSession | null>(null);
  const voiceBusy = React.useRef<string | null>(null);
  const cloudVoiceTemporaryUri = React.useRef<string | null>(null);
  const dictationRun = React.useRef(0);
  const dictationActive = React.useRef(false);
  const mounted = React.useRef(true);
  const speechAdapter = React.useMemo(() => createExpoKoiDeviceSttAdapter(), []);
  const cloudVoicePlayer = useAudioPlayer(null);
  const cloudVoicePlayerStatus = useAudioPlayerStatus(cloudVoicePlayer);
  const preferences = koi.state!.preferences;
  const messages = koi.state!.messages;
  const remaining = koi.allowance
    ? Math.max(0, koi.allowance.chatLimit - koi.allowance.chatUsed)
    : 0;
  const hasPersonalUnlimitedUsage = koi.allowance?.usageMode === 'personal_unlimited';

  React.useEffect(() => {
    if (draft === '' && koi.state?.draft) setDraft(koi.state.draft);
  }, [draft, koi.state?.draft]);

  const deleteTemporaryVoiceFile = React.useCallback(async (uri?: string | null) => {
    const target = uri ?? cloudVoiceTemporaryUri.current;
    if (!target) return;
    if (cloudVoiceTemporaryUri.current === target) cloudVoiceTemporaryUri.current = null;
    await deleteAsync(target, { idempotent: true });
  }, []);

  React.useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
      shouldRouteThroughEarpiece: false,
    });
  }, []);

  React.useEffect(() => {
    if (!cloudVoicePlayerStatus.didJustFinish) return;
    setVoiceStatus('');
    void deleteTemporaryVoiceFile();
  }, [cloudVoicePlayerStatus.didJustFinish, deleteTemporaryVoiceFile]);

  const completeDictation = React.useCallback((run: number) => {
    if (dictationRun.current !== run) return;
    dictationActive.current = false;
    speechSession.current = null;
    if (mounted.current) setDictating(false);
  }, []);

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      dictationRun.current += 1;
      dictationActive.current = false;
      const session = speechSession.current;
      speechSession.current = null;
      void session?.cancel();
      cloudVoicePlayer.pause();
      void deleteTemporaryVoiceFile();
    };
  }, [cloudVoicePlayer, deleteTemporaryVoiceFile]);

  const toggleDictation = async () => {
    if (dictationActive.current) {
      const run = dictationRun.current;
      const session = speechSession.current;
      completeDictation(run);
      try {
        await session?.stop();
      } catch (cause) {
        if (mounted.current && dictationRun.current === run) {
          setChatError(cause instanceof Error ? cause.message : 'On-device dictation could not stop.');
        }
      }
      return;
    }
    const run = dictationRun.current + 1;
    dictationRun.current = run;
    dictationActive.current = true;
    setDictating(true);
    setChatError('');
    try {
      const availability = await speechAdapter.getAvailability();
      if (dictationRun.current !== run || !dictationActive.current) return;
      if (!availability.available) {
        throw new Error('On-device dictation is not available. You can still type your question or use keyboard dictation.');
      }
      const permission = availability.permission === 'granted'
        ? 'granted'
        : await speechAdapter.requestPermission();
      if (dictationRun.current !== run || !dictationActive.current) return;
      if (permission !== 'granted') throw new Error('Microphone permission was not granted.');
      const session = await speechAdapter.start({
        locale: KOI_DEFAULT_SPEECH_INPUT_LOCALE,
        partialResults: true,
        maxDurationMs: 15_000,
      }, transcript => {
        if (dictationRun.current !== run || !dictationActive.current) return;
        setDraft(transcript.transcript);
      }, error => {
        if (mounted.current && dictationRun.current === run) setChatError(error.message);
      }, () => {
        completeDictation(run);
      });
      if (dictationRun.current === run && dictationActive.current) {
        speechSession.current = session;
      } else {
        await session.cancel();
      }
    } catch (cause) {
      if (mounted.current && dictationRun.current === run) {
        setChatError(cause instanceof Error ? cause.message : 'On-device dictation could not start.');
      }
      completeDictation(run);
    }
  };

  const speakKoiReply = React.useCallback(async (assistantMessageId: string, spokenText: string) => {
    if (voiceBusy.current) return;
    voiceBusy.current = assistantMessageId;
    setVoiceBusyMessageId(assistantMessageId);
    setVoiceStatus("Preparing Koi's custom voice…");
    let systemVoiceText = spokenText;
    try {
      const synthesis = await koi.synthesizeKoiReply(assistantMessageId);
      if (synthesis.status === 'cloud_audio' && synthesis.expiresAtMs > Date.now()) {
        cloudVoicePlayer.pause();
        await deleteTemporaryVoiceFile();
        const prepared = await prepareKoiCloudAudioSource(synthesis.audioUrl, assistantMessageId, {
          cacheDirectory,
          deleteFile: uri => deleteAsync(uri, { idempotent: true }),
          writeBase64: (uri, base64) => writeAsStringAsync(uri, base64, {
            encoding: EncodingType.Base64,
          }),
        });
        cloudVoiceTemporaryUri.current = prepared.temporaryUri;
        cloudVoicePlayer.replace({ uri: prepared.uri });
        cloudVoicePlayer.play();
        setVoiceStatus("Playing Koi's custom voice.");
        voiceBusy.current = null;
        setVoiceBusyMessageId(null);
        return;
      }
      systemVoiceText = getKoiSystemVoiceText(synthesis, spokenText);
      setVoiceStatus("Koi's custom voice is unavailable. Using the device voice.");
    } catch {
      setVoiceStatus("Koi's custom voice could not play. Using the device voice.");
    }
    try {
      if (systemVoiceText) await speakKoiReplyText(systemVoiceText);
    } finally {
      voiceBusy.current = null;
      setVoiceBusyMessageId(null);
    }
  }, [cloudVoicePlayer, deleteTemporaryVoiceFile, koi]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setChatError('');
    const startedAt = Date.now();
    try {
      const answer = await koi.askKoi(text);
      trackKoiEvent('koi_chat_result', {
        provider_mode: koi.runtimeStage === 'mock' ? 'mock' : 'live',
        result: answer.status,
        capacity_band: answer.allowance.capacityBand,
        latency_bucket: koiLatencyBucket(Date.now() - startedAt),
        source_count: answer.citations.length,
      });
      setDraft('');
      if (preferences.voicePlaybackEnabled && preferences.voiceAutoplayEnabled
        && answer.assistantMessage.spokenText) {
        void speakKoiReply(answer.assistantMessage.id, answer.assistantMessage.spokenText);
      }
    } catch (cause) {
      trackKoiEvent('koi_chat_result', {
        provider_mode: koi.runtimeStage === 'mock' ? 'mock' : 'live',
        result: 'failed',
        capacity_band: koi.allowance?.capacityBand ?? 'paused',
        latency_bucket: koiLatencyBucket(Date.now() - startedAt),
        source_count: 0,
      });
      setChatError(cause instanceof Error ? cause.message : 'Koi could not answer this question.');
    } finally {
      setSending(false);
    }
  };

  const submitReport = async () => {
    if (!reportTargetId) return;
    try {
      await koi.reportCloudMessage(reportTargetId, reportReason);
      setReportTargetId(null);
      setReportStatus('Report received. Thank you for helping improve Koi.');
    } catch (cause) {
      setReportStatus(cause instanceof Error ? cause.message : 'Koi could not submit the report.');
    }
  };

  const saveMemory = async () => {
    const text = memoryText.trim();
    if (!text || savingMemory) return;
    setSavingMemory(true);
    setMemoryStatus('');
    try {
      await koi.saveCloudMemory({ memoryId: createKoiUuid(), category: memoryCategory, text });
      setMemoryText('');
      setMemoryStatus('Saved only because you approved it.');
    } catch (cause) {
      setMemoryStatus(cause instanceof Error ? cause.message : 'Koi could not save that approved memory.');
    } finally {
      setSavingMemory(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.chatShell}>
      <View style={styles.chatHeader}>
        <ScreenHeader title="Koi Sensei" subtitle="Japanese-learning questions only" onBack={onBack} />
        <Card tone="soft" shadow="none" style={styles.modeCard}>
          <Text style={styles.modeLabel} testID="koi-chat-mode">
            {koi.runtimeStage === 'mock' ? 'LOCAL MOCK · ZERO PROVIDER COST' : 'LIVE SERVICE · VERIFIED ACCOUNT'}
          </Text>
          <Text accessibilityLiveRegion="polite" style={styles.allowance} testID="koi-chat-allowance">
            {koi.allowance
              ? hasPersonalUnlimitedUsage
                ? 'Personal MiniMax access — no app-imposed reply limit. Token Plan availability still applies.'
                : `${remaining} of ${koi.allowance.chatLimit} chat replies remain in this rolling 24-hour window.`
              : 'Chat allowance is unavailable.'}
          </Text>
        </Card>
      </View>
      {chatError || koi.error ? (
        <Text accessibilityRole="alert" style={styles.error}>{chatError || koi.error}</Text>
      ) : null}
      {voiceStatus ? (
        <Text accessibilityLiveRegion="polite" style={styles.voiceStatus}>{voiceStatus}</Text>
      ) : null}
      <ScreenScaffold contentStyle={styles.messageList}>
        {messages.length === 0 ? (
          <View style={[styles.messageBubble, styles.assistantBubble]}>
            <Text style={styles.assistantMessage}>
              こんにちは！ I am Koi Sensei's local mock. Ask me about Japanese vocabulary or grammar, such as the difference between は and が.
            </Text>
          </View>
        ) : null}
        {messages.map(message => (
          <View
            key={message.id}
            accessibilityLabel={`${message.role === 'assistant' ? 'Koi Sensei' : 'You'}: ${message.text}`}
            style={[styles.messageBubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}
          >
            <Text style={message.role === 'user' ? styles.userMessage : styles.assistantMessage}>{message.text}</Text>
            {message.sourceIds.length > 0 ? (
              <Text style={styles.sources}>Sources: {message.sourceIds.join(', ')}</Text>
            ) : null}
            {message.role === 'assistant' && message.spokenText && preferences.voicePlaybackEnabled ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Speak Koi's reply"
                accessibilityState={{ busy: voiceBusyMessageId === message.id, disabled: voiceBusyMessageId !== null }}
                disabled={voiceBusyMessageId !== null}
                onPress={() => { void speakKoiReply(message.id, message.spokenText!); }}
                style={({ pressed }) => [
                  styles.speakButton,
                  voiceBusyMessageId !== null && styles.speakButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.speakText}>
                  {voiceBusyMessageId === message.id ? 'Preparing voice…' : 'Speak reply'}
                </Text>
              </Pressable>
            ) : null}
            {message.role === 'assistant' && koi.runtimeStage !== 'mock' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => { setReportTargetId(message.id); setReportStatus(''); }}
                style={({ pressed }) => [styles.reportLink, pressed && styles.pressed]}
                testID={`koi-chat-report-${message.id}`}
              >
                <Text style={styles.reportLinkText}>Report this reply</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        {reportTargetId ? (
          <Card tone="danger" shadow="none" style={styles.sectionCard}>
            <Text accessibilityRole="header" style={styles.title}>Why are you reporting this reply?</Text>
            <View style={styles.reportChoices}>
              {(['incorrect', 'unsafe', 'offensive', 'privacy', 'other'] as const).map(reason => (
                <Pressable
                  key={reason}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: reportReason === reason }}
                  onPress={() => setReportReason(reason)}
                  style={[styles.reportChoice, reportReason === reason && styles.reportChoiceSelected]}
                >
                  <Text style={styles.reportChoiceText}>{reason}</Text>
                </Pressable>
              ))}
            </View>
            <Button label="Submit report" variant="danger" onPress={() => { void submitReport(); }} testID="koi-chat-report-submit" />
            <Button label="Cancel" variant="ghost" onPress={() => setReportTargetId(null)} />
          </Card>
        ) : null}
        {reportStatus ? <Text accessibilityLiveRegion="polite" style={styles.caption}>{reportStatus}</Text> : null}

        {koi.runtimeStage !== 'mock' ? (
          <Card tone="soft" shadow="none" style={styles.sectionCard}>
            <Text accessibilityRole="header" style={styles.title}>Save an approved Koi memory</Text>
            <Text style={styles.caption}>Koi never saves a memory automatically. Choose a category and approve one short learning note.</Text>
            <View style={styles.memoryChoices}>
              {(['goal', 'preference', 'recurring_mistake', 'useful_phrase'] as const).map(category => (
                <Pressable
                  key={category}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: memoryCategory === category }}
                  onPress={() => setMemoryCategory(category)}
                  style={[styles.reportChoice, memoryCategory === category && styles.reportChoiceSelected]}
                >
                  <Text style={styles.reportChoiceText}>{category.replace('_', ' ')}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput accessibilityLabel="Approved Koi memory text" maxLength={160} onChangeText={setMemoryText} placeholder="Example: I want to practise は and が." placeholderTextColor={ds.colors.textMuted} style={styles.input} value={memoryText} />
            <Button label={savingMemory ? 'Saving…' : 'Approve and save memory'} disabled={!memoryText.trim() || savingMemory} onPress={() => { void saveMemory(); }} testID="koi-memory-save" />
            {memoryStatus ? <Text accessibilityLiveRegion="polite" style={styles.caption}>{memoryStatus}</Text> : null}
          </Card>
        ) : null}

        <View style={styles.chatActions}>
          {messages.length > 0 ? (
            <Button label="Clear chat" variant="ghost" size="md" onPress={() => { void koi.clearChat(); }} testID="koi-chat-clear" />
          ) : null}
          {confirmRevoke ? (
            <Card tone="danger" shadow="none" style={styles.sectionCard}>
              <Text style={styles.body}>Revoking AI consent also clears this local Koi chat. Pet progress stays on the device.</Text>
              <Button
                label="Confirm revoke and clear"
                variant="danger"
                size="md"
                onPress={() => { void koi.revokeAiConsent(); }}
                testID="koi-chat-revoke-confirm"
              />
              <Button label="Cancel" variant="ghost" size="md" onPress={() => setConfirmRevoke(false)} />
            </Card>
          ) : (
            <Button
              label="Revoke AI consent"
              variant="ghost"
              size="md"
              onPress={() => setConfirmRevoke(true)}
              testID="koi-chat-revoke"
            />
          )}
        </View>
      </ScreenScaffold>
      <View style={styles.composer}>
        {preferences.speechToTextEnabled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={dictating ? 'Stop dictating Koi question' : 'Dictate Koi question on this device'}
            accessibilityState={{ busy: dictating }}
            onPress={() => { void toggleDictation(); }}
            style={({ pressed }) => [styles.dictationButton, dictating && styles.dictationButtonActive, pressed && styles.pressed]}
            testID="koi-chat-dictate"
          >
            <Text style={styles.dictationText}>{dictating ? 'Stop' : 'Dictate'}</Text>
          </Pressable>
        ) : null}
        <TextInput
          accessibilityLabel="Question for Koi Sensei"
          maxLength={2000}
          multiline
          onChangeText={setDraft}
          onBlur={() => { void koi.saveDraft(draft); }}
          placeholder="Ask about Japanese…"
          placeholderTextColor={ds.colors.textMuted}
          style={styles.input}
          testID="koi-chat-input"
          value={draft}
        />
        <Button
          label="Send"
          disabled={!draft.trim() || sending || !koi.ready || (!hasPersonalUnlimitedUsage && remaining === 0)}
          fullWidth={false}
          onPress={() => { void send(); }}
          size="md"
          testID="koi-chat-send"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  body: { color: ds.colors.text, fontSize: ds.type.body, lineHeight: 22 },
  caption: { color: ds.colors.textMuted, fontSize: ds.type.caption, lineHeight: 19 },
  title: { color: ds.colors.text, fontSize: ds.type.heading, lineHeight: 24, fontWeight: '900' },
  brandTitle: { color: ds.colors.brandInk, fontSize: ds.type.title, lineHeight: 29, fontWeight: '900' },
  brandBody: { color: ds.colors.brandInk, fontSize: ds.type.caption, lineHeight: 19, opacity: 0.92 },
  modeEyebrow: { color: ds.colors.brandDark, fontSize: ds.type.micro, fontWeight: '900', letterSpacing: 0.8 },
  section: { gap: ds.spacing.sm },
  sectionCard: { gap: ds.spacing.sm },
  choiceGroup: { gap: ds.spacing.sm },
  choice: {
    minHeight: ds.touch.comfortable,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ds.spacing.sm,
    paddingHorizontal: ds.spacing.md,
    borderRadius: ds.radius.lg,
    borderWidth: 1,
    borderColor: ds.colors.border,
    backgroundColor: ds.colors.surface,
  },
  choiceSelected: { borderColor: ds.colors.brand, backgroundColor: ds.colors.brandSoft },
  choiceText: { color: ds.colors.text, fontSize: ds.type.body, fontWeight: '700' },
  choiceTextSelected: { color: ds.colors.brandDark },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: ds.colors.textMuted },
  radioSelected: { borderWidth: 6, borderColor: ds.colors.brand },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: ds.spacing.sm, minHeight: ds.touch.min },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: ds.radius.sm,
    borderWidth: 2,
    borderColor: ds.colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { borderColor: ds.colors.brand, backgroundColor: ds.colors.brand },
  checkmark: { color: ds.colors.brandInk, fontWeight: '900' },
  consentText: { flex: 1, color: ds.colors.text, fontSize: ds.type.caption, lineHeight: 20 },
  versionText: { color: ds.colors.textMuted, fontSize: ds.type.micro, lineHeight: 16 },
  notice: { color: ds.colors.brandDark, backgroundColor: ds.colors.brandSoft, padding: ds.spacing.sm, borderRadius: ds.radius.md, fontSize: ds.type.caption, lineHeight: 19 },
  error: { color: ds.colors.danger, backgroundColor: ds.colors.dangerSoft, padding: ds.spacing.sm, fontSize: ds.type.caption },
  voiceStatus: { color: ds.colors.brandDark, backgroundColor: ds.colors.brandSoft, paddingHorizontal: ds.spacing.md, paddingVertical: ds.spacing.sm, fontSize: ds.type.caption },
  pressed: { opacity: 0.82 },
  chatShell: { flex: 1, backgroundColor: ds.colors.background },
  chatHeader: { paddingHorizontal: ds.spacing.md, paddingTop: ds.spacing.md, gap: ds.spacing.sm },
  modeCard: { gap: ds.spacing.xs, padding: ds.spacing.sm },
  modeLabel: { color: ds.colors.brandDark, fontSize: ds.type.micro, fontWeight: '900', letterSpacing: 0.7 },
  allowance: { color: ds.colors.textMuted, fontSize: ds.type.caption, lineHeight: 18 },
  messageList: { justifyContent: 'flex-end', paddingBottom: ds.spacing.md },
  messageBubble: { maxWidth: '86%', borderRadius: ds.radius.lg, padding: ds.spacing.md, marginBottom: ds.spacing.sm },
  userBubble: { alignSelf: 'flex-end', backgroundColor: ds.colors.brand },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: ds.colors.surface },
  userMessage: { color: ds.colors.brandInk, fontSize: ds.type.body, lineHeight: 22 },
  assistantMessage: { color: ds.colors.text, fontSize: ds.type.body, lineHeight: 22 },
  sources: { color: ds.colors.textMuted, fontSize: ds.type.micro, lineHeight: 16, marginTop: ds.spacing.sm },
  reportLink: { alignSelf: 'flex-start', marginTop: ds.spacing.sm, paddingVertical: ds.spacing.xs },
  reportLinkText: { color: ds.colors.danger, fontSize: ds.type.micro, fontWeight: '800' },
  reportChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.xs },
  memoryChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing.xs },
  reportChoice: { borderRadius: ds.radius.pill, borderWidth: 1, borderColor: ds.colors.border, paddingHorizontal: ds.spacing.sm, paddingVertical: ds.spacing.xs },
  reportChoiceSelected: { borderColor: ds.colors.danger, backgroundColor: ds.colors.dangerSoft },
  reportChoiceText: { color: ds.colors.text, fontSize: ds.type.micro, textTransform: 'capitalize' },
  speakButton: { alignSelf: 'flex-start', minHeight: ds.touch.min, justifyContent: 'center', marginTop: ds.spacing.xs },
  speakButtonDisabled: { opacity: 0.55 },
  speakText: { color: ds.colors.brandDark, fontSize: ds.type.caption, fontWeight: '900' },
  chatActions: { gap: ds.spacing.sm, marginTop: ds.spacing.md },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: ds.spacing.sm,
    padding: ds.spacing.md,
    borderTopWidth: 1,
    borderTopColor: ds.colors.border,
    backgroundColor: ds.colors.surface,
  },
  dictationButton: {
    minWidth: ds.touch.min,
    minHeight: ds.touch.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ds.colors.border,
    borderRadius: ds.radius.md,
    backgroundColor: ds.colors.surfaceAlt,
    paddingHorizontal: ds.spacing.sm,
  },
  dictationButtonActive: { borderColor: ds.colors.brand, backgroundColor: ds.colors.brandSoft },
  dictationText: { color: ds.colors.brandDark, fontSize: ds.type.micro, fontWeight: '900' },
  input: {
    flex: 1,
    minHeight: ds.touch.min,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: ds.colors.border,
    borderRadius: ds.radius.lg,
    paddingHorizontal: ds.spacing.md,
    paddingVertical: ds.spacing.sm,
    color: ds.colors.text,
    backgroundColor: ds.colors.surfaceAlt,
    fontSize: ds.type.body,
  },
});
