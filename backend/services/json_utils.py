import json
import re
from typing import Any


def parse_json(content: str, fallback: Any) -> Any:
    text = content.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE | re.DOTALL).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    starts = [(text.find("{"), "}"), (text.find("["), "]")]
    candidates = [(start, end) for start, end in starts if start >= 0]
    for start, end_char in sorted(candidates):
        end = text.rfind(end_char)
        if end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                continue
    return fallback
