import React from 'react';
import { Linking } from 'react-native';

import { useLearningContext } from '../../services/learningContext';
import { useUserProfileContext } from '../../services/userProfileContext';
import {
  KoiClientError,
  createKoiFirebaseLiveClient,
  createKoiUuid,
  createKoiGateway,
  createKoiMockTransport,
  createKoiUnconfiguredLiveTransport,
  type KoiAllowanceView,
  type KoiAnswer,
  type KoiGateway,
  type KoiFirebaseLiveClient,
  type KoiFirebaseLiveConfig,
  type KoiLiveAuthSnapshot,
  type KoiRuntimeStage,
  type KoiSynthesisResult,
} from './api';
import {
  askAndPersistKoi,
  createKoiEligibilityRecord,
  evaluateKoiEligibility,
  KOI_CURRENT_DETAILED_PROGRESS_POLICY_VERSION,
  openKoiSenseiRepository,
  type CreateKoiEligibilityInput,
  type KoiActiveDojoSessionV1,
  type KoiCachedChatMessageV1,
  type KoiCachedPetSnapshotV1,
  type KoiExperienceStateV1,
  type KoiEligibilityStatus,
  type KoiLocalPreferencesV1,
  type KoiQueuedClaimV1,
  type KoiSenseiLocalStateV1,
  type KoiSenseiRepository,
} from './data';
import { buildKoiLearningSummary, subscribeKoiLearningProgression } from './integration';
import {
  createDefaultKoiProgression,
  mergeKoiProgressionHighWater,
  type KoiDomain,
  type KoiRank,
} from './domain';

type KoiQuizEvidenceResult = Awaited<ReturnType<KoiGateway['submitQuizAnswer']>>;

export interface KoiSenseiContextValue {
  ready: boolean;
  error: string | null;
  state: KoiSenseiLocalStateV1 | null;
  runtimeStage: KoiRuntimeStage;
  eligibility: KoiEligibilityStatus;
  allowance: KoiAllowanceView | null;
  liveAuth: KoiLiveAuthSnapshot;
  pendingEmailLink: string | null;
  refresh(): Promise<void>;
  sendEmailSignInLink(email: string): Promise<void>;
  completeEmailSignIn(email: string): Promise<void>;
  registerLiveAccount(): Promise<'active' | 'waitlisted'>;
  signOutLiveAccount(): Promise<void>;
  exportCloudData(): Promise<string>;
  deleteCloudAccount(): Promise<void>;
  reportCloudMessage(
    messageId: string,
    reason: 'incorrect' | 'unsafe' | 'offensive' | 'privacy' | 'other',
  ): Promise<void>;
  saveCloudMemory(input: {
    memoryId: string;
    category: 'goal' | 'preference' | 'recurring_mistake' | 'useful_phrase';
    text: string;
  }): Promise<void>;
  deleteCloudMemory(memoryId: string): Promise<void>;
  completeEligibility(input: CreateKoiEligibilityInput): Promise<void>;
  revokeAiConsent(): Promise<void>;
  setDetailedProgressConsent(enabled: boolean): Promise<void>;
  askKoi(text: string): Promise<KoiAnswer>;
  synthesizeKoiReply(assistantMessageId: string): Promise<KoiSynthesisResult>;
  submitQuizAnswer(input: {
    questionId: string;
    answer: string;
    domain: KoiDomain;
    rank: KoiRank;
  }): Promise<KoiQuizEvidenceResult>;
  saveDraft(draft: string): Promise<void>;
  savePreferences(patch: Partial<KoiLocalPreferencesV1>): Promise<void>;
  savePetSnapshot(snapshot: KoiCachedPetSnapshotV1 | null): Promise<void>;
  saveExperience(experience: KoiExperienceStateV1): Promise<void>;
  saveActivityState(
    snapshot: KoiCachedPetSnapshotV1,
    experience: KoiExperienceStateV1,
    activeDojoSession: KoiActiveDojoSessionV1 | null,
  ): Promise<void>;
  saveActiveDojoSession(session: KoiActiveDojoSessionV1 | null): Promise<void>;
  enqueueClaim(claim: KoiQueuedClaimV1): Promise<void>;
  appendMessage(message: KoiCachedChatMessageV1): Promise<void>;
  clearChat(): Promise<void>;
  resetLocalState(): Promise<void>;
}

const KoiSenseiContext = React.createContext<KoiSenseiContextValue | null>(null);

export function KoiSenseiProvider({
  children,
  repositoryFactory = openKoiSenseiRepository,
  runtimeStage = 'mock',
  liveConfig = null,
}: {
  children: React.ReactNode;
  repositoryFactory?: () => Promise<KoiSenseiRepository>;
  runtimeStage?: KoiRuntimeStage;
  liveConfig?: KoiFirebaseLiveConfig | null;
}) {
  const learning = useLearningContext();
  const profile = useUserProfileContext();
  const repositoryRef = React.useRef<KoiSenseiRepository | null>(null);
  const liveClientRef = React.useRef<KoiFirebaseLiveClient | null>(null);
  const [liveAuth, setLiveAuth] = React.useState<KoiLiveAuthSnapshot>(() => (
    runtimeStage === 'mock'
      ? { authenticated: true, emailVerified: true, enrollmentStatus: 'active' }
      : { authenticated: false, emailVerified: false, enrollmentStatus: 'not_registered' }
  ));
  const liveAuthRef = React.useRef(liveAuth);
  const [pendingEmailLink, setPendingEmailLink] = React.useState<string | null>(null);
  const progressionSyncDrainRef = React.useRef<() => Promise<void>>(async () => undefined);
  const progressionSyncPausedRef = React.useRef(false);
  const learningSummaryRevisionRef = React.useRef(0);
  const [state, setState] = React.useState<KoiSenseiLocalStateV1 | null>(null);
  const stateRef = React.useRef<KoiSenseiLocalStateV1 | null>(null);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [allowance, setAllowance] = React.useState<KoiAllowanceView | null>(() => (
    runtimeStage === 'mock'
      ? {
          usageMode: 'personal_unlimited',
          chatLimit: 12,
          chatUsed: 0,
          voiceLimit: 4,
          voiceUsed: 0,
          expiresAtMs: Date.now() + (24 * 60 * 60 * 1_000),
          capacityBand: 'high',
        }
      : null
  ));

  stateRef.current = state;
  liveAuthRef.current = liveAuth;

  const gatewayRef = React.useRef<{ stage: KoiRuntimeStage; gateway: KoiGateway } | null>(null);
  if (!gatewayRef.current || gatewayRef.current.stage !== runtimeStage) {
    const transport = runtimeStage === 'mock'
      ? createKoiMockTransport()
      : createKoiUnconfiguredLiveTransport();
    gatewayRef.current = {
      stage: runtimeStage,
      gateway: createKoiGateway(transport, () => {
        const eligibility = evaluateKoiEligibility(stateRef.current?.eligibility);
        const remote = liveAuthRef.current;
        return {
          authenticated: runtimeStage === 'mock' ? true : remote.authenticated && remote.emailVerified,
          enrollmentStatus: runtimeStage === 'mock'
            ? eligibility.eligible ? 'active' : 'not_registered'
            : remote.enrollmentStatus,
          ageBand: eligibility.eligible ? eligibility.ageBand : undefined,
          aiConsentVersion: eligibility.eligible
            ? stateRef.current?.eligibility?.aiPolicyVersion
            : undefined,
          privacyPolicyVersion: eligibility.eligible
            ? stateRef.current?.eligibility?.privacyPolicyVersion
            : undefined,
          usProcessingAcknowledged: eligibility.eligible,
          consentedAtMs: eligibility.eligible
            ? stateRef.current?.eligibility?.consentedAt ?? undefined
            : undefined,
          detailedProgressConsentVersion: stateRef.current?.preferences.detailedProgressConsent
            ? KOI_CURRENT_DETAILED_PROGRESS_POLICY_VERSION
            : undefined,
        };
      }),
    };
  }

  React.useEffect(() => {
    if (runtimeStage === 'mock') return undefined;
    if (!liveConfig) {
      setError('Live Koi configuration is incomplete. No provider request can be sent.');
      return undefined;
    }
    let active = true;
    let unsubscribe: () => void = () => undefined;
    void createKoiFirebaseLiveClient(liveConfig)
      .then(async client => {
        if (!active) {
          client.dispose();
          return;
        }
        liveClientRef.current = client;
        gatewayRef.current = {
          stage: runtimeStage,
          gateway: createKoiGateway(client.transport, () => {
            const eligibility = evaluateKoiEligibility(stateRef.current?.eligibility);
            const remote = liveAuthRef.current;
            return {
              authenticated: remote.authenticated && remote.emailVerified,
              enrollmentStatus: remote.enrollmentStatus,
              ageBand: eligibility.eligible ? eligibility.ageBand : undefined,
              aiConsentVersion: eligibility.eligible ? stateRef.current?.eligibility?.aiPolicyVersion : undefined,
              privacyPolicyVersion: eligibility.eligible ? stateRef.current?.eligibility?.privacyPolicyVersion : undefined,
              usProcessingAcknowledged: eligibility.eligible,
              consentedAtMs: eligibility.eligible ? stateRef.current?.eligibility?.consentedAt ?? undefined : undefined,
              detailedProgressConsentVersion: stateRef.current?.preferences.detailedProgressConsent
                ? KOI_CURRENT_DETAILED_PROGRESS_POLICY_VERSION
                : undefined,
            };
          }),
        };
        unsubscribe = client.subscribe(next => {
          liveAuthRef.current = next;
          setLiveAuth(next);
        });
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && await client.isEmailLink(initialUrl)) setPendingEmailLink(initialUrl);
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'Koi live service could not initialize.');
      });
    const linkSubscription = Linking.addEventListener('url', event => {
      const client = liveClientRef.current;
      if (!client) return;
      void client.isEmailLink(event.url).then(valid => {
        if (active && valid) setPendingEmailLink(event.url);
      });
    });
    return () => {
      active = false;
      unsubscribe();
      linkSubscription.remove();
      liveClientRef.current?.dispose();
      liveClientRef.current = null;
    };
  }, [liveConfig, runtimeStage]);

  const loadFromRepository = React.useCallback(async (repository: KoiSenseiRepository) => {
    const nextState = await repository.load();
    stateRef.current = nextState;
    setState(nextState);
    setError(null);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void repositoryFactory()
      .then(async repository => {
        repositoryRef.current = repository;
        const nextState = await repository.load();
        if (!cancelled) {
          stateRef.current = nextState;
          setState(nextState);
          setError(null);
        }
      })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Koi storage is unavailable.');
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => { cancelled = true; };
  }, [repositoryFactory]);

  const withRepository = React.useCallback(async (
    mutation?: (repository: KoiSenseiRepository) => Promise<void>,
  ) => {
    const repository = repositoryRef.current;
    if (!repository) throw new Error('Koi Sensei storage is not ready.');
    try {
      if (mutation) await mutation(repository);
      await loadFromRepository(repository);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Koi storage operation failed.';
      setError(message);
      throw cause;
    }
  }, [loadFromRepository]);

  React.useEffect(() => {
    const learningStore = learning.store;
    const learningRepository = learning.repo;
    if (!ready || !learning.ready || !learningStore || !learningRepository) return undefined;
    const repository = repositoryRef.current;
    if (!repository) return undefined;
    let active = true;
    const subscription = subscribeKoiLearningProgression({
      learningStore,
      learningRepository,
      koiRepository: repository,
      shouldContinue: () => active && !progressionSyncPausedRef.current,
      onPersisted: () => loadFromRepository(repository),
      onError: cause => {
        if (active) {
          setError(cause instanceof Error
            ? cause.message
            : 'Koi could not update learning milestones.');
        }
      },
    });
    progressionSyncDrainRef.current = subscription.drain;
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [learning.ready, learning.repo, learning.store, loadFromRepository, ready]);

  React.useEffect(() => {
    const learningStore = learning.store;
    const learningRepository = learning.repo;
    const srs = learning.srs;
    const detailedProgressEnabled = state?.preferences.detailedProgressConsent === true;
    if (runtimeStage === 'mock' || !ready || !learning.ready || !profile.ready
      || !learningStore || !learningRepository || !srs || !detailedProgressEnabled
      || !liveAuth.authenticated || !liveAuth.emailVerified || liveAuth.enrollmentStatus !== 'active') {
      return undefined;
    }
    let active = true;
    let queue = Promise.resolve();
    const schedule = () => {
      const task = queue.then(async () => {
        if (!active || !stateRef.current?.preferences.detailedProgressConsent
          || liveAuthRef.current.enrollmentStatus !== 'active') return;
        await learningStore.ready();
        const [progress, dueCount] = await Promise.all([
          learningRepository.getProgress(),
          srs.dueCount(),
        ]);
        if (!active || !stateRef.current?.preferences.detailedProgressConsent) return;
        learningSummaryRevisionRef.current = Math.max(
          learningSummaryRevisionRef.current + 1,
          Date.now(),
        );
        await gatewayRef.current!.gateway.syncLearningSummary({
          requestId: createKoiUuid(),
          context: buildKoiLearningSummary({
            revision: learningSummaryRevisionRef.current,
            dueCount,
            progress,
            events: learningStore.getExtendedProgress().todoEventCounts,
            profile: profile.profile,
          }),
        });
      });
      queue = task.catch(cause => {
        if (active) setError(cause instanceof Error
          ? cause.message
          : 'Koi could not sync the approved learning summary.');
      });
    };
    const unsubscribe = learningStore.subscribeExtendedProgress(schedule);
    schedule();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [
    learning.ready,
    learning.repo,
    learning.srs,
    learning.store,
    liveAuth.authenticated,
    liveAuth.emailVerified,
    liveAuth.enrollmentStatus,
    profile.profile,
    profile.ready,
    ready,
    runtimeStage,
    state?.preferences.detailedProgressConsent,
  ]);

  const eligibility = React.useMemo(
    () => evaluateKoiEligibility(state?.eligibility),
    [state?.eligibility],
  );

  const completeEligibility = React.useCallback(async (input: CreateKoiEligibilityInput) => {
    if (input.ageBand !== 'under16' && (!input.aiDataConsent || !input.usProcessingAcknowledged)) {
      throw new KoiClientError(
        'CONSENT_REQUIRED',
        'Both AI-data consent and the United States processing acknowledgement are required.',
      );
    }
    const record = createKoiEligibilityRecord(input);
    await withRepository(repository => repository.saveEligibility(record));
  }, [withRepository]);

  const registerLiveAccount = React.useCallback(async (): Promise<'active' | 'waitlisted'> => {
    if (runtimeStage === 'mock') return 'active';
    const client = liveClientRef.current;
    const local = stateRef.current?.eligibility;
    const status = evaluateKoiEligibility(local);
    if (!client || !liveAuthRef.current.authenticated || !liveAuthRef.current.emailVerified) {
      throw new KoiClientError('AUTH_REQUIRED', 'Complete email-link sign-in before joining the Koi beta.');
    }
    if (!status.eligible || !local) {
      throw new KoiClientError('CONSENT_REQUIRED', 'Complete the current Koi age and consent notice first.');
    }
    const result = await gatewayRef.current!.gateway.completeRegistration({
      requestId: createKoiUuid(),
      ageBand: status.ageBand,
      aiPolicyVersion: local.aiPolicyVersion,
      privacyPolicyVersion: local.privacyPolicyVersion,
      supportLanguage: profile.profile?.static.supportLanguage ?? 'en',
    });
    client.setEnrollmentStatus(result.status);
    if (result.status === 'active') {
      setAllowance(await gatewayRef.current!.gateway.getAllowance(createKoiUuid()));
    }
    return result.status;
  }, [profile.profile?.static.supportLanguage, runtimeStage]);

  const sendEmailSignInLink = React.useCallback(async (email: string) => {
    const client = liveClientRef.current;
    if (!client) throw new KoiClientError('LIVE_BACKEND_NOT_CONFIGURED', 'Koi live sign-in is not configured.');
    await client.sendEmailLink(email);
  }, []);

  const completeEmailSignIn = React.useCallback(async (email: string) => {
    const client = liveClientRef.current;
    const link = pendingEmailLink;
    if (!client || !link) throw new KoiClientError('INVALID_REQUEST', 'Open a fresh Koi sign-in link first.');
    await client.completeEmailLink(email, link);
    setPendingEmailLink(null);
  }, [pendingEmailLink]);

  React.useEffect(() => {
    if (runtimeStage === 'mock' || !liveAuth.authenticated || !liveAuth.emailVerified
      || liveAuth.enrollmentStatus !== 'not_registered') return;
    const local = evaluateKoiEligibility(stateRef.current?.eligibility);
    if (!local.eligible) return;
    void registerLiveAccount().catch(cause => {
      if (cause instanceof KoiClientError && cause.reason === 'BETA_WAITLISTED') {
        liveClientRef.current?.setEnrollmentStatus('waitlisted');
        return;
      }
      setError(cause instanceof Error ? cause.message : 'Koi beta registration could not complete.');
    });
  }, [
    eligibility.eligible,
    liveAuth.authenticated,
    liveAuth.emailVerified,
    liveAuth.enrollmentStatus,
    registerLiveAccount,
    runtimeStage,
  ]);

  const revokeAiConsent = React.useCallback(async () => {
    let remoteError: unknown;
    if (runtimeStage !== 'mock' && liveAuthRef.current.authenticated) {
      try {
        await gatewayRef.current!.gateway.revokeConsent(createKoiUuid());
        liveClientRef.current?.setEnrollmentStatus('not_registered');
      } catch (cause) {
        remoteError = cause;
      }
    }
    await withRepository(repository => repository.revokeEligibility());
    if (remoteError) throw remoteError;
  }, [runtimeStage, withRepository]);

  const setDetailedProgressConsent = React.useCallback(async (enabled: boolean) => {
    if (runtimeStage !== 'mock') {
      await gatewayRef.current!.gateway.setDetailedProgressConsent({
        requestId: createKoiUuid(),
        enabled,
        policyVersion: KOI_CURRENT_DETAILED_PROGRESS_POLICY_VERSION,
      });
    }
    await withRepository(repository => repository.savePreferences({ detailedProgressConsent: enabled }));
  }, [runtimeStage, withRepository]);

  const exportCloudData = React.useCallback(async (): Promise<string> => {
    const client = liveClientRef.current;
    if (runtimeStage === 'mock' || !client || !liveAuthRef.current.authenticated) {
      throw new KoiClientError('AUTH_REQUIRED', 'Sign in before exporting cloud Koi data.');
    }
    const requestId = createKoiUuid();
    const response = await client.transport.invoke('exportKoiData', { schemaVersion: 1, requestId });
    if (typeof response !== 'object' || response === null
      || (response as { schemaVersion?: unknown }).schemaVersion !== 1
      || (response as { requestId?: unknown }).requestId !== requestId) {
      throw new KoiClientError('INVALID_RESPONSE', 'Koi returned an invalid cloud export.');
    }
    const serialized = JSON.stringify(response, null, 2);
    if (serialized.length > 2_000_000) {
      throw new KoiClientError('INVALID_RESPONSE', 'Koi returned an oversized cloud export.');
    }
    return serialized;
  }, [runtimeStage]);

  const deleteCloudAccount = React.useCallback(async (): Promise<void> => {
    const client = liveClientRef.current;
    const repository = repositoryRef.current;
    if (runtimeStage === 'mock' || !client || !repository || !liveAuthRef.current.authenticated) {
      throw new KoiClientError('AUTH_REQUIRED', 'Sign in before deleting cloud Koi data.');
    }
    const requestId = createKoiUuid();
    const createdAt = Date.now();
    await repository.setCloudDeletionTombstone({
      schemaVersion: 1,
      requestId,
      createdAt,
      attemptCount: 1,
      lastAttemptAt: createdAt,
    });
    const response = await client.transport.invoke('deleteKoiData', {
      schemaVersion: 1,
      requestId,
      confirmation: 'DELETE_KOI_DATA',
    });
    if (typeof response !== 'object' || response === null
      || (response as { schemaVersion?: unknown }).schemaVersion !== 1
      || (response as { requestId?: unknown }).requestId !== requestId
      || (response as { deleted?: unknown }).deleted !== true) {
      throw new KoiClientError('INVALID_RESPONSE', 'Koi did not confirm cloud deletion.');
    }
    await repository.reset();
    stateRef.current = null;
    setState(null);
    setAllowance(null);
    await client.signOut();
  }, [runtimeStage]);

  const reportCloudMessage = React.useCallback(async (
    messageId: string,
    reason: 'incorrect' | 'unsafe' | 'offensive' | 'privacy' | 'other',
  ): Promise<void> => {
    const client = liveClientRef.current;
    if (runtimeStage === 'mock' || !client || !liveAuthRef.current.authenticated) {
      throw new KoiClientError('AUTH_REQUIRED', 'Sign in before reporting a live Koi reply.');
    }
    const requestId = createKoiUuid();
    const response = await client.transport.invoke('reportKoiMessage', {
      schemaVersion: 1,
      requestId,
      messageId,
      reason,
    });
    if (typeof response !== 'object' || response === null
      || (response as { schemaVersion?: unknown }).schemaVersion !== 1
      || (response as { requestId?: unknown }).requestId !== requestId
      || (response as { accepted?: unknown }).accepted !== true) {
      throw new KoiClientError('INVALID_RESPONSE', 'Koi did not confirm the report.');
    }
  }, [runtimeStage]);

  const saveCloudMemory = React.useCallback(async (input: {
    memoryId: string;
    category: 'goal' | 'preference' | 'recurring_mistake' | 'useful_phrase';
    text: string;
  }): Promise<void> => {
    if (runtimeStage === 'mock') throw new KoiClientError('AUTH_REQUIRED', 'Sign in before saving a cloud Koi memory.');
    await gatewayRef.current!.gateway.upsertMemory({ requestId: createKoiUuid(), ...input });
  }, [runtimeStage]);

  const deleteCloudMemory = React.useCallback(async (memoryId: string): Promise<void> => {
    if (runtimeStage === 'mock') throw new KoiClientError('AUTH_REQUIRED', 'Sign in before deleting a cloud Koi memory.');
    await gatewayRef.current!.gateway.deleteMemory({ requestId: createKoiUuid(), memoryId });
  }, [runtimeStage]);

  const resetLocalState = React.useCallback(async () => {
    progressionSyncPausedRef.current = true;
    try {
      await progressionSyncDrainRef.current().catch(() => undefined);
      await withRepository(repository => repository.reset());
    } finally {
      progressionSyncPausedRef.current = false;
    }
  }, [withRepository]);

  const askKoi = React.useCallback(async (text: string): Promise<KoiAnswer> => {
    const repository = repositoryRef.current;
    if (!repository) throw new Error('Koi Sensei storage is not ready.');
    const currentEligibility = evaluateKoiEligibility(stateRef.current?.eligibility);
    if (!currentEligibility.eligible) {
      throw new KoiClientError(
        currentEligibility.reason === 'under16' ? 'AGE_RESTRICTED' : 'CONSENT_REQUIRED',
        currentEligibility.reason === 'under16'
          ? 'Koi AI chat is available only to learners age 16 or older.'
          : 'Review and accept the current Koi AI and privacy notice before chatting.',
      );
    }
    try {
      const result = await askAndPersistKoi({
        repository,
        gateway: gatewayRef.current!.gateway,
      }, text);
      setAllowance(result.answer.allowance);
      await loadFromRepository(repository);
      return result.answer;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Koi could not answer this question.');
      throw cause;
    }
  }, [loadFromRepository]);

  const synthesizeKoiReply = React.useCallback(async (
    assistantMessageId: string,
  ): Promise<KoiSynthesisResult> => {
    const result = await gatewayRef.current!.gateway.synthesize({
      requestId: createKoiUuid(),
      assistantMessageId,
    });
    setAllowance(result.allowance);
    return result;
  }, []);

  const submitQuizAnswer = React.useCallback(async (input: {
    questionId: string;
    answer: string;
    domain: KoiDomain;
    rank: KoiRank;
  }): Promise<KoiQuizEvidenceResult> => {
    const result = await gatewayRef.current!.gateway.submitQuizAnswer({
      requestId: createKoiUuid(),
      ...input,
    });
    const currentSnapshot = stateRef.current?.petSnapshot;
    if (currentSnapshot && result.domainStars) {
      const incoming = createDefaultKoiProgression();
      incoming.currentRank = result.highestRank ?? input.rank;
      incoming.rankProgress[input.rank].domainStars = {
        ...incoming.rankProgress[input.rank].domainStars,
        ...Object.fromEntries(Object.entries(result.domainStars)
          .filter(([domain]) => ['vocabulary', 'grammar', 'phrases', 'quizzes'].includes(domain))
          .map(([domain, stars]) => [domain, Math.min(2, Math.max(0, Math.floor(stars)))])),
      } as typeof incoming.rankProgress[typeof input.rank]['domainStars'];
      await withRepository(repository => repository.savePetSnapshot({
        ...currentSnapshot,
        revision: currentSnapshot.revision + 1,
        progression: mergeKoiProgressionHighWater(currentSnapshot.progression, incoming),
      }));
    }
    return result;
  }, [withRepository]);

  const savePetSnapshot = React.useCallback(async (snapshot: KoiCachedPetSnapshotV1 | null) => {
    await withRepository(repository => repository.savePetSnapshot(snapshot));
    if (runtimeStage !== 'mock' && snapshot) {
      await gatewayRef.current!.gateway.syncPetPresentation({
        requestId: createKoiUuid(),
        presentation: {
          revision: snapshot.revision,
          avatarMode: stateRef.current?.preferences.avatarMode ?? '3d',
          effectPreference: stateRef.current?.preferences.effectPreference ?? 'full',
          equippedCosmeticIds: snapshot.equippedCosmeticIds,
          selectedDojoThemeId: snapshot.selectedDojoThemeId,
        },
      }).catch(cause => setError(cause instanceof Error ? cause.message : 'Koi pet sync is unavailable.'));
    }
  }, [runtimeStage, withRepository]);

  const value = React.useMemo<KoiSenseiContextValue>(() => ({
    ready,
    error,
    state,
    runtimeStage,
    eligibility,
    allowance,
    liveAuth,
    pendingEmailLink,
    refresh: () => withRepository(),
    sendEmailSignInLink,
    completeEmailSignIn,
    registerLiveAccount,
    signOutLiveAccount: async () => {
      await liveClientRef.current?.signOut();
      setAllowance(null);
    },
    exportCloudData,
    deleteCloudAccount,
    reportCloudMessage,
    saveCloudMemory,
    deleteCloudMemory,
    completeEligibility,
    revokeAiConsent,
    setDetailedProgressConsent,
    askKoi,
    synthesizeKoiReply,
    submitQuizAnswer,
    saveDraft: draft => withRepository(repository => repository.saveDraft(draft)),
    savePreferences: patch => withRepository(repository => repository.savePreferences(patch)),
    savePetSnapshot,
    saveExperience: experience => withRepository(repository => repository.saveExperience(experience)),
    saveActivityState: (snapshot, experience, activeDojoSession) => withRepository(
      repository => repository.saveActivityState(snapshot, experience, activeDojoSession),
    ),
    saveActiveDojoSession: session => withRepository(repository => repository.saveActiveDojoSession(session)),
    enqueueClaim: claim => withRepository(repository => repository.enqueueClaim(claim)),
    appendMessage: message => withRepository(repository => repository.appendMessage(message)),
    clearChat: () => withRepository(repository => repository.clearChat()),
    resetLocalState,
  }), [
    allowance,
    askKoi,
    completeEmailSignIn,
    completeEligibility,
    deleteCloudAccount,
    deleteCloudMemory,
    eligibility,
    error,
    exportCloudData,
    liveAuth,
    pendingEmailLink,
    ready,
    registerLiveAccount,
    reportCloudMessage,
    saveCloudMemory,
    resetLocalState,
    revokeAiConsent,
    setDetailedProgressConsent,
    runtimeStage,
    sendEmailSignInLink,
    state,
    synthesizeKoiReply,
    submitQuizAnswer,
    savePetSnapshot,
    withRepository,
  ]);

  return <KoiSenseiContext.Provider value={value}>{children}</KoiSenseiContext.Provider>;
}

export function useKoiSenseiContext(): KoiSenseiContextValue {
  const value = React.useContext(KoiSenseiContext);
  if (!value) throw new Error('useKoiSenseiContext must be used inside KoiSenseiProvider.');
  return value;
}
