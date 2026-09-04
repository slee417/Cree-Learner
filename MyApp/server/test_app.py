
import io
from app import app

def test_assess_requires_audio_and_text():
    client = app.test_client()
    response = client.post("/api/pronounce/assess")
    assert response.status_code == 400
    assert response.get_json() == {
        "error": "audio and text are required"
    }


def test_assess_requires_text():
    client = app.test_client()
    response = client.post(
        "/api/pronounce/assess", 
        data={
            "audio":(io.BytesIO(b"fake audio"), "recording.m4a")
        },
        content_type="multipart/form-data",
    )
    assert response.status_code == 400

def test_random_word_has_required_fields():
    client = app.test_client()

    response = client.post(
        "/api/activities/search",
        json={},
    )

    data = response.get_json()
    assert response.status_code == 200
    assert "Cree" in data
    assert "Pronunciation" in data
    assert "Meaning" in data
    assert "AudioUrl" in data