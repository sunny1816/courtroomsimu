"""
Training utility helpers for LEXA legal model fine-tuning.

Provides:
  - GPU/VRAM reporting
  - Checkpoint management
  - Training step estimation
  - Smoke-test prompts for post-training validation
"""

from __future__ import annotations

import shutil
from pathlib import Path


# ---------------------------------------------------------------------------
# VRAM / GPU reporting
# ---------------------------------------------------------------------------

def vram_stats() -> dict:
    """
    Return a dict of current VRAM usage for the primary CUDA device.
    Returns an empty dict when CUDA is unavailable.
    """
    try:
        import torch

        if not torch.cuda.is_available():
            return {}

        dev = torch.cuda.current_device()
        props = torch.cuda.get_device_properties(dev)
        total = props.total_memory
        reserved = torch.cuda.memory_reserved(dev)
        allocated = torch.cuda.memory_allocated(dev)

        return {
            "device": props.name,
            "total_gb": round(total / 1e9, 2),
            "reserved_gb": round(reserved / 1e9, 2),
            "allocated_gb": round(allocated / 1e9, 2),
            "free_gb": round((total - reserved) / 1e9, 2),
            "utilisation_pct": round(allocated / total * 100, 1),
        }
    except Exception:
        return {}


def print_gpu_banner() -> None:
    """Print a compact GPU status line to stdout before training starts."""
    try:
        import torch

        if not torch.cuda.is_available():
            print("[LEXA] Compute : CPU only — CUDA not available")
            return

        name = torch.cuda.get_device_name(0)
        total_gb = torch.cuda.get_device_properties(0).total_memory / 1e9
        cuda_ver = getattr(torch.version, "cuda", "unknown")
        print(
            f"[LEXA] Compute : {name}  |  "
            f"VRAM {total_gb:.1f} GB  |  "
            f"CUDA {cuda_ver}  |  "
            f"PyTorch {torch.__version__}"
        )
    except ImportError:
        print("[LEXA] Compute : torch not installed")
    except Exception as exc:
        print(f"[LEXA] Compute : detection failed ({exc})")


def format_bytes(n: float) -> str:
    """Human-readable byte size string."""
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} PB"


# ---------------------------------------------------------------------------
# Training step estimation
# ---------------------------------------------------------------------------

def estimate_steps(
    num_samples: int,
    batch_size: int,
    gradient_accumulation_steps: int,
    num_epochs: int,
) -> int:
    """
    Estimate total optimizer update steps.
    Useful for progress bars and ETA calculations before training starts.
    """
    steps_per_epoch = max(1, num_samples // batch_size)
    optimizer_steps_per_epoch = max(1, steps_per_epoch // gradient_accumulation_steps)
    return optimizer_steps_per_epoch * num_epochs


# ---------------------------------------------------------------------------
# Checkpoint management
# ---------------------------------------------------------------------------

def list_checkpoints(output_dir: Path) -> list[Path]:
    """Return HuggingFace checkpoint subdirs sorted by step number (ascending)."""
    if not output_dir.exists():
        return []
    return sorted(
        [d for d in output_dir.iterdir() if d.is_dir() and d.name.startswith("checkpoint-")],
        key=lambda d: int(d.name.split("-")[-1]),
    )


def cleanup_checkpoints(output_dir: Path, keep_last: int = 1) -> list[str]:
    """
    Delete intermediate checkpoint folders, keeping the `keep_last` most recent.
    Returns the names of removed directories.

    Set keep_last=0 to remove all checkpoints (e.g., after final adapter save).
    """
    checkpoints = list_checkpoints(output_dir)
    to_remove = checkpoints[:-keep_last] if keep_last > 0 else checkpoints
    removed = []
    for ckpt in to_remove:
        shutil.rmtree(ckpt, ignore_errors=True)
        removed.append(ckpt.name)
    return removed


def adapter_size_mb(adapter_dir: Path) -> float:
    """Return total disk footprint of the saved LoRA adapter in MB."""
    if not adapter_dir.exists():
        return 0.0
    total_bytes = sum(f.stat().st_size for f in adapter_dir.rglob("*") if f.is_file())
    return round(total_bytes / 1e6, 1)


def adapter_exists(adapter_dir: Path) -> bool:
    """Return True when a trained adapter_config.json is present."""
    return (adapter_dir / "adapter_config.json").exists()


# ---------------------------------------------------------------------------
# Smoke-test prompts
# ---------------------------------------------------------------------------

def sample_prompts() -> list[dict[str, str]]:
    """
    Return curated legal prompts for quick post-training validation.

    Each dict has 'system' and 'user' keys matching call_agent() / call_lexa_local()
    so they can be run directly against the fine-tuned adapter.

    Usage:
        from training.utils import sample_prompts
        from services.lexa_local_client import call_lexa_local
        for p in sample_prompts():
            print(call_lexa_local(p["system"], p["user"]))
    """
    return [
        # Prosecution
        {
            "system": (
                "You are a prosecutor. Build the strongest case using "
                "the evidence and cited Indian law."
            ),
            "user": (
                "Evidence: {'facts': ['Accused struck the victim with an iron rod', "
                "'Weapon recovered from accused premises', "
                "'Medical report confirms serious bodily harm'], "
                "'people': ['Ravi Kumar', 'Dr Meera Patel']}\n"
                "Laws: IPC Section 307 — Attempt to murder; "
                "IPC Section 326 — Voluntarily causing grievous hurt by dangerous weapons"
            ),
        },
        # Defence
        {
            "system": (
                "You are defense counsel. Challenge every prosecution claim "
                "and identify reasonable doubt."
            ),
            "user": (
                "Evidence: {'facts': ['Single eyewitness account', "
                "'No CCTV footage', 'No forensic match on weapon'], "
                "'people': ['Ravi Kumar']}\n"
                "Prosecution: The prosecution relies on a single eyewitness "
                "whose testimony has not been corroborated by forensic evidence."
            ),
        },
        # Judge
        {
            "system": "Weigh arguments impartially. Apply cited laws and explain your reasoning.",
            "user": (
                "{'evidence': {'facts': ['Iron rod recovered', 'Medical report confirms injury']}, "
                "'prosecution': 'Section 307 IPC applies — intent to cause death is evident.', "
                "'defense': 'No direct proof of intent. Section 308 is more appropriate.', "
                "'contradictions': [{'statement_a': 'Weapon found at scene', "
                "'statement_b': 'No fingerprints on weapon', "
                "'conflict': 'Weapon ownership disputed'}]}"
            ),
        },
        # Contradiction detection
        {
            "system": (
                "Identify factual conflicts between these statements. "
                "Return a JSON list only."
            ),
            "user": (
                "Evidence: Witness states accused was seen at the crime scene at 9 PM.\n"
                "Prosecution: CCTV confirms accused arrived at 9:05 PM.\n"
                "Defense: Accused's phone location data shows he was 15 km away at 9 PM."
            ),
        },
        # Appeal
        {
            "system": (
                "Review for procedural errors or missed evidence. "
                "Keep the appeal decision concise."
            ),
            "user": (
                "Trial court convicted accused under IPC 307. Defence argues: "
                "(1) Key witness not cross-examined. "
                "(2) Medical expert testimony excluded without reason. "
                "(3) Sentencing did not consider mitigating factors."
            ),
        },
    ]


# ---------------------------------------------------------------------------
# Training summary printer
# ---------------------------------------------------------------------------

def print_training_summary(
    base_model: str,
    num_samples: int,
    config_dict: dict,
    adapter_dir: Path,
) -> None:
    """Print a pre-training summary to stdout."""
    from training.config import estimate_steps as _est

    steps = estimate_steps(
        num_samples=num_samples,
        batch_size=config_dict.get("batch_size", 4),
        gradient_accumulation_steps=config_dict.get("gradient_accumulation_steps", 4),
        num_epochs=config_dict.get("num_epochs", 3),
    )

    stats = vram_stats()
    vram_line = (
        f"{stats['allocated_gb']} GB used / {stats['total_gb']} GB total"
        if stats else "N/A (CPU mode)"
    )

    print("=" * 60)
    print("  LEXA Legal Model Fine-Tuning")
    print("=" * 60)
    print(f"  Base model   : {base_model}")
    print(f"  Dataset      : {num_samples:,} training examples")
    print(f"  Epochs       : {config_dict.get('num_epochs', 3)}")
    print(f"  Batch size   : {config_dict.get('batch_size', 4)} "
          f"(effective: {config_dict.get('batch_size', 4) * config_dict.get('gradient_accumulation_steps', 4)})")
    print(f"  Learning rate: {config_dict.get('learning_rate', 2e-4)}")
    print(f"  LoRA r/alpha : {config_dict.get('lora_r', 16)} / {config_dict.get('lora_alpha', 32)}")
    print(f"  Max seq len  : {config_dict.get('max_seq_length', 1024)}")
    print(f"  Est. steps   : {steps:,}")
    print(f"  VRAM         : {vram_line}")
    print(f"  Output dir   : {adapter_dir}")
    print("=" * 60)
