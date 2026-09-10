import React, { useState, useRef, useCallback, useEffect } from "react";
import { Alert, View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from "react-native";
import TrackPlayer from "react-native-track-player";
import AudioRecorderPlayer from "react-native-audio-recorder-player";
import {
  configureAudioSession,
  deactivateAudioSession,
  getMicrophonePermissionStatus,
  onAudioChunk,
  requestMicrophonePermission,
  startRecording as startPcmRecording,
  stopRecording as stopPcmRecording,
} from "@mindinventory/react-native-nitro-realtime-audio";
import { useFocusEffect } from "@react-navigation/native";

type Word = {
  Id: string;
  Cree: string;
  Pronunciation?: string;
  Meaning?: string;
  AudioUrl?: string;
  Category?: string;
  Difficulty?: string;
  SourceUrl?: string;
};

type AssessmentResult = {
  text: string;
  scores: {
    accuracy: number;
    fluency: number;
    completeness: number;
  };
};

type AssessmentSocketMessage =
  | { type: "ready" }
  | ({ type: "result" } & AssessmentResult)
  | { type: "error"; message: string };

const API_URL = "http://127.0.0.1:4000/api/activities/search"; 
const PCM_SAMPLE_RATE = 16000;
const PCM_CHANNELS = 1;
const PCM_BITS_PER_SAMPLE = 16;
// iOS 시뮬레이터 = localhost, Android 에뮬레이터 = 10.0.2.2 로 바꾸기.
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
    Id: item.Id ?? item.id ?? "",
    Cree: item.Cree ?? item.cree ?? item.word ?? "",
    Pronunciation: item.Pronunciation ?? item.pronunciation ?? item.pron ?? "",
    Meaning: item.Meaning ?? item.meaning ?? item.translation ?? "",
    AudioUrl: item.AudioUrl ?? item.audioUrl ?? item.audio ?? "",
    Category: item.Category ?? item.category ?? "",
    Difficulty: item.Difficulty ?? item.difficulty ?? "",
    SourceUrl: item.SourceUrl ?? item.sourceUrl ?? "",
  };
}

const WordsScreen = () => {
  const [word, setWord] = useState<Word | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRecording, setRecording] = useState(false);
  const [assessment, setAssessment] =
    useState<AssessmentResult | null>(null);
  const [isAssessing, setIsAssessing] = useState(false);
  const [isPcmTesting, setIsPcmTesting] = useState(false);
  const [isPcmConnecting, setIsPcmConnecting] = useState(false);
  const pcmTestActiveRef = useRef(false);
  const pcmAwaitingResultRef = useRef(false);
  const pcmChunkCountRef = useRef(0);
  const pcmTotalBytesRef = useRef(0);
  const pcmSocketRef = useRef<WebSocket | null>(null);
  const currentWordIdRef = useRef<string | null>(null);

    const audioRecorderPlayer = useRef(new AudioRecorderPlayer()).current;

  useEffect(() => {
    onAudioChunk(buffer => {
      if (!pcmTestActiveRef.current) return;

      const chunkBytes = buffer.byteLength;
      pcmChunkCountRef.current += 1;
      pcmTotalBytesRef.current += chunkBytes;

      if (pcmChunkCountRef.current === 1 || pcmChunkCountRef.current % 10 === 0) {
        console.log(
          `PCM chunk ${pcmChunkCountRef.current}: ${chunkBytes} bytes`,
        );
      }

      const socket = pcmSocketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(buffer);
      }
    });

    return () => {
      if (pcmTestActiveRef.current) {
        try {
          stopPcmRecording();
          deactivateAudioSession();
        } catch (err) {
          console.error("PCM cleanup error:", err);
        } finally {
          pcmTestActiveRef.current = false;
        }
      }

      pcmAwaitingResultRef.current = false;
      const socket = pcmSocketRef.current;
      pcmSocketRef.current = null;
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
      }
    };
  }, []);

  const startPcmTest = async () => {
    if (isRecording || isAssessing || isPcmTesting || isPcmConnecting) {
      Alert.alert("Microphone busy", "Finish the current recording or assessment first.");
      return;
    }

    const referenceText = word?.Pronunciation || word?.Cree || "";
    if (!referenceText.trim()) {
      Alert.alert("No word", "Please select a word first.");
      return;
    }

    try {
      let permission = getMicrophonePermissionStatus();
      if (permission !== "granted") {
        permission = await requestMicrophonePermission();
      }
      if (permission !== "granted") {
        Alert.alert("Microphone permission", "Microphone access is required for the PCM test.");
        return;
      }

      pcmChunkCountRef.current = 0;
      pcmTotalBytesRef.current = 0;
      pcmAwaitingResultRef.current = false;
      setAssessment(null);
      setIsPcmConnecting(true);

      const socket = new WebSocket("ws://127.0.0.1:4000/ws/audio");
      pcmSocketRef.current = socket;

      const failPcmSession = (message: string, error?: unknown) => {
        if (pcmTestActiveRef.current) {
          try {
            stopPcmRecording();
            deactivateAudioSession();
          } catch (stopError) {
            console.error("PCM cleanup error:", stopError);
          } finally {
            pcmTestActiveRef.current = false;
          }
        }

        pcmAwaitingResultRef.current = false;
        setIsPcmConnecting(false);
        setIsPcmTesting(false);
        setIsAssessing(false);
        if (pcmSocketRef.current === socket) {
          pcmSocketRef.current = null;
        }
        socket.close();
        if (error) console.error("PCM streaming error:", error);
        Alert.alert("Pronunciation assessment error", message);
      };

      socket.onmessage = event => {
        try {
          const message = JSON.parse(event.data) as AssessmentSocketMessage;

          if (message.type === "ready") {
            configureAudioSession({ mode: "record" });
            pcmTestActiveRef.current = true;
            startPcmRecording({
              sampleRate: PCM_SAMPLE_RATE,
              channels: PCM_CHANNELS,
              chunkDurationMs: 100,
            });
            setIsPcmConnecting(false);
            setIsPcmTesting(true);
            console.log("PCM streaming started: 16 kHz, mono, 16-bit");
            return;
          }

          if (message.type === "result") {
            const result: AssessmentResult = {
              text: message.text,
              scores: message.scores,
            };
            pcmAwaitingResultRef.current = false;
            setAssessment(result);
            setIsAssessing(false);
            pcmSocketRef.current = null;
            socket.close();
            console.log("Streaming pronunciation assessment:", result);
            return;
          }

          if (message.type === "error") {
            failPcmSession(message.message);
          }
        } catch (err) {
          failPcmSession("The server returned an invalid response.", err);
        }
      };

      socket.onopen = () => {
        socket.send(JSON.stringify({
          type: "start",
          text: referenceText,
        }));
      };

      socket.onerror = error => {
        failPcmSession("Could not connect to the audio server.", error);
      };

      socket.onclose = () => {
        const wasCurrentSocket = pcmSocketRef.current === socket;
        const wasRecording = pcmTestActiveRef.current;

        if (wasRecording) {
          try {
            stopPcmRecording();
            deactivateAudioSession();
          } catch (stopError) {
            console.error("PCM cleanup error:", stopError);
          } finally {
            pcmTestActiveRef.current = false;
            setIsPcmTesting(false);
          }
        }

        if (wasCurrentSocket) {
          pcmSocketRef.current = null;
        }
        setIsPcmConnecting(false);

        if (pcmAwaitingResultRef.current) {
          pcmAwaitingResultRef.current = false;
          setIsAssessing(false);
          Alert.alert(
            "Connection closed",
            "The server disconnected before returning an assessment.",
          );
        } else if (wasCurrentSocket && wasRecording) {
          Alert.alert(
            "Connection closed",
            "The audio server disconnected during recording.",
          );
        }
      };

    } catch (err) {
      pcmTestActiveRef.current = false;
      setIsPcmConnecting(false);
      console.error("PCM test start error:", err);
      Alert.alert("PCM test error", "Failed to start live audio capture.");
    }
  };

  const stopPcmTest = () => {
    try {
      stopPcmRecording();
      deactivateAudioSession();
    } catch (err) {
      console.error("PCM test stop error:", err);
      Alert.alert("PCM test error", "Failed to stop live audio capture cleanly.");
    } finally {
      pcmTestActiveRef.current = false;
      setIsPcmTesting(false);

      const bytesPerSecond =
        PCM_SAMPLE_RATE * PCM_CHANNELS * (PCM_BITS_PER_SAMPLE / 8);
      const estimatedSeconds = pcmTotalBytesRef.current / bytesPerSecond;

      console.log("PCM test stopped", {
        chunks: pcmChunkCountRef.current,
        totalBytes: pcmTotalBytesRef.current,
        estimatedSeconds: Number(estimatedSeconds.toFixed(2)),
      });

      const socket = pcmSocketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        try {
          pcmAwaitingResultRef.current = true;
          setIsAssessing(true);
          socket.send(JSON.stringify({ type: "stop" }));
        } catch (err) {
          pcmAwaitingResultRef.current = false;
          setIsAssessing(false);
          socket.close();
          pcmSocketRef.current = null;
          console.error("PCM stop message error:", err);
          Alert.alert(
            "Connection error",
            "Could not request the pronunciation result.",
          );
        }
      } else {
        setIsAssessing(false);
        socket?.close();
        pcmSocketRef.current = null;
        Alert.alert(
          "Connection error",
          "The audio server connection is not open.",
        );
      }
    }
  };

  const togglePcmTest = () => {
    if (isPcmTesting) {
      stopPcmTest();
    } else {
      startPcmTest();
    }
  };

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
      setAssessment(null);
      setRecording(true);
      console.log('Recording started:', result);
    } catch (err) {
      console.error('Start recording error:', err);
      Alert.alert('Error', 'Failed to start recording');
    }
  };
  
  const stopRecording = async () => {
    let result: string;
    try {
      result = await audioRecorderPlayer.stopRecorder();
      setRecording(false);
      console.log('Recording stopped:', result);
    } catch (err) {
      console.error('Stop recording error:', err);
      Alert.alert('Error', 'Failed to stop recording');
      return;
    }
    try {
      await uploadRecording(result, word?.Cree || ""); 
      // await uploadRecording(result,"hello world"); 
    } catch (err) {
      console.error('record uploading error:', err);
    }
  };
  const uploadRecording = async (recordingUri: string, refText: string) => {

    if (!refText.trim()) return Alert.alert("No word", "Please select a word first");
    if (!recordingUri) return Alert.alert("No recording", "Please record first");

    setIsAssessing(true);

    try {
      const formData = new FormData();
      formData.append("audio", {
        uri: recordingUri,
        name: "recording.m4a",
        type: "audio/m4a",
      });
      formData.append("text", refText);

      const res = await fetch("http://127.0.0.1:4000/api/pronounce/assess", {
        method: "POST",
        body: formData,
        // headers: { "Content-Type": "multipart/form-data" },
      });
      if (!res.ok) {
        throw new Error("response not ok: Pronunciation assessment failed");
      }
      const data: AssessmentResult = await res.json();
      setAssessment(data);
      console.log("Pronunciation Assessment:", data);
    } finally {
      setIsAssessing(false);
    }
  };

  const fetchWord = async () => {
    setAssessment(null);
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          excludeId: currentWordIdRef.current,
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Word request failed (${res.status})`);
      }
      console.log("API raw:", data);
      const nextWord = normalizeWord(data);
      currentWordIdRef.current = nextWord?.Id || null;
      setWord(nextWord);
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

      {isAssessing && (
        <View>
          <ActivityIndicator size="small" color="#2E3A1C" />
          <Text>Assessing pronunciation...</Text>
        </View>
      )}

      {assessment && (
        <View>
          <Text>Recognized: {assessment.text}</Text>
          <Text>Accuracy: {assessment.scores.accuracy}</Text>
          <Text>Fluency: {assessment.scores.fluency}</Text>
          <Text>Completeness: {assessment.scores.completeness}</Text>
        </View>
      )}

      <TouchableOpacity
        disabled={isRecording || isAssessing || isPcmConnecting}
        style={[
          styles.pcmTestButton,
          (isRecording || isAssessing || isPcmConnecting) && styles.disabledButton,
        ]}
        onPress={togglePcmTest}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={isPcmTesting ? "Stop live assessment" : "Start live assessment"}
      >
        <Text style={styles.pcmTestButtonText}>
          {isPcmConnecting
            ? "Connecting..."
            : isPcmTesting
              ? "Stop live assessment"
              : "Start live assessment"}
        </Text>
      </TouchableOpacity>

      {/* Floating refresh Button */}
{/* Action Row: 왼쪽(레코딩), 오른쪽(리프레시) */}
<View style={styles.actionRow}>
  {/* 🎤 Record / ⏸ Pause 토글 버튼 (왼쪽) */}
  <TouchableOpacity
  disabled={isAssessing || isPcmTesting || isPcmConnecting}
  style={[
    styles.roundButton,
    (isAssessing || isPcmTesting || isPcmConnecting) && styles.disabledButton,
  ]}
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
    disabled={isRecording || isAssessing || isPcmTesting || isPcmConnecting}
    style={[
      styles.roundButton,
      (isRecording || isAssessing || isPcmTesting || isPcmConnecting) &&
        styles.disabledButton,
    ]}
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

disabledButton: {
  opacity: 0.5,
},

pcmTestButton: {
  marginTop: 20,
  backgroundColor: '#E8F2E2',
  borderRadius: 20,
  paddingHorizontal: 18,
  paddingVertical: 10,
},

pcmTestButtonText: {
  color: '#2E3A1C',
  fontSize: 15,
  fontWeight: '600',
},

roundIcon: {
  width: 28,
  height: 28,
  tintColor: '#1A2E05', // pause/mic는 녹색 라벨 유지, refresh는 위에서 흰색으로 오버라이드
},

});

export default WordsScreen;
