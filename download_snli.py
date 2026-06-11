from datasets import load_dataset
import json
from pathlib import Path

dataset = load_dataset("stanfordnlp/snli")

output = Path("backend/data/training_datasets/contradictions_snli.jsonl")
output.parent.mkdir(parents=True, exist_ok=True)

count = 0

with output.open("w", encoding="utf-8") as f:
    for row in dataset["train"]:
        if row["label"] == 2:  # contradiction
            record = {
                "statement_a": row["premise"],
                "statement_b": row["hypothesis"],
                "conflict": "Statements contradict each other."
            }

            f.write(json.dumps(record, ensure_ascii=False) + "\n")
            count += 1

            if count >= 500:
                break

print(f"Saved {count} contradiction examples")