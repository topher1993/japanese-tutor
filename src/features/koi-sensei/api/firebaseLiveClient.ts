import { KoiClientError, type KoiCallableName, type KoiCallableTransport } from './gateway';
import type { KoiPublicEnvironment, KoiPublicRuntimeConfig, KoiRuntimeStage } from './runtimeConfig';

export interface KoiFirebaseLiveConfig {
  stage: Exclude<KoiRuntimeStage, 'mock'>;
  apiKey: string;
  appId: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  region: string;
  emailLinkUrl: string;
  appCheckSiteKey?: string;
  functionsEmulator?: { host: string; port: number };
  authEmulatorOrigin?: string;
  workerUrl?: string;
}

export interface KoiLiveAuthSnapshot {
  authenticated: boolean;
  emailVerified: boolean;
  enrollmentStatus: 'not_registered' | 'active' | 'waitlisted';
}

export interface KoiFirebaseLiveClient {
  transport: KoiCallableTransport;
  getAuthSnapshot(): KoiLiveAuthSnapshot;
  subscribe(listener: (snapshot: KoiLiveAuthSnapshot) => void): () => void;
  sendEmailLink(email: string): Promise<void>;
  isEmailLink(url: string): Promise<boolean>;
  completeEmailLink(email: string, url: string): Promise<void>;
  setEnrollmentStatus(status: KoiLiveAuthSnapshot['enrollmentStatus']): void;
  signOut(): Promise<void>;
  dispose(): void;
}

function required(environment: KoiPublicEnvironment, name: keyof KoiPublicEnvironment): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${String(name)} is required outside Koi mock mode.`);
  return value;
}

function parseOrigin(value: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid origin.`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${label} must be an http(s) origin without a path.`);
  }
  return url;
}

export function resolveKoiFirebaseLiveConfig(
  environment: KoiPublicEnvironment,
  runtime: KoiPublicRuntimeConfig,
): KoiFirebaseLiveConfig | null {
  if (runtime.stage === 'mock') return null;
  const emailLinkUrl = required(environment, 'EXPO_PUBLIC_KOI_EMAIL_LINK_URL');
  let link: URL;
  try {
    link = new URL(emailLinkUrl);
  } catch {
    throw new Error('EXPO_PUBLIC_KOI_EMAIL_LINK_URL must be a valid URL.');
  }
  if (runtime.stage !== 'development' && link.protocol !== 'https:') {
    throw new Error('Koi staging and production email links must use HTTPS.');
  }
  const emulator = runtime.functionsEmulatorOrigin
    ? parseOrigin(runtime.functionsEmulatorOrigin, 'Koi Functions emulator origin')
    : undefined;
  const authEmulatorOrigin = environment.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_ORIGIN?.trim();
  if (runtime.stage === 'production' && authEmulatorOrigin) {
    throw new Error('Koi production must never call a Firebase Auth emulator.');
  }
  if (authEmulatorOrigin) parseOrigin(authEmulatorOrigin, 'Koi Auth emulator origin');
  return {
    stage: runtime.stage,
    apiKey: required(environment, 'EXPO_PUBLIC_FIREBASE_API_KEY'),
    appId: required(environment, 'EXPO_PUBLIC_FIREBASE_APP_ID'),
    authDomain: required(environment, 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
    projectId: runtime.firebaseProjectId!,
    storageBucket: required(environment, 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: required(environment, 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
    region: runtime.functionsRegion,
    emailLinkUrl,
    ...(environment.EXPO_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY?.trim()
      ? { appCheckSiteKey: environment.EXPO_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY.trim() }
      : runtime.stage === 'development' ? {} : { appCheckSiteKey: required(environment, 'EXPO_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY') }),
    ...(emulator ? { functionsEmulator: { host: emulator.hostname, port: Number(emulator.port) } } : {}),
    ...(authEmulatorOrigin ? { authEmulatorOrigin } : {}),
    ...(runtime.workerUrl ? { workerUrl: runtime.workerUrl } : {}),
  };
}

function clientError(cause: unknown): KoiClientError {
  if (cause instanceof KoiClientError) return cause;
  const value = typeof cause === 'object' && cause !== null
    ? cause as { message?: unknown; details?: unknown; code?: unknown }
    : {};
  const details = typeof value.details === 'object' && value.details !== null
    ? value.details as { reason?: unknown }
    : {};
  const reason = typeof details.reason === 'string'
    ? details.reason
    : value.code === 'functions/unauthenticated' ? 'AUTH_REQUIRED' : 'LIVE_BACKEND_NOT_CONFIGURED';
  const message = typeof value.message === 'string' && value.message.trim()
    ? value.message
    : 'Koi could not complete the secure service request.';
  return new KoiClientError(reason as KoiClientError['reason'], message);
}

async function initializeKoiFirebaseApp(config: KoiFirebaseLiveConfig) {
  const appModule = await import('@react-native-firebase/app');
  // Android/iOS initialize the default app from google-services.json /
  // GoogleService-Info.plist before React Native starts. Native Firebase Auth
  // owns its persistence, so no JS AsyncStorage adapter is required.
  const nativeDefault = appModule.getApps().find(candidate => candidate.name === '[DEFAULT]');
  if (nativeDefault) return nativeDefault;
  const appName = `koi-${config.stage}`;
  const existing = appModule.getApps().find(candidate => candidate.name === appName);
  if (existing) return existing;
  return appModule.initializeApp({
    apiKey: config.apiKey,
    appId: config.appId,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
  }, { name: appName, automaticDataCollectionEnabled: false });
}

export async function createKoiFirebaseLiveClient(
  config: KoiFirebaseLiveConfig,
): Promise<KoiFirebaseLiveClient> {
  const [authModule, appCheckModule, functionsModule] = await Promise.all([
    import('@react-native-firebase/auth'),
    import('@react-native-firebase/app-check'),
    import('@react-native-firebase/functions'),
  ]);
  const app = await initializeKoiFirebaseApp(config);
  if (config.appCheckSiteKey || config.stage !== 'development') {
    const appCheckProvider = new appCheckModule.ReactNativeFirebaseAppCheckProvider({
      web: { provider: 'reCaptchaEnterprise', siteKey: config.appCheckSiteKey ?? '' },
      android: { provider: 'playIntegrity' },
      apple: { provider: 'appAttestWithDeviceCheckFallback' },
      isTokenAutoRefreshEnabled: true,
    });
    await appCheckModule.initializeAppCheck(app, {
      provider: appCheckProvider,
      isTokenAutoRefreshEnabled: true,
    });
  }

  const auth = authModule.getAuth(app);
  const functions = functionsModule.getFunctions(app, config.region);
  if (config.authEmulatorOrigin) authModule.connectAuthEmulator(auth, config.authEmulatorOrigin, { disableWarnings: true });
  if (config.functionsEmulator) {
    functionsModule.connectFunctionsEmulator(functions, config.functionsEmulator.host, config.functionsEmulator.port);
  }

  let snapshot: KoiLiveAuthSnapshot = {
    authenticated: false,
    emailVerified: false,
    enrollmentStatus: 'not_registered',
  };
  const listeners = new Set<(next: KoiLiveAuthSnapshot) => void>();
  const publish = (next: KoiLiveAuthSnapshot) => {
    snapshot = next;
    listeners.forEach(listener => listener(next));
  };
  const unsubscribeAuth = authModule.onAuthStateChanged(auth, user => {
    publish({
      authenticated: Boolean(user),
      emailVerified: user?.emailVerified === true,
      enrollmentStatus: 'not_registered',
    });
  });

  const transport: KoiCallableTransport = {
    async invoke(name: KoiCallableName, payload) {
      if (!snapshot.authenticated || !snapshot.emailVerified) {
        throw new KoiClientError('AUTH_REQUIRED', 'A verified email-link account is required.');
      }
      try {
        if (config.workerUrl && (name === 'askKoiSensei' || name === 'syncKoiLearningContext' || name === 'syncKoiPetPresentation' || name === 'upsertKoiMemory' || name === 'deleteKoiMemory' || name === 'exportKoiData' || name === 'deleteKoiData' || name === 'reportKoiMessage' || name === 'revokeKoiConsent' || name === 'completeKoiRegistration' || name === 'getKoiAllowance' || name === ('submitQuizAnswer' as KoiCallableName))) {
          const user = auth.currentUser;
          const token = await user?.getIdToken();
          if (!token) throw new KoiClientError('AUTH_REQUIRED', 'A verified email-link account is required.');
          const endpoint = name === ('submitQuizAnswer' as KoiCallableName) ? 'quiz/submit' : `koi/${name}`;
          const response = await fetch(`${config.workerUrl}/v1/${endpoint}`, {
            method: 'POST',
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await response.json().catch(() => null);
          if (!response.ok) {
            const error = typeof data === 'object' && data !== null && 'error' in data ? String(data.error) : 'provider_unavailable';
            const reason = error === 'chat_allowance_exhausted' ? 'CHAT_ALLOWANCE_EXHAUSTED' : error === 'provider_busy' ? 'TOKEN_PLAN_BUSY' : 'PROVIDER_UNAVAILABLE';
            throw new KoiClientError(reason, `Koi could not complete the request (${error}).`);
          }
          return data;
        }
        const callable = functionsModule.httpsCallable<Record<string, unknown>, unknown>(functions, name, {
          timeout: 55_000,
          limitedUseAppCheckTokens: true,
        });
        return (await callable(payload)).data;
      } catch (cause) {
        throw clientError(cause);
      }
    },
  };

  return {
    transport,
    getAuthSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot);
      return () => listeners.delete(listener);
    },
    async sendEmailLink(email) {
      const normalized = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) {
        throw new KoiClientError('INVALID_REQUEST', 'Enter a valid email address.');
      }
      await authModule.sendSignInLinkToEmail(auth, normalized, {
        url: config.emailLinkUrl,
        handleCodeInApp: true,
      });
    },
    isEmailLink: url => authModule.isSignInWithEmailLink(auth, url),
    async completeEmailLink(email, url) {
      const normalized = email.trim().toLowerCase();
      if (!await authModule.isSignInWithEmailLink(auth, url)) {
        throw new KoiClientError('INVALID_REQUEST', 'This is not a valid Koi sign-in link.');
      }
      const credential = await authModule.signInWithEmailLink(auth, normalized, url);
      if (!credential.user.emailVerified) {
        await authModule.signOut(auth);
        throw new KoiClientError('AUTH_REQUIRED', 'The email-link account was not verified.');
      }
    },
    setEnrollmentStatus(enrollmentStatus) {
      publish({ ...snapshot, enrollmentStatus });
    },
    signOut: () => authModule.signOut(auth),
    dispose() {
      unsubscribeAuth();
      listeners.clear();
    },
  };
}
