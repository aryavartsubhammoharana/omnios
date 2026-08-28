import { query } from '../../config/db.js';
import { EmbeddingService } from '../../services/embedding.service.js';
import { LlmService } from '../../services/llm.service.js';
import { ApiError } from '../../utils/apiError.js';

export class AiService {
  /**
   * Semantic Vector Search & Contextual RAG Chat
   */
  static async chatWithClassroomNotes(classroomId, queryText, documentId = null, topK = 4) {
    // 1. Verify classroom exists
    const classRes = await query(`SELECT name, subject FROM classrooms WHERE id = $1`, [classroomId]);
    if (classRes.rows.length === 0) {
      throw ApiError.notFound('Classroom not found.');
    }
    const classroom = classRes.rows[0];

    // 2. Generate 1536-d embedding for student query
    const queryEmbedding = await EmbeddingService.generateEmbedding(queryText);
    const queryVectorStr = EmbeddingService.toPgVector(queryEmbedding);

    // 3. Perform pgvector Cosine Similarity Query
    let sql = `
      SELECT dc.id, dc.chunk_text, dc.chunk_index, dc.metadata, dc.document_id,
             d.file_name,
             1 - (dc.embedding <=> $1::vector) AS similarity
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE dc.classroom_id = $2
    `;
    const params = [queryVectorStr, classroomId];

    if (documentId) {
      sql += ` AND dc.document_id = $3`;
      params.push(documentId);
    }

    // Order by cosine distance ascending (closest vectors first)
    sql += ` ORDER BY dc.embedding <=> $1::vector ASC LIMIT $${params.length + 1}`;
    params.push(topK);

    const searchResults = await query(sql, params);
    const contextChunks = searchResults.rows.map((row) => ({
      chunkId: row.id,
      chunkIndex: row.chunk_index,
      chunkText: row.chunk_text,
      fileName: row.file_name,
      similarity: parseFloat(row.similarity),
      metadata: row.metadata,
    }));

    // 4. Generate grounded answer via LLM
    const ragResult = await LlmService.generateRagAnswer(
      queryText,
      contextChunks,
      `${classroom.name} (${classroom.subject})`
    );

    return {
      query: queryText,
      classroom: {
        id: classroomId,
        name: classroom.name,
        subject: classroom.subject,
      },
      answer: ragResult.answer,
      sources: ragResult.sources,
      retrievedChunksCount: contextChunks.length,
    };
  }

  /**
   * Summarize Document Content
   */
  static async summarizeDocument(documentId) {
    const docRes = await query(
      `SELECT d.id, d.file_name, d.status, c.name AS classroom_name, c.subject
       FROM documents d
       JOIN classrooms c ON d.classroom_id = c.id
       WHERE d.id = $1`,
      [documentId]
    );

    if (docRes.rows.length === 0) {
      throw ApiError.notFound('Document not found.');
    }

    const doc = docRes.rows[0];

    // Fetch all chunks for this document
    const chunksRes = await query(
      `SELECT chunk_text FROM document_chunks WHERE document_id = $1 ORDER BY chunk_index ASC`,
      [documentId]
    );

    if (chunksRes.rows.length === 0) {
      if (doc.status === 'PENDING' || doc.status === 'PROCESSING') {
        throw ApiError.badRequest('Document is still being parsed and processed. Please retry in a few moments.');
      }
      throw ApiError.badRequest('No text chunks available for this document.');
    }

    const fullText = chunksRes.rows.map((r) => r.chunk_text).join('\n\n');
    const summaryData = await LlmService.generateSummary(fullText, doc.file_name);

    return {
      documentId: doc.id,
      fileName: doc.file_name,
      classroom: {
        name: doc.classroom_name,
        subject: doc.subject,
      },
      totalChunksAnalyzed: chunksRes.rows.length,
      ...summaryData,
    };
  }

  /**
   * Generate Structured Quiz (MCQs + Short Questions)
   */
  static async generateQuizForDocument(documentId, numQuestions = 5) {
    const docRes = await query(
      `SELECT d.id, d.file_name, d.status, c.name AS classroom_name, c.subject
       FROM documents d
       JOIN classrooms c ON d.classroom_id = c.id
       WHERE d.id = $1`,
      [documentId]
    );

    if (docRes.rows.length === 0) {
      throw ApiError.notFound('Document not found.');
    }

    const doc = docRes.rows[0];

    const chunksRes = await query(
      `SELECT chunk_text FROM document_chunks WHERE document_id = $1 ORDER BY chunk_index ASC`,
      [documentId]
    );

    if (chunksRes.rows.length === 0) {
      if (doc.status === 'PENDING' || doc.status === 'PROCESSING') {
        throw ApiError.badRequest('Document is currently being processed. Please retry once processing is complete.');
      }
      throw ApiError.badRequest('No text chunks available for quiz generation.');
    }

    const fullText = chunksRes.rows.map((r) => r.chunk_text).join('\n\n');
    const quizData = await LlmService.generateQuiz(fullText, numQuestions);

    return {
      documentId: doc.id,
      fileName: doc.file_name,
      classroom: {
        name: doc.classroom_name,
        subject: doc.subject,
      },
      ...quizData,
    };
  }
}
