import { Worker } from 'bullmq';
import { DOCUMENT_QUEUE_NAME } from '../documentQueue.js';
import { redisConnectionOptions } from '../../config/redis.js';
import { query, withTransaction } from '../../config/db.js';
import { storageService } from '../../config/s3.js';
import { TextExtractorService } from '../../services/textExtractor.service.js';
import { TextChunker } from '../../utils/textChunker.js';
import { EmbeddingService } from '../../services/embedding.service.js';

/**
 * Core business logic to process an uploaded document:
 * 1. Mark status = PROCESSING
 * 2. Extract text (PDF / DOCX / OCR Images / Text)
 * 3. Chunk text into semantic windows with overlap
 * 4. Generate 1536-d vector embeddings
 * 5. Batch insert chunks into PostgreSQL document_chunks table
 * 6. Mark status = READY
 */
export async function processDocumentJobDirectly(data) {
  const { documentId, classroomId, fileUrlOrKey, fileType, fileName } = data;
  console.log(`🚀 [Worker] Starting processing for document: ${fileName} (ID: ${documentId})`);

  try {
    // 1. Set status to PROCESSING
    await query(
      `UPDATE documents 
       SET status = 'PROCESSING', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [documentId]
    );

    // 2. Fetch file buffer from local storage or S3
    const buffer = await storageService.getBuffer(fileUrlOrKey);

    // 3. Extract text content
    const extractionResult = await TextExtractorService.extract(buffer, fileType, fileName);
    const { text, pageCount, metadata: extractionMetadata } = extractionResult;

    if (!text || text.trim().length === 0) {
      throw new Error('Document contained no readable text or OCR extraction was empty.');
    }

    // 4. Chunk document into semantic overlapping windows
    const chunks = TextChunker.splitText(text, {
      maxTokens: 600,
      overlapTokens: 80,
      metadata: {
        fileName,
        fileType,
        pageCount,
        ...extractionMetadata,
      },
    });

    console.log(`📄 [Worker] Generated ${chunks.length} chunks for ${fileName}`);

    // 5. Generate vector embeddings in batches
    const chunkTexts = chunks.map((c) => c.chunkText);
    const embeddings = await EmbeddingService.generateBatchEmbeddings(chunkTexts);

    // 6. Batch insert chunks into PostgreSQL with pgvector inside a transaction
    await withTransaction(async (client) => {
      // Clear any prior chunks for this document if re-processing
      await client.query(`DELETE FROM document_chunks WHERE document_id = $1`, [documentId]);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embeddingVectorStr = EmbeddingService.toPgVector(embeddings[i]);

        await client.query(
          `INSERT INTO document_chunks 
            (document_id, classroom_id, chunk_index, chunk_text, metadata, embedding)
           VALUES ($1, $2, $3, $4, $5, $6::vector)`,
          [
            documentId,
            classroomId,
            chunk.chunkIndex,
            chunk.chunkText,
            JSON.stringify(chunk.metadata),
            embeddingVectorStr,
          ]
        );
      }

      // 7. Update document status to READY
      await client.query(
        `UPDATE documents 
         SET status = 'READY', error_message = NULL, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [documentId]
      );
    });

    console.log(`✅ [Worker] Document ${fileName} (ID: ${documentId}) successfully indexed into pgvector!`);
    return { success: true, chunksCount: chunks.length };
  } catch (error) {
    console.error(`❌ [Worker] Failed to process document ${documentId}:`, error);

    // Update document status to FAILED
    await query(
      `UPDATE documents 
       SET status = 'FAILED', error_message = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [documentId, error.message || 'Unknown processing error']
    );

    throw error;
  }
}

// Instantiate BullMQ Worker
let fileProcessorWorker = null;

try {
  fileProcessorWorker = new Worker(
    DOCUMENT_QUEUE_NAME,
    async (job) => {
      return processDocumentJobDirectly(job.data);
    },
    {
      connection: redisConnectionOptions,
      concurrency: 5,
    }
  );

  fileProcessorWorker.on('completed', (job) => {
    console.log(`🎉 [Worker] BullMQ Job ${job.id} completed successfully`);
  });

  fileProcessorWorker.on('error', () => {
    // Suppress repeated connection warnings when Redis is offline
  });
} catch (err) {
  // Graceful fallback to direct execution
}

export { fileProcessorWorker };
