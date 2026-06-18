import os

from dotenv import load_dotenv
from openai import OpenAI
from rest_framework import status


class VoiceTranscriber:
    """Turn an uploaded audio blob into text via Groq Whisper (whisper-large-v3)."""

    def __init__(self, model: str = "whisper-large-v3"):
        load_dotenv()
        self.model = model
        self._client = None

    @property
    def client(self):
        if self._client is None:
            api_key = os.getenv("GROQ_API_KEY")
            if not api_key:
                raise RuntimeError("GROQ_API_KEY is not set.")
            self._client = OpenAI(
                api_key=api_key,
                base_url="https://api.groq.com/openai/v1",
            )
        return self._client

    def transcribe(self, audio_file):
        """audio_file: a Django UploadedFile. Returns (data, status, message)."""
        if audio_file is None:
            msg = "audio file is required."
            return {"error": msg}, status.HTTP_400_BAD_REQUEST, msg

        try:
            name = getattr(audio_file, "name", "audio.webm") or "audio.webm"
            result = self.client.audio.transcriptions.create(
                model=self.model,
                file=(name, audio_file.read()),
                language="en",
            )
            return {"text": result.text}, status.HTTP_200_OK, "Transcribed"
        except Exception as exc:  # noqa: BLE001
            msg = f"Transcription failed: {exc}"
            return {"error": msg}, status.HTTP_502_BAD_GATEWAY, msg
