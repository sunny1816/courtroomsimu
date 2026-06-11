"""
LEXA local fine-tuned model inference client.

Wraps training.inference.generate() with the same (system_prompt, user_content)
signature used by call_agent() in nim_client.py, allowing the fine-tuned LoRA
adapter to act as the highest-priority LLM provider in the agent dispatch chain.

The adapter is loaded lazily on the first call and cached in-process.
Subsequent calls reuse the in-memory model with no reload overhead.

Activation:
  Set LEXA_USE_LOCAL_MODEL=true in backend/.env (or environment) and ensure
  a trained adapter exists at the path configured by settings.training_output_dir.

  LEXA_USE_LOCAL_MODEL=true
  # optional override — defaults to models/lexa-legal
  # TRAINING_OUTPUT_DIR=models/lexa-legal
"""

from __future__ import annotations

from config import settings


# ---------------------------------------------------------------------------
# Availability check
# ---------------------------------------------------------------------------

def is_available() -> bool:
    """
    Return True when a trained LoRA adapter exists on disk.
    Does NOT attempt to load the model — safe to call at startup.
    """
    adapter_config = settings.training_output_dir / "adapter_config.json"
    return adapter_config.exists()


# ---------------------------------------------------------------------------
# Main inference call
# ---------------------------------------------------------------------------

def call_lexa_local(system_prompt: str, user_content: str) -> str:
    """
    Generate a response using the fine-tuned LEXA legal adapter.

    Matches the call_agent(system_prompt, user_content) signature so it
    can be dropped in as a transparent replacement inside nim_client.py.

    Args:
        system_prompt: Agent role instruction (e.g. "You are a prosecutor…")
        user_content:  Case evidence / context string

    Returns:
        Model-generated legal reasoning as a plain string.

    Raises:
        RuntimeError: When no trained adapter is found.
        ImportError:  When inference dependencies (torch, peft, transformers) are missing.
    """
    if not is_available():
        raise RuntimeError(
            f"No fine-tuned LEXA adapter found at '{settings.training_output_dir}'. "
            "Upload a dataset and run training via the /training UI first."
        )

    from training.inference import generate

    return generate(
        system_prompt=system_prompt,
        user_content=user_content,
        adapter_dir=str(settings.training_output_dir),
    )


# ---------------------------------------------------------------------------
# Diagnostic helper (used by /health and training_routes.py)
# ---------------------------------------------------------------------------

def get_local_model_status() -> dict:
    """
    Return a status dict for monitoring endpoints.

    {
        "available": bool,
        "adapter_dir": str,
        "adapter_size_mb": float,   # 0.0 if not trained
        "model_loaded": bool,       # True if already in memory
    }
    """
    from training.utils import adapter_size_mb
    from pathlib import Path

    adapter_dir = settings.training_output_dir
    loaded = False

    if is_available():
        try:
            from training.inference import _cached_adapter_dir
            loaded = _cached_adapter_dir == str(adapter_dir)
        except ImportError:
            pass

    return {
        "available": is_available(),
        "adapter_dir": str(adapter_dir),
        "adapter_size_mb": adapter_size_mb(adapter_dir),
        "model_loaded": loaded,
    }
