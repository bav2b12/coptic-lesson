const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');
const upload = require('../middleware/upload');
const { logActivity } = require('../middleware/audit');

// 1. Get Single Assignment
router.get('/:id', authenticate, async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.id, 10);
    const assignment = await db.get(`
      SELECT a.*, c.title as course_title, c.title_ar as course_title_ar
      FROM assignments a
      JOIN courses c ON c.id = a.course_id
      WHERE a.id = ?
    `, [assignmentId]);

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }

    // Check student submission
    const submission = await db.get(
      'SELECT * FROM assignment_submissions WHERE assignment_id = ? AND user_id = ?',
      [assignmentId, req.user.id]
    );

    return res.json({
      success: true,
      assignment,
      submission: submission || null
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch assignment.' });
  }
});

// 2. Submit Assignment (Student)
router.post('/:id/submit', authenticate, upload.single('submission_file'), async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.id, 10);
    const { text_answer = '' } = req.body;

    const assignment = await db.get('SELECT * FROM assignments WHERE id = ?', [assignmentId]);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }

    let filePath = '';
    let fileName = '';

    if (req.file) {
      filePath = req.file.filename;
      fileName = req.file.originalname;
    }

    if (!text_answer.trim() && !filePath) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either a text response or attach a file.',
        message_ar: 'يرجى كتابة إجابة نصية أو إرفاق ملف للواجب.'
      });
    }

    const existing = await db.get(
      'SELECT id FROM assignment_submissions WHERE assignment_id = ? AND user_id = ?',
      [assignmentId, req.user.id]
    );

    if (existing) {
      await db.run(`
        UPDATE assignment_submissions
        SET text_answer = ?,
            file_path = COALESCE(NULLIF(?, ''), file_path),
            file_name = COALESCE(NULLIF(?, ''), file_name),
            status = 'submitted',
            submitted_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [text_answer.trim(), filePath, fileName, existing.id]);
    } else {
      await db.run(`
        INSERT INTO assignment_submissions (assignment_id, user_id, text_answer, file_path, file_name, status)
        VALUES (?, ?, ?, ?, ?, 'submitted')
      `, [assignmentId, req.user.id, text_answer.trim(), filePath, fileName]);
    }

    return res.json({
      success: true,
      message: 'Assignment submitted successfully!',
      message_ar: 'تم تسليم الواجب بنجاح!'
    });
  } catch (error) {
    console.error('Error submitting assignment:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit assignment.' });
  }
});

// 3. Create Assignment (Admin)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { course_id, unit_id, lesson_id, title, title_ar, description, description_ar, instructions, due_date, max_grade = 100, required_file_types = '.pdf,.doc,.docx,.jpg,.png' } = req.body;

    if (!course_id || !title || !title_ar) {
      return res.status(400).json({ success: false, message: 'Course ID and title are required.' });
    }

    const result = await db.run(`
      INSERT INTO assignments (course_id, unit_id, lesson_id, title, title_ar, description, description_ar, instructions, due_date, max_grade, required_file_types)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [course_id, unit_id || null, lesson_id || null, title.trim(), title_ar.trim(), description || '', description_ar || '', instructions || '', due_date || null, max_grade, required_file_types]);

    await logActivity(req, 'CREATE_ASSIGNMENT', 'Assignment', result.lastID, `Created assignment: ${title_ar}`);

    return res.status(201).json({
      success: true,
      message: 'Assignment created successfully.',
      message_ar: 'تم إنشاء الواجب بنجاح.',
      assignmentId: result.lastID
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create assignment.' });
  }
});

// 4. Update Assignment (Admin)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.id, 10);
    const { title, title_ar, description, description_ar, instructions, due_date, max_grade, required_file_types } = req.body;

    await db.run(`
      UPDATE assignments
      SET title = COALESCE(?, title),
          title_ar = COALESCE(?, title_ar),
          description = COALESCE(?, description),
          description_ar = COALESCE(?, description_ar),
          instructions = COALESCE(?, instructions),
          due_date = COALESCE(?, due_date),
          max_grade = COALESCE(?, max_grade),
          required_file_types = COALESCE(?, required_file_types)
      WHERE id = ?
    `, [title, title_ar, description, description_ar, instructions, due_date, max_grade, required_file_types, assignmentId]);

    await logActivity(req, 'UPDATE_ASSIGNMENT', 'Assignment', assignmentId, `Updated assignment ${assignmentId}`);

    return res.json({ success: true, message: 'Assignment updated successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update assignment.' });
  }
});

// 5. Delete Assignment (Admin)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.id, 10);
    await db.run('DELETE FROM assignments WHERE id = ?', [assignmentId]);
    await logActivity(req, 'DELETE_ASSIGNMENT', 'Assignment', assignmentId, `Deleted assignment ${assignmentId}`);
    return res.json({ success: true, message: 'Assignment deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete assignment.' });
  }
});

// 6. View Submissions for an Assignment (Admin)
router.get('/:id/submissions', authenticate, requireAdmin, async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.id, 10);
    const submissions = await db.all(`
      SELECT asub.*, u.name as student_name, u.phone as student_phone, u.avatar_url,
             a.max_grade, a.title_ar as assignment_title_ar
      FROM assignment_submissions asub
      JOIN users u ON u.id = asub.user_id
      JOIN assignments a ON a.id = asub.assignment_id
      WHERE asub.assignment_id = ?
      ORDER BY asub.submitted_at DESC
    `, [assignmentId]);

    return res.json({ success: true, submissions });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch submissions.' });
  }
});

// 7. Grade Submission (Admin)
router.post('/submissions/:submissionId/grade', authenticate, requireAdmin, async (req, res) => {
  try {
    const submissionId = parseInt(req.params.submissionId, 10);
    const { grade, feedback, status = 'accepted' } = req.body;

    const submission = await db.get(`
      SELECT s.*, a.max_grade, a.title_ar as assignment_title, u.id as student_id
      FROM assignment_submissions s
      JOIN assignments a ON a.id = s.assignment_id
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ?
    `, [submissionId]);

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found.' });
    }

    const cleanGrade = parseInt(grade, 10);
    if (isNaN(cleanGrade) || cleanGrade < 0 || cleanGrade > submission.max_grade) {
      return res.status(400).json({
        success: false,
        message: `Grade must be a number between 0 and ${submission.max_grade}.`,
        message_ar: `يجب أن تكون الدرجة بين 0 و ${submission.max_grade}.`
      });
    }

    await db.run(`
      UPDATE assignment_submissions
      SET grade = ?, feedback = ?, status = ?, graded_at = CURRENT_TIMESTAMP, graded_by = ?
      WHERE id = ?
    `, [cleanGrade, feedback || '', status, req.user.id, submissionId]);

    // Send notification to student
    await db.run(`
      INSERT INTO notifications (user_id, title, title_ar, message, message_ar, type, link_url)
      VALUES (?, ?, ?, ?, ?, 'grade', ?)
    `, [
      submission.student_id,
      `Assignment Graded: ${submission.assignment_title}`,
      `تم تصحيح واجبك: ${submission.assignment_title}`,
      `Your grade: ${cleanGrade}/${submission.max_grade}. Feedback: ${feedback || 'Good effort!'}`,
      `درجتك: ${cleanGrade} من ${submission.max_grade}. ملاحظات المعلم: ${feedback || 'عمل ممتاز!'}`,
      `#assignment/${submission.assignment_id}`
    ]);

    await logActivity(req, 'GRADE_ASSIGNMENT', 'AssignmentSubmission', submissionId, `Graded submission for ${submission.student_id}: ${cleanGrade}/${submission.max_grade}`);

    return res.json({
      success: true,
      message: 'Submission graded successfully.',
      message_ar: 'تم تصحيح الواجب ورصد الدرجة بنجاح.'
    });
  } catch (error) {
    console.error('Error grading assignment:', error);
    return res.status(500).json({ success: false, message: 'Failed to grade submission.' });
  }
});

module.exports = router;
