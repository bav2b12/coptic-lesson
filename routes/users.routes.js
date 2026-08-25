const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');
const { logActivity } = require('../middleware/audit');

// All endpoints in this file require Administrator privileges (Super Admin or Course Admin)
router.use(authenticate, requireAdmin);

// 1. List Users with Search, Filter & Pagination
router.get('/', async (req, res) => {
  try {
    const { search, role, status, course_id, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const isSuperAdmin = req.user.role === 'super_admin';

    let whereClauses = ['1=1'];
    let params = [];

    // Course Admin can only see students enrolled in their managed courses
    if (!isSuperAdmin) {
      whereClauses.push(`u.role = 'student' AND u.id IN (
        SELECT uce.user_id FROM user_course_enrollments uce
        JOIN course_admins ca ON ca.course_id = uce.course_id
        WHERE ca.user_id = ?
      )`);
      params.push(req.user.id);
    }

    if (search && search.trim()) {
      whereClauses.push('(u.name LIKE ? OR u.phone LIKE ? OR ac.code LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (role && role !== 'all') {
      whereClauses.push('u.role = ?');
      params.push(role);
    }

    if (status && status !== 'all') {
      whereClauses.push('u.status = ?');
      params.push(status);
    }

    if (course_id && course_id !== 'all') {
      const cId = parseInt(course_id, 10);
      whereClauses.push(`(
        u.id IN (SELECT uce.user_id FROM user_course_enrollments uce WHERE uce.course_id = ?)
        OR u.id IN (SELECT ca.user_id FROM course_admins ca WHERE ca.course_id = ?)
      )`);
      params.push(cId, cId);
    }

    const whereSql = whereClauses.join(' AND ');

    const countResult = await db.get(`
      SELECT COUNT(DISTINCT u.id) as total
      FROM users u
      LEFT JOIN access_codes ac ON u.access_code_id = ac.id
      WHERE ${whereSql}
    `, params);

    const users = await db.all(`
      SELECT 
        u.id, u.name, u.phone, u.role, u.status, u.created_at, u.last_login,
        ac.id as access_code_id, ac.code as access_code, ac.title as access_code_title,
        (SELECT COUNT(*) FROM user_course_enrollments e WHERE e.user_id = u.id) as enrolled_courses_count,
        (SELECT COUNT(*) FROM lesson_progress lp WHERE lp.user_id = u.id AND lp.completed = 1) as completed_lessons_count
      FROM users u
      LEFT JOIN access_codes ac ON u.access_code_id = ac.id
      WHERE ${whereSql}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit, 10), offset]);

    // Attach assigned courses list for each user
    const enrichedUsers = await Promise.all(
      users.map(async (u) => {
        let assignedCourses = [];
        if (u.role === 'student') {
          assignedCourses = await db.all(`
            SELECT c.id, c.title, c.title_ar, c.level
            FROM courses c
            JOIN user_course_enrollments e ON e.course_id = c.id
            WHERE e.user_id = ?
            ORDER BY c.order_index ASC
          `, [u.id]);
        } else if (u.role === 'course_admin') {
          assignedCourses = await db.all(`
            SELECT c.id, c.title, c.title_ar, c.level
            FROM courses c
            JOIN course_admins ca ON ca.course_id = c.id
            WHERE ca.user_id = ?
            ORDER BY c.order_index ASC
          `, [u.id]);
        }
        return {
          ...u,
          assigned_courses: assignedCourses
        };
      })
    );

    return res.json({
      success: true,
      users: enrichedUsers,
      pagination: {
        total: countResult.total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(countResult.total / parseInt(limit, 10))
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch users list.' });
  }
});

// 2. Get Single User Comprehensive Profile & Progress
router.get('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const isSuperAdmin = req.user.role === 'super_admin';

    const user = await db.get(`
      SELECT u.id, u.name, u.phone, u.role, u.status, u.avatar_url, u.created_at, u.last_login,
             ac.id as access_code_id, ac.code as access_code, ac.title as access_code_title
      FROM users u
      LEFT JOIN access_codes ac ON u.access_code_id = ac.id
      WHERE u.id = ?
    `, [userId]);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.', message_ar: 'المستخدم غير موجود.' });
    }

    // Permission check for Course Admin
    if (!isSuperAdmin) {
      if (user.role !== 'student') {
        return res.status(403).json({ success: false, message: 'Unauthorized to view this user.' });
      }
      const canAccess = await db.get(`
        SELECT 1 FROM user_course_enrollments uce
        JOIN course_admins ca ON ca.course_id = uce.course_id
        WHERE ca.user_id = ? AND uce.user_id = ?
      `, [req.user.id, userId]);
      if (!canAccess) {
        return res.status(403).json({ success: false, message: 'Unauthorized to view student from other courses.' });
      }
    }

    // Courses Enrolled
    const courses = await db.all(`
      SELECT c.id, c.title, c.title_ar, c.level, c.cover_image, e.enrolled_at,
             (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) as total_lessons,
             (SELECT COUNT(*) FROM lesson_progress lp WHERE lp.user_id = ? AND lp.course_id = c.id AND lp.completed = 1) as completed_lessons,
             (SELECT AVG(lp.video_watched_percentage) FROM lesson_progress lp WHERE lp.user_id = ? AND lp.course_id = c.id) as avg_video_percentage
      FROM courses c
      JOIN user_course_enrollments e ON e.course_id = c.id
      WHERE e.user_id = ?
    `, [userId, userId, userId]);

    // Exam Attempts
    const examAttempts = await db.all(`
      SELECT ea.id, ea.exam_id, ea.score, ea.total_points, ea.percentage, ea.passed, ea.submitted_at, ea.attempt_number,
             e.title as exam_title, e.title_ar as exam_title_ar, c.title_ar as course_title_ar
      FROM exam_attempts ea
      JOIN exams e ON e.id = ea.exam_id
      JOIN courses c ON c.id = e.course_id
      WHERE ea.user_id = ?
      ORDER BY ea.submitted_at DESC
    `, [userId]);

    // Assignment Submissions
    const assignments = await db.all(`
      SELECT sub.id, sub.assignment_id, sub.grade, sub.status, sub.feedback, sub.submitted_at, sub.file_name,
             a.title as assignment_title, a.title_ar as assignment_title_ar, a.max_grade, c.title_ar as course_title_ar
      FROM assignment_submissions sub
      JOIN assignments a ON a.id = sub.assignment_id
      JOIN courses c ON c.id = a.course_id
      WHERE sub.user_id = ?
      ORDER BY sub.submitted_at DESC
    `, [userId]);

    // Assigned courses for course admins
    let assignedAdminCourses = [];
    if (user.role === 'course_admin') {
      assignedAdminCourses = await db.all(`
        SELECT c.id, c.title, c.title_ar, c.level
        FROM courses c
        JOIN course_admins ca ON ca.course_id = c.id
        WHERE ca.user_id = ?
      `, [userId]);
    }

    return res.json({
      success: true,
      user,
      courses,
      examAttempts,
      assignments,
      assignedAdminCourses
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ success: false, message: 'Failed to load user profile.' });
  }
});

// 3. Create User Manually (Super Admin / Course Admin)
router.post('/', async (req, res) => {
  try {
    const { name, phone, password, role = 'student', access_code_id, course_ids = [] } = req.body;
    const isSuperAdmin = req.user.role === 'super_admin';

    // Course admin can only create students for courses they manage
    if (!isSuperAdmin && role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Course Administrators can only create Student accounts.',
        message_ar: 'مشرف الكورس مصرح له فقط بإضافة حسابات الطلاب.'
      });
    }

    if (!name || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, phone, and password are required.',
        message_ar: 'الاسم ورقم الهاتف وكلمة المرور مطلوبة.'
      });
    }

    const cleanPhone = phone.trim();
    const existing = await db.get('SELECT id FROM users WHERE phone = ?', [cleanPhone]);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A user with this phone number already exists.',
        message_ar: 'يوجد مستخدم مسجل بهذا الرقم بالفعل.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    let parsedCodeId = access_code_id ? parseInt(access_code_id, 10) : null;
    let codeRecord = null;

    if (parsedCodeId) {
      codeRecord = await db.get('SELECT * FROM access_codes WHERE id = ?', [parsedCodeId]);
      if (!codeRecord) {
        return res.status(400).json({
          success: false,
          message: 'Selected access code not found.',
          message_ar: 'كود الدخول المختار غير موجود.'
        });
      }
      if (codeRecord.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Selected access code is inactive.',
          message_ar: 'كود الدخول المختار غير نشط.'
        });
      }
      if (codeRecord.expires_at && new Date(codeRecord.expires_at) < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Selected access code has expired.',
          message_ar: 'كود الدخول المختار منتهي الصلاحية.'
        });
      }
    }

    const result = await db.run(`
      INSERT INTO users (name, phone, password_hash, role, access_code_id, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `, [name.trim(), cleanPhone, passwordHash, role, parsedCodeId]);

    const newUserId = result.lastID;

    // If Course Admin, assign specified courses
    if (role === 'course_admin' && Array.isArray(course_ids)) {
      for (const cId of course_ids) {
        await db.run('INSERT OR IGNORE INTO course_admins (user_id, course_id) VALUES (?, ?)', [newUserId, cId]);
      }
    }

    // If student has access code, enroll in all associated courses
    if (role === 'student') {
      if (parsedCodeId) {
        const assignedCourses = await db.all('SELECT course_id FROM access_code_courses WHERE access_code_id = ?', [parsedCodeId]);
        for (const row of assignedCourses) {
          await db.run('INSERT OR IGNORE INTO user_course_enrollments (user_id, course_id, granted_by_code) VALUES (?, ?, ?)', [newUserId, row.course_id, parsedCodeId]);
        }
        await db.run('UPDATE access_codes SET current_users = current_users + 1 WHERE id = ?', [parsedCodeId]);
      }
      if (Array.isArray(course_ids)) {
        for (const cId of course_ids) {
          await db.run('INSERT OR IGNORE INTO user_course_enrollments (user_id, course_id, granted_by_code) VALUES (?, ?, ?)', [newUserId, cId, parsedCodeId]);
        }
      }
    }

    await logActivity(req, 'CREATE_USER', 'User', newUserId, `Created ${role} user: ${name} (${cleanPhone})`);

    return res.status(201).json({
      success: true,
      message: 'User created successfully.',
      message_ar: 'تم إنشاء الحساب بنجاح.',
      user: {
        id: newUserId,
        name: name.trim(),
        phone: cleanPhone,
        role,
        access_code: codeRecord ? codeRecord.code : null
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({ success: false, message: 'Failed to create user.' });
  }
});

// 4. Update User (Name, Phone, Role, Status, Access Code with Dynamic Recalculation)
router.put('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { name, phone, role, status, access_code_id, course_ids } = req.body;
    const isSuperAdmin = req.user.role === 'super_admin';

    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.', message_ar: 'المستخدم غير موجود.' });
    }

    // Permission enforcement: Course admin cannot modify Super Admin or other Course Admins
    if (!isSuperAdmin) {
      if (user.role !== 'student') {
        return res.status(403).json({ success: false, message: 'Unauthorized to modify administrative accounts.' });
      }
    }

    // Prevent Super Admin from demoting or disabling own account
    if (user.id === req.user.id) {
      if (role && role !== 'super_admin') {
        return res.status(400).json({ success: false, message: 'You cannot demote your own Super Admin account.', message_ar: 'لا يمكنك تغيير دور حسابك كمدير عام.' });
      }
      if (status && status === 'disabled') {
        return res.status(400).json({ success: false, message: 'You cannot disable your own account.', message_ar: 'لا يمكنك تعطيل حسابك الخاص.' });
      }
    }

    const updatedRole = role || user.role;
    const updatedStatus = status || user.status;
    let newCodeId = access_code_id !== undefined ? (access_code_id ? parseInt(access_code_id, 10) : null) : user.access_code_id;

    await db.run(`
      UPDATE users 
      SET name = COALESCE(?, name),
          phone = COALESCE(?, phone),
          role = ?,
          status = ?,
          access_code_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name ? name.trim() : null, phone ? phone.trim() : null, updatedRole, updatedStatus, newCodeId, userId]);

    // Dynamic Course Access Recalculation when access_code_id changes for a student
    if (updatedRole === 'student') {
      if (access_code_id !== undefined && newCodeId !== user.access_code_id) {
        // Remove previous code-granted enrollments
        await db.run('DELETE FROM user_course_enrollments WHERE user_id = ?', [userId]);

        // If new access code is provided, enroll in all associated courses
        if (newCodeId) {
          const assignedCourses = await db.all('SELECT course_id FROM access_code_courses WHERE access_code_id = ?', [newCodeId]);
          for (const row of assignedCourses) {
            await db.run('INSERT OR IGNORE INTO user_course_enrollments (user_id, course_id, granted_by_code) VALUES (?, ?, ?)', [userId, row.course_id, newCodeId]);
          }
        }
      } else if (Array.isArray(course_ids)) {
        await db.run('DELETE FROM user_course_enrollments WHERE user_id = ?', [userId]);
        for (const cId of course_ids) {
          await db.run('INSERT OR IGNORE INTO user_course_enrollments (user_id, course_id, granted_by_code) VALUES (?, ?, ?)', [userId, cId, newCodeId]);
        }
      }
    }

    // Update Course Admin course assignments if updated to Course Admin
    if (updatedRole === 'course_admin' && Array.isArray(course_ids)) {
      await db.run('DELETE FROM course_admins WHERE user_id = ?', [userId]);
      for (const cId of course_ids) {
        await db.run('INSERT INTO course_admins (user_id, course_id) VALUES (?, ?)', [userId, cId]);
      }
    }

    await logActivity(req, 'UPDATE_USER', 'User', userId, `Updated user details for ${user.name}`);

    return res.json({
      success: true,
      message: 'User updated successfully.',
      message_ar: 'تم تحديث بيانات المستخدم وصلاحياته بنجاح.'
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ success: false, message: 'Failed to update user.' });
  }
});

// 5. Admin Reset Password
router.post('/:id/reset-password', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { new_password, force_change_on_next_login = 0 } = req.body;
    const isSuperAdmin = req.user.role === 'super_admin';

    const targetUser = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (!isSuperAdmin && targetUser.role !== 'student') {
      return res.status(403).json({ success: false, message: 'Unauthorized to reset admin passwords.' });
    }

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters.',
        message_ar: 'يجب ألا تقل كلمة المرور عن 6 أحرف.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(new_password, salt);

    await db.run(`
      UPDATE users
      SET password_hash = ?, force_password_change = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [hash, force_change_on_next_login ? 1 : 0, userId]);

    await logActivity(req, 'RESET_PASSWORD', 'User', userId, `Admin reset password for ${targetUser.name}`);

    return res.json({
      success: true,
      message: 'Password reset successfully.',
      message_ar: 'تمت إعادة تعيين كلمة المرور بنجاح.'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
});

// 6. Delete Single User
router.delete('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const isSuperAdmin = req.user.role === 'super_admin';

    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account.',
        message_ar: 'لا يمكنك حذف حسابك الخاص.'
      });
    }

    const user = await db.get('SELECT name, role FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.', message_ar: 'المستخدم غير موجود.' });
    }

    if (!isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'Only Super Admin can delete accounts.' });
    }

    await db.run('DELETE FROM users WHERE id = ?', [userId]);
    await logActivity(req, 'DELETE_USER', 'User', userId, `Deleted ${user.role}: ${user.name}`);

    return res.json({
      success: true,
      message: 'User deleted successfully.',
      message_ar: 'تم حذف المستخدم بنجاح.'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete user.' });
  }
});

// 7. Bulk Delete Users
router.post('/bulk-delete', async (req, res) => {
  try {
    const { user_ids } = req.body;
    const isSuperAdmin = req.user.role === 'super_admin';

    if (!isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'Only Super Admin can bulk delete accounts.' });
    }

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No users selected for deletion.',
        message_ar: 'لم يتم تحديد أي مستخدمين للحذف.'
      });
    }

    // Exclude current user from deletion list
    const filteredIds = user_ids.filter(id => parseInt(id, 10) !== req.user.id);

    if (filteredIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete current logged-in administrator.',
        message_ar: 'لا يمكن حذف حساب المدير الحالي.'
      });
    }

    const placeholders = filteredIds.map(() => '?').join(',');
    await db.run(`DELETE FROM users WHERE id IN (${placeholders})`, filteredIds);

    await logActivity(req, 'BULK_DELETE_USERS', 'Users', null, `Bulk deleted ${filteredIds.length} users.`);

    return res.json({
      success: true,
      message: `Successfully deleted ${filteredIds.length} users.`,
      message_ar: `تم حذف ${filteredIds.length} مستخدم بنجاح.`
    });
  } catch (error) {
    console.error('Error during bulk delete:', error);
    return res.status(500).json({ success: false, message: 'Failed to complete bulk deletion.' });
  }
});

module.exports = router;

