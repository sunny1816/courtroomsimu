import re
from pathlib import Path


def clean_text(text: str) -> str:
    text = re.sub(r"\r", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_text_from_file(path: str | Path) -> str:
    path = Path(path)
    if path.suffix.lower() == ".txt":
        return clean_text(path.read_text(encoding="utf-8", errors="ignore"))
    if path.suffix.lower() != ".pdf":
        raise ValueError("Only PDF and TXT files are supported")

    import fitz

    parts = []
    with fitz.open(path) as doc:
        for page in doc:
            parts.append(page.get_text("text"))
    text = clean_text("\n".join(parts))
    if not text:
        raise ValueError("The uploaded document did not contain extractable text")
    return text
