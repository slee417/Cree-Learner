from flask import Flask, request, jsonify
from flask_sock import Sock
from flask_cors import CORS
from simple_websocket.errors import ConnectionClosed
import json
import os
from pathlib import Path
import pyodbc
import traceback
import random
import azure.cognitiveservices.speech as speechsdk

app = Flask(__name__)
CORS(app)
sock = Sock(app)

WORDS_PATH = Path(__file__).parent / "data" / "cree_words.json"
REQUIRED_WORD_FIELDS = {
    "Id",
    "Cree",
    "Pronunciation",
    "Meaning",
    "AudioUrl",
    "Category",
    "Difficulty",
    "SourceUrl",
    "Enabled",
}


def load_cree_words(path=WORDS_PATH):
    with path.open(encoding="utf-8") as word_file:
        words = json.load(word_file)

    if not isinstance(words, list) or not words:
        raise ValueError("Cree word data must be a non-empty JSON array.")

    seen_ids = set()
    for index, word in enumerate(words):
        if not isinstance(word, dict):
            raise ValueError(f"Word at index {index} must be a JSON object.")

        missing_fields = REQUIRED_WORD_FIELDS - word.keys()
        if missing_fields:
            missing = ", ".join(sorted(missing_fields))
            raise ValueError(f"Word at index {index} is missing: {missing}.")

        word_id = word["Id"]
        if not isinstance(word_id, str) or not word_id.strip():
            raise ValueError(f"Word at index {index} has an invalid Id.")
        if word_id in seen_ids:
            raise ValueError(f"Duplicate Cree word Id: {word_id}.")
        seen_ids.add(word_id)

    return words


CREE_WORDS = load_cree_words()

# 👉 이미 INSERT할 때 사용한 conn_str 그대로 사용
CONN_STR = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=vancouveract.database.windows.net;"
    "DATABASE=VancouverRecreationalActivities;"
    "UID=myadmin;"
    # "PWD=SoohoJisooNayoung123!;"
    "Encrypt=yes;"
    "TrustServerCertificate=no;"
    "Connection Timeout=30;"
)

def get_conn():
    return pyodbc.connect(CONN_STR)

@app.route("/api/pronounce/assess", methods=["POST"])
def assess_json():
    try:
        file = request.files.get("audio")
        ref_text = (request.form.get("text") or "").strip()  # ??
        if not file or not ref_text:
            return jsonify({"error": "audio and text are required"}), 400

        import os, tempfile, subprocess
        import azure.cognitiveservices.speech as speechsdk

        with tempfile.TemporaryDirectory() as td:
            src = os.path.join(td, file.filename or "in.m4a")
            file.save(src)
            # TODO audio convert
            wav_path = os.path.join(td, "converted.wav")
            cmd = [
                "ffmpeg", "-y", "-i", src,
                "-ac", "1",          # mono
                "-ar", "16000",      # 16 kHz sample rate
                "-c:a", "pcm_s16le", # PCM 16-bit
                wav_path
            ]
            subprocess.run(cmd, check=True)
            key = os.environ.get("AZURE_SPEECH_KEY")
            region = os.environ.get("AZURE_SPEECH_REGION")
            lang = os.environ.get("AZURE_SPEECH_LANG", "en-US")
            if not key or not region:
                return jsonify({"error": "server not configured (AZURE_SPEECH_KEY/REGION)"}), 500

            speech_config = speechsdk.SpeechConfig(subscription=key, region=region)
            speech_config.speech_recognition_language = lang
            audio_config = speechsdk.audio.AudioConfig(filename=wav_path)
            recognizer = speechsdk.SpeechRecognizer(speech_config, audio_config)  # 수호 todo
            # body = request.get_json(force=True) or {}
            # # ✅ 필수값 검사 (예: text)
            # required = ["text"]
            # missing = [k for k in required if k not in body]
            # if missing:
            #     return jsonify({"error": f"missing fields: {missing}"}), 400

            pa_cfg = speechsdk.PronunciationAssessmentConfig(
                reference_text=ref_text,
                grading_system=speechsdk.PronunciationAssessmentGradingSystem.HundredMark,
                granularity=speechsdk.PronunciationAssessmentGranularity.Phoneme,
                enable_miscue=True,
            )

            pa_cfg.apply_to(recognizer)

            result = recognizer.recognize_once()
            if result.reason != speechsdk.ResultReason.RecognizedSpeech:
                return jsonify({"error": "no_speech_or_failed", "reason": str(result.reason)}), 400

            pa = speechsdk.PronunciationAssessmentResult(result)

            return jsonify({
                "text": result.text,
                "scores": {
                    "accuracy": pa.accuracy_score,
                    "fluency": pa.fluency_score,
                    "completeness": pa.completeness_score,
                }
            }), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


        

@app.route("/api/activities/search", methods=["POST"])
def search_activities():
    body = request.get_json(silent=True) or {}
    print("🧪 Received request body:", body)

    # TODO: body 값에 따라 SQL 조건을 동적으로 붙일 수 있음
    # sql = "SELECT * FROM words"
    # print("🧾 SQL Query:", sql)

    # try:
    #     with get_conn() as conn:
    #         cur = conn.cursor()
    #         cur.execute(sql)  # ← params가 없으니 단순 실행
    #         cols = [c[0] for c in cur.description]
    #         rows = [dict(zip(cols, r)) for r in cur.fetchall()]

    #         num = random.randint(0, 4)
    #         print(rows[num])
    #         print("✅ Query returned", len(rows), "rows")
    #         return rows[num]

    category = str(body.get("category") or "").strip().lower()
    difficulty = str(body.get("difficulty") or "").strip().lower()
    exclude_id = str(body.get("excludeId") or "").strip()

    candidates = [word for word in CREE_WORDS if word["Enabled"]]

    if category:
        candidates = [
            word for word in candidates
            if word["Category"].lower() == category
        ]
    if difficulty:
        candidates = [
            word for word in candidates
            if word["Difficulty"].lower() == difficulty
        ]

    if not candidates:
        return jsonify({"error": "No words match the requested filters."}), 404

    non_repeating_candidates = [
        word for word in candidates if word["Id"] != exclude_id
    ]
    if non_repeating_candidates:
        candidates = non_repeating_candidates

    return jsonify(random.choice(candidates))

    # except Exception as e:
    #     print("❌ Exception:", str(e))
    #     traceback.print_exc()
        # return jsonify({"error": str(e)}), 500

@sock.route("/ws/audio")
def receive_audio(ws):
    total_bytes = 0
    chunk_count = 0
    push_stream = None
    recognition_future = None
    stream_closed = False

    print("WebSocket connected")

    try:
        while True:
            data = ws.receive()

            if data is None:
                break

            if isinstance(data, str):
                try:
                    message = json.loads(data)
                except json.JSONDecodeError:
                    ws.send(json.dumps({
                        "type": "error",
                        "message": "Invalid JSON message."
                    }))
                    break

                if not isinstance(message, dict):
                    ws.send(json.dumps({
                        "type": "error",
                        "message": "Message must be a JSON object."
                    }))
                    break

                message_type = message.get("type")

                if message_type == "start":
                    if push_stream is not None:
                        ws.send(json.dumps({
                            "type": "error",
                            "message": "Assessment has already started."
                        }))
                        break

                    reference_text = str(message.get("text") or "").strip()
                    if not reference_text:
                        ws.send(json.dumps({
                            "type": "error",
                            "message": "A reference word is required."
                        }))
                        break

                    key = os.environ.get("AZURE_SPEECH_KEY")
                    region = os.environ.get("AZURE_SPEECH_REGION")
                    language = os.environ.get("AZURE_SPEECH_LANG", "en-US")
                    if not key or not region:
                        ws.send(json.dumps({
                            "type": "error",
                            "message": (
                                "Server is missing AZURE_SPEECH_KEY or "
                                "AZURE_SPEECH_REGION."
                            )
                        }))
                        break

                    stream_format = speechsdk.audio.AudioStreamFormat(
                        samples_per_second=16000,
                        bits_per_sample=16,
                        channels=1,
                    )
                    push_stream = speechsdk.audio.PushAudioInputStream(
                        stream_format=stream_format
                    )
                    audio_config = speechsdk.audio.AudioConfig(
                        stream=push_stream
                    )
                    speech_config = speechsdk.SpeechConfig(
                        subscription=key,
                        region=region,
                    )
                    speech_config.speech_recognition_language = language
                    recognizer = speechsdk.SpeechRecognizer(
                        speech_config=speech_config,
                        audio_config=audio_config,
                    )
                    assessment_config = (
                        speechsdk.PronunciationAssessmentConfig(
                            reference_text=reference_text,
                            grading_system=(
                                speechsdk.PronunciationAssessmentGradingSystem
                                .HundredMark
                            ),
                            granularity=(
                                speechsdk.PronunciationAssessmentGranularity
                                .Phoneme
                            ),
                            enable_miscue=True,
                        )
                    )
                    assessment_config.apply_to(recognizer)
                    recognition_future = recognizer.recognize_once_async()
                    ws.send(json.dumps({"type": "ready"}))
                    print(f"Azure stream ready for: {reference_text}")

                elif message_type == "stop":
                    if push_stream is None or recognition_future is None:
                        ws.send(json.dumps({
                            "type": "error",
                            "message": "Assessment has not been started."
                        }))
                        break

                    push_stream.close()
                    stream_closed = True
                    result = recognition_future.get()

                    if result.reason != speechsdk.ResultReason.RecognizedSpeech:
                        ws.send(json.dumps({
                            "type": "error",
                            "message": (
                                "Azure could not recognize speech: "
                                f"{result.reason}"
                            )
                        }))
                        break

                    assessment = speechsdk.PronunciationAssessmentResult(
                        result
                    )
                    ws.send(json.dumps({
                        "type": "result",
                        "text": result.text,
                        "scores": {
                            "accuracy": assessment.accuracy_score,
                            "fluency": assessment.fluency_score,
                            "completeness": assessment.completeness_score,
                        }
                    }))
                    break

                else:
                    ws.send(json.dumps({
                        "type": "error",
                        "message": f"Unknown message type: {message_type}"
                    }))
                    break

            elif isinstance(data, bytes):
                if push_stream is None:
                    ws.send(json.dumps({
                        "type": "error",
                        "message": "Send a start message before audio."
                    }))
                    break

                chunk_count += 1
                total_bytes += len(data)
                push_stream.write(data)

                if chunk_count == 1 or chunk_count % 10 == 0:
                    print(
                        f"PCM chunk {chunk_count}: "
                        f"{len(data)} bytes "
                        f"(total: {total_bytes})"
                    )
    except ConnectionClosed:
        pass
    except Exception:
        traceback.print_exc()
        try:
            ws.send(json.dumps({
                "type": "error",
                "message": "Streaming pronunciation assessment failed.",
            }))
        except ConnectionClosed:
            pass
    finally:
        if push_stream is not None and not stream_closed:
            try:
                push_stream.close()
            except Exception:
                traceback.print_exc()
        print(
            f"WebSocket disconnected: "
            f"{chunk_count} chunks, {total_bytes} bytes"
        )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=4000, debug=True)
