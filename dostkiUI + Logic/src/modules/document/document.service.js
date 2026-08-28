import path from 'path';
import { query, withTransaction } from '../../config/db.js';
import { storageService } from '../../config/s3.js';
import { enqueueDocumentProcessing } from '../../queues/documentQueue.js';
import { ApiError } from '../../utils/apiError.js';

export class DocumentService {
  /**
   * Upload and enqueue a classroom note
   */
  static async uploadClassroomNote(classroomId, uploaderId, file) {
    if (!file) {
      throw ApiError.badRequest('No file provided for upload.');
    }

    // Verify classroom exists and user is the teacher or admin
    const classCheck = await query(`SELECT id, teacher_id FROM classrooms WHERE id = $1`, [classroomId]);
    if (classCheck.rows.length === 0) {
      throw ApiError.notFound('Classroom not found.');
    }

    if (uploaderId && classCheck.rows[0].teacher_id !== uploaderId) {
      // In production check if user is admin, otherwise restrict upload to classroom teacher
      const uploader = await query(`SELECT role FROM users WHERE id = $1`, [uploaderId]);
      if (uploader.rows[0]?.role !== 'ADMIN') {
        throw ApiError.forbidden('Only the classroom teacher or an administrator can upload notes to this classroom.');
      }
    }

    // Determine normalized file type
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const fileType = ext || 'pdf';

    // 1. Save file to storage (local disk or S3)
    const stored = await storageService.save(file);

    // 2. Insert document record into DB with status PENDING
    const result = await query(
      `INSERT INTO documents (classroom_id, uploader_id, file_name, file_url, file_type, file_size, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
       RETURNING id, classroom_id, uploader_id, file_name, file_url, file_type, file_size, status, created_at`,
      [classroomId, uploaderId, file.originalname, stored.url, fileType, stored.size]
    );

    const document = result.rows[0];

    // 3. Dispatch processing job to BullMQ queue
    await enqueueDocumentProcessing({
      documentId: document.id,
      classroomId: document.classroom_id,
      fileUrlOrKey: stored.key || stored.url,
      fileType: document.file_type,
      fileName: document.file_name,
      uploaderId,
    });

    return {
      ...document,
      processingStatus: 'PENDING',
      message: 'Note uploaded successfully. Asynchronous vector processing initiated.',
    };
  }

  /**
   * Get all documents for a classroom
   */
  static async getClassroomDocuments(classroomId) {
    const result = await query(
      `SELECT d.id, d.classroom_id, d.uploader_id, d.file_name, d.file_url, d.file_type, d.file_size,
              d.status, d.error_message, d.created_at, d.updated_at,
              u.first_name AS uploader_first_name, u.last_name AS uploader_last_name,
              COUNT(dc.id)::int AS chunks_count
       FROM documents d
       JOIN users u ON d.uploader_id = u.id
       LEFT JOIN document_chunks dc ON d.id = dc.document_id
       WHERE d.classroom_id = $1
       GROUP BY d.id, u.id
       ORDER BY d.created_at DESC`,
      [classroomId]
    );

    return result.rows;
  }

  /**
   * Get single document by ID
   */
  static async getDocumentById(documentId) {
    const result = await query(
      `SELECT d.id, d.classroom_id, d.uploader_id, d.file_name, d.file_url, d.file_type, d.file_size,
              d.status, d.error_message, d.created_at, d.updated_at,
              c.name AS classroom_name, c.subject AS classroom_subject,
              COUNT(dc.id)::int AS chunks_count
       FROM documents d
       JOIN classrooms c ON d.classroom_id = c.id
       LEFT JOIN document_chunks dc ON d.id = dc.document_id
       WHERE d.id = $1
       GROUP BY d.id, c.id`,
      [documentId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Document not found.');
    }

    return result.rows[0];
  }

  /**
   * Get parsed chunks for a document
   */
  static async getDocumentChunks(documentId) {
    const result = await query(
      `SELECT id, document_id, classroom_id, chunk_index, chunk_text, metadata, created_at
       FROM document_chunks
       WHERE document_id = $1
       ORDER BY chunk_index ASC`,
      [documentId]
    );

    return result.rows;
  }

  /**
   * Delete document and its vector chunks
   */
  static async deleteDocument(documentId, userId, userRole) {
    const docResult = await query(
      `SELECT d.id, d.file_url, d.uploader_id, c.teacher_id 
       FROM documents d 
       JOIN classrooms c ON d.classroom_id = c.id 
       WHERE d.id = $1`,
      [documentId]
    );

    if (docResult.rows.length === 0) {
      throw ApiError.notFound('Document not found.');
    }

    const doc = docResult.rows[0];
    const isOwnerOrTeacher = doc.uploader_id === userId || doc.teacher_id === userId;

    if (userRole !== 'ADMIN' && !isOwnerOrTeacher) {
      throw ApiError.forbidden('You are not authorized to delete this document.');
    }

    // Delete file from storage
    await storageService.delete(doc.file_url);

    // Delete from DB (document_chunks cascade on delete)
    await query(`DELETE FROM documents WHERE id = $1`, [documentId]);

    return { deleted: true };
  }
}
