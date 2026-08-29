"""Dual Vector Database Architecture for NoteAI:
1. Classroom Vector DB (Per-Classroom Isolated Vector Space with Full Metadata)
2. Global Vector DB (Unified Anonymous Vector Space without Metadata)
"""

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

def get_classroom_collection(classroom_code: str):
    """Returns dedicated isolated ChromaDB collection for a specific classroom."""
    client = get_chroma_client()
    clean_code = str(classroom_code).strip().upper()
    collection_name = f"classroom_{clean_code}"
    return client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"}
    )

def get_global_collection():
    """Returns the single unified Global Vector Database collection."""
    client = get_chroma_client()
    return client.get_or_create_collection(
        name="global_knowledge_base",
        metadata={"hnsw:space": "cosine"}
    )

def index_document_in_dual_vector_store(
    doc_id: int,
    classroom_code: str | None,
    classroom_id: int | None,
    filename: str,
    content_text: str
) -> int:
    """Simultaneously indexes document into:
    1. Classroom-specific Vector DB (with full document metadata)
    2. Global Vector DB (pure anonymous chunks without metadata)
    """
    if not content_text or not content_text.strip():
        return 0

    try:
        chunks = chunk_text(content_text, max_tokens=600, overlap_tokens=80)
        if not chunks:
            return 0

        # =========================================================================
        # 1. CLASSROOM VECTOR DB (Per-Classroom Vector Store WITH Metadata)
        # =========================================================================
        if classroom_code:
            try:
                class_col = get_classroom_collection(classroom_code)
                # Clean existing chunks for this doc in classroom DB
                try:
                    class_col.delete(where={"doc_id": int(doc_id)})
                except Exception:
                    pass

                class_docs = []
                class_metas = []
                class_ids = []

                for c in chunks:
                    idx = c["chunk_index"]
                    class_docs.append(c["chunk_text"])
                    class_metas.append({
                        "doc_id": int(doc_id),
                        "classroom_id": int(classroom_id) if classroom_id else 0,
                        "classroom_code": str(classroom_code).upper(),
                        "filename": str(filename),
                        "chunk_index": int(idx),
                        "total_chunks": int(len(chunks))
                    })
                    class_ids.append(f"class_{classroom_code}_doc_{doc_id}_chunk_{idx}")

                class_col.add(
                    documents=class_docs,
                    metadatas=class_metas,
                    ids=class_ids
                )
                print(f"[OK] Classroom Vector DB ({classroom_code}): Indexed {len(chunks)} chunks with metadata for '{filename}'")
            except Exception as e:
                print(f"Error indexing in Classroom Vector DB: {e}")

        # =========================================================================
        # 2. GLOBAL VECTOR DB (Anonymous Knowledge Space WITHOUT Metadata)
        # =========================================================================
        try:
            global_col = get_global_collection()
            # Clean existing chunks in global DB
            try:
                global_col.delete(where={"doc_hash": f"doc_{doc_id}"})
            except Exception:
                pass

            global_docs = []
            global_metas = []
            global_ids = []

            for c in chunks:
                idx = c["chunk_index"]
                global_docs.append(c["chunk_text"])
                # PURE ANONYMOUS METADATA: No filename, no user ID, no teacher name
                global_metas.append({
                    "doc_hash": f"doc_{doc_id}",
                    "collection_key": str(classroom_code or "general").upper()
                })
                global_ids.append(f"global_doc_{doc_id}_chunk_{idx}")

            global_col.add(
                documents=global_docs,
                metadatas=global_metas,
                ids=global_ids
            )
            print(f"[OK] Global Vector DB: Indexed {len(chunks)} anonymous chunks into collection '{classroom_code or 'general'}'")
        except Exception as e:
            print(f"Error indexing in Global Vector DB: {e}")

        return len(chunks)

    except Exception as e:
        print(f"Error in dual vector store indexing: {e}")
        return 0

def query_classroom_vector_db(classroom_code: str, query_text: str, n_results: int = 5) -> list[dict]:
    """Semantic search inside a specific Classroom Vector Database.
    Returns matched chunks with source metadata.
    """
    if not query_text or not query_text.strip() or not classroom_code:
        return []

    try:
        col = get_classroom_collection(classroom_code)
        results = col.query(
            query_texts=[query_text],
            n_results=n_results
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
                    "filename": meta.get("filename", "Classroom Note"),
                    "chunk_index": meta.get("chunk_index", 0),
                    "doc_id": meta.get("doc_id", 0),
                    "classroom_code": meta.get("classroom_code", classroom_code),
                    "similarity": round(1.0 - dist, 4) if dist is not None else 1.0
                })

        return formatted
    except Exception as e:
        print(f"Error querying Classroom Vector DB ({classroom_code}): {e}")
        return []

def query_global_vector_db(query_text: str, n_results: int = 6) -> list[dict]:
    """Semantic search across the entire Global Vector Database.
    Returns pure anonymous chunks without revealing source metadata.
    """
    if not query_text or not query_text.strip():
        return []

    try:
        col = get_global_collection()
        results = col.query(
            query_texts=[query_text],
            n_results=n_results
        )

        formatted = []
        if results and "documents" in results and results["documents"]:
            docs = results["documents"][0]
            dists = results["distances"][0] if "distances" in results and results["distances"] else [0.0] * len(docs)

            for i, text in enumerate(docs):
                dist = dists[i] if i < len(dists) else 0.0
                formatted.append({
                    "chunk_text": text,
                    "similarity": round(1.0 - dist, 4) if dist is not None else 1.0
                })

        return formatted
    except Exception as e:
        print(f"Error querying Global Vector DB: {e}")
        return []

def delete_document_from_dual_vector_store(doc_id: int, classroom_code: str | None = None):
    """Removes document chunks from both Classroom Vector DB and Global Vector DB."""
    # 1. Delete from Classroom Vector DB
    if classroom_code:
        try:
            class_col = get_classroom_collection(classroom_code)
            class_col.delete(where={"doc_id": int(doc_id)})
            print(f"[OK] Deleted doc {doc_id} from Classroom Vector DB ({classroom_code})")
        except Exception as e:
            print(f"Note on deleting from Classroom Vector DB: {e}")

    # 2. Delete from Global Vector DB
    try:
        global_col = get_global_collection()
        global_col.delete(where={"doc_hash": f"doc_{doc_id}"})
        print(f"[OK] Deleted doc {doc_id} from Global Vector DB")
    except Exception as e:
        print(f"Note on deleting from Global Vector DB: {e}")
