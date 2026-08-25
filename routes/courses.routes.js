const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { requireSuperAdmin, requireAdmin } = require('../middleware/rbac');
const { checkCourseAccess, checkCourseManagementPermission } = require('../middleware/courseAccess');
const upload = require('../middleware/upload');
const { logActivity } = require('../middleware/audit');

// 1. List Courses (Role-aware)
router.get('/', authenticate, async (req, res) => {
  try {
    let courses = [];

    if (req.user.role === 'super_admin') {
      // Super Admin sees all courses with admin stats
      courses = await db.all(`
        SELECT c.*,
          (SELECT COUNT(*) FROM units u WHERE u.course_id = c.id) as units_count,
          (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) as lessons_count,
          (SELECT COUNT(*) FROM exams e WHERE e.course_id = c.id) as exams_count,
          (SELECT COUNT(*) FROM assignments a WHERE a.course_id = c.id) as assignments_count,
          (SELECT COUNT(*) FROM user_course_enrollments uce WHERE uce.course_id = c.id) as students_count
        FROM courses c
        ORDER BY c.order_index ASC, c.created_at DESC
      `);
    } else if (req.user.role === 'course_admin') {
      // Course Admin sees assigned courses
      courses = await db.all(`
        SELECT c.*,
          (SELECT COUNT(*) FROM units u WHERE u.course_id = c.id) as units_count,
          (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) as lessons_count,
          (SELECT COUNT(*) FROM exams e WHERE e.course_id = c.id) as exams_count,
          (SELECT COUNT(*) FROM assignments a WHERE a.course_id = c.id) as assignments_count,
          (SELECT COUNT(*) FROM user_course_enrollments uce WHERE uce.course_id = c.id) as students_count
        FROM courses c
        JOIN course_admins ca ON ca.course_id = c.id
        WHERE ca.user_id = ?
        ORDER BY c.order_index ASC
      `, [req.user.id]);
    } else {
      // Student sees only their enrolled courses that are published + their personal progress %
      courses = await db.all(`
        SELECT c.id, c.title, c.title_ar, c.description, c.description_ar, c.medios_id, c.cover_image, c.instructor_name, c.instructor_name_ar, c.order_index,
               m.name as medios_name, m.name_ar as medios_name_ar,
          (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) as total_lessons,
          (SELECT COUNT(*) FROM exams e WHERE e.course_id = c.id AND e.is_published = 1) as total_exams,
          (SELECT COUNT(*) FROM assignments a WHERE a.course_id = c.id) as total_assignments,
          (SELECT COUNT(*) FROM lesson_progress lp WHERE lp.user_id = ? AND lp.course_id = c.id AND lp.completed = 1) as completed_lessons,
          (SELECT COUNT(*) FROM exam_attempts ea JOIN exams ex ON ex.id = ea.exam_id WHERE ea.user_id = ? AND ex.course_id = c.id AND ea.passed = 1) as passed_exams
        FROM courses c
        LEFT JOIN medios m ON m.id = c.medios_id
        JOIN user_course_enrollments uce ON uce.course_id = c.id
        WHERE uce.user_id = ? AND c.status = 'published'
        ORDER BY c.order_index ASC
      `, [req.user.id, req.user.id, req.user.id]);

      // Calculate overall progress percentage per course
      courses = courses.map(c => {
        const totalItems = (c.total_lessons || 0) + (c.total_exams || 0);
        const completedItems = (c.completed_lessons || 0) + (c.passed_exams || 0);
        const progressPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
        return {
          ...c,
          progress_percentage: Math.min(100, progressPercentage)
        };
      });
    }

    return res.json({ success: true, courses });
  } catch (error) {
    console.error('Error fetching courses:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch courses.' });
  }
});

// 2. Get Single Course Details with Units, Lessons, Exams, Assignments & Materials
router.get('/:id', authenticate, checkCourseAccess, async (req, res) => {
  try {
    const courseId = parseInt(req.params.id, 10);
    const course = req.course;

    // Fetch Units
    const units = await db.all(
      'SELECT * FROM units WHERE course_id = ? ORDER BY order_index ASC, id ASC',
      [courseId]
    );

    // Fetch Lessons
    const lessons = await db.all(`
      SELECT l.id, l.unit_id, l.course_id, l.title, l.title_ar, l.duration_minutes, l.order_index, l.youtube_video_id,
             lp.completed as is_completed, lp.video_watched_percentage
      FROM lessons l
      LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
      WHERE l.course_id = ?
      ORDER BY l.order_index ASC, l.id ASC
    `, [req.user.id, courseId]);

    // Fetch Exams
    const exams = await db.all(`
      SELECT e.id, e.unit_id, e.lesson_id, e.title, e.title_ar, e.description, e.description_ar,
             e.time_limit_minutes, e.passing_score_percentage, e.max_attempts, e.is_published,
             (SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id = e.id) as question_count,
             (SELECT MAX(score) FROM exam_attempts ea WHERE ea.exam_id = e.id AND ea.user_id = ?) as best_score,
             (SELECT MAX(passed) FROM exam_attempts ea WHERE ea.exam_id = e.id AND ea.user_id = ?) as is_passed,
             (SELECT COUNT(*) FROM exam_attempts ea WHERE ea.exam_id = e.id AND ea.user_id = ?) as attempts_used
      FROM exams e
      WHERE e.course_id = ? ${req.user.role === 'student' ? 'AND e.is_published = 1' : ''}
      ORDER BY e.order_index ASC, e.id ASC
    `, [req.user.id, req.user.id, req.user.id, courseId]);

    // Fetch Assignments
    const assignments = await db.all(`
      SELECT a.id, a.unit_id, a.lesson_id, a.title, a.title_ar, a.description, a.description_ar, a.due_date, a.max_grade,
             asub.id as submission_id, asub.grade, asub.status as submission_status, asub.feedback
      FROM assignments a
      LEFT JOIN assignment_submissions asub ON asub.assignment_id = a.id AND asub.user_id = ?
      WHERE a.course_id = ?
      ORDER BY a.created_at ASC
    `, [req.user.id, courseId]);

    // Fetch Files / Materials
    const files = await db.all(`
      SELECT id, lesson_id, unit_id, name, description, file_path, file_type, file_size, created_at
      FROM lesson_files
      WHERE course_id = ?
      ORDER BY created_at DESC
    `, [courseId]);

    // Fetch assigned Course Admins if Super Admin
    let courseAdmins = [];
    if (req.user.role === 'super_admin') {
      courseAdmins = await db.all(`
        SELECT u.id, u.name, u.phone
        FROM users u
        JOIN course_admins ca ON ca.user_id = u.id
        WHERE ca.course_id = ?
      `, [courseId]);
    }

    // Structure units tree
    const structuredUnits = units.map(unit => {
      return {
        ...unit,
        lessons: lessons.filter(l => l.unit_id === unit.id),
        exams: exams.filter(e => e.unit_id === unit.id),
        assignments: assignments.filter(a => a.unit_id === unit.id),
        files: files.filter(f => f.unit_id === unit.id)
      };
    });

    // Unassigned items (belong to course root)
    const rootExams = exams.filter(e => !e.unit_id);
    const rootAssignments = assignments.filter(a => !a.unit_id);
    const rootFiles = files.filter(f => !f.unit_id && !f.lesson_id);

    return res.json({
      success: true,
      course,
      units: structuredUnits,
      root_exams: rootExams,
      root_assignments: rootAssignments,
      root_files: rootFiles,
      course_admins: courseAdmins
    });
  } catch (error) {
    console.error('Error getting course details:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve course details.' });
  }
});

// Course Management: one course scope for codes, students, and real activity summaries.
router.get('/:id/management', authenticate, checkCourseManagementPermission, async (req, res) => {
  try {
    const courseId = parseInt(req.params.id, 10);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const search = String(req.query.search || '').trim();
    const offset = (page - 1) * limit;
    const course = await db.get(`SELECT c.*, m.name as medios_name, m.name_ar as medios_name_ar
      FROM courses c LEFT JOIN medios m ON m.id = c.medios_id WHERE c.id = ?`, [courseId]);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });

    const codes = await db.all(`
      SELECT ac.id, ac.code, ac.status, ac.created_at, ac.expires_at,
             m.name as medios_name, m.name_ar as medios_name_ar,
             (SELECT COUNT(*) FROM users u WHERE u.access_code_id = ac.id) as student_count
      FROM access_codes ac JOIN access_code_courses acc ON acc.access_code_id = ac.id
      LEFT JOIN medios m ON m.id = ac.medios_id WHERE acc.course_id = ? ORDER BY ac.created_at DESC`, [courseId]);

    const term = `%${search}%`;
    const filter = search ? 'AND (u.name LIKE ? OR u.phone LIKE ? OR ac.code LIKE ?)' : '';
    const studentParams = search ? [courseId, courseId, courseId, courseId, courseId, courseId, term, term, term, limit, offset] : [courseId, courseId, courseId, courseId, courseId, courseId, limit, offset];
    const students = await db.all(`
      SELECT u.id, u.name, u.phone, ac.code as access_code, m.name as medios_name, m.name_ar as medios_name_ar,
        COALESCE((SELECT ROUND(AVG(lp.completed) * 100) FROM lesson_progress lp WHERE lp.user_id = u.id AND lp.course_id = ?), 0) as progress,
        (SELECT COUNT(*) FROM exam_attempts ea JOIN exams e ON e.id = ea.exam_id WHERE ea.user_id = u.id AND e.course_id = ? AND ea.submitted_at IS NOT NULL) as exams_completed,
        COALESCE((SELECT ROUND(AVG(ea.percentage)) FROM exam_attempts ea JOIN exams e ON e.id = ea.exam_id WHERE ea.user_id = u.id AND e.course_id = ? AND ea.submitted_at IS NOT NULL), 0) as average_exam_score,
        (SELECT COUNT(*) FROM assignment_submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.user_id = u.id AND a.course_id = ?) as assignments_submitted,
        (SELECT MAX(last_accessed_at) FROM lesson_progress lp WHERE lp.user_id = u.id AND lp.course_id = ?) as last_activity
      FROM users u JOIN user_course_enrollments e ON e.user_id = u.id AND e.course_id = ?
      LEFT JOIN access_codes ac ON ac.id = u.access_code_id LEFT JOIN medios m ON m.id = ac.medios_id
      WHERE u.role = 'student' ${filter} ORDER BY last_activity DESC, u.name ASC LIMIT ? OFFSET ?`, studentParams);
    const total = await db.get(`SELECT COUNT(*) as count FROM users u
      JOIN user_course_enrollments e ON e.user_id = u.id AND e.course_id = ?
      LEFT JOIN access_codes ac ON ac.id = u.access_code_id WHERE u.role = 'student' ${filter}`,
      search ? [courseId, term, term, term] : [courseId]);
    const counts = await db.get(`SELECT (SELECT COUNT(*) FROM lessons WHERE course_id = ?) as lessons,
      (SELECT COUNT(*) FROM exams WHERE course_id = ?) as exams, (SELECT COUNT(*) FROM assignments WHERE course_id = ?) as assignments,
      (SELECT COUNT(*) FROM lesson_files WHERE course_id = ?) as files`, [courseId, courseId, courseId, courseId]);
    return res.json({ success: true, course, access_codes: codes, students, content_counts: counts,
      pagination: { page, limit, total: total.count, pages: Math.ceil(total.count / limit) } });
  } catch (error) {
    console.error('Error fetching course management:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch course management.' });
  }
});

router.get('/:id/management/students/:studentId', authenticate, checkCourseManagementPermission, async (req, res) => {
  try {
    const courseId = parseInt(req.params.id, 10);
    const studentId = parseInt(req.params.studentId, 10);
    const student = await db.get(`SELECT u.id, u.name, u.phone, ac.code as access_code, m.name as medios_name, m.name_ar as medios_name_ar
      FROM users u JOIN user_course_enrollments e ON e.user_id = u.id AND e.course_id = ?
      LEFT JOIN access_codes ac ON ac.id = u.access_code_id LEFT JOIN medios m ON m.id = ac.medios_id
      WHERE u.id = ? AND u.role = 'student'`, [courseId, studentId]);
    if (!student) return res.status(404).json({ success: false, message: 'Student is not enrolled in this course.' });
    const lessons = await db.all(`SELECT l.id, l.title, l.title_ar, COALESCE(lp.completed, 0) as completed,
      COALESCE(lp.video_watched_percentage, 0) as video_progress, lp.last_accessed_at, lp.completed_at
      FROM lessons l LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ? WHERE l.course_id = ? ORDER BY l.order_index, l.id`, [studentId, courseId]);
    const exams = await db.all(`SELECT e.id, e.title, e.title_ar, ea.attempt_number, ea.score, ea.total_points, ea.percentage, ea.passed, ea.started_at, ea.submitted_at
      FROM exams e LEFT JOIN exam_attempts ea ON ea.exam_id = e.id AND ea.user_id = ? WHERE e.course_id = ? ORDER BY e.order_index, ea.attempt_number`, [studentId, courseId]);
    const assignments = await db.all(`SELECT a.id, a.title, a.title_ar, a.max_grade, s.grade, s.status, s.submitted_at, s.feedback
      FROM assignments a LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.user_id = ? WHERE a.course_id = ? ORDER BY a.created_at`, [studentId, courseId]);
    const timeline = await db.all(`SELECT 'lesson' as type, l.title as name, lp.last_accessed_at as occurred_at FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id WHERE lp.user_id = ? AND lp.course_id = ?
      UNION ALL SELECT 'exam', e.title, ea.submitted_at FROM exam_attempts ea JOIN exams e ON e.id = ea.exam_id WHERE ea.user_id = ? AND e.course_id = ? AND ea.submitted_at IS NOT NULL
      UNION ALL SELECT 'assignment', a.title, s.submitted_at FROM assignment_submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.user_id = ? AND a.course_id = ? ORDER BY occurred_at DESC LIMIT 100`, [studentId, courseId, studentId, courseId, studentId, courseId]);
    return res.json({ success: true, student, lessons, exams, assignments, timeline });
  } catch (error) {
    console.error('Error fetching student course activity:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch student activity.' });
  }
});

// 3. Create Course (Super Admin)
router.post('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { title, title_ar, description, description_ar, medios_id = null, instructor_name, instructor_name_ar, status = 'published', order_index = 0 } = req.body;

    if (!title || !title_ar) {
      return res.status(400).json({
        success: false,
        message: 'Course title in English and Arabic are required.',
        message_ar: 'عنوان الكورس بالعربية والإنجليزية مطلوب.'
      });
    }

    const result = await db.run(`
      INSERT INTO courses (title, title_ar, description, description_ar, medios_id, instructor_name, instructor_name_ar, status, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [title.trim(), title_ar.trim(), description || '', description_ar || '', medios_id || null, instructor_name || '', instructor_name_ar || '', status, order_index]);

    const newCourseId = result.lastID;
    await logActivity(req, 'CREATE_COURSE', 'Course', newCourseId, `Created course: ${title_ar}`);

    return res.status(201).json({
      success: true,
      message: 'Course created successfully.',
      message_ar: 'تم إنشاء الكورس بنجاح.',
      courseId: newCourseId
    });
  } catch (error) {
    console.error('Error creating course:', error);
    return res.status(500).json({ success: false, message: 'Failed to create course.' });
  }
});

// 4. Update Course (Super Admin or Assigned Course Admin)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const courseId = parseInt(req.params.id, 10);
    const { title, title_ar, description, description_ar, medios_id, instructor_name, instructor_name_ar, status, order_index } = req.body;

    if (req.user.role === 'course_admin') {
      const assigned = await db.get('SELECT id FROM course_admins WHERE user_id = ? AND course_id = ?', [req.user.id, courseId]);
      if (!assigned) {
        return res.status(403).json({ success: false, message: 'You are not authorized to edit this course.' });
      }
    }

    await db.run(`
      UPDATE courses
      SET title = COALESCE(?, title),
          title_ar = COALESCE(?, title_ar),
          description = COALESCE(?, description),
          description_ar = COALESCE(?, description_ar),
          medios_id = ?,
          instructor_name = COALESCE(?, instructor_name),
          instructor_name_ar = COALESCE(?, instructor_name_ar),
          status = COALESCE(?, status),
          order_index = COALESCE(?, order_index),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [title, title_ar, description, description_ar, medios_id !== undefined ? (medios_id || null) : undefined, instructor_name, instructor_name_ar, status, order_index, courseId]);

    await logActivity(req, 'UPDATE_COURSE', 'Course', courseId, `Updated course ID ${courseId}`);

    return res.json({
      success: true,
      message: 'Course updated successfully.',
      message_ar: 'تم تحديث بيانات الكورس بنجاح.'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update course.' });
  }
});

// 5. Upload Course Cover Image
router.post('/:id/cover', authenticate, requireAdmin, upload.single('cover'), async (req, res) => {
  try {
    const courseId = parseInt(req.params.id, 10);
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded.' });
    }

    const coverFileName = req.file.filename;
    await db.run('UPDATE courses SET cover_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [coverFileName, courseId]);

    await logActivity(req, 'UPLOAD_COVER', 'Course', courseId, `Uploaded cover image for course ${courseId}`);

    return res.json({
      success: true,
      message: 'Cover image uploaded successfully.',
      message_ar: 'تم رفع صورة الغلاف بنجاح.',
      cover_image: coverFileName
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to upload cover.' });
  }
});

// 6. Delete Course (Super Admin only)
router.delete('/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const courseId = parseInt(req.params.id, 10);
    const course = await db.get('SELECT title_ar FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    await db.run('DELETE FROM courses WHERE id = ?', [courseId]);
    await logActivity(req, 'DELETE_COURSE', 'Course', courseId, `Deleted course: ${course.title_ar}`);

    return res.json({
      success: true,
      message: 'Course deleted successfully.',
      message_ar: 'تم حذف الكورس بنجاح.'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete course.' });
  }
});

// 7. Manage Units inside Course (Create / Edit / Delete Units)
router.post('/:id/units', authenticate, requireAdmin, async (req, res) => {
  try {
    const courseId = parseInt(req.params.id, 10);
    const { title, title_ar, description, description_ar, order_index = 0 } = req.body;

    if (!title || !title_ar) {
      return res.status(400).json({ success: false, message: 'Unit titles are required.' });
    }

    const result = await db.run(`
      INSERT INTO units (course_id, title, title_ar, description, description_ar, order_index)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [courseId, title.trim(), title_ar.trim(), description || '', description_ar || '', order_index]);

    return res.status(201).json({
      success: true,
      message: 'Unit created successfully.',
      message_ar: 'تمت إضافة الوحدة بنجاح.',
      unitId: result.lastID
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create unit.' });
  }
});

router.put('/units/:unitId', authenticate, requireAdmin, async (req, res) => {
  try {
    const unitId = parseInt(req.params.unitId, 10);
    const { title, title_ar, description, description_ar, order_index } = req.body;

    await db.run(`
      UPDATE units
      SET title = COALESCE(?, title),
          title_ar = COALESCE(?, title_ar),
          description = COALESCE(?, description),
          description_ar = COALESCE(?, description_ar),
          order_index = COALESCE(?, order_index)
      WHERE id = ?
    `, [title, title_ar, description, description_ar, order_index, unitId]);

    return res.json({ success: true, message: 'Unit updated successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update unit.' });
  }
});

router.delete('/units/:unitId', authenticate, requireAdmin, async (req, res) => {
  try {
    const unitId = parseInt(req.params.unitId, 10);
    await db.run('DELETE FROM units WHERE id = ?', [unitId]);
    return res.json({ success: true, message: 'Unit deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete unit.' });
  }
});

module.exports = router;
