import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const moduleSource = readFileSync('android/app/src/main/java/com/belion/japanesetutor/AudioStudyServiceModule.java', 'utf8');
const serviceSource = readFileSync('android/app/src/main/java/com/belion/japanesetutor/AudioStudyForegroundService.java', 'utf8');
const panelSource = readFileSync('src/components/AudioStudyPanel.tsx', 'utf8');

describe('Android audio-study lifecycle contract', () => {
  it('reports native start failures through the React Native promise', () => {
    expect(moduleSource).toMatch(/startLoop\([^)]*Promise promise\)/);
    expect(moduleSource).toContain('promise.resolve(null)');
    expect(moduleSource).toContain('promise.reject("audio_study_start_failed"');
    expect(moduleSource).not.toContain('catch (Exception ignored)');
  });

  it('does not advertise process-death resumability without persisted playback state', () => {
    expect(serviceSource).toContain('return START_NOT_STICKY;');
    expect(serviceSource).not.toContain('return START_STICKY;');
    expect(serviceSource).toContain('@Override public void onError(String utteranceId) { stopLoop(); }');
    expect(serviceSource).toContain('stopSelf(startId)');
  });

  it('offers a notification action that stops the foreground loop', () => {
    expect(serviceSource).toContain('new Intent(this, AudioStudyForegroundService.class).setAction(ACTION_STOP)');
    expect(serviceSource).toContain('.addAction(android.R.drawable.ic_media_pause, "Stop", stopPending)');
  });

  it('requests notification permission and falls back when native startup rejects', () => {
    expect(panelSource).toContain('PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS');
    expect(panelSource).toContain('result === PermissionsAndroid.RESULTS.GRANTED');
    expect(panelSource).toContain('await nativeAudioStudyService.startLoop(');
    expect(panelSource).toContain('Background playback could not start');
    expect(panelSource).toMatch(/await nativeAudioStudyService\.startLoop\([\s\S]*?catch \{[\s\S]*?setPlaying\(false\);[\s\S]*?playWithExpo\(cardIndex, token\)/);
  });

  it('truthfully distinguishes native system voices from Expo fallback voices', () => {
    expect(panelSource).toContain('Background loop: Android system Japanese and English voices.');
    expect(panelSource).toContain('In-app fallback:');
  });
});
