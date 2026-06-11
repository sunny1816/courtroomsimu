from datasets import load_dataset
import json

dataset = load_dataset(
    "stanfordnlp/snli",
    split="train[:2000]"
)

with open("evidence.jsonl", "w", encoding="utf-8") as f:

    for item in dataset:

        if item["label"] == -1:
            continue

        if item["label"] == 0:
            result = "The evidence contradicts the statement."
        elif item["label"] == 1:
            result = "The evidence is neutral and does not strongly support or contradict the statement."
        else:
            result = "The evidence supports the statement."

        sample = {
            "instruction": "Analyze the evidence and determine its significance.",
            "input": (
                f"Evidence: {item['premise']}\n\n"
                f"Claim: {item['hypothesis']}"
            ),
            "output": result
        }

        f.write(json.dumps(sample, ensure_ascii=False) + "\n")

print("Generated evidence.jsonl")