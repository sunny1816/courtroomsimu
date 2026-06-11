"""
vLLM inference client for LEXA.
Connects to a locally-running vLLM server via its OpenAI-compatible API.
Set VLLM_BASE_URL in .env to enable (e.g. http://localhost:8080/v1).
"""

from __future__ import annotations

from openai import OpenAI

from config import settings

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            base_url=settings.vllm_base_url,
            api_key="not-needed",
            timeout=120.0,
        )
    return _client


def is_available() -> bool:
    return bool(settings.vllm_base_url)


def call_vllm(system_prompt: str, user_content: str) -> str:
    if not is_available():
        raise RuntimeError("vLLM not configured — set VLLM_BASE_URL in .env")

    client = _get_client()
    response = client.chat.completions.create(
        model=settings.vllm_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        temperature=0.3,
        max_tokens=1024,
    )
    return response.choices[0].message.content or ""
