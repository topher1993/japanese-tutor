// Expo SDK 54 / expo-sqlite web export support.
//
// expo-sqlite imports wa-sqlite.wasm for web. Metro's default resolver in this
// project did not include wasm as an asset extension, so `npx expo export
// --platform web` failed to resolve node_modules/expo-sqlite/web/wa-sqlite/*.wasm
// even though the file exists on disk.

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const threeCommonJsEntry = require.resolve('three');

config.resolver.assetExts = Array.from(new Set([
  ...config.resolver.assetExts,
  'wasm',
  'glb',
]));

// React Three Fiber's native bundle loads Three.js through CommonJS so it can
// install the Expo asset/file-loader polyfills. App imports normally resolve to
// Three's ESM build, which creates a second module instance and leaves GLTFLoader
// unpatched. Force one shared native instance so bundled numeric asset IDs are
// handled by the native loader shim.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if ((platform === 'android' || platform === 'ios') && moduleName === 'three') {
    return context.resolveRequest(context, threeCommonJsEntry, platform);
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
