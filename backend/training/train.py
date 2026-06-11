"""
LEXA Legal Model Fine-Tuning
QLoRA + PEFT + TRL on Qwen2.5-3B-Instruct (dev) or Llama-3.1-8B (final).

State is written to data/training_state.json so the API can poll progress.

CLI usage:
    python -m training.train \\
        --dataset_dir data/training_prepared \\
        --output_dir  models/lexa-legal
"""

from __future__ import annotations

import argparse
import json
import threading
from datetime import datetime
from pathlib import Path

STATE_FILE = Path("data/training_state.json")


# ---------------------------------------------------------------------------
# State helpers
# ---------------------------------------------------------------------------

def _write_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(
    json.dumps(state, indent=2, ensure_ascii=False),
    encoding="utf-8"
)

def read_state() -> dict:
    if not STATE_FILE.exists():
        return {"status": "idle"}
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"status": "idle"}


# ---------------------------------------------------------------------------
# Main training function
# ---------------------------------------------------------------------------

def run_training(
    dataset_dir: str,
    output_dir: str,
    base_model: str = "Qwen/Qwen2.5-3B-Instruct",
    num_epochs: int = 3,
    batch_size: int = 4,
    learning_rate: float = 2e-4,
    max_seq_length: int = 1024,
    lora_r: int = 16,
    lora_alpha: int = 32,
) -> None:
    """
    Run QLoRA fine-tuning and update STATE_FILE throughout.
    Designed to run in a background thread.
    """
    started_at = datetime.utcnow().isoformat()
    _write_state({
        "status": "starting",
        "base_model": base_model,
        "started_at": started_at,
        "epoch": 0,
        "num_epochs": num_epochs,
        "step": 0,
        "total_steps": 0,
        "loss": None,
        "log": ["Initializing LEXA fine-tuning..."],
    })

    try:
        from services.gpu_detector import detect_gpu, GPUTier

        gpu_tier, gpu_name = detect_gpu()
        log: list[str] = [f"Compute: {gpu_name} ({gpu_tier.value})"]

        # ----------------------------------------------------------------
        # Imports — optional deps; fail gracefully if not installed
        # ----------------------------------------------------------------
        try:
            import torch
            from datasets import Dataset
            from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
            from transformers import (
                AutoModelForCausalLM,
                AutoTokenizer,
                BitsAndBytesConfig,
                TrainerCallback,
                TrainingArguments,
            )
            from trl import SFTTrainer
        except ImportError as exc:
            raise ImportError(
                f"Training dependencies missing: {exc}. "
                "Install with: pip install torch transformers peft trl datasets bitsandbytes"
            ) from exc

        # ----------------------------------------------------------------
        # Tokenizer
        # ----------------------------------------------------------------
        log.append(f"Loading tokenizer from {base_model}…")
        _write_state({
            "status": "loading_model", "base_model": base_model,
            "started_at": started_at, "log": log,
            "epoch": 0, "num_epochs": num_epochs, "step": 0, "total_steps": 0, "loss": None,
        })

        tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token

        # ----------------------------------------------------------------
        # Quantization config (GPU only)
        # ----------------------------------------------------------------
        use_gpu = torch.cuda.is_available()
        bnb_config = None
        if use_gpu:
            bnb_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_compute_dtype=torch.float16,
            )

        # ----------------------------------------------------------------
        # Model
        # ----------------------------------------------------------------
        log.append("Loading base model (4-bit QLoRA)…")
        _write_state({
            "status": "loading_model", "base_model": base_model,
            "started_at": started_at, "log": log,
            "epoch": 0, "num_epochs": num_epochs, "step": 0, "total_steps": 0, "loss": None,
        })

        model = AutoModelForCausalLM.from_pretrained(
            base_model,
            quantization_config=bnb_config,
            device_map="auto" if use_gpu else "cpu",
            trust_remote_code=True,
        )
        model.config.use_cache = False
        if bnb_config:
            model = prepare_model_for_kbit_training(model)

        # ----------------------------------------------------------------
        # LoRA adapter
        # ----------------------------------------------------------------
        lora_cfg = LoraConfig(
            r=lora_r,
            lora_alpha=lora_alpha,
            target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
            lora_dropout=0.05,
            bias="none",
            task_type="CAUSAL_LM",
        )
        model = get_peft_model(model, lora_cfg)
        trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
        log.append(f"Trainable parameters: {trainable:,}")

        # ----------------------------------------------------------------
        # Dataset
        # ----------------------------------------------------------------
        train_jsonl = Path(dataset_dir) / "train.jsonl"
        if not train_jsonl.exists():
            raise FileNotFoundError(f"Training data not found: {train_jsonl}")

        texts: list[str] = []
        with train_jsonl.open(encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    texts.append(json.loads(line)["text"])

        if not texts:
            raise ValueError("Training dataset is empty.")

        dataset = Dataset.from_dict({"text": texts})
        log.append(f"Dataset: {len(texts)} training examples")

        # ----------------------------------------------------------------
        # Progress callback
        # ----------------------------------------------------------------
        total_steps = max(1, (len(texts) // batch_size) * num_epochs)
        _state_lock = threading.Lock()

        class _ProgressCallback(TrainerCallback):
            def on_log(self, args, state, control, logs_dict=None, **kwargs):
                if not logs_dict:
                    return
                loss = logs_dict.get("loss")
                with _state_lock:
                    current = read_state()
                    current_log = current.get("log", [])
                    if loss is not None:
                        current_log.append(f"Step {state.global_step}/{total_steps}  loss={loss:.4f}")
                    _write_state({
                        **current,
                        "status": "training",
                        "epoch": round(float(state.epoch or 0), 2),
                        "step": state.global_step,
                        "total_steps": total_steps,
                        "loss": loss,
                        "log": current_log[-60:],
                    })

        # ----------------------------------------------------------------
        # TrainingArguments
        # ----------------------------------------------------------------
        out_path = Path(output_dir)
        out_path.mkdir(parents=True, exist_ok=True)

        training_args = TrainingArguments(
            output_dir=str(out_path),
            num_train_epochs=num_epochs,
            per_device_train_batch_size=batch_size,
            gradient_accumulation_steps=4,
            learning_rate=learning_rate,
            fp16=use_gpu,
            logging_steps=10,
            save_strategy="epoch",
            optim="paged_adamw_8bit" if bnb_config else "adamw_torch",
            lr_scheduler_type="cosine",
            warmup_ratio=0.05,
            report_to="none",
        )

        trainer = SFTTrainer(
            model=model,
            args=training_args,
            train_dataset=dataset,
            #tokenizer=tokenizer,
            #max_seq_length=max_seq_length,
            #dataset_text_field="text",
            callbacks=[_ProgressCallback()],
        )

        log.append("Training started…")
        _write_state({
            "status": "training", "base_model": base_model, "started_at": started_at,
            "epoch": 0, "num_epochs": num_epochs, "step": 0, "total_steps": total_steps,
            "loss": None, "log": log,
        })

        trainer.train()

        # ----------------------------------------------------------------
        # Save adapter
        # ----------------------------------------------------------------
        model.save_pretrained(str(out_path))
        tokenizer.save_pretrained(str(out_path))

        log.append(f"Model saved → {output_dir}")
        _write_state({
            "status": "completed", "base_model": base_model, "output_dir": output_dir,
            "started_at": started_at, "completed_at": datetime.utcnow().isoformat(),
            "epoch": num_epochs, "num_epochs": num_epochs,
            "step": total_steps, "total_steps": total_steps, "loss": None, "log": log,
        })

    except Exception as exc:
        current = read_state()
        _write_state({
            **current,
            "status": "failed",
            "error": str(exc),
            "log": current.get("log", []) + [f"ERROR: {exc}"],
        })
        raise


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LEXA Legal Model Fine-Tuning")
    parser.add_argument("--dataset_dir", required=True)
    parser.add_argument("--output_dir", default="models/lexa-legal")
    parser.add_argument("--base_model", default="Qwen/Qwen2.5-3B-Instruct")
    parser.add_argument("--num_epochs", type=int, default=3)
    parser.add_argument("--batch_size", type=int, default=4)
    parser.add_argument("--learning_rate", type=float, default=2e-4)
    parser.add_argument("--lora_r", type=int, default=16)
    parser.add_argument("--lora_alpha", type=int, default=32)
    args = parser.parse_args()

    run_training(
        dataset_dir=args.dataset_dir,
        output_dir=args.output_dir,
        base_model=args.base_model,
        num_epochs=args.num_epochs,
        batch_size=args.batch_size,
        learning_rate=args.learning_rate,
        lora_r=args.lora_r,
        lora_alpha=args.lora_alpha,
    )
