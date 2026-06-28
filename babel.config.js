module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // react-native-worklets/plugin MUST be first per Expo + Reanimated 4 docs.
      // Reanimated 4 split its worklet transform into the separate react-native-worklets package.
      'react-native-worklets/plugin',
    ],
  };
};