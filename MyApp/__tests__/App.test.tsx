/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../client/App';


// TrackPlayer 가짜 모듈 설정
jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    setupPlayer: jest.fn(() => Promise.resolve()),
    updateOptions: jest.fn(),
    add: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    stop: jest.fn(),
    reset: jest.fn(),
    addEventListener: jest.fn(),
  },
  Capability: {
    Play: 0,
    Pause: 1,
    Stop: 2,
  },
  Event: {
    PlaybackState: 'playback-state',
    PlaybackError: 'playback-error',
  },
  State: {
    None: 'none',
    Ready: 'ready',
    Playing: 'playing',
    Paused: 'paused',
    Stopped: 'stopped',
  },
  usePlaybackState: jest.fn(() => ({ state: 'none' })),
  useProgress: jest.fn(() => ({ position: 0, duration: 0, buffered: 0 })),
}));



test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
