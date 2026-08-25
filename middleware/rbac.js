function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      message_ar: 'يجب تسجيل الدخول أولاً.'
    });
  }

  if (req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Super Administrator permission required.',
      message_ar: 'تم رفض الوصول. هذه الميزة متاحة فقط للمدير العام للنظام.'
    });
  }

  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      message_ar: 'يجب تسجيل الدخول أولاً.'
    });
  }

  if (req.user.role !== 'super_admin' && req.user.role !== 'course_admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Administrator privileges required.',
      message_ar: 'تم رفض الوصول. هذه الميزة متاحة فقط للمشرفين والمعلمين.'
    });
  }

  next();
}

module.exports = {
  requireSuperAdmin,
  requireAdmin
};
