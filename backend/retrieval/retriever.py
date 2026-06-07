from pathlib import Path
import pickle
import re

from config import settings
from graph.state import LEXAState


def _load_text_chunks() -> list[dict]:
    index_chunks = settings.index_dir / "chunks.pkl"
    if index_chunks.exists():
        with index_chunks.open("rb") as file:
            return pickle.load(file)

    chunks: list[dict] = []
    for path in settings.corpus_dir.glob("*.txt"):
        text = path.read_text(encoding="utf-8", errors="ignore")
        for block in re.split(r"\n\s*\n", text):
            clean = " ".join(block.split())
            if clean:
                chunks.append({"section": path.stem.upper(), "text": clean, "source": str(path)})
    return chunks


def retrieve_laws(query: str, top_k: int = 3) -> list[dict]:
    chunks = _load_text_chunks()
    terms = {term.lower() for term in re.findall(r"[a-zA-Z]{4,}", query)}

    def score(chunk: dict) -> int:
        text = chunk["text"].lower()
        return sum(1 for term in terms if term in text)

    ranked = sorted(chunks, key=score, reverse=True)
    return [
        {"section": item.get("section", "LAW"), "text": item["text"], "relevance": score(item)}
        for item in ranked[:top_k]
    ]


def legal_research(state: LEXAState) -> dict:
    query = f"{state.get('evidence', '')} {state.get('case_text', '')[:500]}"
    laws = retrieve_laws(query)
    return {"retrieved_laws": laws, "agent_trace": state.get("agent_trace", []) + [{"agent": "LegalResearch", "output": laws}]}
