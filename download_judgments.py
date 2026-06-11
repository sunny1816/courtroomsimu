from datasets import load_dataset
import json
from pathlib import Path

out_dir = Path("backend/data/training_datasets")
out_dir.mkdir(parents=True, exist_ok=True)

print("Downloading BillSum...")

dataset = load_dataset("billsum")

output_file = out_dir / "judgments.jsonl"

count = 0

with output_file.open("w", encoding="utf-8") as f:
    for row in dataset["train"]:
        record = {
            "context": row["text"],
            "verdict": "Summary",
            "reasoning": row["summary"]
        }

        f.write(json.dumps(record, ensure_ascii=False) + "\n")

        count += 1

        if count >= 300:
            break

print(f"Saved {count} judgment examples")