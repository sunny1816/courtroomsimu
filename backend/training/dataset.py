"""
Dataset utilities for LEXA legal model fine-tuning.

Supported dataset categories:
  - legal_qa          : Legal question-answer pairs
  - court_judgments   : Full judgment reasoning chains
  - contradiction     : Factual contradiction detection pairs
  - evidence_analysis : Evidence extraction examples

Supported input formats: .json (list of records), .jsonl (one record per line)
Output: Alpaca instruction format, written as .jsonl with {"text": "..."}
"""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Iterator


_ALPACA = """\
### Instruction:
{instruction}

### Input:
{input}

### Response:
{output}"""


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

def _load_jsonl(path: Path) -> list[dict]:
    records = []

    try:
        with path.open(encoding="utf-8-sig") as fh:
            for line_num, line in enumerate(fh, start=1):
                line = line.strip()

                if not line:
                    continue

                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError as e:
                    print(
                        f"[WARNING] Skipping invalid JSON in "
                        f"{path.name} at line {line_num}: {e}"
                    )

    except Exception as e:
        print(f"[ERROR] Failed to read {path}: {e}")

    return records


def _load_json(path: Path) -> list[dict]:
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))

        if isinstance(data, list):
            return data

        return [data]

    except json.JSONDecodeError as e:
        print(f"[ERROR] Invalid JSON in {path.name}: {e}")
        return []

    except Exception as e:
        print(f"[ERROR] Failed to load {path.name}: {e}")
        return []


def load_dataset_file(path: Path) -> list[dict]:
    """Load a .json or .jsonl file and return a list of records."""

    if not path.exists():
        print(f"[WARNING] Dataset file not found: {path}")
        return []

    if path.stat().st_size == 0:
        print(f"[WARNING] Empty dataset file skipped: {path.name}")
        return []

    if path.suffix.lower() == ".jsonl":
        return _load_jsonl(path)

    return _load_json(path)

# ---------------------------------------------------------------------------
# Formatting
# ---------------------------------------------------------------------------

def format_record(record: dict) -> str:
    """
    Convert a dataset record to Alpaca instruction format.
    Handles multiple schemas:
      {instruction, input?, output}  — Alpaca
      {prompt, response}             — Chat pair
      {question, answer}             — QA pair
      {context, verdict, reasoning?} — Court judgment
      {statement_a, statement_b, ...} — Contradiction detection
    """
    if "instruction" in record and "output" in record:
        return _ALPACA.format(
            instruction=record["instruction"],
            input=record.get("input", ""),
            output=record["output"],
        )

    if "prompt" in record and "response" in record:
        return _ALPACA.format(
            instruction=record["prompt"],
            input="",
            output=record["response"],
        )

    if "question" in record and "answer" in record:
        return _ALPACA.format(
            instruction="Answer the following legal question accurately and concisely.",
            input=record["question"],
            output=record["answer"],
        )

    if "context" in record and "verdict" in record:
        reasoning = record.get("reasoning", "")
        output = f"Verdict: {record['verdict']}"
        if reasoning:
            output += f"\nReasoning: {reasoning}"
        return _ALPACA.format(
            instruction="Analyze the following case facts and deliver a verdict with full legal reasoning.",
            input=record["context"],
            output=output,
        )

    if "statement_a" in record and "statement_b" in record:
        conflict = record.get("conflict", record.get("explanation", ""))
        return _ALPACA.format(
            instruction="Identify whether the two statements are factually contradictory and explain.",
            input=f"Statement A: {record['statement_a']}\nStatement B: {record['statement_b']}",
            output=f"Contradiction detected: {conflict}" if conflict else "No contradiction found.",
        )

    # Fallback — dump raw JSON
    return _ALPACA.format(
        instruction="Process the following legal information.",
        input=json.dumps(record, indent=2, ensure_ascii=False),
        output="[Legal analysis required]",
    )


# ---------------------------------------------------------------------------
# Preparation pipeline
# ---------------------------------------------------------------------------

def prepare_dataset(
    data_files: list[Path],
    output_dir: Path,
    val_split: float = 0.1,
    seed: int = 42,
) -> tuple[int, int]:
    """
    Merge all dataset files, format to Alpaca, split train/val, write JSONL.
    Returns (train_count, val_count).
    """
    records: list[dict] = []
    for path in data_files:
        records.extend(load_dataset_file(path))

    random.seed(seed)
    random.shuffle(records)

    split_idx = max(1, int(len(records) * (1 - val_split)))
    train_records = records[:split_idx]
    val_records = records[split_idx:]

    output_dir.mkdir(parents=True, exist_ok=True)

    for subset, rows in [("train", train_records), ("val", val_records)]:
        dest = output_dir / f"{subset}.jsonl"
        with dest.open("w", encoding="utf-8") as fh:
            for rec in rows:
                fh.write(json.dumps({"text": format_record(rec)}, ensure_ascii=False) + "\n")

    return len(train_records), len(val_records)


def iter_texts(jsonl_path: Path) -> Iterator[str]:
    """Stream formatted training texts from a prepared .jsonl file."""
    with jsonl_path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                yield json.loads(line)["text"]
