"""
Legal retrieval for LEXA.

On first call the corpus is embedded with SentenceTransformers and stored in a
FAISS index.  Subsequent calls load the cached index from disk — no re-embedding.

Falls back to keyword scoring if the FAISS / sentence-transformers packages are
not installed (keeps the system runnable in a minimal environment).
"""

from __future__ import annotations

import pickle
import re

from config import settings
from graph.state import LEXAState


# ---------------------------------------------------------------------------
# Corpus loading
# ---------------------------------------------------------------------------

def _load_chunks() -> list[dict]:
    """Load text chunks from the FAISS index cache or build fresh from corpus."""
    chunks_file = settings.index_dir / "chunks.pkl"
    if chunks_file.exists():
        with chunks_file.open("rb") as fh:
            return pickle.load(fh)

    chunks: list[dict] = []
    for path in settings.corpus_dir.glob("*.txt"):
        text = path.read_text(encoding="utf-8", errors="ignore")
        for block in re.split(r"\n\s*\n", text):
            clean = " ".join(block.split())
            if len(clean) > 40:
                chunks.append({
                    "section": path.stem.upper(),
                    "text": clean,
                    "source": str(path),
                })
    return chunks


# ---------------------------------------------------------------------------
# FAISS index
# ---------------------------------------------------------------------------

_faiss_index = None
_faiss_chunks: list[dict] = []
_embed_model = None


def _get_embed_model():
    global _embed_model
    if _embed_model is None:
        from sentence_transformers import SentenceTransformer
        _embed_model = SentenceTransformer(settings.embedding_model)
    return _embed_model


def _build_or_load_faiss_index(chunks: list[dict]):
    """Build a FAISS index from chunks, or load a pre-built one from disk."""
    global _faiss_index, _faiss_chunks

    index_file = settings.index_dir / "index.faiss"

    if index_file.exists():
        import faiss
        _faiss_index = faiss.read_index(str(index_file))
        _faiss_chunks = chunks
        return

    import faiss
    import numpy as np

    model = _get_embed_model()
    texts = [c["text"] for c in chunks]
    embeddings = model.encode(texts, batch_size=64, show_progress_bar=False, normalize_embeddings=True)
    embeddings = np.array(embeddings, dtype="float32")

    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)   # inner product = cosine similarity on normalized vecs
    index.add(embeddings)

    settings.index_dir.mkdir(parents=True, exist_ok=True)
    faiss.write_index(index, str(index_file))

    # Also cache chunks alongside the index
    chunks_file = settings.index_dir / "chunks.pkl"
    with chunks_file.open("wb") as fh:
        pickle.dump(chunks, fh)

    _faiss_index = index
    _faiss_chunks = chunks


# ---------------------------------------------------------------------------
# Retrieval
# ---------------------------------------------------------------------------

def _retrieve_faiss(query: str, top_k: int) -> list[dict]:
    """Vector-based retrieval using FAISS + SentenceTransformers."""
    import numpy as np

    chunks = _load_chunks()
    if not chunks:
        return []

    _build_or_load_faiss_index(chunks)

    model = _get_embed_model()
    q_vec = model.encode([query], normalize_embeddings=True)
    q_vec = np.array(q_vec, dtype="float32")

    distances, indices = _faiss_index.search(q_vec, top_k)
    results = []
    for score, idx in zip(distances[0], indices[0]):
        if idx < 0:
            continue
        chunk = _faiss_chunks[idx]
        results.append({
            "section": chunk["section"],
            "text": chunk["text"],
            "relevance": round(float(score), 4),
        })
    return results


def _retrieve_keyword(query: str, top_k: int) -> list[dict]:
    """Keyword-scoring fallback (no ML deps required)."""
    chunks = _load_chunks()
    terms = {t.lower() for t in re.findall(r"[a-zA-Z]{4,}", query)}

    def score(chunk: dict) -> int:
        text = chunk["text"].lower()
        return sum(1 for t in terms if t in text)

    ranked = sorted(chunks, key=score, reverse=True)
    return [
        {"section": c["section"], "text": c["text"], "relevance": score(c)}
        for c in ranked[:top_k]
    ]


def retrieve_laws(query: str, top_k: int | None = None) -> list[dict]:
    """
    Retrieve the most relevant law sections for a given query.
    Uses FAISS vector search if available, falls back to keyword scoring.
    """
    k = top_k if top_k is not None else settings.retrieval_top_k
    try:
        return _retrieve_faiss(query, k)
    except Exception:
        return _retrieve_keyword(query, k)


# ---------------------------------------------------------------------------
# LangGraph agent node
# ---------------------------------------------------------------------------

def legal_research(state: LEXAState) -> dict:
    query = f"{state.get('evidence', '')} {state.get('case_text', '')[:500]}"
    laws = retrieve_laws(query)
    return {
        "retrieved_laws": laws,
        "agent_trace": state.get("agent_trace", []) + [{"agent": "LegalResearch", "output": laws}],
    }
