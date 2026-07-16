package com.belion.japanesetutor;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Locale;

public final class AudioStudyForegroundService extends Service {
  static final String ACTION_START = "com.belion.japanesetutor.AUDIO_STUDY_START";
  static final String ACTION_STOP = "com.belion.japanesetutor.AUDIO_STUDY_STOP";
  static final String EXTRA_ITEMS = "audio_items";
  static final String EXTRA_START_INDEX = "audio_start_index";
  static final String EXTRA_LOOP = "audio_loop";
  static final String EXTRA_WORD_DELAY_MS = "audio_word_delay_ms";
  private static final String CHANNEL_ID = "audio-study-loop";
  private static final int NOTIFICATION_ID = 4101;
  private static final long MEANING_DELAY_MS = 450L;
  private static final long WORD_DELAY_MS = 800L;

  private final ArrayList<AudioItem> items = new ArrayList<>();
  private TextToSpeech textToSpeech;
  private boolean ttsInitialized;
  private boolean ttsReady;
  private boolean stopped = true;
  private boolean loop;
  private int index;
  private long wordDelayMs = WORD_DELAY_MS;

  @Override
  public void onCreate() {
    super.onCreate();
    createNotificationChannel();
    textToSpeech = new TextToSpeech(this, status -> {
      ttsInitialized = true;
      ttsReady = status == TextToSpeech.SUCCESS;
      if (!stopped) {
        if (ttsReady) speakCurrent();
        else stopLoop();
      }
    });
    textToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
      @Override public void onStart(String utteranceId) { }
      @Override public void onError(String utteranceId) { stopLoop(); }
      @Override public void onError(String utteranceId, int errorCode) { stopLoop(); }
      @Override public void onDone(String utteranceId) { onSpeechFinished(utteranceId); }
    });
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null && ACTION_STOP.equals(intent.getAction())) {
      stopLoop();
      return START_NOT_STICKY;
    }
    if (intent != null && ACTION_START.equals(intent.getAction())) {
      items.clear();
      try {
        JSONArray jsonItems = new JSONArray(intent.getStringExtra(EXTRA_ITEMS));
        for (int i = 0; i < jsonItems.length(); i++) {
          JSONObject item = jsonItems.getJSONObject(i);
          items.add(new AudioItem(item.optString("reading"), item.optString("english")));
        }
      } catch (Exception ignored) { }
      index = Math.max(0, intent.getIntExtra(EXTRA_START_INDEX, 0));
      loop = intent.getBooleanExtra(EXTRA_LOOP, true);
      wordDelayMs = Math.max(300L, Math.min(3000L, (long) intent.getIntExtra(EXTRA_WORD_DELAY_MS, (int) WORD_DELAY_MS)));
      stopped = items.isEmpty();
      startForeground(NOTIFICATION_ID, buildNotification());
      if (stopped) stopLoop();
      else if (ttsReady) speakCurrent();
      else if (ttsInitialized) stopLoop();
    } else if (intent == null || !ACTION_STOP.equals(intent.getAction())) {
      stopSelf(startId);
    }
    // The playlist is process-local. Do not claim the service can resume after
    // Android kills it without first persisting the items and playback index.
    return START_NOT_STICKY;
  }

  private void speakCurrent() {
    if (stopped || items.isEmpty()) return;
    if (index >= items.size()) {
      if (loop) index = 0;
      else { stopLoop(); return; }
    }
    AudioStudyServiceModule.emitProgress(index, true);
    AudioItem item = items.get(index);
    textToSpeech.setLanguage(Locale.JAPAN);
    textToSpeech.setSpeechRate(0.78f);
    if (textToSpeech.speak(item.reading, TextToSpeech.QUEUE_FLUSH, speechParams(), "ja-" + index) == TextToSpeech.ERROR) {
      stopLoop();
    }
  }

  private void speakMeaning() {
    if (stopped || index >= items.size()) return;
    AudioItem item = items.get(index);
    textToSpeech.setLanguage(Locale.US);
    textToSpeech.setSpeechRate(0.92f);
    if (textToSpeech.speak(item.english, TextToSpeech.QUEUE_FLUSH, speechParams(), "en-" + index) == TextToSpeech.ERROR) {
      stopLoop();
    }
  }

  private void onSpeechFinished(String utteranceId) {
    if (stopped) return;
    if (utteranceId.startsWith("ja-")) {
      new android.os.Handler(getMainLooper()).postDelayed(this::speakMeaning, MEANING_DELAY_MS);
    } else if (utteranceId.startsWith("en-")) {
      new android.os.Handler(getMainLooper()).postDelayed(() -> {
        if (stopped) return;
        index += 1;
        speakCurrent();
      }, wordDelayMs);
    }
  }

  private Bundle speechParams() {
    Bundle params = new Bundle();
    params.putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_MUSIC);
    return params;
  }

  private Notification buildNotification() {
    Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
    PendingIntent pending = PendingIntent.getActivity(this, 0, launch,
      PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
    Intent stopIntent = new Intent(this, AudioStudyForegroundService.class).setAction(ACTION_STOP);
    PendingIntent stopPending = PendingIntent.getService(this, 1, stopIntent,
      PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
    return new NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_media_play)
      .setContentTitle("Japanese Tutor")
      .setContentText("Audio study loop is playing")
      .setOngoing(true)
      .setContentIntent(pending)
      .addAction(android.R.drawable.ic_media_pause, "Stop", stopPending)
      .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
      .build();
  }

  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Audio study loop", NotificationManager.IMPORTANCE_LOW);
    channel.setDescription("Keeps Japanese audio study playing while the app is minimized.");
    getSystemService(NotificationManager.class).createNotificationChannel(channel);
  }

  private void stopLoop() {
    stopped = true;
    if (textToSpeech != null) { textToSpeech.stop(); }
    AudioStudyServiceModule.emitProgress(Math.min(index, Math.max(0, items.size() - 1)), false);
    if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE);
    else stopForeground(true);
    stopSelf();
  }

  @Override public void onTaskRemoved(Intent rootIntent) { /* remain foreground while minimized */ }

  @Override public void onDestroy() {
    stopped = true;
    if (textToSpeech != null) { textToSpeech.stop(); textToSpeech.shutdown(); }
    super.onDestroy();
  }

  @Nullable @Override public IBinder onBind(Intent intent) { return null; }

  private static final class AudioItem {
    final String reading;
    final String english;
    AudioItem(String reading, String english) { this.reading = reading; this.english = english; }
  }
}
