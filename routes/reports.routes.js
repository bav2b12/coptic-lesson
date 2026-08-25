const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');

router.use(authenticate, requireAdmin);

// 1. Dashboard Global Metrics & Activity Stream
router.get('/dashboard', async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'super_admin';

    // Counts
    const studentsCount = await db.get('SELECT COUNT(*) as count FROM users WHERE role = "student"');
    const coursesCount = await db.get('SELECT COUNT(*) as count FROM courses');
    const lessonsCount = await db.get('SELECT COUNT(*) as count FROM lessons');
    const examsCount = await db.get('SELECT COUNT(*) as count FROM exams');
    const assignmentsCount = await db.get('SELECT COUNT(*) as count FROM assignments');
    const activeCodesCount = await db.get('SELECT COUNT(*) as count FROM access_codes WHERE status = "active"');
    
    // Average Video Watch & Overall Progress
    const avgProgress = await db.get(`
      SELECT 
        AVG(video_watched_percentage) as avg_video_watch,
        (SELECT COUNT(*) FROM lesson_progress WHERE completed = 1) * 1.0 / MAX(1, (SELECT COUNT(*) FROM users WHERE role = "student") * (SELECT COUNT(*) FROM lessons)) * 100 as overall_completion_rate
      FROM lesson_progress
    `);

    // Recent Activity Logs
    const recentActivity = await db.all(`
      SELECT id, admin_name, action, target_type, target_id, details, created_at
      FROM activity_logs
      ORDER BY created_at DESC
      LIMIT 15
    `);

    // Recent Exam Submissions
    const recentAttempts = await db.all(`
      SELECT ea.id, ea.score, ea.total_points, ea.percentage, ea.passed, ea.submitted_at,
             u.name as student_name, e.title_ar as exam_title_ar
      FROM exam_attempts ea
      JOIN users u ON u.id = ea.user_id
      JOIN exams e ON e.id = ea.exam_id
      ORDER BY ea.submitted_at DESC
      LIMIT 10
    `);

    return res.json({
      success: true,
      stats: {
        total_students: studentsCount.count,
        total_courses: coursesCount.count,
        total_lessons: lessonsCount.count,
        total_exams: examsCount.count,
        total_assignments: assignmentsCount.count,
        active_codes: activeCodesCount.count,
        avg_video_watch: Math.round(avgProgress.avg_video_watch || 0),
        overall_completion_rate: Math.min(100, Math.round(avgProgress.overall_completion_rate || 0))
      },
      recent_activity: recentActivity,
      recent_attempts: recentAttempts
    });
  } catch (error) {
    console.error('Error fetching dashboard reports:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch dashboard metrics.' });
  }
});

// 2. Comprehensive Student Progress Reports
router.get('/students', async (req, res) => {
  try {
    const { course_id, search } = req.query;

    let whereSql = 'u.role = "student"';
    let params = [];

    if (search && search.trim()) {
      whereSql += ' AND (u.name LIKE ? OR u.phone LIKE ? OR ac.code LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const students = await db.all(`
      SELECT 
        u.id, u.name, u.phone, u.status, u.created_at, u.last_login,
        ac.code as access_code,
        (SELECT COUNT(*) FROM user_course_enrollments uce WHERE uce.user_id = u.id) as enrolled_courses_count,
        (SELECT COUNT(*) FROM lesson_progress lp WHERE lp.user_id = u.id AND lp.completed = 1) as completed_lessons,
        (SELECT AVG(lp.video_watched_percentage) FROM lesson_progress lp WHERE lp.user_id = u.id) as avg_video_percentage,
        (SELECT AVG(ea.percentage) FROM exam_attempts ea WHERE ea.user_id = u.id) as avg_exam_score,
        (SELECT COUNT(*) FROM exam_attempts ea WHERE ea.user_id = u.id AND ea.passed = 1) as passed_exams,
        (SELECT AVG(asub.grade) FROM assignment_submissions asub WHERE asub.user_id = u.id AND asub.grade IS NOT NULL) as avg_assignment_grade
      FROM users u
      LEFT JOIN access_codes ac ON ac.id = u.access_code_id
      WHERE ${whereSql}
      ORDER BY u.name ASC
    `, params);

    const formatted = students.map(s => ({
      ...s,
      avg_video_percentage: Math.round(s.avg_video_percentage || 0),
      avg_exam_score: Math.round(s.avg_exam_score || 0),
      avg_assignment_grade: Math.round(s.avg_assignment_grade || 0)
    }));

    return res.json({ success: true, students: formatted });
  } catch (error) {
    console.error('Error fetching student reports:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch student reports.' });
  }
});

// 3. Export Student Report to CSV
router.get('/export-csv', async (req, res) => {
  try {
    const students = await db.all(`
      SELECT 
        u.id, u.name, u.phone, u.status, u.created_at, u.last_login,
        COALESCE(ac.code, 'Direct') as access_code,
        (SELECT COUNT(*) FROM lesson_progress lp WHERE lp.user_id = u.id AND lp.completed = 1) as completed_lessons,
        (SELECT ROUND(AVG(lp.video_watched_percentage), 1) FROM lesson_progress lp WHERE lp.user_id = u.id) as avg_video_pct,
        (SELECT ROUND(AVG(ea.percentage), 1) FROM exam_attempts ea WHERE ea.user_id = u.id) as avg_exam_pct
      FROM users u
      LEFT JOIN access_codes ac ON ac.id = u.access_code_id
      WHERE u.role = "student"
      ORDER BY u.name ASC
    `);

    // Build CSV
    let csv = '\uFEFF'; // UTF-8 BOM for Excel Arabic support
    csv += 'ID,Name,Phone,Access Code,Status,Completed Lessons,Avg Video Watch %,Avg Exam Score %,Created At,Last Login\n';

    students.forEach(s => {
      csv += `"${s.id}","${s.name.replace(/"/g, '""')}","${s.phone}","${s.access_code}","${s.status}","${s.completed_lessons || 0}","${s.avg_video_pct || 0}%","${s.avg_exam_pct || 0}%","${s.created_at}","${s.last_login || ''}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="doros_coptic_students_report.csv"');
    return res.send(csv);
  } catch (error) {
    return res.status(500).send('Error generating CSV report.');
  }
});

module.exports = router;
