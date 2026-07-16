import type { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

import {
  KOI_DEFAULT_SPEECH_INPUT_LOCALE,
  createUnavailableKoiDeviceSttAdapter,
  toKoiSpeechTranscript,
  type KoiDeviceSttAdapter,
  type KoiDeviceSttSession,
  type KoiSpeechInputEndReason,
  type KoiSpeechPermissionState,
} from './speechInput';

type SpeechModule = typeof ExpoSpeechRecognitionModule;

export interface KoiExpoDeviceSttDependencies {
  loadModule?: () => Promise<{ ExpoSpeechRecognitionModule: SpeechModule }>;
  now?: () => number;
}

function permissionState(value: { granted?: boolean; status?: string }): KoiSpeechPermissionState {
  if (value.granted || value.status === 'granted') return 'granted';
  if (value.status === 'denied') return 'denied';
  return 'undetermined';
}

/**
 * Native/web Expo adapter that requires the operating system's on-device
 * recognizer. The dependency is loaded only when dictation is requested, so
 * unsupported dev clients retain the text composer. Recording persistence and
 * file/audio-source transcription are explicitly disabled.
 */
export function createExpoKoiDeviceSttAdapter(
  dependencies: KoiExpoDeviceSttDependencies = {},
): KoiDeviceSttAdapter {
  const loadModule = dependencies.loadModule ?? (() => import('expo-speech-recognition'));
  const now = dependencies.now ?? Date.now;
  let cancelActive: (() => void) | null = null;

  const loadSupported = async (): Promise<SpeechModule | null> => {
    try {
      const module = (await loadModule()).ExpoSpeechRecognitionModule;
      return module.isRecognitionAvailable() && module.supportsOnDeviceRecognition()
        ? module
        : null;
    } catch {
      return null;
    }
  };

  return {
    async getAvailability() {
      const module = await loadSupported();
      if (!module) return createUnavailableKoiDeviceSttAdapter().getAvailability();
      const permission = permissionState(await module.getPermissionsAsync());
      let supportedLocales: string[] = [];
      try {
        const locales = await module.getSupportedLocales({});
        supportedLocales = locales.installedLocales.length
          ? locales.installedLocales
          : locales.locales;
      } catch {
        // Some Android recognition services cannot enumerate their locales.
        // The recognizer can still validate ja-JP when start() is called.
      }
      return {
        available: true,
        permission,
        ...(permission === 'denied' ? { reason: 'permission-denied' as const } : {}),
        capabilities: {
          engine: 'device-stt',
          output: 'transcript-only',
          rawAudioRetention: false,
          supportsPartialResults: true,
          supportedLocales,
        },
      };
    },

    async requestPermission() {
      const module = await loadSupported();
      if (!module) return 'undetermined';
      return permissionState(await module.requestPermissionsAsync());
    },

    async start(options, onTranscript, onError, onEnd): Promise<KoiDeviceSttSession> {
      const module = await loadSupported();
      if (!module) throw new Error('On-device speech recognition is unavailable.');
      if (permissionState(await module.getPermissionsAsync()) !== 'granted') {
        throw new Error('Microphone and speech-recognition permission is required.');
      }

      cancelActive?.();
      let finished = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const subscriptions: Array<{ remove(): void }> = [];
      const finish = (reason: KoiSpeechInputEndReason) => {
        if (finished) return false;
        finished = true;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        for (const subscription of subscriptions) subscription.remove();
        if (cancelActive === cancel) cancelActive = null;
        onEnd({ reason, endedAt: now() });
        return true;
      };
      const cancel = () => {
        if (!finish('cancelled')) return;
        module.abort();
      };
      cancelActive = cancel;

      subscriptions.push(module.addListener('result', event => {
        if (finished) return;
        const result = event.results[0];
        const transcript = toKoiSpeechTranscript({
          transcript: result?.transcript,
          confidence: result?.confidence,
          locale: options.locale,
          isFinal: event.isFinal,
          capturedAt: now(),
        }, { fallbackLocale: KOI_DEFAULT_SPEECH_INPUT_LOCALE, now: now() });
        try {
          if (transcript) onTranscript(transcript);
        } finally {
          if (event.isFinal && finish('completed')) module.stop();
        }
      }));
      subscriptions.push(module.addListener('error', event => {
        if (finished) return;
        try {
          onError(new Error(event.message || `Speech recognition failed: ${event.error}.`));
        } finally {
          finish('error');
        }
      }));
      subscriptions.push(module.addListener('end', () => {
        finish('completed');
      }));

      const maxDurationMs = Number.isFinite(options.maxDurationMs)
        ? Math.min(60_000, Math.max(1_000, Math.round(options.maxDurationMs)))
        : 15_000;
      timer = setTimeout(() => {
        if (finish('timeout')) module.stop();
      }, maxDurationMs);
      try {
        module.start({
          lang: options.locale || KOI_DEFAULT_SPEECH_INPUT_LOCALE,
          interimResults: options.partialResults,
          continuous: false,
          maxAlternatives: 1,
          requiresOnDeviceRecognition: true,
          addsPunctuation: true,
          recordingOptions: { persist: false },
        });
      } catch (cause) {
        finish('error');
        throw cause;
      }

      return {
        async stop() {
          if (finish('stopped')) module.stop();
        },
        async cancel() {
          cancel();
        },
      };
    },
  };
}
