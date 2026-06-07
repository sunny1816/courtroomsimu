from pathlib import Path
import pickle
import re

from config import settings


def chunk_corpus(corpus_dir: Path | None = None) -> list[dict]:
    corpus_dir = corpus_dir or settings.corpus_dir
    chunks: list[dict] = []
    for path in corpus_dir.glob("*.txt"):
        text = path.read_text(encoding="utf-8", errors="ignore")
        for raw in re.split(r"\n\s*\n", text):
            clean = " ".join(raw.split())
            if len(clean) > 40:
                chunks.append({"section": path.stem.upper(), "text": clean, "source": str(path)})
    return chunks


def build_index() -> int:
    settings.index_dir.mkdir(parents=True, exist_ok=True)
    chunks = chunk_corpus()
    with (settings.index_dir / "chunks.pkl").open("wb") as file:
        pickle.dump(chunks, file)
    try:
        from sentence_transformers import SentenceTransformer
        import faiss

        model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        embeddings = model.encode([chunk["text"] for chunk in chunks], normalize_embeddings=True)
        index = faiss.IndexFlatIP(embeddings.shape[1])
        index.add(embeddings)
        faiss.write_index(index, str(settings.index_dir / "index.faiss"))
    except Exception as exc:
        print(f"Saved chunks without FAISS index: {exc}")
    return len(chunks)


if __name__ == "__main__":
    print(f"Indexed {build_index()} legal chunks")
