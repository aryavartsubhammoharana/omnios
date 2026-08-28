import { ClassroomService } from './classroom.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

export class ClassroomController {
  /**
   * POST /api/v1/classrooms
   * Create classroom (TEACHER only)
   */
  static async create(req, res, next) {
    try {
      const classroom = await ClassroomService.createClassroom(req.user.id, req.body);
      return ApiResponse.created(res, classroom, 'Classroom created successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/classrooms/join
   * Join classroom using 6-character code (STUDENT)
   */
  static async join(req, res, next) {
    try {
      const result = await ClassroomService.joinClassroom(req.user.id, req.body.classroomCode);
      return ApiResponse.ok(res, result, 'Joined classroom successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/classrooms
   * List classrooms for logged-in user
   */
  static async getAll(req, res, next) {
    try {
      const classrooms = await ClassroomService.getUserClassrooms(req.user.id, req.user.role);
      return ApiResponse.ok(res, classrooms, 'Classrooms retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/classrooms/:id
   * Get single classroom details
   */
  static async getById(req, res, next) {
    try {
      const classroom = await ClassroomService.getClassroomById(req.params.id, req.user.id);
      return ApiResponse.ok(res, classroom, 'Classroom details retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/classrooms/:id/members
   * Get classroom member roster
   */
  static async getMembers(req, res, next) {
    try {
      const members = await ClassroomService.getClassroomMembers(req.params.id);
      return ApiResponse.ok(res, members, 'Classroom members retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/classrooms/:id
   * Delete classroom
   */
  static async delete(req, res, next) {
    try {
      const result = await ClassroomService.deleteClassroom(req.params.id, req.user.id, req.user.role);
      return ApiResponse.ok(res, result, 'Classroom deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}
