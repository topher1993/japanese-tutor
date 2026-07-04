// Vitest setup file.
// Defines React Native globals that are normally injected at runtime by the
// Expo/Metro bundler but absent in plain Node test environment.

declare const __DEV__: boolean;
(globalThis as { __DEV__?: boolean }).__DEV__ = true;