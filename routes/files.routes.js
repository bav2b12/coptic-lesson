const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');
const upload = require('../middleware/upload');
const { logActivity } = require('../middleware/audit');
const config = require('../config/config');

// 1. Upload Material File (Admin)
router.post('/upload', authenticate, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { course_id, unit_id, lesson_id, name, description = '' } = req.body;

    if (!course_id) {
      return res.status(400).json({ success: false, message: 'Course ID is required.' });
    }

    const displayName = name ? name.trim() : req.file.originalname;

    const result = await db.run(`
      INSERT INTO lesson_files (course_id, unit_id, lesson_id, name, description, file_path, file_type, file_size, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      parseInt(course_id, 10),
      unit_id ? parseInt(unit_id, 10) : null,
      lesson_id ? parseInt(lesson_id, 10) : null,
      displayName,
      description,
      req.file.filename,
      req.file.mimetype,
      req.file.size,
      req.user.id
    ]);

    await logActivity(req, 'UPLOAD_FILE', 'LessonFile', result.lastID, `Uploaded file: ${displayName}`);

    return res.status(201).json({
      success: true,
      message: 'File uploaded successfully.',
      message_ar: 'تم رفع الملف بنجاح.',
      file: {
        id: result.lastID,
        name: displayName,
        file_path: req.file.filename,
        file_size: req.file.size,
        file_type: req.file.mimetype
      }
    });
  } catch (error) {
    console.error('File upload error:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload file.' });
  }
});

// 2. Delete Material File (Admin)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const fileId = parseInt(req.params.id, 10);
    const fileRecord = await db.get('SELECT * FROM lesson_files WHERE id = ?', [fileId]);
    if (!fileRecord) {
      return res.status(404).json({ success: false, message: 'File not found.' });
    }

    // Try deleting from disk
    const diskPath = path.join(config.UPLOAD_DIR, 'materials', fileRecord.file_path);
    if (fs.existsSync(diskPath)) {
      try { fs.unlinkSync(diskPath); } catch (e) {}
    }

    await db.run('DELETE FROM lesson_files WHERE id = ?', [fileId]);
    await logActivity(req, 'DELETE_FILE', 'LessonFile', fileId, `Deleted file: ${fileRecord.name}`);

    return res.json({ success: true, message: 'File deleted successfully.', message_ar: 'تم حذف الملف بنجاح.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete file.' });
  }
});

module.exports = router;
