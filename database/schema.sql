-- DOROS COPTIC / دروس قبطي — DATABASE SCHEMA v2.0
-- Clean start: No demo data. First user becomes Super Admin.

-- 0. Medios Table (Exactly 13 Medios — educational levels/categories for access code organization)
CREATE TABLE IF NOT EXISTS medios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description TEXT DEFAULT '',
  order_index INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 1. Access Codes (linked to Medios, not Level string)
CREATE TABLE IF NOT EXISTS access_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  medios_id INTEGER DEFAULT NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  max_users INTEGER DEFAULT NULL,
  current_users INTEGER DEFAULT 0,
  expires_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (medios_id) REFERENCES medios(id) ON DELETE SET NULL
);

-- 2. Users
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'student' CHECK(role IN ('super_admin', 'course_admin', 'student')),
  access_code_id INTEGER,
  avatar_url TEXT DEFAULT NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'disabled')),
  force_password_change INTEGER DEFAULT 0,
  last_login DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (access_code_id) REFERENCES access_codes(id) ON DELETE SET NULL
);

-- 3. Courses (linked to Medios)
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  description TEXT DEFAULT '',
  description_ar TEXT DEFAULT '',
  medios_id INTEGER DEFAULT NULL,
  cover_image TEXT DEFAULT '',
  instructor_name TEXT DEFAULT '',
  instructor_name_ar TEXT DEFAULT '',
  status TEXT DEFAULT 'published' CHECK(status IN ('draft', 'published', 'archived')),
  order_index INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (medios_id) REFERENCES medios(id) ON DELETE SET NULL
);

-- 4. Access Code Courses (ManyToMany: AccessCode <-> Course)
CREATE TABLE IF NOT EXISTS access_code_courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  access_code_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  FOREIGN KEY (access_code_id) REFERENCES access_codes(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE(access_code_id, course_id)
);

-- 5. User Course Enrollments (ManyToMany: User <-> Course)
CREATE TABLE IF NOT EXISTS user_course_enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  granted_by_code INTEGER DEFAULT NULL,
  enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by_code) REFERENCES access_codes(id) ON DELETE SET NULL,
  UNIQUE(user_id, course_id)
);

-- 6. Course Admins (ManyToMany: User <-> Course for Course Admins)
CREATE TABLE IF NOT EXISTS course_admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE(user_id, course_id)
);

-- 7. Course Units / Modules
CREATE TABLE IF NOT EXISTS units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  description TEXT DEFAULT '',
  description_ar TEXT DEFAULT '',
  order_index INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- 8. Lessons
CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  content_text TEXT DEFAULT '',
  coptic_content TEXT DEFAULT '',
  youtube_url TEXT DEFAULT '',
  youtube_video_id TEXT DEFAULT '',
  duration_minutes INTEGER DEFAULT 15,
  required_watch_percentage INTEGER DEFAULT 90,
  order_index INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- 9. Lesson Files / Materials
CREATE TABLE IF NOT EXISTS lesson_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER DEFAULT NULL,
  course_id INTEGER NOT NULL,
  unit_id INTEGER DEFAULT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  file_path TEXT NOT NULL,
  file_type TEXT DEFAULT 'application/pdf',
  file_size INTEGER DEFAULT 0,
  uploaded_by INTEGER DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 10. Exams
CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  unit_id INTEGER DEFAULT NULL,
  lesson_id INTEGER DEFAULT NULL,
  title TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  description TEXT DEFAULT '',
  description_ar TEXT DEFAULT '',
  instructions TEXT DEFAULT '',
  time_limit_minutes INTEGER DEFAULT 20,
  passing_score_percentage INTEGER DEFAULT 70,
  max_attempts INTEGER DEFAULT 3,
  is_published INTEGER DEFAULT 1,
  order_index INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL
);

-- 11. Exam Questions (supports text + image questions, text + image answers)
-- options_json format: [{"id":"A","text":"...","image_url":"..."}, ...]
-- question_image_url: URL of image if question uses an image instead of/alongside text
CREATE TABLE IF NOT EXISTS exam_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL,
  question_text TEXT DEFAULT '',
  question_coptic TEXT DEFAULT '',
  question_image_url TEXT DEFAULT '',
  options_json TEXT NOT NULL DEFAULT '[]',
  correct_option_id TEXT NOT NULL,
  points INTEGER DEFAULT 1,
  order_index INTEGER DEFAULT 0,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

-- 12. Exam Attempts
CREATE TABLE IF NOT EXISTS exam_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  attempt_number INTEGER DEFAULT 1,
  score INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  percentage REAL DEFAULT 0.0,
  passed INTEGER DEFAULT 0,
  answers_json TEXT DEFAULT '{}',
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  submitted_at DATETIME DEFAULT NULL,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 13. Assignments
CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  unit_id INTEGER DEFAULT NULL,
  lesson_id INTEGER DEFAULT NULL,
  title TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  description TEXT DEFAULT '',
  description_ar TEXT DEFAULT '',
  instructions TEXT DEFAULT '',
  due_date DATETIME DEFAULT NULL,
  max_grade INTEGER DEFAULT 100,
  required_file_types TEXT DEFAULT '.pdf,.doc,.docx,.jpg,.png',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL
);

-- 14. Assignment Submissions
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  text_answer TEXT DEFAULT '',
  file_path TEXT DEFAULT '',
  file_name TEXT DEFAULT '',
  grade INTEGER DEFAULT NULL,
  max_grade INTEGER DEFAULT 100,
  status TEXT DEFAULT 'submitted' CHECK(status IN ('submitted', 'accepted', 'resubmission_requested')),
  feedback TEXT DEFAULT '',
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  graded_at DATETIME DEFAULT NULL,
  graded_by INTEGER DEFAULT NULL,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 15. Student Lesson & Video Progress
CREATE TABLE IF NOT EXISTS lesson_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  lesson_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  completed INTEGER DEFAULT 0,
  video_watched_seconds INTEGER DEFAULT 0,
  video_duration_seconds INTEGER DEFAULT 0,
  video_watched_percentage REAL DEFAULT 0.0,
  completed_at DATETIME DEFAULT NULL,
  last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE(user_id, lesson_id)
);

-- 16. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER DEFAULT NULL,
  title TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  message TEXT NOT NULL,
  message_ar TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK(type IN ('info', 'exam', 'assignment', 'announcement', 'grade')),
  link_url TEXT DEFAULT '',
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 17. Admin Activity Logs (Audit Trail)
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER DEFAULT NULL,
  admin_name TEXT DEFAULT 'System',
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT DEFAULT NULL,
  details TEXT DEFAULT '',
  ip_address TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 18. Platform Settings
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_access_codes_code ON access_codes(code);
CREATE INDEX IF NOT EXISTS idx_access_codes_medios ON access_codes(medios_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON user_course_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON user_course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_course_admins_user ON course_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_course_admins_course ON course_admins(course_id);
CREATE INDEX IF NOT EXISTS idx_units_course ON units(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_unit ON lessons(unit_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_progress_user ON lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_course ON lesson_progress(course_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_exam ON exam_attempts(user_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_assign ON assignment_submissions(user_id, assignment_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_date ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_courses_medios ON courses(medios_id);
