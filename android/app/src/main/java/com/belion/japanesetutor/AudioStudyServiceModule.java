package com.belion.japanesetutor;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import org.json.JSONArray;
import org.json.JSONObject;

public final class AudioStudyServiceModule extends ReactContextBaseJavaModule {
  private static ReactApplicationContext reactContext;

  public AudioStudyServiceModule(ReactApplicationContext context) {
    super(context);
    reactContext = context;
  }

  @NonNull
  @Override
  public String getName() {
    return "AudioStudyService";
  }

  @ReactMethod
  public void startLoop(ReadableArray items, int startIndex, boolean loop, int wordDelayMs, Promise promise) {
    try {
      if (items.size() == 0) {
        promise.reject("audio_study_empty_playlist", "Audio study needs at least one item.");
        return;
      }
      JSONArray jsonItems = new JSONArray();
      for (int i = 0; i < items.size(); i++) {
        ReadableMap item = items.getMap(i);
        JSONObject jsonItem = new JSONObject();
        jsonItem.put("reading", item.hasKey("reading") ? item.getString("reading") : "");
        jsonItem.put("english", item.hasKey("english") ? item.getString("english") : "");
        jsonItems.put(jsonItem);
      }
      Context context = getReactApplicationContext();
      Intent intent = new Intent(context, AudioStudyForegroundService.class)
        .setAction(AudioStudyForegroundService.ACTION_START)
        .putExtra(AudioStudyForegroundService.EXTRA_ITEMS, jsonItems.toString())
        .putExtra(AudioStudyForegroundService.EXTRA_START_INDEX, startIndex)
        .putExtra(AudioStudyForegroundService.EXTRA_LOOP, loop)
        .putExtra(AudioStudyForegroundService.EXTRA_WORD_DELAY_MS, wordDelayMs);
      ComponentName startedService = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
        ? context.startForegroundService(intent)
        : context.startService(intent);
      if (startedService == null) {
        promise.reject("audio_study_start_failed", "Android did not start the audio study service.");
        return;
      }
      promise.resolve(null);
    } catch (Exception error) {
      promise.reject("audio_study_start_failed", "Unable to start Android background audio.", error);
    }
  }

  @ReactMethod
  public void stopLoop() {
    Context context = getReactApplicationContext();
    context.startService(new Intent(context, AudioStudyForegroundService.class)
      .setAction(AudioStudyForegroundService.ACTION_STOP));
  }

  static void emitProgress(int index, boolean playing) {
    if (reactContext == null || !reactContext.hasActiveCatalystInstance()) return;
    WritableMap payload = Arguments.createMap();
    payload.putInt("index", index);
    payload.putBoolean("playing", playing);
    reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
      .emit("AudioStudyProgress", payload);
  }
}
