const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { logActivity } = require('../middleware/audit');

// ─────────────────────────────────────────────────────────────────────────────
// 1. Setup Status — Check whether the platform has zero users (first run)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/setup-status', async (req, res) => {
  try {
    const { count } = await db.get('SELECT COUNT(*) as count FROM users');
    return res.json({ success: true, setupRequired: count === 0 });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. First setup — only when there are zero users
//    The first account always becomes Super Admin.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/setup', async (req, res) => {
  try {
    const { name, phone, password, confirm_password } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required.', message_ar: 'الاسم الكامل مطلوب.' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Phone number is required.', message_ar: 'رقم الهاتف مطلوب.' });
    }
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required.', message_ar: 'كلمة المرور مطلوبة.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.', message_ar: 'كلمة المرور يجب ألا تقل عن 6 أحرف.' });
    }
    if (confirm_password && password !== confirm_password) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.', message_ar: 'كلمتا المرور غير متطابقتين.' });
    }

    const { count: userCount } = await db.get('SELECT COUNT(*) as count FROM users');
    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'The initial setup has already been completed. Please log in or create a normal account using a valid access code.',
        message_ar: 'تمت تهيئة النظام بالفعل. يرجى تسجيل الدخول أو إنشاء حساب عادي باستخدام كود دخول صالح.'
      });
    }

    const cleanPhone = phone.trim();
    const cleanName = name.trim();
    const existingUser = await db.get('SELECT id FROM users WHERE phone = ?', [cleanPhone]);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'This phone number is already registered.', message_ar: 'رقم الهاتف هذا مسجل بالفعل.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const result = await db.run(
      `INSERT INTO users (name, phone, password_hash, role, status) VALUES (?, ?, ?, 'super_admin', 'active')`,
      [cleanName, cleanPhone, passwordHash]
    );

    const token = jwt.sign(
      { userId: result.lastID, role: 'super_admin' },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    await logActivity(
      { user: { id: result.lastID, name: cleanName } },
      'FIRST_ADMIN_CREATED', 'User', result.lastID,
      'First Super Admin account created during initial platform setup.'
    );

    return res.status(201).json({
      success: true,
      message: 'Super Administrator account created. Welcome to Doros Coptic!',
      message_ar: 'تم إنشاء حساب المدير العام بنجاح. مرحباً بك في منصة دروس قبطي!',
      isFirstUser: true,
      token,
      user: {
        id: result.lastID,
        name: cleanName,
        phone: cleanPhone,
        role: 'super_admin',
        avatar_url: null
      }
    });
  } catch (error) {
    console.error('Initial setup error:', error);
    return res.status(500).json({ success: false, message: 'Server error during initial setup.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Register — Unified account creation endpoint
//    • If users count == 0  →  first account becomes Super Admin (access code skipped)
//    • If users count > 0   →  access code required, student account created
// ─────────────────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, phone, access_code, password, confirm_password } = req.body;

    // Basic field validation
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required.', message_ar: 'الاسم الكامل مطلوب.' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Phone number is required.', message_ar: 'رقم الهاتف مطلوب.' });
    }
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required.', message_ar: 'كلمة المرور مطلوبة.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.', message_ar: 'كلمة المرور يجب ألا تقل عن 6 أحرف.' });
    }
    if (confirm_password && password !== confirm_password) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.', message_ar: 'كلمتا المرور غير متطابقتين.' });
    }

    const cleanPhone = phone.trim();
    const cleanName  = name.trim();

    // Check if phone is already registered
    const existingUser = await db.get('SELECT id FROM users WHERE phone = ?', [cleanPhone]);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'This phone number is already registered.', message_ar: 'رقم الهاتف هذا مسجل بالفعل.' });
    }

    // Determine: first user or normal user
    const { count: userCount } = await db.get('SELECT COUNT(*) as count FROM users');
    const isFirstUser = userCount === 0;

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // ── CASE A: First user → Super Admin ────────────────────────────────────
    if (isFirstUser) {
      const result = await db.run(
        `INSERT INTO users (name, phone, password_hash, role, status) VALUES (?, ?, ?, 'super_admin', 'active')`,
        [cleanName, cleanPhone, passwordHash]
      );

      const token = jwt.sign(
        { userId: result.lastID, role: 'super_admin' },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      await logActivity(
        { user: { id: result.lastID, name: cleanName } },
        'FIRST_ADMIN_CREATED', 'User', result.lastID,
        'First Super Admin account created during initial platform setup.'
      );

      return res.status(201).json({
        success: true,
        message: 'Super Administrator account created. Welcome to Doros Coptic!',
        message_ar: 'تم إنشاء حساب المدير العام بنجاح. مرحباً بك في منصة دروس قبطي!',
        isFirstUser: true,
        token,
        user: {
          id: result.lastID,
          name: cleanName,
          phone: cleanPhone,
          role: 'super_admin',
          avatar_url: null
        }
      });
    }

    // ── CASE B: Normal user → Validate access code ───────────────────────────
    if (!access_code || !access_code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Access code is required to create an account.',
        message_ar: 'كود الدخول مطلوب لإنشاء الحساب.'
      });
    }

    const cleanCode = access_code.trim().toUpperCase();
    const codeRecord = await db.get('SELECT * FROM access_codes WHERE UPPER(code) = ?', [cleanCode]);

    if (!codeRecord) {
      return res.status(400).json({
        success: false,
        message: 'This access code does not exist. Please contact the administrator.',
        message_ar: 'كود الدخول هذا غير مسجل. يرجى التواصل مع إدارة المنصة.'
      });
    }
    if (codeRecord.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'This access code is currently inactive.',
        message_ar: 'كود الدخول هذا غير نشط حالياً.'
      });
    }
    if (codeRecord.expires_at && new Date(codeRecord.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'This access code has expired.',
        message_ar: 'انتهت صلاحية كود الدخول.'
      });
    }
    if (codeRecord.max_users && codeRecord.current_users >= codeRecord.max_users) {
      return res.status(400).json({
        success: false,
        message: 'This access code has reached its maximum number of users.',
        message_ar: 'وصل هذا الكود إلى الحد الأقصى من المستخدمين.'
      });
    }

    // Create student account
    const result = await db.run(
      `INSERT INTO users (name, phone, password_hash, role, access_code_id, status) VALUES (?, ?, ?, 'student', ?, 'active')`,
      [cleanName, cleanPhone, passwordHash, codeRecord.id]
    );

    // Increment code user count
    await db.run('UPDATE access_codes SET current_users = current_users + 1 WHERE id = ?', [codeRecord.id]);

    // Enroll student in all courses linked to this access code
    const linkedCourses = await db.all(
      'SELECT course_id FROM access_code_courses WHERE access_code_id = ?',
      [codeRecord.id]
    );
    for (const { course_id } of linkedCourses) {
      await db.run(
        'INSERT OR IGNORE INTO user_course_enrollments (user_id, course_id, granted_by_code) VALUES (?, ?, ?)',
        [result.lastID, course_id, codeRecord.id]
      );
    }

    const token = jwt.sign(
      { userId: result.lastID, role: 'student' },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    await logActivity(
      { user: { id: result.lastID, name: cleanName } },
      'STUDENT_REGISTERED', 'User', result.lastID,
      `Student registered with access code ${cleanCode}.`
    );

    return res.status(201).json({
      success: true,
      message: 'Account created successfully. Welcome!',
      message_ar: 'تم إنشاء الحساب بنجاح. مرحباً بك!',
      isFirstUser: false,
      token,
      user: {
        id: result.lastID,
        name: cleanName,
        phone: cleanPhone,
        role: 'student',
        avatar_url: null,
        access_code: codeRecord.code
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Login — Phone + Password ONLY (no access code required at login)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and password are required.',
        message_ar: 'رقم الهاتف وكلمة المرور مطلوبان.'
      });
    }

    const user = await db.get('SELECT * FROM users WHERE phone = ?', [phone.trim()]);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Phone number or password is incorrect.',
        message_ar: 'رقم الهاتف أو كلمة المرور غير صحيح.'
      });
    }

    if (user.status === 'disabled') {
      return res.status(403).json({
        success: false,
        message: 'Your account is currently disabled. Please contact the administrator.',
        message_ar: 'تم تعطيل حسابك. يرجى التواصل مع إدارة المنصة.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Phone number or password is incorrect.',
        message_ar: 'رقم الهاتف أو كلمة المرور غير صحيح.'
      });
    }

    // Update last login
    await db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    // Fetch access code info if student
    let accessCodeInfo = null;
    if (user.access_code_id) {
      accessCodeInfo = await db.get(
        'SELECT id, code, title, medios_id FROM access_codes WHERE id = ?',
        [user.access_code_id]
      );
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    return res.json({
      success: true,
      message: 'Logged in successfully.',
      message_ar: 'تم تسجيل الدخول بنجاح.',
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        access_code: accessCodeInfo ? accessCodeInfo.code : null,
        avatar_url: user.avatar_url,
        force_password_change: !!user.force_password_change
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Verify Access Code — preview what Medios/courses a code unlocks
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify-code', async (req, res) => {
  try {
    const { access_code } = req.body;
    if (!access_code || !access_code.trim()) {
      return res.status(400).json({ success: false, message: 'Access code is required.', message_ar: 'كود الدخول مطلوب.' });
    }

    const cleanCode = access_code.trim().toUpperCase();
    const codeRecord = await db.get(`
      SELECT ac.*, m.name as medios_name, m.name_ar as medios_name_ar
      FROM access_codes ac
      LEFT JOIN medios m ON m.id = ac.medios_id
      WHERE UPPER(ac.code) = ?
    `, [cleanCode]);

    if (!codeRecord) {
      return res.status(400).json({ success: false, message: 'This access code does not exist.', message_ar: 'كود الدخول غير مسجل.' });
    }
    if (codeRecord.status !== 'active') {
      return res.status(400).json({ success: false, message: 'This access code is inactive.', message_ar: 'كود الدخول غير نشط.' });
    }
    if (codeRecord.expires_at && new Date(codeRecord.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'This access code has expired.', message_ar: 'انتهت صلاحية الكود.' });
    }

    const courses = await db.all(`
      SELECT c.id, c.title, c.title_ar, c.cover_image, c.instructor_name_ar
      FROM courses c
      JOIN access_code_courses acc ON acc.course_id = c.id
      WHERE acc.access_code_id = ? AND c.status = 'published'
    `, [codeRecord.id]);

    return res.json({
      success: true,
      message_ar: 'كود الدخول صالح ونشط.',
      code: {
        code: codeRecord.code,
        title: codeRecord.title,
        medios_id: codeRecord.medios_id,
        medios_name: codeRecord.medios_name,
        medios_name_ar: codeRecord.medios_name_ar,
        courses
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to verify access code.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Get Current Authenticated User
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    let enrolledCourses = [];
    let assignedAdminCourses = [];

    if (req.user.role === 'student') {
      enrolledCourses = await db.all(`
        SELECT c.id, c.title, c.title_ar, c.description, c.description_ar, c.cover_image, c.instructor_name_ar
        FROM courses c
        JOIN user_course_enrollments e ON e.course_id = c.id
        WHERE e.user_id = ? AND c.status = 'published'
        ORDER BY c.order_index ASC
      `, [req.user.id]);
    } else if (req.user.role === 'course_admin') {
      assignedAdminCourses = await db.all(`
        SELECT c.id, c.title, c.title_ar, c.status
        FROM courses c
        JOIN course_admins ca ON ca.course_id = c.id
        WHERE ca.user_id = ?
        ORDER BY c.order_index ASC
      `, [req.user.id]);
    }

    let codeInfo = null;
    if (req.user.access_code_id) {
      codeInfo = await db.get(
        'SELECT id, code, title, medios_id FROM access_codes WHERE id = ?',
        [req.user.access_code_id]
      );
    }

    return res.json({
      success: true,
      user: {
        ...req.user,
        force_password_change: !!req.user.force_password_change,
        access_code_info: codeInfo,
        enrolled_courses: enrolledCourses,
        assigned_courses: assignedAdminCourses
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error retrieving user profile.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Update Profile
// ─────────────────────────────────────────────────────────────────────────────
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { name, avatar_url } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name cannot be empty.', message_ar: 'الاسم مطلوب.' });
    }
    await db.run(
      'UPDATE users SET name = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name.trim(), avatar_url || req.user.avatar_url, req.user.id]
    );
    return res.json({ success: true, message: 'Profile updated.', message_ar: 'تم تحديث الملف الشخصي.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error updating profile.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Change Password
// ─────────────────────────────────────────────────────────────────────────────
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { old_password, new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.', message_ar: 'كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف.' });
    }
    const user = await db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const isMatch = await bcrypt.compare(old_password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.', message_ar: 'كلمة المرور الحالية غير صحيحة.' });
    }
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(new_password, salt);
    await db.run(
      'UPDATE users SET password_hash = ?, force_password_change = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newHash, req.user.id]
    );
    return res.json({ success: true, message: 'Password changed successfully.', message_ar: 'تم تغيير كلمة المرور بنجاح.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error changing password.' });
  }
});

module.exports = router;
