const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { requireSuperAdmin, requireAdmin } = require('../middleware/rbac');
const { logActivity } = require('../middleware/audit');

// ─────────────────────────────────────────────────────────────────────────────
// GET /medios — List all 13 Medios (public, for registration/code creation forms)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/medios', async (req, res) => {
  try {
    const medios = await db.all('SELECT * FROM medios ORDER BY order_index ASC');
    return res.json({ success: true, medios });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch Medios.' });
  }
});

// All other access-code endpoints require Super Admin
router.use(authenticate, requireSuperAdmin);

// ─────────────────────────────────────────────────────────────────────────────
// GET / — List all access codes with Medios info and enrolled student count
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const codes = await db.all(`
      SELECT ac.*,
             m.name        as medios_name,
             m.name_ar     as medios_name_ar,
             (SELECT COUNT(*) FROM users u WHERE u.access_code_id = ac.id) as actual_user_count
      FROM access_codes ac
      LEFT JOIN medios m ON m.id = ac.medios_id
      ORDER BY ac.created_at DESC
    `);

    // Attach linked courses for each code
    const codesWithCourses = await Promise.all(
      codes.map(async (code) => {
        const assignedCourses = await db.all(`
          SELECT c.id, c.title, c.title_ar, c.cover_image
          FROM courses c
          JOIN access_code_courses acc ON acc.course_id = c.id
          WHERE acc.access_code_id = ?
        `, [code.id]);
        return { ...code, assigned_courses: assignedCourses };
      })
    );

    return res.json({ success: true, access_codes: codesWithCourses });
  } catch (error) {
    console.error('Error fetching access codes:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch access codes.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST / — Create a new access code (linked to a Medios)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      code,
      title,
      medios_id = null,
      status = 'active',
      max_users = null,
      expires_at = null,
      course_ids = []
    } = req.body;

    if (!code || !title) {
      return res.status(400).json({
        success: false,
        message: 'Access code and title are required.',
        message_ar: 'كود الدخول والاسم التعريفي مطلوبان.'
      });
    }

    const cleanCode = code.trim().toUpperCase();

    // Check uniqueness
    const existing = await db.get('SELECT id FROM access_codes WHERE UPPER(code) = ?', [cleanCode]);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'This access code already exists. Please use a unique code.',
        message_ar: 'هذا الكود مستخدم بالفعل. يرجى اختيار كود فريد.'
      });
    }

    // Validate medios_id if provided
    if (medios_id) {
      const medios = await db.get('SELECT id FROM medios WHERE id = ?', [medios_id]);
      if (!medios) {
        return res.status(400).json({ success: false, message: 'Invalid Medios selected.', message_ar: 'الميديوس المحدد غير صحيح.' });
      }
    }

    const result = await db.run(
      `INSERT INTO access_codes (code, title, medios_id, status, max_users, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [cleanCode, title.trim(), medios_id || null, status, max_users ? parseInt(max_users, 10) : null, expires_at || null]
    );

    const codeId = result.lastID;

    // Link assigned courses
    if (Array.isArray(course_ids) && course_ids.length > 0) {
      for (const cId of course_ids) {
        await db.run('INSERT OR IGNORE INTO access_code_courses (access_code_id, course_id) VALUES (?, ?)', [codeId, cId]);
      }
    }

    await logActivity(req, 'CREATE_ACCESS_CODE', 'AccessCode', codeId,
      `Created access code ${cleanCode} linked to Medios ${medios_id || 'none'} with ${course_ids.length} courses.`);

    return res.status(201).json({
      success: true,
      message: 'Access code created successfully.',
      message_ar: 'تم إنشاء كود الدخول بنجاح.',
      codeId
    });
  } catch (error) {
    console.error('Error creating access code:', error);
    return res.status(500).json({ success: false, message: 'Failed to create access code.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /:id — Update access code
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const codeId = parseInt(req.params.id, 10);
    const { code, title, medios_id, status, max_users, expires_at, course_ids } = req.body;

    const existing = await db.get('SELECT * FROM access_codes WHERE id = ?', [codeId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Access code not found.' });
    }

    const cleanCode = code ? code.trim().toUpperCase() : existing.code;

    if (cleanCode !== existing.code) {
      const dup = await db.get('SELECT id FROM access_codes WHERE UPPER(code) = ? AND id != ?', [cleanCode, codeId]);
      if (dup) {
        return res.status(400).json({ success: false, message: 'This code is already taken.' });
      }
    }

    await db.run(`
      UPDATE access_codes
      SET code      = ?,
          title     = COALESCE(?, title),
          medios_id = ?,
          status    = COALESCE(?, status),
          max_users = ?,
          expires_at = ?
      WHERE id = ?
    `, [
      cleanCode,
      title ? title.trim() : null,
      medios_id !== undefined ? (medios_id || null) : existing.medios_id,
      status || null,
      max_users ? parseInt(max_users, 10) : null,
      expires_at || null,
      codeId
    ]);

    if (Array.isArray(course_ids)) {
      await db.run('DELETE FROM access_code_courses WHERE access_code_id = ?', [codeId]);
      for (const cId of course_ids) {
        await db.run('INSERT OR IGNORE INTO access_code_courses (access_code_id, course_id) VALUES (?, ?)', [codeId, cId]);
      }
    }

    await logActivity(req, 'UPDATE_ACCESS_CODE', 'AccessCode', codeId, `Updated access code ${cleanCode}.`);

    return res.json({ success: true, message: 'Access code updated.', message_ar: 'تم تحديث كود الدخول.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update access code.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /:id — Delete access code
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const codeId = parseInt(req.params.id, 10);
    const existing = await db.get('SELECT code FROM access_codes WHERE id = ?', [codeId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Access code not found.' });
    }

    await db.run('DELETE FROM access_codes WHERE id = ?', [codeId]);
    await logActivity(req, 'DELETE_ACCESS_CODE', 'AccessCode', codeId, `Deleted access code: ${existing.code}`);

    return res.json({ success: true, message: 'Access code deleted.', message_ar: 'تم حذف كود الدخول.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete access code.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /:id/students — Students enrolled via this code
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/students', async (req, res) => {
  try {
    const codeId = parseInt(req.params.id, 10);
    const students = await db.all(`
      SELECT u.id, u.name, u.phone, u.status, u.created_at, u.last_login
      FROM users u
      WHERE u.access_code_id = ?
      ORDER BY u.created_at DESC
    `, [codeId]);
    return res.json({ success: true, students });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch students.' });
  }
});

module.exports = router;
