"""Embedding service using Google Gemini text-embedding-004 for 768-d vector generation."""

import json
import requests
from app.config import settings


def generate_embedding(text: str) -> list[float] | None:
    """Generate a 768-dimensional embedding vector using Gemini text-embedding-004.
    Returns None on failure."""
    if not settings.GEMINI_API_KEY:
        print("⚠️ GEMINI_API_KEY not set — cannot generate embeddings")
        return None

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={settings.GEMINI_API_KEY}"
        payload = {
            "model": "models/text-embedding-004",
            "content": {
                "parts": [{"text": text[:8000]}]  # Gemini limit
            }
        }
        res = requests.post(url, json=payload, timeout=30)
        if res.status_code == 200:
            data = res.json()
            embedding = data.get("embedding", {}).get("values", [])
            if embedding:
                return embedding
        else:
            print(f"Embedding API error ({res.status_code}): {res.text[:200]}")
    except Exception as e:
        print(f"Error generating embedding: {e}")

    return None


def generate_embeddings_batch(texts: list[str]) -> list[list[float] | None]:
    """Generate embeddings for a batch of texts. Uses batch API if available, else sequential."""
    if not settings.GEMINI_API_KEY:
        return [None] * len(texts)

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key={settings.GEMINI_API_KEY}"
        requests_list = []
        for text in texts:
            requests_list.append({
                "model": "models/text-embedding-004",
                "content": {
                    "parts": [{"text": text[:8000]}]
                }
            })

        payload = {"requests": requests_list}
        res = requests.post(url, json=payload, timeout=60)
        if res.status_code == 200:
            data = res.json()
            embeddings = []
            for emb in data.get("embeddings", []):
                values = emb.get("values", [])
                embeddings.append(values if values else None)
            return embeddings
        else:
            print(f"Batch embedding API error ({res.status_code}): {res.text[:200]}")
    except Exception as e:
        print(f"Error in batch embedding: {e}")

    # Fallback to sequential
    print("Falling back to sequential embedding generation...")
    return [generate_embedding(t) for t in texts]


def to_pg_vector(embedding: list[float]) -> str:
    """Convert embedding list to PostgreSQL pgvector format string."""
    return "[" + ",".join(str(round(v, 8)) for v in embedding) + "]"


def cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
    """Compute cosine similarity between two float vectors (-1.0 to 1.0)."""
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0
    import numpy as np
    a = np.array(vec1, dtype=np.float32)
    b = np.array(vec2, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def search_top_k_chunks(query_embedding: list[float], chunks_list: list, k: int = 5) -> list:
    """Sort chunks by cosine similarity to query embedding and return top k items."""
    if not query_embedding or not chunks_list:
        return chunks_list[:k]

    scored = []
    for c in chunks_list:
        emb = c.embedding
        if emb and isinstance(emb, list):
            sim = cosine_similarity(query_embedding, emb)
            scored.append((sim, c))
        else:
            scored.append((0.0, c))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [c for sim, c in scored[:k]]

