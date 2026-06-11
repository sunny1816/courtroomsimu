"""
GPU detection for LEXA inference and training.
Priority: NVIDIA H200 > RTX 4060 > CPU
"""

from enum import Enum


class GPUTier(str, Enum):
    H200 = "h200"
    RTX4060 = "rtx4060"
    CPU = "cpu"


def detect_gpu() -> tuple[GPUTier, str]:
    """
    Detect the best available compute device.
    Returns (tier, human-readable device name).
    """
    try:
        import torch

        if not torch.cuda.is_available():
            return GPUTier.CPU, "CPU"

        # Check all devices, prefer H200 first
        h200_idx = None
        rtx4060_idx = None

        for i in range(torch.cuda.device_count()):
            name = torch.cuda.get_device_name(i).upper()
            if "H200" in name and h200_idx is None:
                h200_idx = i
            if ("4060" in name or "RTX 4060" in name) and rtx4060_idx is None:
                rtx4060_idx = i

        if h200_idx is not None:
            return GPUTier.H200, torch.cuda.get_device_name(h200_idx)
        if rtx4060_idx is not None:
            return GPUTier.RTX4060, torch.cuda.get_device_name(rtx4060_idx)

        # CUDA available but unrecognised GPU — treat as RTX4060 tier
        return GPUTier.RTX4060, torch.cuda.get_device_name(0)

    except ImportError:
        return GPUTier.CPU, "CPU (torch not installed)"
    except Exception as exc:
        return GPUTier.CPU, f"CPU (detection error: {exc})"


def get_torch_device() -> str:
    """Return 'cuda' or 'cpu' string for use with torch.device()."""
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"
