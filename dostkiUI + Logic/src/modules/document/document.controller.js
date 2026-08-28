import { DocumentService } from './document.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

export class DocumentController {
  /**
   * POST /api/v1/classrooms/:classroomId/notes
   * Upload note to classroom
   */
  static async upload(req, res, next) {
    try {
      const result = await DocumentService.uploadClassroomNote(
        req.params.classroomId,
        req.user.id,
        req.file
      );
      return ApiResponse.created(res, result, 'Document uploaded and queued for processing');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/classrooms/:classroomId/notes
   * List all notes for a classroom
   */
  static async getByClassroom(req, res, next) {
    try {
      const documents = await DocumentService.getClassroomDocuments(req.params.classroomId);
      return ApiResponse.ok(res, documents, 'Classroom documents retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/notes/:id
   * Get single note metadata and processing status
   */
  static async getById(req, res, next) {
    try {
      const document = await DocumentService.getDocumentById(req.params.id);
      return ApiResponse.ok(res, document, 'Document details retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/notes/:id/chunks
   * Get parsed document chunks
   */
  static async getChunks(req, res, next) {
    try {
      const chunks = await DocumentService.getDocumentChunks(req.params.id);
      return ApiResponse.ok(res, chunks, 'Document chunks retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/notes/:id
   * Delete note
   */
  static async delete(req, res, next) {
    try {
      const result = await DocumentService.deleteDocument(req.params.id, req.user.id, req.user.role);
      return ApiResponse.ok(res, result, 'Document deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}
