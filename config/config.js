const path = require('path');
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'coptic_doros_secret_key_2026_super_secure',
  JWT_EXPIRES_IN: '7d',
  DB_PATH: path.join(__dirname, '..', 'data', 'coptic_lms.db'),
  UPLOAD_DIR: path.join(__dirname, '..', 'uploads'),
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_FILE_TYPES: ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.webp', '.mp3', '.zip'],
  VIDEO_COMPLETION_THRESHOLD: 90 // 90% required to auto-complete video
};
