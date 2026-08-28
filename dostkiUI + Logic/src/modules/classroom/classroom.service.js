import { query, withTransaction } from '../../config/db.js';
import { generateClassroomCode } from '../../utils/codeGenerator.js';
import { ApiError } from '../../utils/apiError.js';

export class ClassroomService {
  /**
   * Create a new classroom (Teacher action)
   * Generates a unique 6-character code
   */
  static async createClassroom(teacherId, data) {
    const { name, subject, description } = data;

    let code = '';
    let isUnique = false;
    let attempts = 0;

    // Retry loop to ensure collision-free 6-char code
    while (!isUnique && attempts < 10) {
      code = generateClassroomCode(6);
      const existing = await query(`SELECT id FROM classrooms WHERE classroom_code = $1`, [code]);
      if (existing.rows.length === 0) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw ApiError.internal('Failed to generate a unique classroom code. Please try again.');
    }

    const result = await query(
      `INSERT INTO classrooms (name, subject, description, classroom_code, teacher_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, subject, description, classroom_code, teacher_id, created_at`,
      [name.trim(), subject.trim(), description ? description.trim() : null, code, teacherId]
    );

    return result.rows[0];
  }

  /**
   * Join a classroom using 6-character code (Student action)
   */
  static async joinClassroom(studentId, classroomCode) {
    const normalizedCode = classroomCode.trim().toUpperCase();

    // 1. Locate classroom by code
    const classResult = await query(
      `SELECT c.id, c.name, c.subject, c.description, c.classroom_code, c.teacher_id,
              u.first_name AS teacher_first_name, u.last_name AS teacher_last_name
       FROM classrooms c
       JOIN users u ON c.teacher_id = u.id
       WHERE c.classroom_code = $1`,
      [normalizedCode]
    );

    if (classResult.rows.length === 0) {
      throw ApiError.notFound('Classroom not found. Please verify the 6-character code.');
    }

    const classroom = classResult.rows[0];

    // Cannot join own classroom as student if you are the teacher
    if (classroom.teacher_id === studentId) {
      throw ApiError.badRequest('You are the teacher of this classroom.');
    }

    // 2. Check if already enrolled
    const memberCheck = await query(
      `SELECT id FROM classroom_members WHERE classroom_id = $1 AND student_id = $2`,
      [classroom.id, studentId]
    );

    if (memberCheck.rows.length > 0) {
      throw ApiError.conflict('You are already enrolled in this classroom.');
    }

    // 3. Insert membership
    await query(
      `INSERT INTO classroom_members (classroom_id, student_id)
       VALUES ($1, $2)`,
      [classroom.id, studentId]
    );

    return {
      classroomId: classroom.id,
      name: classroom.name,
      subject: classroom.subject,
      description: classroom.description,
      classroomCode: classroom.classroom_code,
      teacher: {
        firstName: classroom.teacher_first_name,
        lastName: classroom.teacher_last_name,
      },
    };
  }

  /**
   * Get all classrooms for a user based on their role
   */
  static async getUserClassrooms(userId, role) {
    if (role === 'TEACHER') {
      const result = await query(
        `SELECT c.id, c.name, c.subject, c.description, c.classroom_code, c.created_at,
                COUNT(DISTINCT cm.student_id)::int AS student_count,
                COUNT(DISTINCT d.id)::int AS document_count
         FROM classrooms c
         LEFT JOIN classroom_members cm ON c.id = cm.classroom_id
         LEFT JOIN documents d ON c.id = d.classroom_id
         WHERE c.teacher_id = $1
         GROUP BY c.id
         ORDER BY c.created_at DESC`,
        [userId]
      );
      return result.rows;
    }

    // Default: Student or general user joined classrooms
    const result = await query(
      `SELECT c.id, c.name, c.subject, c.description, c.classroom_code, c.created_at,
              u.first_name AS teacher_first_name, u.last_name AS teacher_last_name,
              COUNT(DISTINCT d.id)::int AS document_count,
              cm.joined_at
       FROM classroom_members cm
       JOIN classrooms c ON cm.classroom_id = c.id
       JOIN users u ON c.teacher_id = u.id
       LEFT JOIN documents d ON c.id = d.classroom_id
       WHERE cm.student_id = $1
       GROUP BY c.id, u.id, cm.joined_at
       ORDER BY cm.joined_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Get Classroom details by ID
   */
  static async getClassroomById(classroomId, userId) {
    const result = await query(
      `SELECT c.id, c.name, c.subject, c.description, c.classroom_code, c.teacher_id, c.created_at,
              u.first_name AS teacher_first_name, u.last_name AS teacher_last_name, u.email AS teacher_email,
              COUNT(DISTINCT cm.student_id)::int AS student_count,
              COUNT(DISTINCT d.id)::int AS document_count
       FROM classrooms c
       JOIN users u ON c.teacher_id = u.id
       LEFT JOIN classroom_members cm ON c.id = cm.classroom_id
       LEFT JOIN documents d ON c.id = d.classroom_id
       WHERE c.id = $1
       GROUP BY c.id, u.id`,
      [classroomId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Classroom not found.');
    }

    const classroom = result.rows[0];

    // Check authorization: user must be the teacher, an admin, or an enrolled student
    const isTeacher = classroom.teacher_id === userId;
    const enrollment = await query(
      `SELECT id FROM classroom_members WHERE classroom_id = $1 AND student_id = $2`,
      [classroomId, userId]
    );
    const isEnrolled = enrollment.rows.length > 0;

    return {
      ...classroom,
      isTeacher,
      isEnrolled,
    };
  }

  /**
   * Get list of members in a classroom (Teacher / Enrolled Students)
   */
  static async getClassroomMembers(classroomId) {
    const result = await query(
      `SELECT u.id, u.first_name, u.last_name, u.email, cm.joined_at,
              COALESCE(s.current_streak, 0) AS current_streak,
              COALESCE(SUM(sa.time_spent_seconds), 0)::int AS total_time_spent_seconds,
              COUNT(DISTINCT sa.document_id)::int AS documents_viewed_count
       FROM classroom_members cm
       JOIN users u ON cm.student_id = u.id
       LEFT JOIN student_streaks s ON u.id = s.student_id
       LEFT JOIN student_analytics sa ON sa.student_id = u.id AND sa.classroom_id = cm.classroom_id
       WHERE cm.classroom_id = $1
       GROUP BY u.id, cm.joined_at, s.current_streak
       ORDER BY cm.joined_at ASC`,
      [classroomId]
    );

    return result.rows;
  }

  /**
   * Delete a classroom (Teacher / Admin only)
   */
  static async deleteClassroom(classroomId, userId, userRole) {
    const classResult = await query(`SELECT teacher_id FROM classrooms WHERE id = $1`, [classroomId]);
    if (classResult.rows.length === 0) {
      throw ApiError.notFound('Classroom not found.');
    }

    if (userRole !== 'ADMIN' && classResult.rows[0].teacher_id !== userId) {
      throw ApiError.forbidden('You are not authorized to delete this classroom.');
    }

    await query(`DELETE FROM classrooms WHERE id = $1`, [classroomId]);
    return { deleted: true };
  }
}
