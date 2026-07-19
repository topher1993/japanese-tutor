// Expo SDK 54 / expo-sqlite web export support.
//
// expo-sqlite imports wa-sqlite.wasm for web. Metro's default resolver in this
// project did not include wasm as an asset extension, so `npx expo export
// --platform web` failed to resolve node_modules/expo-sqlite/web/wa-sqlite/*.wasm
// even though the file exists on disk.

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts = Array.from(new Set([
  ...config.resolver.assetExts,
  'wasm',
  'glb',
]));

module.exports = config;
