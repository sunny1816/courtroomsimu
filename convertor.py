import re
import json

input_file = r"legal_qa_100.json"
output_file = r"legal_qa_100_fixed.jsonl"

with open(input_file, "r", encoding="utf-8-sig") as f:
    content = f.read()

# Fix missing commas between JSON objects
content = re.sub(r'}\s*\n\s*{', '},{', content)

# Ensure valid JSON array
data = json.loads(content)

with open(output_file, "w", encoding="utf-8") as f:
    for item in data:
        f.write(json.dumps(item, ensure_ascii=False) + "\n")

print("Converted:", len(data))