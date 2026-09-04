// MyApp/client/App.tsx
import React, { useEffect, useRef } from 'react';
import BottomTabNav from './src/navigation/BottomTabNav';
import TrackPlayer, { Capability } from 'react-native-track-player';

export default function App() {
  const playerReadyRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await TrackPlayer.setupPlayer();
        if (!mounted) return;
        playerReadyRef.current = true;

        await TrackPlayer.updateOptions({
          capabilities: [Capability.Play, Capability.Pause, Capability.Stop],
        });

        console.log('🎧 TrackPlayer initialized');
      } catch (e) {
        console.error('TrackPlayer setup error:', e);
      }
    })();

    // ✅ 안전한 cleanup
    return () => {
      mounted = false;
      (async () => {
        try {
          if (!playerReadyRef.current) return;

          // 개발/핫리로드/시뮬레이터에서도 안전
          await TrackPlayer.reset();

        } catch (err) {
          console.warn('cleanup error (ignored):', err);
        } finally {
          playerReadyRef.current = false;
        }
      })();
    };
  }, []);

  return <BottomTabNav />;
}
