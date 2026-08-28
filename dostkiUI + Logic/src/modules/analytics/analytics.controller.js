import { AnalyticsService } from './analytics.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

export class AnalyticsController {
  /**
   * POST /api/v1/notes/:id/track-view
   * Log student document view and update daily streak
   */
  static async trackView(req, res, next) {
    try {
      const timeSpent = req.body.timeSpentSeconds || 30;
      const result = await AnalyticsService.trackNoteView(req.user.id, req.params.id, timeSpent);
      return ApiResponse.ok(res, result, 'Document view and streak recorded');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/classrooms/:id/analytics
   * Teacher classroom analytics dashboard
   */
  static async getClassroomAnalytics(req, res, next) {
    try {
      const analytics = await AnalyticsService.getClassroomAnalytics(req.params.id, req.user.id);
      return ApiResponse.ok(res, analytics, 'Classroom analytics retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/analytics/streak
   * Get student's current learning streak
   */
  static async getStreak(req, res, next) {
    try {
      const streak = await AnalyticsService.getStudentStreak(req.user.id);
      return ApiResponse.ok(res, streak, 'Student streak retrieved');
    } catch (error) {
      next(error);
    }
  }
}
