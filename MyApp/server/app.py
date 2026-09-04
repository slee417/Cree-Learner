from flask import Flask, request, jsonify
from flask_cors import CORS
import pyodbc
import traceback
import random

app = Flask(__name__)
CORS(app)

# 👉 이미 INSERT할 때 사용한 conn_str 그대로 사용
CONN_STR = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=vancouveract.database.windows.net;"
    "DATABASE=VancouverRecreationalActivities;"
    "UID=myadmin;"
    "PWD=SoohoJisooNayoung123!;"
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
            # 수호 TODO audio convert
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

        body = request.get_json(force=True) or {}
        # ✅ 필수값 검사 (예: text)
        required = ["text"]
        missing = [k for k in required if k not in body]
        if missing:
            return jsonify({"error": f"missing fields: {missing}"}), 400

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
    body = request.get_json(force=True) or {}
    print("🧪 Received request body:", body)

    # TODO: body 값에 따라 SQL 조건을 동적으로 붙일 수 있음
    sql = "SELECT * FROM words"
    print("🧾 SQL Query:", sql)

    try:
        with get_conn() as conn:
            cur = conn.cursor()
            cur.execute(sql)  # ← params가 없으니 단순 실행
            cols = [c[0] for c in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]

            num = random.randint(0, 4)
            print(rows[num])
            print("✅ Query returned", len(rows), "rows")
            return rows[num]

    except Exception as e:
        print("❌ Exception:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=4000, debug=True)