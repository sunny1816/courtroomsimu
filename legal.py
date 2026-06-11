from datasets import load_dataset
import json

dataset = load_dataset(
    "nguha/legalbench",
    split="train"
)

with open("legal_qa_100.jsonl", "w", encoding="utf-8") as f:

    count = 0

    for item in dataset:

        sample = {
            "instruction": item.get("text", ""),
            "input": "",
            "output": str(item.get("label", ""))
        }

        f.write(json.dumps(sample, ensure_ascii=False) + "\n")

        count += 1

        if count >= 1000:
            break

print(f"Generated {count} Legal QA samples")