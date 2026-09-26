"""Small OpenAI-shaped Vertex client for the benchmark's existing judges."""

import os
import subprocess
from types import SimpleNamespace

import requests


class VertexJudge:
    def __init__(self, model="gemini-2.5-flash"):
        self.model = model
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))
        self.models = SimpleNamespace(list=lambda: [model])

    def create(self, *, messages, **_kwargs):
        project = os.environ["GOOGLE_CLOUD_PROJECT"]
        location = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
        token = subprocess.check_output(
            ["gcloud", "auth", "print-access-token"], text=True
        ).strip()
        url = (
            f"https://{location}-aiplatform.googleapis.com/v1/projects/{project}"
            f"/locations/{location}/publishers/google/models/{self.model}:generateContent"
        )
        prompt = "\n\n".join(f"{m['role']}: {m['content']}" for m in messages)
        generation_config = {
            "temperature": _kwargs.get("temperature", 0.2),
            "maxOutputTokens": max(1024, _kwargs.get("max_tokens", 8192)),
            "responseMimeType": "application/json",
        }
        if self.model.startswith("gemini-2.5-flash"):
            generation_config["thinkingConfig"] = {"thinkingBudget": 0}
        response = requests.post(
            url,
            headers={"Authorization": f"Bearer {token}"},
            json={
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": generation_config,
            },
            timeout=120,
        )
        response.raise_for_status()
        parts = response.json()["candidates"][0]["content"]["parts"]
        text = "".join(part.get("text", "") for part in parts)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=text))])
