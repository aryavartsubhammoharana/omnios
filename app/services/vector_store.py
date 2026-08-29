"""ChromaDB Vector Database Service for high-speed local RAG semantic search."""

import os
import chromadb
from app.utils.text_chunker import chunk_text

CHROMA_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "chroma_data")
os.makedirs(CHROMA_DATA_DIR, exist_ok=True)

_client = None

def get_chroma_client():
    global _client
    if _client is None:
        try:
            _client = chromadb.PersistentClient(path=CHROMA_DATA_DIR)
        except Exception as e:
            print(f"Error initializing ChromaDB persistent client: {e}")
            _client = chromadb.Client()
    return _client

def get_collection(name: str = "classroom_notes"):
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"}
    )

def index_document_in_chroma(doc_id: int, classroom_id: int | None, filename: str, content_text: str) -> int:
    """Chunks text and stores embeddings into ChromaDB with metadata for fast RAG search."""
    if not content_text or not content_text.strip():
        return 0

    try:
        col = get_collection()
        
        # 1. Clean previous chunks for this document
        try:
            col.delete(where={"doc_id": int(doc_id)})
        except Exception:
            pass

        # 2. Chunk text
        chunks = chunk_text(content_text, max_tokens=600, overlap_tokens=80)
        if not chunks:
            return 0

        # 3. Prepare payload for ChromaDB
        doc_texts = []
        metadatas = []
        ids = []

        for c in chunks:
            idx = c["chunk_index"]
            doc_texts.append(c["chunk_text"])
            metadatas.append({
                "doc_id": int(doc_id),
                "classroom_id": int(classroom_id) if classroom_id else 0,
                "filename": str(filename),
                "chunk_index": int(idx),
                "total_chunks": int(len(chunks))
            })
            ids.append(f"doc_{doc_id}_chunk_{idx}")

        # 4. Insert into ChromaDB (auto-embeds locally using built-in embedding engine)
        col.add(
            documents=doc_texts,
            metadatas=metadatas,
            ids=ids
        )
        print(f"[OK] ChromaDB: Successfully indexed {len(chunks)} vector chunks for '{filename}' (doc_id={doc_id})")
        return len(chunks)
    except Exception as e:
        print(f"Error indexing in ChromaDB: {e}")
        return 0

def query_chroma_rag(query_text: str, doc_id: int | None = None, classroom_id: int | None = None, n_results: int = 5) -> list[dict]:
    """Semantic search query in ChromaDB. Returns top matching chunks with metadata."""
    if not query_text or not query_text.strip():
        return []

    try:
        col = get_collection()
        where_filter = None

        if doc_id:
            where_filter = {"doc_id": int(doc_id)}
        elif classroom_id:
            where_filter = {"classroom_id": int(classroom_id)}

        results = col.query(
            query_texts=[query_text],
            n_results=n_results,
            where=where_filter
        )

        formatted = []
        if results and "documents" in results and results["documents"]:
            docs = results["documents"][0]
            metas = results["metadatas"][0] if "metadatas" in results and results["metadatas"] else [{}] * len(docs)
            dists = results["distances"][0] if "distances" in results and results["distances"] else [0.0] * len(docs)

            for i, text in enumerate(docs):
                meta = metas[i] if i < len(metas) else {}
                dist = dists[i] if i < len(dists) else 0.0
                formatted.append({
                    "chunk_text": text,
                    "filename": meta.get("filename", "Lecture Note"),
                    "chunk_index": meta.get("chunk_index", 0),
                    "doc_id": meta.get("doc_id", 0),
                    "similarity": round(1.0 - dist, 4) if dist is not None else 1.0
                })

        return formatted
    except Exception as e:
        print(f"Error querying ChromaDB: {e}")
        return []

def delete_document_from_chroma(doc_id: int):
    """Remove all vector chunks for a given document from ChromaDB."""
    try:
        col = get_collection()
        col.delete(where={"doc_id": int(doc_id)})
        print(f"[OK] ChromaDB: Deleted all vector chunks for doc_id={doc_id}")
    except Exception as e:
        print(f"Note on deleting from ChromaDB: {e}")
