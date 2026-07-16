export type KoiRuntimeStage = 'mock' | 'development' | 'staging' | 'production';

export interface KoiPublicRuntimeConfig {
  stage: KoiRuntimeStage;
  firebaseProjectId?: string;
  functionsRegion: string;
  useEmulators: boolean;
  functionsEmulatorOrigin?: string;
}

export interface KoiPublicEnvironment {
  EXPO_PUBLIC_KOI_STAGE?: string;
  EXPO_PUBLIC_FIREBASE_PROJECT_ID?: string;
  EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION?: string;
  EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_ORIGIN?: string;
  [name: string]: string | undefined;
}

const STAGES: readonly KoiRuntimeStage[] = ['mock', 'development', 'staging', 'production'];
const SECRET_NAME_PATTERN = /(?:MINIMAX|TOKEN_PLAN).*(?:KEY|SECRET|TOKEN)|(?:KEY|SECRET|TOKEN).*(?:MINIMAX|TOKEN_PLAN)/i;

function normalizeOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().replace(/\/$/, '');
  if (!/^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(normalized)) {
    throw new Error('Koi emulator origin must be an http(s) origin without a path.');
  }
  return normalized;
}

/** Fails the build/runtime check if a MiniMax secret is ever placed in an
 * Expo public variable, where it would be embedded in the app bundle. */
export function assertNoKoiClientSecrets(environment: KoiPublicEnvironment): void {
  const exposed = Object.entries(environment).find(([name, value]) => (
    name.startsWith('EXPO_PUBLIC_') && Boolean(value?.trim()) && SECRET_NAME_PATTERN.test(name)
  ));
  if (exposed) throw new Error(`${exposed[0]} must never be present in the mobile app environment.`);
}

export function resolveKoiPublicRuntimeConfig(
  environment: KoiPublicEnvironment,
): KoiPublicRuntimeConfig {
  assertNoKoiClientSecrets(environment);
  const stage = (environment.EXPO_PUBLIC_KOI_STAGE?.trim() || 'mock') as KoiRuntimeStage;
  if (!STAGES.includes(stage)) throw new Error(`Unsupported Koi runtime stage: ${stage}.`);
  const functionsRegion = environment.EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION?.trim() || 'us-central1';
  if (!/^[a-z]+(?:-[a-z0-9]+)+\d$/.test(functionsRegion)) {
    throw new Error('Koi Firebase Functions region is invalid.');
  }
  const firebaseProjectId = environment.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim() || undefined;
  const emulatorOrigin = normalizeOrigin(environment.EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_ORIGIN);
  if (stage !== 'mock' && !firebaseProjectId) {
    throw new Error('A Firebase project id is required outside Koi mock mode.');
  }
  if (stage === 'production' && emulatorOrigin) {
    throw new Error('Koi production must never call a Firebase emulator.');
  }
  return {
    stage,
    firebaseProjectId,
    functionsRegion,
    useEmulators: stage !== 'production' && Boolean(emulatorOrigin),
    functionsEmulatorOrigin: emulatorOrigin,
  };
}

