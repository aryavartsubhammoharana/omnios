import { EmbeddingService } from '../../services/embedding.service.js';
import { query } from '../../config/db.js';

/**
 * Helper to re-embed or batch embed existing chunks
 */
export async function recomputeChunkEmbeddings(documentId) {
  const result = await query(
    `SELECT id, chunk_text FROM document_chunks WHERE document_id = $1 ORDER BY chunk_index ASC`,
    [documentId]
  );

  const chunks = result.rows;
  if (chunks.length === 0) return { count: 0 };

  const texts = chunks.map((c) => c.chunk_text);
  const embeddings = await EmbeddingService.generateBatchEmbeddings(texts);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const vectorStr = EmbeddingService.toPgVector(embeddings[i]);
    await query(
      `UPDATE document_chunks SET embedding = $1::vector WHERE id = $2`,
      [vectorStr, chunk.id]
    );
  }

  return { count: chunks.length };
}
