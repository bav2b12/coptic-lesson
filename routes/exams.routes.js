const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');
const { checkCourseManagementPermission } = require('../middleware/courseAccess');
const upload = require('../middleware/upload');
const { logActivity } = require('../middleware/audit');

async function requireExamCourseAccess(req, res, next) {
  const examId = parseInt(req.params.id, 10);
  const exam = await db.get('SELECT course_id FROM exams WHERE id = ?', [examId]);
  if (!exam) return res.status(404).json({ success: false, message: 'Exam not found.' });
  req.body.course_id = exam.course_id;
  return checkCourseManagementPermission(req, res, next);
}

// 1. Get Exam Details & Questions
router.get('/:id', authenticate, async (req, res) => {
  try {
    const examId = parseInt(req.params.id, 10);
    const exam = await db.get(`
      SELECT e.*, c.title as course_title, c.title_ar as course_title_ar
      FROM exams e
      JOIN courses c ON c.id = e.course_id
      WHERE e.id = ?
    `, [examId]);

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.', message_ar: 'الامتحان غير موجود.' });
    }

    if (req.user.role === 'course_admin') {
      const assignment = await db.get('SELECT id FROM course_admins WHERE user_id = ? AND course_id = ?', [req.user.id, exam.course_id]);
      if (!assignment) return res.status(403).json({ success: false, message: 'You are not authorized to view this exam.' });
    }

    // Verify student course enrollment
    if (req.user.role === 'student') {
      const enrollment = await db.get(
        'SELECT id FROM user_course_enrollments WHERE user_id = ? AND course_id = ?',
        [req.user.id, exam.course_id]
      );
      if (!enrollment) {
        return res.status(403).json({
          success: false,
          message: 'You are not enrolled in the course for this exam.',
          message_ar: 'أنت غير مسجل في كورس هذا الامتحان.'
        });
      }
    }

    // Fetch questions
    if (req.user.role === 'student' && !exam.is_published) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    const rawQuestions = await db.all(
      'SELECT id, exam_id, question_text, question_coptic, question_image_url as image_url, options_json, points, order_index, correct_option_id FROM exam_questions WHERE exam_id = ? ORDER BY order_index ASC, id ASC',
      [examId]
    );

    // Format questions (Sanitize correct_option_id for students)
    const questions = rawQuestions.map(q => {
      let parsedOptions = [];
      try {
        parsedOptions = JSON.parse(q.options_json);
      } catch (e) {
        parsedOptions = [];
      }

      const qObj = {
        id: q.id,
        exam_id: q.exam_id,
        question_text: q.question_text,
        question_coptic: q.question_coptic,
        image_url: q.image_url,
        options: parsedOptions,
        points: q.points,
        order_index: q.order_index
      };

      if (req.user.role === 'super_admin' || req.user.role === 'course_admin') {
        qObj.correct_option_id = q.correct_option_id;
      }

      return qObj;
    });

    // Check student previous attempts
    const attempts = await db.all(
      'SELECT id, attempt_number, score, total_points, percentage, passed, started_at, submitted_at FROM exam_attempts WHERE exam_id = ? AND user_id = ? ORDER BY attempt_number DESC',
      [examId, req.user.id]
    );

    return res.json({
      success: true,
      exam,
      questions,
      attempts,
      attempts_remaining: Math.max(0, exam.max_attempts - attempts.length)
    });
  } catch (error) {
    console.error('Error fetching exam:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch exam.' });
  }
});

// 2. Start Exam Attempt
router.post('/:id/start', authenticate, async (req, res) => {
  try {
    const examId = parseInt(req.params.id, 10);
    const exam = await db.get('SELECT * FROM exams WHERE id = ?', [examId]);
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    if (req.user.role === 'student') {
      const enrollment = await db.get('SELECT id FROM user_course_enrollments WHERE user_id = ? AND course_id = ?', [req.user.id, exam.course_id]);
      if (!enrollment || !exam.is_published) return res.status(403).json({ success: false, message: 'This exam is not available.' });
    }
    const previousAttempts = await db.all(
      'SELECT id FROM exam_attempts WHERE exam_id = ? AND user_id = ?',
      [examId, req.user.id]
    );

    if (previousAttempts.length >= exam.max_attempts) {
      return res.status(400).json({
        success: false,
        message: `You have reached the maximum number of attempts (${exam.max_attempts}).`,
        message_ar: `لقد استنفدت الحد الأقصى للمحاولات (${exam.max_attempts}).`
      });
    }

    const attemptNumber = previousAttempts.length + 1;
    const result = await db.run(`
      INSERT INTO exam_attempts (exam_id, user_id, attempt_number, started_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `, [examId, req.user.id, attemptNumber]);

    return res.json({
      success: true,
      attemptId: result.lastID,
      attemptNumber,
      timeLimitMinutes: exam.time_limit_minutes,
      startedAt: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to start exam attempt.' });
  }
});

// 3. Submit Exam Answers & Auto-Grade
router.post('/:id/submit', authenticate, async (req, res) => {
  try {
    const examId = parseInt(req.params.id, 10);
    const { attempt_id, answers = {} } = req.body; // answers: { "q_1": "A", "q_2": "C" }

    const exam = await db.get('SELECT * FROM exams WHERE id = ?', [examId]);
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    if (req.user.role === 'student') {
      const enrollment = await db.get('SELECT id FROM user_course_enrollments WHERE user_id = ? AND course_id = ?', [req.user.id, exam.course_id]);
      if (!enrollment || !exam.is_published) return res.status(403).json({ success: false, message: 'This exam is not available.' });
    }
    const questions = await db.all(
      'SELECT id, question_text, question_coptic, options_json, correct_option_id, points FROM exam_questions WHERE exam_id = ?',
      [examId]
    );

    let totalPoints = 0;
    let earnedPoints = 0;
    const questionResults = [];

    for (const q of questions) {
      const qPoints = q.points || 1;
      totalPoints += qPoints;

      const studentSelected = answers[q.id] || answers[String(q.id)];
      const isCorrect = studentSelected && studentSelected.toUpperCase() === q.correct_option_id.toUpperCase();

      if (isCorrect) {
        earnedPoints += qPoints;
      }

      let parsedOptions = [];
      try { parsedOptions = JSON.parse(q.options_json); } catch (e) {}

      questionResults.push({
        question_id: q.id,
        question_text: q.question_text,
        question_coptic: q.question_coptic,
        options: parsedOptions,
        student_selected: studentSelected || null,
        correct_option_id: q.correct_option_id,
        is_correct: !!isCorrect,
        points: qPoints
      });
    }

    const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100 * 10) / 10 : 0;
    const passed = percentage >= exam.passing_score_percentage ? 1 : 0;

    // Update or insert attempt
    if (attempt_id) {
      await db.run(`
        UPDATE exam_attempts
        SET score = ?, total_points = ?, percentage = ?, passed = ?, answers_json = ?, submitted_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `, [earnedPoints, totalPoints, percentage, passed, JSON.stringify(answers), attempt_id, req.user.id]);
    } else {
      await db.run(`
        INSERT INTO exam_attempts (exam_id, user_id, attempt_number, score, total_points, percentage, passed, answers_json, submitted_at)
        VALUES (?, ?, 1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [examId, req.user.id, earnedPoints, totalPoints, percentage, passed, JSON.stringify(answers)]);
    }

    // Add notification to student
    await db.run(`
      INSERT INTO notifications (user_id, title, title_ar, message, message_ar, type, link_url)
      VALUES (?, ?, ?, ?, ?, 'exam', ?)
    `, [
      req.user.id,
      `Exam Completed: ${exam.title}`,
      `نتيجة الاختبار: ${exam.title_ar}`,
      `You scored ${earnedPoints}/${totalPoints} (${percentage}%). ${passed ? 'Congratulations, you passed!' : 'Keep practicing!'}`,
      `حصلت على ${earnedPoints} من ${totalPoints} بنسبة ${percentage}%. ${passed ? 'تهانينا، لقد اجتزت الاختبار بنجاح!' : 'حظاً أوفر في المحاولة القادمة!'}`,
      `#exam/${examId}`
    ]);

    return res.json({
      success: true,
      result: {
        score: earnedPoints,
        total_points: totalPoints,
        percentage,
        passed: passed === 1,
        passing_score: exam.passing_score_percentage,
        questions: questionResults
      }
    });
  } catch (error) {
    console.error('Error grading exam:', error);
    return res.status(500).json({ success: false, message: 'Failed to evaluate exam.' });
  }
});

// 4. Create Exam with Questions (Admin)
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  if (req.user.role === 'course_admin') return checkCourseManagementPermission(req, res, () => createExam(req, res));
  return createExam(req, res);
});

async function createExam(req, res) {
  try {
    const { course_id, unit_id, lesson_id, title, title_ar, description, description_ar, instructions, time_limit_minutes = 20, passing_score_percentage = 70, max_attempts = 3, is_published = 0, questions = [] } = req.body;

    if (!course_id || !title || !title_ar) {
      return res.status(400).json({ success: false, message: 'Course ID and title are required.' });
    }

    const examResult = await db.run(`
      INSERT INTO exams (course_id, unit_id, lesson_id, title, title_ar, description, description_ar, instructions, time_limit_minutes, passing_score_percentage, max_attempts, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [course_id, unit_id || null, lesson_id || null, title.trim(), title_ar.trim(), description || '', description_ar || '', instructions || '', time_limit_minutes, passing_score_percentage, max_attempts, is_published ? 1 : 0]);

    const examId = examResult.lastID;

    // Insert Questions
    if (Array.isArray(questions)) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await db.run(`
          INSERT INTO exam_questions (exam_id, question_text, question_coptic, question_image_url, options_json, correct_option_id, points, order_index)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [examId, q.question_text || '', q.question_coptic || '', q.image_url || '', JSON.stringify(q.options || []), q.correct_option_id || 'A', q.points || 1, i + 1]);
      }
    }

    await logActivity(req, 'CREATE_EXAM', 'Exam', examId, `Created exam: ${title_ar} with ${questions.length} questions`);

    return res.status(201).json({
      success: true,
      message: 'Exam created successfully.',
      message_ar: 'تم إنشاء الامتحان بنجاح.',
      examId
    });
  } catch (error) {
    console.error('Error creating exam:', error);
    return res.status(500).json({ success: false, message: 'Failed to create exam.' });
  }
}

// 5. Update Exam (Admin)
router.put('/:id', authenticate, requireAdmin, requireExamCourseAccess, async (req, res) => {
  try {
    const examId = parseInt(req.params.id, 10);
    const { title, title_ar, description, description_ar, instructions, time_limit_minutes, passing_score_percentage, max_attempts, is_published, questions } = req.body;

    await db.run(`
      UPDATE exams
      SET title = COALESCE(?, title),
          title_ar = COALESCE(?, title_ar),
          description = COALESCE(?, description),
          description_ar = COALESCE(?, description_ar),
          instructions = COALESCE(?, instructions),
          time_limit_minutes = COALESCE(?, time_limit_minutes),
          passing_score_percentage = COALESCE(?, passing_score_percentage),
          max_attempts = COALESCE(?, max_attempts),
          is_published = COALESCE(?, is_published)
      WHERE id = ?
    `, [title, title_ar, description, description_ar, instructions, time_limit_minutes, passing_score_percentage, max_attempts, is_published, examId]);

    // If questions list is updated
    if (Array.isArray(questions)) {
      await db.run('DELETE FROM exam_questions WHERE exam_id = ?', [examId]);
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await db.run(`
          INSERT INTO exam_questions (exam_id, question_text, question_coptic, question_image_url, options_json, correct_option_id, points, order_index)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [examId, q.question_text || '', q.question_coptic || '', q.image_url || '', JSON.stringify(q.options || []), q.correct_option_id || 'A', q.points || 1, i + 1]);
      }
    }

    await logActivity(req, 'UPDATE_EXAM', 'Exam', examId, `Updated exam ${examId}`);

    return res.json({ success: true, message: 'Exam updated successfully.', message_ar: 'تم تحديث الامتحان بنجاح.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update exam.' });
  }
});

// 6. Delete Exam (Admin)
router.delete('/:id', authenticate, requireAdmin, requireExamCourseAccess, async (req, res) => {
  try {
    const examId = parseInt(req.params.id, 10);
    await db.run('DELETE FROM exams WHERE id = ?', [examId]);
    await logActivity(req, 'DELETE_EXAM', 'Exam', examId, `Deleted exam ${examId}`);
    return res.json({ success: true, message: 'Exam deleted successfully.', message_ar: 'تم حذف الامتحان بنجاح.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete exam.' });
  }
});

// 7. Get All Student Attempts for an Exam (Admin)
router.get('/:id/attempts', authenticate, requireAdmin, requireExamCourseAccess, async (req, res) => {
  try {
    const examId = parseInt(req.params.id, 10);
    const attempts = await db.all(`
      SELECT ea.*, u.name as student_name, u.phone as student_phone
      FROM exam_attempts ea
      JOIN users u ON u.id = ea.user_id
      WHERE ea.exam_id = ?
      ORDER BY ea.submitted_at DESC
    `, [examId]);

    return res.json({ success: true, attempts });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch exam attempts.' });
  }
});

router.post('/:id/images', authenticate, requireAdmin, requireExamCourseAccess, upload.fields([
  { name: 'question_image', maxCount: 1 },
  { name: 'answer_image_A', maxCount: 1 }, { name: 'answer_image_B', maxCount: 1 },
  { name: 'answer_image_C', maxCount: 1 }, { name: 'answer_image_D', maxCount: 1 }
]), async (req, res) => {
  const files = req.files || {};
  const imageUrl = file => file ? `/uploads/exam-images/${file.filename}` : null;
  const questionImage = imageUrl(files.question_image && files.question_image[0]);
  const answers = ['A', 'B', 'C', 'D'].reduce((result, letter) => { result[letter] = imageUrl(files[`answer_image_${letter}`] && files[`answer_image_${letter}`][0]); return result; }, {});
  if (req.body.question_id) {
    const question = await db.get('SELECT options_json FROM exam_questions WHERE id = ? AND exam_id = ?', [req.body.question_id, req.params.id]);
    if (!question) return res.status(404).json({ success: false, message: 'Question not found.' });
    const options = JSON.parse(question.options_json || '[]').map(option => ({ ...option, image_url: answers[option.id] || option.image_url || '' }));
    await db.run('UPDATE exam_questions SET question_image_url = COALESCE(?, question_image_url), options_json = ? WHERE id = ?', [questionImage, JSON.stringify(options), req.body.question_id]);
  }
  return res.json({ success: true, question_image: questionImage, answers });
});

module.exports = router;
