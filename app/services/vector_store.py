import os
import chromadb
from app.utils.text_chunker import chunk_text

CHROMA_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "chroma_data")
os.makedirs(CHROMA_DATA_DIR, exist_ok=True)

COLLECTION_NAME = "ournotes"
_client = None


def get_chroma_client():
    global _client
    if _client is None:
        try:
            _client = chromadb.PersistentClient(path=CHROMA_DATA_DIR)
        except Exception as e:
            print(f"ChromaDB persistent client init: {e}")
            _client = chromadb.Client()
    return _client


def get_ournotes_collection():
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"}
    )


def index_document_in_vector_store(
    doc_id: int,
    content_text: str,
    filename: str,
    classroom_id: int | None = None,
    classroom_code: str | None = None,
    uploaded_by_id: int | None = None
) -> int:
    if not content_text or not content_text.strip():
        return 0

    try:
        chunks = chunk_text(content_text, max_tokens=600, overlap_tokens=80)
        if not chunks:
            return 0

        col = get_ournotes_collection()

        try:
            col.delete(where={"doc_id": int(doc_id)})
        except Exception:
            pass

        docs = []
        metas = []
        ids = []

        clean_code = str(classroom_code).strip().upper() if classroom_code else ""
        c_id = int(classroom_id) if classroom_id else 0
        u_id = int(uploaded_by_id) if uploaded_by_id else 0

        for c in chunks:
            idx = c["chunk_index"]
            docs.append(c["chunk_text"])
            metas.append({
                "doc_id": int(doc_id),
                "classroom_id": c_id,
                "classroom_code": clean_code,
                "uploaded_by_id": u_id,
                "filename": str(filename),
                "chunk_index": int(idx),
                "total_chunks": int(len(chunks))
            })
            ids.append(f"doc_{doc_id}_chunk_{idx}")

        col.add(
            documents=docs,
            metadatas=metas,
            ids=ids
        )

        print(f"[OK] Collection '{COLLECTION_NAME}': Indexed {len(chunks)} chunks for doc_id={doc_id} ('{filename}')")
        return len(chunks)

    except Exception as e:
        print(f"Error indexing in collection '{COLLECTION_NAME}': {e}")
        return 0


def index_document_in_dual_vector_store(
    doc_id: int,
    classroom_code: str | None = None,
    classroom_id: int | None = None,
    filename: str = "Document",
    content_text: str = "",
    uploaded_by_id: int | None = None
) -> int:
    return index_document_in_vector_store(
        doc_id=doc_id,
        content_text=content_text,
        filename=filename,
        classroom_id=classroom_id,
        classroom_code=classroom_code,
        uploaded_by_id=uploaded_by_id
    )


def query_vector_store(
    query_text: str,
    doc_id: int | None = None,
    classroom_id: int | None = None,
    classroom_code: str | None = None,
    uploaded_by_id: int | None = None,
    allowed_classroom_ids: list[int] | None = None,
    n_results: int = 6
) -> list[dict]:
    if not query_text or not query_text.strip():
        return []

    try:
        col = get_ournotes_collection()
        where_filter = None

        if doc_id:
            where_filter = {"doc_id": int(doc_id)}
        elif classroom_id:
            where_filter = {"classroom_id": int(classroom_id)}
        elif classroom_code:
            where_filter = {"classroom_code": str(classroom_code).strip().upper()}

        query_args = {
            "query_texts": [query_text],
            "n_results": n_results
        }
        if where_filter:
            query_args["where"] = where_filter

        results = col.query(**query_args)

        formatted = []
        if results and "documents" in results and results["documents"]:
            docs = results["documents"][0]
            metas = results["metadatas"][0] if "metadatas" in results and results["metadatas"] else [{}] * len(docs)
            dists = results["distances"][0] if "distances" in results and results["distances"] else [0.0] * len(docs)

            for i, text in enumerate(docs):
                meta = metas[i] if i < len(metas) else {}
                dist = dists[i] if i < len(dists) else 0.0

                chunk_c_id = meta.get("classroom_id", 0)
                chunk_u_id = meta.get("uploaded_by_id", 0)

                if allowed_classroom_ids is not None and uploaded_by_id is not None:
                    is_own_upload = (chunk_u_id == uploaded_by_id)
                    is_in_allowed_class = (chunk_c_id in allowed_classroom_ids) if allowed_classroom_ids else False
                    if not is_own_upload and not is_in_allowed_class:
                        continue

                formatted.append({
                    "chunk_text": text,
                    "filename": meta.get("filename", "Study Note"),
                    "chunk_index": meta.get("chunk_index", 0),
                    "doc_id": meta.get("doc_id", 0),
                    "classroom_id": chunk_c_id,
                    "classroom_code": meta.get("classroom_code", ""),
                    "uploaded_by_id": chunk_u_id,
                    "similarity": round(1.0 - dist, 4) if dist is not None else 1.0
                })

        return formatted
    except Exception as e:
        print(f"Error querying collection '{COLLECTION_NAME}': {e}")
        return []


def query_classroom_vector_db(classroom_code: str, query_text: str, n_results: int = 5) -> list[dict]:
    return query_vector_store(query_text=query_text, classroom_code=classroom_code, n_results=n_results)


def query_global_vector_db(query_text: str, n_results: int = 6) -> list[dict]:
    return query_vector_store(query_text=query_text, n_results=n_results)


def delete_document_from_vector_store(doc_id: int):
    try:
        col = get_ournotes_collection()
        col.delete(where={"doc_id": int(doc_id)})
        print(f"[OK] Deleted doc_id={doc_id} from '{COLLECTION_NAME}'")
    except Exception as e:
        print(f"Error deleting from '{COLLECTION_NAME}': {e}")


def delete_document_from_dual_vector_store(doc_id: int, classroom_code: str | None = None, classroom_id: int | None = None):
    delete_document_from_vector_store(doc_id=doc_id)
