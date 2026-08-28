"""Semantic sliding-window text chunker for RAG vector embeddings.
Splits documents into overlapping chunks preserving paragraph & sentence boundaries."""

import re


def chunk_text(text: str, max_tokens: int = 600, overlap_tokens: int = 80) -> list[dict]:
    """Split text into overlapping chunks of ~max_tokens tokens (≈ max_tokens*4 chars).
    
    Returns list of dicts: [{"chunk_index": 0, "chunk_text": "...", "char_start": 0, "char_end": 500}, ...]
    """
    if not text or not text.strip():
        return []

    # Approximate: 1 token ≈ 4 characters
    max_chars = max_tokens * 4
    overlap_chars = overlap_tokens * 4

    # Step 1: Split by paragraphs first
    paragraphs = re.split(r'\n{2,}', text.strip())
    
    chunks = []
    current_chunk = ""
    chunk_start = 0
    char_pos = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        # If adding this paragraph exceeds max, finalize current chunk
        if current_chunk and (len(current_chunk) + len(para) + 2) > max_chars:
            chunks.append({
                "chunk_index": len(chunks),
                "chunk_text": current_chunk.strip(),
                "char_start": chunk_start,
                "char_end": chunk_start + len(current_chunk.strip())
            })
            # Start new chunk with overlap from end of previous
            overlap_text = current_chunk[-overlap_chars:] if len(current_chunk) > overlap_chars else current_chunk
            chunk_start = chunk_start + len(current_chunk) - len(overlap_text)
            current_chunk = overlap_text + "\n\n" + para
        else:
            if current_chunk:
                current_chunk += "\n\n" + para
            else:
                current_chunk = para
                chunk_start = char_pos

        char_pos += len(para) + 2  # +2 for \n\n

    # Don't forget the last chunk
    if current_chunk.strip():
        chunks.append({
            "chunk_index": len(chunks),
            "chunk_text": current_chunk.strip(),
            "char_start": chunk_start,
            "char_end": chunk_start + len(current_chunk.strip())
        })

    # If text was too short for even 1 paragraph split, handle sentence-level
    if len(chunks) == 1 and len(chunks[0]["chunk_text"]) > max_chars:
        long_text = chunks[0]["chunk_text"]
        chunks = []
        sentences = re.split(r'(?<=[.!?])\s+', long_text)
        current_chunk = ""
        chunk_start = 0

        for sent in sentences:
            if current_chunk and (len(current_chunk) + len(sent) + 1) > max_chars:
                chunks.append({
                    "chunk_index": len(chunks),
                    "chunk_text": current_chunk.strip(),
                    "char_start": chunk_start,
                    "char_end": chunk_start + len(current_chunk.strip())
                })
                overlap_text = current_chunk[-overlap_chars:] if len(current_chunk) > overlap_chars else ""
                chunk_start = chunk_start + len(current_chunk) - len(overlap_text)
                current_chunk = overlap_text + " " + sent
            else:
                current_chunk = (current_chunk + " " + sent).strip() if current_chunk else sent

        if current_chunk.strip():
            chunks.append({
                "chunk_index": len(chunks),
                "chunk_text": current_chunk.strip(),
                "char_start": chunk_start,
                "char_end": chunk_start + len(current_chunk.strip())
            })

    # Add total_chunks metadata
    total = len(chunks)
    for c in chunks:
        c["total_chunks"] = total

    return chunks
