const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');
const { checkCourseAccess } = require('../middleware/courseAccess');
const { logActivity } = require('../middleware/audit');
const config = require('../config/config');

// Helper to extract YouTube Video ID
function extractYouTubeId(url) {
  if (!url) return '';
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : url;
}

// 1. Get Single Lesson (with Course Access verification)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const lessonId = parseInt(req.params.id, 10);
    const lesson = await db.get(`
      SELECT l.*, c.title as course_title, c.title_ar as course_title_ar, c.status as course_status,
             u.title as unit_title, u.title_ar as unit_title_ar
      FROM lessons l
      JOIN courses c ON c.id = l.course_id
      JOIN units u ON u.id = l.unit_id
      WHERE l.id = ?
    `, [lessonId]);

    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found.', message_ar: 'الدرس غير موجود.' });
    }

    // Verify student course enrollment
    if (req.user.role === 'student') {
      const enrollment = await db.get(
        'SELECT id FROM user_course_enrollments WHERE user_id = ? AND course_id = ?',
        [req.user.id, lesson.course_id]
      );
      if (!enrollment) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this course lesson.',
          message_ar: 'غير مصرح لك بالوصول إلى هذا الدرس.'
        });
      }
    }

    // Fetch user progress for this lesson
    const progress = await db.get(
      'SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?',
      [req.user.id, lessonId]
    );

    // Fetch attached files / materials
    const files = await db.all(
      'SELECT id, name, description, file_path, file_type, file_size FROM lesson_files WHERE lesson_id = ?',
      [lessonId]
    );

    // Find Previous and Next Lesson in the same course
    const allLessons = await db.all(
      'SELECT id, title, title_ar, unit_id, order_index FROM lessons WHERE course_id = ? ORDER BY unit_id ASC, order_index ASC, id ASC',
      [lesson.course_id]
    );

    const currentIndex = allLessons.findIndex(l => l.id === lessonId);
    const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
    const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

    return res.json({
      success: true,
      lesson,
      progress: progress || {
        completed: 0,
        video_watched_seconds: 0,
        video_duration_seconds: 0,
        video_watched_percentage: 0.0
      },
      files,
      navigation: {
        prev: prevLesson,
        next: nextLesson,
        current_index: currentIndex + 1,
        total_lessons: allLessons.length
      }
    });
  } catch (error) {
    console.error('Error fetching lesson:', error);
    return res.status(500).json({ success: false, message: 'Failed to load lesson.' });
  }
});

// 2. Update Video Playback Progress & Auto-Completion
router.post('/:id/progress', authenticate, async (req, res) => {
  try {
    const lessonId = parseInt(req.params.id, 10);
    const { watched_seconds = 0, duration_seconds = 0, percentage = 0 } = req.body;

    const lesson = await db.get('SELECT id, course_id, required_watch_percentage FROM lessons WHERE id = ?', [lessonId]);
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found.' });
    }

    const cleanPercentage = Math.min(100, Math.max(0, parseFloat(percentage) || 0));
    const cleanWatchedSeconds = parseInt(watched_seconds, 10) || 0;
    const cleanDurationSeconds = parseInt(duration_seconds, 10) || 0;
    const threshold = lesson.required_watch_percentage || config.VIDEO_COMPLETION_THRESHOLD;

    // Check existing progress
    const existing = await db.get(
      'SELECT id, completed, video_watched_percentage FROM lesson_progress WHERE user_id = ? AND lesson_id = ?',
      [req.user.id, lessonId]
    );

    let isCompleted = existing ? existing.completed : 0;
    let maxPercentage = existing ? Math.max(existing.video_watched_percentage, cleanPercentage) : cleanPercentage;

    // Auto-mark completed only if playback reaches threshold
    if (!isCompleted && maxPercentage >= threshold) {
      isCompleted = 1;
    }

    if (existing) {
      await db.run(`
        UPDATE lesson_progress 
        SET video_watched_seconds = MAX(video_watched_seconds, ?),
            video_duration_seconds = COALESCE(NULLIF(?, 0), video_duration_seconds),
            video_watched_percentage = ?,
            completed = ?,
            completed_at = CASE WHEN ? = 1 AND completed_at IS NULL THEN CURRENT_TIMESTAMP ELSE completed_at END,
            last_accessed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [cleanWatchedSeconds, cleanDurationSeconds, maxPercentage, isCompleted, isCompleted, existing.id]);
    } else {
      await db.run(`
        INSERT INTO lesson_progress (user_id, lesson_id, course_id, completed, video_watched_seconds, video_duration_seconds, video_watched_percentage, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END)
      `, [req.user.id, lessonId, lesson.course_id, isCompleted, cleanWatchedSeconds, cleanDurationSeconds, maxPercentage, isCompleted]);
    }

    return res.json({
      success: true,
      completed: isCompleted === 1,
      percentage: maxPercentage
    });
  } catch (error) {
    console.error('Error updating progress:', error);
    return res.status(500).json({ success: false, message: 'Failed to update progress.' });
  }
});

// 3. Mark Lesson Completed (Manual toggle)
router.post('/:id/complete', authenticate, async (req, res) => {
  try {
    const lessonId = parseInt(req.params.id, 10);
    const { completed = true } = req.body;

    const lesson = await db.get('SELECT id, course_id FROM lessons WHERE id = ?', [lessonId]);
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found.' });
    }

    const isDone = completed ? 1 : 0;

    await db.run(`
      INSERT INTO lesson_progress (user_id, lesson_id, course_id, completed, completed_at, last_accessed_at)
      VALUES (?, ?, ?, ?, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, lesson_id) DO UPDATE SET
        completed = ?,
        completed_at = CASE WHEN ? = 1 THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE NULL END,
        last_accessed_at = CURRENT_TIMESTAMP
    `, [req.user.id, lessonId, lesson.course_id, isDone, isDone, isDone, isDone]);

    return res.json({
      success: true,
      completed: isDone === 1,
      message: isDone ? 'Lesson marked as completed.' : 'Lesson marked as incomplete.',
      message_ar: isDone ? 'تم تحديد الدرس كمكتمل.' : 'تم إلغاء اكتمال الدرس.'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update completion status.' });
  }
});

// 4. Create Lesson (Admin)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { unit_id, course_id, title, title_ar, content_text, coptic_content, youtube_url, duration_minutes = 15, required_watch_percentage = 90, order_index = 0 } = req.body;

    if (!title || !title_ar || !unit_id || !course_id) {
      return res.status(400).json({ success: false, message: 'Title, unit, and course are required.' });
    }

    const videoId = extractYouTubeId(youtube_url);

    const result = await db.run(`
      INSERT INTO lessons (unit_id, course_id, title, title_ar, content_text, coptic_content, youtube_url, youtube_video_id, duration_minutes, required_watch_percentage, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [unit_id, course_id, title.trim(), title_ar.trim(), content_text || '', coptic_content || '', youtube_url || '', videoId, duration_minutes, required_watch_percentage, order_index]);

    await logActivity(req, 'CREATE_LESSON', 'Lesson', result.lastID, `Created lesson: ${title_ar}`);

    return res.status(201).json({
      success: true,
      message: 'Lesson created successfully.',
      message_ar: 'تم إنشاء الدرس بنجاح.',
      lessonId: result.lastID
    });
  } catch (error) {
    console.error('Error creating lesson:', error);
    return res.status(500).json({ success: false, message: 'Failed to create lesson.' });
  }
});

// 5. Update Lesson (Admin)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const lessonId = parseInt(req.params.id, 10);
    const { unit_id, title, title_ar, content_text, coptic_content, youtube_url, duration_minutes, required_watch_percentage, order_index } = req.body;

    let videoId = undefined;
    if (youtube_url !== undefined) {
      videoId = extractYouTubeId(youtube_url);
    }

    await db.run(`
      UPDATE lessons
      SET unit_id = COALESCE(?, unit_id),
          title = COALESCE(?, title),
          title_ar = COALESCE(?, title_ar),
          content_text = COALESCE(?, content_text),
          coptic_content = COALESCE(?, coptic_content),
          youtube_url = COALESCE(?, youtube_url),
          youtube_video_id = COALESCE(?, youtube_video_id),
          duration_minutes = COALESCE(?, duration_minutes),
          required_watch_percentage = COALESCE(?, required_watch_percentage),
          order_index = COALESCE(?, order_index)
      WHERE id = ?
    `, [unit_id, title, title_ar, content_text, coptic_content, youtube_url, videoId, duration_minutes, required_watch_percentage, order_index, lessonId]);

    await logActivity(req, 'UPDATE_LESSON', 'Lesson', lessonId, `Updated lesson ${lessonId}`);

    return res.json({ success: true, message: 'Lesson updated successfully.', message_ar: 'تم تحديث الدرس بنجاح.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update lesson.' });
  }
});

// 6. Delete Lesson (Admin)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const lessonId = parseInt(req.params.id, 10);
    await db.run('DELETE FROM lessons WHERE id = ?', [lessonId]);
    await logActivity(req, 'DELETE_LESSON', 'Lesson', lessonId, `Deleted lesson ${lessonId}`);
    return res.json({ success: true, message: 'Lesson deleted successfully.', message_ar: 'تم حذف الدرس بنجاح.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete lesson.' });
  }
});

module.exports = router;
