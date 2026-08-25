const jwt = require('jsonwebtoken');
const config = require('../config/config');
const db = require('../database/db');

async function authenticate(req, res, next) {
  try {
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.',
        message_ar: 'يجب تسجيل الدخول للوصول إلى هذه الصفحة.'
      });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = await db.get(
      'SELECT id, name, phone, role, access_code_id, avatar_url, status, force_password_change, last_login, created_at FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found.',
        message_ar: 'لم يتم العثور على الحساب.'
      });
    }

    if (user.status === 'disabled') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact the administrator.',
        message_ar: 'تم تعطيل حسابك. برجاء التواصل مع إدارة المنصة.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired session token. Please log in again.',
      message_ar: 'جلسة الدخول منتهية أو غير صالحة. يرجى تسجيل الدخول مجدداً.'
    });
  }
}

module.exports = { authenticate };
