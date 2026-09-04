// jest.config.js
module.exports = {
  preset: 'react-native',
  moduleNameMapper: {
    '\\.(mp3)$': '<rootDir>/__mocks__/fileMock.js',
  },
  transformIgnorePatterns: [
    // 💡 맨 끝에 |react-native-audio-recorder-player 를 추가했습니다.
    'node_modules/(?!(react-native|@react-native|@react-navigation|@react-native-community|react-native-track-player|react-native-audio-recorder-player)/)',
  ],
};
