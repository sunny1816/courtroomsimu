"""
Fine-tuned model inference for LEXA.
Loads a PEFT LoRA adapter on top of the base model and exposes a generate() call.
Results are cached after first load — subsequent calls reuse the in-memory model.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

_cached_model = None
_cached_tokenizer = None
_cached_adapter_dir: str | None = None


def _resolve_base_model(adapter_dir: str) -> str:
    """Read base_model_name_or_path from the saved adapter config."""
    config_path = Path(adapter_dir) / "adapter_config.json"
    if config_path.exists():
        cfg = json.loads(config_path.read_text(encoding="utf-8"))
        return cfg.get("base_model_name_or_path", "Qwen/Qwen2.5-3B-Instruct")
    return "Qwen/Qwen2.5-3B-Instruct"


def load_model(adapter_dir: str, base_model: Optional[str] = None):
    """Load and cache the fine-tuned model + tokenizer. Re-uses cache if adapter_dir unchanged."""
    global _cached_model, _cached_tokenizer, _cached_adapter_dir

    if _cached_adapter_dir == adapter_dir:
        return _cached_model, _cached_tokenizer

    try:
        import torch
        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer
    except ImportError as exc:
        raise ImportError(
            f"Inference dependencies missing: {exc}. "
            "Install with: pip install torch transformers peft"
        ) from exc

    from services.gpu_detector import detect_gpu, GPUTier

    if base_model is None:
        base_model = _resolve_base_model(adapter_dir)

    use_gpu = torch.cuda.is_available()
    dtype = torch.float16 if use_gpu else torch.float32

    tokenizer = AutoTokenizer.from_pretrained(adapter_dir, trust_remote_code=True)
    base = AutoModelForCausalLM.from_pretrained(
        base_model,
        device_map="auto" if use_gpu else "cpu",
        torch_dtype=dtype,
        trust_remote_code=True,
    )
    model = PeftModel.from_pretrained(base, adapter_dir)
    model.eval()

    _cached_model = model
    _cached_tokenizer = tokenizer
    _cached_adapter_dir = adapter_dir

    return model, tokenizer


def generate(
    system_prompt: str,
    user_content: str,
    adapter_dir: str,
    max_new_tokens: int = 512,
    temperature: float = 0.3,
) -> str:
    """Generate a completion using the fine-tuned adapter."""
    import torch

    model, tokenizer = load_model(adapter_dir)

    prompt = (
        f"### Instruction:\n{system_prompt}\n\n"
        f"### Input:\n{user_content}\n\n"
        "### Response:\n"
    )
    inputs = tokenizer(prompt, return_tensors="pt")
    device = next(model.parameters()).device
    inputs = {k: v.to(device) for k, v in inputs.items()}

    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            do_sample=temperature > 0,
            pad_token_id=tokenizer.eos_token_id,
        )

    new_ids = output_ids[0][inputs["input_ids"].shape[1]:]
    return tokenizer.decode(new_ids, skip_special_tokens=True).strip()


def is_adapter_available(adapter_dir: str) -> bool:
    """Return True if a trained adapter exists at the given directory."""
    return (Path(adapter_dir) / "adapter_config.json").exists()
