import React, { useState, useCallback, useEffect, useRef } from "react";
import { Alert, View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import TrackPlayer, { Capability } from "react-native-track-player";
import AudioRecorderPlayer from "react-native-audio-recorder-player";

type Word = {
  Cree: string;
  Pronunciation?: string;
  Meaning?: string;
  AudioUrl?: string;
};

const API_URL = "http://172.20.10.5:4000/api/activities/search"; 
// iOS 시뮬레이터 = localhost, Android 에뮬레이터 = 10.0.2.2 로 바꾸세요.
// iphone Jisoo: 192.75.244.32

function normalizeWord(raw: any): Word | null {
  if (!raw) return null;

  // 배열이면 첫 요소 사용
  const item = Array.isArray(raw)
    ? raw[0]
    : // 흔한 래핑 형태들 대응
      raw.item ?? raw.result ?? raw.data ?? raw.word ?? raw;

  if (!item) return null;

  return {
    Cree: item.Cree ?? item.cree ?? item.word ?? "",
    Pronunciation: item.Pronunciation ?? item.pronunciation ?? item.pron ?? "",
    Meaning: item.Meaning ?? item.meaning ?? item.translation ?? "",
    AudioUrl: item.AudioUrl ?? item.audioUrl ?? item.audio ?? ""
  };
}

const WordsScreen = () => {
  const [word, setWord] = useState<Word | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRecording, setRecording] = useState(false);
  const [filePath, setFilePath] = useState<string | null>(null);

    const audioRecorderPlayer = useRef(new AudioRecorderPlayer()).current;

  const toggleRecording = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const startRecording = async () => {
    try {
      const result = await audioRecorderPlayer.startRecorder();
      setRecording(true);
      console.log('Recording started:', result);
      setFilePath(null); // clear previous file
    } catch (err) {
      console.error('Start recording error:', err);
      Alert.alert('Error', 'Failed to start recording');
    }
  };
  
  const stopRecording = async () => {
    try {
      const result = await audioRecorderPlayer.stopRecorder();
      setRecording(false);
      console.log('Recording stopped:', result);
      setFilePath(result); // store file path
      await uploadRecording(word?.Cree || ""); 
    } catch (err) {
      console.error('Stop recording error:', err);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const uploadRecording = async (refText: string) => {
    if (!filePath) return Alert.alert("No recording", "Please record first");
  
    const formData = new FormData();
    formData.append("audio", {
      uri: filePath,
      name: "recording.m4a",
      type: "audio/m4a",
    });
    formData.append("text", refText);
  
    const res = await fetch("http://YOUR_SERVER/api/pronounce/assess", {
      method: "POST",
      body: formData,
      headers: { "Content-Type": "multipart/form-data" },
    });
  
    const data = await res.json();
    console.log("Pronunciation Assessment:", data);
  };

  useEffect(() => {
    (async () => {
      try {
        await TrackPlayer.setupPlayer();
        await TrackPlayer.updateOptions({
          capabilities: [Capability.Play, Capability.Pause],
        });
        console.log("🎧 TrackPlayer ready");
      } catch (e) {
        console.error("TrackPlayer setup failed:", e);
      }
    })();

    return () => {
      (async () => {
        try {
          await TrackPlayer.destroy();
          console.log("🧹 TrackPlayer destroyed");
        } catch {}
      })();
    };
  }, []);

  const fetchWord = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await res.json();
      console.log("API raw:", data);
      setWord(normalizeWord(data));
    } catch (err) {
      console.error("API error:", err);
      setWord(null);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchWord();
    }, [])
  );

  const playAudio = async () => {
    if (!word?.AudioUrl) {
      console.warn("⚠️ No AudioUrl found for this word");
      return;
    }

    try {
      console.log("🎵 Playing:", word.AudioUrl);
      await TrackPlayer.reset(); // 이전 재생 초기화
      await TrackPlayer.add({
        id: "word-audio",
        url: word.AudioUrl, // Flask에서 받은 mp3 파일 URL
        title: word.Cree || "Cree Word",
      });
      await TrackPlayer.play();
    } catch (error) {
      console.error("Audio playback error:", error);
    }
  };

  return (
    <View style={styles.container}>
      {loading && <ActivityIndicator size="large" color="#2E3A1C" style={{ marginBottom: 24 }} />}

      {word ? (
        <>
          <Text style={styles.creeText}>{word.Cree}</Text>
          {!!word.Pronunciation && <Text style={styles.pronunciation}>[{word.Pronunciation}]</Text>}

          <TouchableOpacity style={styles.soundButton} onPress={playAudio}>
            <Image source={require("../../assets/images/play.png")} style={styles.soundIcon} />
          </TouchableOpacity>

          {!!word.Meaning && <Text style={styles.meaning}>Meaning: {word.Meaning}</Text>}
        </>
      ) : !loading ? (
        <Text>no data</Text>
      ) : null}
      {/* Floating refresh Button */}
{/* Action Row: 왼쪽(레코딩), 오른쪽(리프레시) */}
<View style={styles.actionRow}>
  {/* 🎤 Record / ⏸ Pause 토글 버튼 (왼쪽) */}
  <TouchableOpacity
  style={styles.roundButton}
  onPress={toggleRecording}
  activeOpacity={0.9}
  accessibilityRole="button"
  accessibilityLabel={isRecording ? "Pause recording" : "Start recording"}
>
  <Image
    source={
      isRecording
        ? require("../../assets/images/pause.png")
        : require("../../assets/images/microphone.png")
    }
    style={styles.roundIcon}
  />
</TouchableOpacity>

  {/* 🔄 Refresh 버튼 (오른쪽) */}
  <TouchableOpacity
    style={styles.roundButton}
    onPress={fetchWord}
    activeOpacity={0.9}
    accessibilityRole="button"
    accessibilityLabel="Refresh word"
  >
    <Image
      source={require("../../assets/images/refresh.png")}
      style={[styles.roundIcon, { tintColor: "#fff" }]}
    />
  </TouchableOpacity>
</View>

      {/* 🔽 저작권 표시 (Copyright) */}
<Text style={styles.copyright}>© 2025 Cree. All rights reserved.</Text>

    </View>
  );
};

const styles = StyleSheet.create({
  container:{ flex:1, justifyContent:"center", alignItems:"center", backgroundColor:"#FCFCF8", padding:20 },
  creeText:{ fontSize:60, color:"#2E3A1C", marginBottom:10, fontWeight:"600" },
  pronunciation:{ fontSize:20, color:"#555", marginBottom:30 },
  meaning:{ fontSize:18, color:"#333", marginTop:20 },
  soundButton:{ backgroundColor:"#E8F2E2", borderRadius:40, padding:15, shadowColor:"#000", shadowOpacity:0.2, shadowRadius:5 },
  soundIcon:{ width:30, height:30, tintColor:"#2E3A1C" },
  refreshButton: { position: 'absolute', bottom: 80,  alignSelf: 'center', backgroundColor: '#A2C98F', borderRadius: 50, padding: 16, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, elevation: 5,},
  refreshIcon: { width: 28, height: 28, tintColor: '#fff',}
,
copyright: {
  position: 'absolute',       // ✅ 항상 하단 고정
  bottom: 20,                 // 하단 여백
  width: '100%',
  textAlign: 'center',
  fontSize: 12,
  color: '#6b7280',           // 회색톤
},
actionRow: {
  position: 'absolute',
  bottom: 92,                 // 탭바 위에 뜨도록 (필요하면 조정)
  width: '86%',
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignSelf: 'center',
},

roundButton: {
  backgroundColor: '#A2C98F',
  width: 64,
  height: 64,
  borderRadius: 32,
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: '#000',
  shadowOpacity: 0.25,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 4 },
  elevation: 6,
},

roundIcon: {
  width: 28,
  height: 28,
  tintColor: '#1A2E05', // pause/mic는 녹색 라벨 유지, refresh는 위에서 흰색으로 오버라이드
},

});

export default WordsScreen;
