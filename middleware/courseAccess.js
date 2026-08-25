const db = require('../database/db');

/**
 * Validates whether the authenticated user has access to view/learn the specified course.
 * - Super Admin: Always allowed
 * - Course Admin: Allowed if assigned to the course
 * - Student: Allowed if enrolled in the course via access code or direct enrollment
 */
async function checkCourseAccess(req, res, next) {
  try {
    const courseId = parseInt(req.params.courseId || req.params.id || req.body.course_id || req.query.course_id, 10);

    if (!courseId || isNaN(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID.',
        message_ar: 'معرف الكورس غير صالح.'
      });
    }

    const course = await db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found.',
        message_ar: 'الكورس غير موجود.'
      });
    }

    req.course = course;

    // Super admin has unrestricted access
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Course admin access check
    if (req.user.role === 'course_admin') {
      const assignment = await db.get(
        'SELECT id FROM course_admins WHERE user_id = ? AND course_id = ?',
        [req.user.id, courseId]
      );
      if (!assignment) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to manage this course.',
          message_ar: 'ليس لديك صلاحية لإدارة هذا الكورس.'
        });
      }
      return next();
    }

    // Student access check
    if (req.user.role === 'student') {
      if (course.status !== 'published') {
        return res.status(403).json({
          success: false,
          message: 'This course is currently not available.',
          message_ar: 'هذا الكورس غير متاح حالياً.'
        });
      }

      const enrollment = await db.get(
        'SELECT id FROM user_course_enrollments WHERE user_id = ? AND course_id = ?',
        [req.user.id, courseId]
      );

      if (!enrollment) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this course. Please use an authorized access code.',
          message_ar: 'أنت غير مسجل في هذا الكورس. يرجى استخدام كود وصول مصرح به.'
        });
      }

      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Unauthorized access.',
      message_ar: 'غير مصرح بالوصول.'
    });
  } catch (error) {
    console.error('Error in checkCourseAccess middleware:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during access verification.',
      message_ar: 'حدث خطأ أثناء التحقق من الصلاحيات.'
    });
  }
}

/**
 * Checks if user has permission to manage (create/edit/delete content) in a course
 */
async function checkCourseManagementPermission(req, res, next) {
  try {
    const courseId = parseInt(req.params.courseId || req.params.id || req.body.course_id, 10);

    if (req.user.role === 'super_admin') {
      return next();
    }

    if (req.user.role === 'course_admin') {
      if (!courseId) {
        return res.status(400).json({
          success: false,
          message: 'Course ID is required.',
          message_ar: 'معرف الكورس مطلوب.'
        });
      }

      const assignment = await db.get(
        'SELECT id FROM course_admins WHERE user_id = ? AND course_id = ?',
        [req.user.id, courseId]
      );

      if (!assignment) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to manage this course.',
          message_ar: 'أنت غير مخصص لإدارة هذا الكورس.'
        });
      }
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Administrative privileges required.',
      message_ar: 'صلاحيات الإدارة مطلوبة.'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal error checking course management privileges.',
      message_ar: 'خطأ أثناء التحقق من صلاحيات إدارة الكورس.'
    });
  }
}

module.exports = {
  checkCourseAccess,
  checkCourseManagementPermission
};
