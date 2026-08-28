import { AiService } from './ai.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

export class AiController {
  /**
   * POST /api/v1/ai/chat
   * RAG Query against classroom notes
   */
  static async chat(req, res, next) {
    try {
      const { classroomId, query, documentId, topK } = req.body;
      const result = await AiService.chatWithClassroomNotes(classroomId, query, documentId, topK);
      return ApiResponse.ok(res, result, 'RAG response generated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/ai/summarize
   * Summarize notes and generate takeaways
   */
  static async summarize(req, res, next) {
    try {
      const { documentId } = req.body;
      const result = await AiService.summarizeDocument(documentId);
      return ApiResponse.ok(res, result, 'Document summary generated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/ai/generate-quiz
   * Generate interactive MCQs and short questions from note content
   */
  static async generateQuiz(req, res, next) {
    try {
      const { documentId, numQuestions } = req.body;
      const result = await AiService.generateQuizForDocument(documentId, numQuestions);
      return ApiResponse.ok(res, result, 'Interactive quiz generated successfully');
    } catch (error) {
      next(error);
    }
  }
}
