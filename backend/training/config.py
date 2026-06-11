"""
Training hyperparameter configuration for LEXA legal model fine-tuning.

Provides GPU-tier-aware presets:
  - RTX_4060_CONFIG  : 8 GB VRAM — 4-bit QLoRA, batch 4, seq 1024
  - H200_CONFIG      : 80 GB VRAM — 4-bit QLoRA, batch 16, seq 2048

Usage:
    from training.config import get_config_for_gpu, TrainingConfig
    cfg = get_config_for_gpu(gpu_tier.value)  # "rtx4060" | "h200" | "cpu"
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

# ---------------------------------------------------------------------------
# Top-level constants (shared by train.py, dataset.py, training_routes.py)
# ---------------------------------------------------------------------------

BASE_MODEL: str = "Qwen/Qwen2.5-3B-Instruct"
ADAPTER_OUTPUT_DIR: Path = Path("models/lexa-legal")
DATASETS_DIR: Path = Path("data/training_datasets")
PREPARED_DIR: Path = Path("data/training_prepared")
STATE_FILE: Path = Path("data/training_state.json")

# ---------------------------------------------------------------------------
# Dataclass
# ---------------------------------------------------------------------------

@dataclass
class TrainingConfig:
    # Model
    base_model: str = BASE_MODEL
    output_dir: Path = ADAPTER_OUTPUT_DIR
    dataset_dir: Path = PREPARED_DIR

    # LoRA adapter
    lora_r: int = 16
    lora_alpha: int = 32
    lora_dropout: float = 0.05
    target_modules: list[str] = field(
        default_factory=lambda: ["q_proj", "v_proj", "k_proj", "o_proj"]
    )

    # Training loop
    num_epochs: int = 3
    batch_size: int = 4
    gradient_accumulation_steps: int = 4
    learning_rate: float = 2e-4
    max_seq_length: int = 1024
    warmup_ratio: float = 0.05
    lr_scheduler_type: str = "cosine"

    # 4-bit QLoRA quantisation
    load_in_4bit: bool = True
    bnb_4bit_quant_type: str = "nf4"
    bnb_use_double_quant: bool = True

    # Logging / checkpointing
    logging_steps: int = 10
    save_strategy: str = "epoch"
    report_to: str = "none"

    # Effective batch = batch_size * gradient_accumulation_steps
    @property
    def effective_batch_size(self) -> int:
        return self.batch_size * self.gradient_accumulation_steps

    # Approximate VRAM required for QLoRA at this config (rough estimate)
    @property
    def estimated_vram_gb(self) -> float:
        # 3B params @ 4-bit ≈ 1.7 GB base; activations + LoRA ≈ 2–5 GB overhead
        base_gb = 1.7
        activation_gb = 0.0015 * self.max_seq_length * self.batch_size / 1024
        return round(base_gb + activation_gb + 1.5, 1)


# ---------------------------------------------------------------------------
# GPU-tier presets
# ---------------------------------------------------------------------------

# NVIDIA RTX 4060 Laptop — 8 GB VRAM
RTX_4060_CONFIG = TrainingConfig(
    batch_size=4,
    gradient_accumulation_steps=4,
    max_seq_length=1024,
    lora_r=16,
    lora_alpha=32,
    num_epochs=3,
)

# NVIDIA H200 — 80 GB VRAM
H200_CONFIG = TrainingConfig(
    batch_size=16,
    gradient_accumulation_steps=2,
    max_seq_length=2048,
    lora_r=32,
    lora_alpha=64,
    num_epochs=5,
)

# CPU-only fallback (smoke-test only — not viable for real training)
CPU_CONFIG = TrainingConfig(
    batch_size=1,
    gradient_accumulation_steps=8,
    max_seq_length=512,
    lora_r=8,
    lora_alpha=16,
    load_in_4bit=False,
    num_epochs=1,
)


def get_config_for_gpu(gpu_tier_value: str) -> TrainingConfig:
    """
    Return the best TrainingConfig for the detected GPU tier.

    Args:
        gpu_tier_value: One of "h200", "rtx4060", "cpu"
                        (matches GPUTier enum values from gpu_detector.py)
    """
    mapping = {
        "h200": H200_CONFIG,
        "rtx4060": RTX_4060_CONFIG,
        "cpu": CPU_CONFIG,
    }
    return mapping.get(gpu_tier_value, RTX_4060_CONFIG)


# ---------------------------------------------------------------------------
# VRAM budget table (informational)
# ---------------------------------------------------------------------------

VRAM_BUDGET: dict[str, dict] = {
    "rtx4060": {
        "total_gb": 8.0,
        "model_4bit_gb": 1.7,
        "lora_adapters_gb": 0.3,
        "activations_gb": 2.5,
        "optimizer_gb": 1.8,
        "safety_margin_gb": 1.0,
        "recommended_batch": 4,
        "max_seq_length": 1024,
        "notes": "Tight fit. Reduce batch to 2 or seq to 512 if OOM.",
    },
    "h200": {
        "total_gb": 80.0,
        "model_4bit_gb": 1.7,
        "lora_adapters_gb": 0.6,
        "activations_gb": 8.0,
        "optimizer_gb": 4.0,
        "safety_margin_gb": 10.0,
        "recommended_batch": 16,
        "max_seq_length": 2048,
        "notes": "Plenty of headroom. Consider bf16 + larger batch.",
    },
}
