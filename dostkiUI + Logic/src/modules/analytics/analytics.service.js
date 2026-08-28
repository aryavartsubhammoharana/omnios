import { query, withTransaction } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';

export class AnalyticsService {
  /**
   * Track a student note view session and update daily learning streak
   */
  static async trackNoteView(studentId, documentId, timeSpentSeconds = 30) {
    // 1. Get classroomId for this document
    const docRes = await query(`SELECT classroom_id FROM documents WHERE id = $1`, [documentId]);
    if (docRes.rows.length === 0) {
      throw ApiError.notFound('Document not found.');
    }
    const classroomId = docRes.rows[0].classroom_id;

    // 2. Insert into student_analytics
    await query(
      `INSERT INTO student_analytics (student_id, classroom_id, document_id, viewed_at, time_spent_seconds)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)`,
      [studentId, classroomId, documentId, timeSpentSeconds]
    );

    // 3. Update student streak logic inside a transaction
    const streakResult = await withTransaction(async (client) => {
      const streakRes = await client.query(
        `SELECT current_streak, longest_streak, last_active_date 
         FROM student_streaks 
         WHERE student_id = $1`,
        [studentId]
      );

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      if (streakRes.rows.length === 0) {
        // First active day
        const insertRes = await client.query(
          `INSERT INTO student_streaks (student_id, current_streak, longest_streak, last_active_date)
           VALUES ($1, 1, 1, CURRENT_DATE)
           RETURNING current_streak, longest_streak, last_active_date`,
          [studentId]
        );
        return insertRes.rows[0];
      }

      const streakData = streakRes.rows[0];
      let currentStreak = streakData.current_streak;
      let longestStreak = streakData.longest_streak;

      if (streakData.last_active_date) {
        const lastDate = new Date(streakData.last_active_date);
        const lastDateStr = lastDate.toISOString().split('T')[0];

        if (lastDateStr !== todayStr) {
          // Calculate difference in calendar days
          const diffTime = Math.abs(today - lastDate);
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays === 1) {
            // Consecutive day: increment streak
            currentStreak += 1;
            if (currentStreak > longestStreak) {
              longestStreak = currentStreak;
            }
          } else if (diffDays > 1) {
            // Missed a day: reset streak to 1
            currentStreak = 1;
          }
        }
      } else {
        currentStreak = 1;
        longestStreak = 1;
      }

      const updateRes = await client.query(
        `UPDATE student_streaks 
         SET current_streak = $1, longest_streak = $2, last_active_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP
         WHERE student_id = $3
         RETURNING current_streak, longest_streak, last_active_date`,
        [currentStreak, longestStreak, studentId]
      );

      return updateRes.rows[0];
    });

    return {
      tracked: true,
      timeSpentSeconds,
      streak: {
        currentStreak: streakResult.current_streak,
        longestStreak: streakResult.longest_streak,
        lastActiveDate: streakResult.last_active_date,
      },
    };
  }

  /**
   * Get comprehensive Teacher Classroom Analytics Dashboard
   */
  static async getClassroomAnalytics(classroomId, teacherId) {
    // Verify classroom ownership or admin access
    const classRes = await query(
      `SELECT id, name, subject, classroom_code, teacher_id FROM classrooms WHERE id = $1`,
      [classroomId]
    );

    if (classRes.rows.length === 0) {
      throw ApiError.notFound('Classroom not found.');
    }

    const classroom = classRes.rows[0];

    // Enforce authorization: only the classroom teacher or an administrator can access analytics
    if (teacherId && classroom.teacher_id !== teacherId) {
      const uploader = await query(`SELECT role FROM users WHERE id = $1`, [teacherId]);
      if (uploader.rows[0]?.role !== 'ADMIN') {
        throw ApiError.forbidden('You are not authorized to view analytics for this classroom.');
      }
    }

    // 1. Overview counts
    const overviewRes = await query(
      `SELECT 
        (SELECT COUNT(DISTINCT student_id) FROM classroom_members WHERE classroom_id = $1)::int AS total_students,
        (SELECT COUNT(id) FROM documents WHERE classroom_id = $1)::int AS total_documents,
        (SELECT COUNT(id) FROM student_analytics WHERE classroom_id = $1)::int AS total_views,
        COALESCE((SELECT SUM(time_spent_seconds) FROM student_analytics WHERE classroom_id = $1), 0)::int AS total_time_spent_seconds`,
      [classroomId]
    );
    const overview = overviewRes.rows[0];

    // 2. Document-level performance
    const docPerformanceRes = await query(
      `SELECT d.id, d.file_name, d.file_type, d.status, d.created_at,
              COUNT(sa.id)::int AS total_views,
              COUNT(DISTINCT sa.student_id)::int AS unique_students_viewed,
              COALESCE(SUM(sa.time_spent_seconds), 0)::int AS total_time_spent_seconds,
              COALESCE(AVG(sa.time_spent_seconds), 0)::int AS avg_time_spent_seconds
       FROM documents d
       LEFT JOIN student_analytics sa ON d.id = sa.document_id
       WHERE d.classroom_id = $1
       GROUP BY d.id
       ORDER BY total_views DESC`,
      [classroomId]
    );

    // 3. Student leaderboard / engagement roster
    const studentEngagementRes = await query(
      `SELECT u.id, u.first_name, u.last_name, u.email,
              COALESCE(s.current_streak, 0) AS current_streak,
              COUNT(sa.id)::int AS total_view_events,
              COUNT(DISTINCT sa.document_id)::int AS documents_viewed,
              COALESCE(SUM(sa.time_spent_seconds), 0)::int AS total_study_time_seconds,
              MAX(sa.viewed_at) AS last_activity_time
       FROM classroom_members cm
       JOIN users u ON cm.student_id = u.id
       LEFT JOIN student_streaks s ON u.id = s.student_id
       LEFT JOIN student_analytics sa ON sa.student_id = u.id AND sa.classroom_id = cm.classroom_id
       WHERE cm.classroom_id = $1
       GROUP BY u.id, s.current_streak
       ORDER BY total_study_time_seconds DESC`,
      [classroomId]
    );

    // 4. Daily activity trend (past 7 days)
    const dailyActivityRes = await query(
      `SELECT DATE(viewed_at) AS activity_date,
              COUNT(id)::int AS views_count,
              COUNT(DISTINCT student_id)::int AS active_students_count,
              COALESCE(SUM(time_spent_seconds), 0)::int AS total_seconds
       FROM student_analytics
       WHERE classroom_id = $1 AND viewed_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY DATE(viewed_at)
       ORDER BY activity_date ASC`,
      [classroomId]
    );

    return {
      classroom: {
        id: classroom.id,
        name: classroom.name,
        subject: classroom.subject,
        classroomCode: classroom.classroom_code,
      },
      summary: {
        totalStudents: overview?.total_students || 0,
        totalDocuments: overview?.total_documents || 0,
        totalViewEvents: overview?.total_views || 0,
        totalStudyTimeSeconds: overview?.total_time_spent_seconds || 0,
        totalStudyTimeHours: Number(((overview?.total_time_spent_seconds || 0) / 3600).toFixed(2)),
      },
      documents: docPerformanceRes.rows,
      students: studentEngagementRes.rows,
      recentTrend: dailyActivityRes.rows,
    };
  }

  /**
   * Get Student Streak and activity details
   */
  static async getStudentStreak(studentId) {
    const res = await query(
      `SELECT current_streak, longest_streak, last_active_date 
       FROM student_streaks 
       WHERE student_id = $1`,
      [studentId]
    );

    if (res.rows.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
      };
    }

    return res.rows[0];
  }
}
