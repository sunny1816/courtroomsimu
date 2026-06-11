"""
Training management API for LEXA.

Endpoints:
  GET  /api/v1/training/gpu        — Detected GPU info
  GET  /api/v1/training/datasets   — List uploaded dataset files
  POST /api/v1/training/upload     — Upload a .json / .jsonl dataset
  POST /api/v1/training/start      — Start fine-tuning in background thread
  GET  /api/v1/training/status     — Poll training progress
  POST /api/v1/training/reset      — Reset state to idle (after error/completion)
"""

from __future__ import annotations

import threading
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1/training")

DATASETS_DIR = Path("data/training_datasets")
PREPARED_DIR = Path("data/training_prepared")
MODEL_OUTPUT_DIR = Path("models/lexa-legal")

_lock = threading.Lock()
_training_thread: threading.Thread | None = None


# ---------------------------------------------------------------------------
# GPU info
# ---------------------------------------------------------------------------

@router.get("/gpu")
async def gpu_info():
    try:
        import torch
        from services.gpu_detector import detect_gpu
        tier, name = detect_gpu()
        cuda_avail = torch.cuda.is_available()
        vram_info = "N/A"
        if cuda_avail:
            try:
                total_mem = torch.cuda.get_device_properties(0).total_memory
                vram_info = f"{round(total_mem / (1024 ** 3), 1)} GB"
            except Exception:
                vram_info = "Detected Automatically"
        return {
            "tier": tier.value,
            "device": name,
            "available": cuda_avail,
            "cuda_available": cuda_avail,
            "torch_device": "cuda" if cuda_avail else "cpu",
            "vram": vram_info,
        }
    except Exception as exc:
        return {
            "tier": "cpu",
            "device": "CPU",
            "available": False,
            "cuda_available": False,
            "torch_device": "cpu",
            "vram": "N/A",
            "error": str(exc)
        }


# ---------------------------------------------------------------------------
# Dataset management
# ---------------------------------------------------------------------------

@router.get("/datasets")
async def list_datasets():
    DATASETS_DIR.mkdir(parents=True, exist_ok=True)
    files = []
    for f in sorted(DATASETS_DIR.iterdir()):
        if f.suffix.lower() in {".json", ".jsonl"} and f.is_file():
            files.append({
                "name": f.name,
                "size_kb": round(f.stat().st_size / 1024, 1),
            })
    return files


@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    suffix = Path(file.filename or "dataset.json").suffix.lower()
    if suffix not in {".json", ".jsonl"}:
        raise HTTPException(status_code=400, detail="Only .json and .jsonl files are accepted.")

    DATASETS_DIR.mkdir(parents=True, exist_ok=True)
    dest = DATASETS_DIR / (file.filename or "dataset.json")
    dest.write_bytes(await file.read())

    count = 0
    try:
        from training.dataset import load_dataset_file
        count = len(load_dataset_file(dest))
    except Exception:
        pass

    return {"filename": dest.name, "records": count, "status": "uploaded"}


# ---------------------------------------------------------------------------
# Training control
# ---------------------------------------------------------------------------

class TrainRequest(BaseModel):
    base_model: str = Field(default="Qwen/Qwen2.5-3B-Instruct")
    num_epochs: int = Field(default=3, ge=1, le=20)
    batch_size: int = Field(default=4, ge=1, le=32)
    learning_rate: float = Field(default=2e-4, gt=0)
    lora_r: int = Field(default=16, ge=4, le=64)
    lora_alpha: int = Field(default=32, ge=4, le=128)
    max_seq_length: int = Field(default=1024, ge=128, le=4096)


@router.post("/start")
async def start_training(req: TrainRequest):
    global _training_thread

    from training.train import read_state

    current = read_state()
    if current.get("status") in ("starting", "loading_model", "training"):
        raise HTTPException(status_code=409, detail="Training is already in progress.")

    # Find uploaded datasets
    DATASETS_DIR.mkdir(parents=True, exist_ok=True)
    data_files = [
        f for f in DATASETS_DIR.iterdir()
        if f.suffix.lower() in {".json", ".jsonl"} and f.is_file()
    ]
    if not data_files:
        raise HTTPException(
            status_code=400,
            detail="No dataset files found. Upload a dataset first.",
        )

    # Prepare dataset (merge + format + split)
    try:
        from training.dataset import prepare_dataset
        train_count, val_count = prepare_dataset(data_files, PREPARED_DIR)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Dataset preparation failed: {exc}") from exc

    # Launch background training thread
    def _worker():
        from training.train import run_training
        run_training(
            dataset_dir=str(PREPARED_DIR),
            output_dir=str(MODEL_OUTPUT_DIR),
            base_model=req.base_model,
            num_epochs=req.num_epochs,
            batch_size=req.batch_size,
            learning_rate=req.learning_rate,
            lora_r=req.lora_r,
            lora_alpha=req.lora_alpha,
            max_seq_length=req.max_seq_length,
        )

    with _lock:
        _training_thread = threading.Thread(target=_worker, daemon=True)
        _training_thread.start()

    return {
        "status": "started",
        "train_samples": train_count,
        "val_samples": val_count,
        "base_model": req.base_model,
        "output_dir": str(MODEL_OUTPUT_DIR),
    }


@router.get("/status")
async def training_status():
    from training.train import read_state
    state = read_state()

    # Attach adapter availability flag
    state["adapter_ready"] = (MODEL_OUTPUT_DIR / "adapter_config.json").exists()
    return state


@router.post("/reset")
async def reset_training():
    from training.train import _write_state
    _write_state({"status": "idle"})
    return {"status": "idle"}
