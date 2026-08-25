const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let subfolder = 'materials';
    if (req.baseUrl.includes('courses') && (file.fieldname === 'cover' || file.fieldname === 'cover_image')) {
      subfolder = 'covers';
    } else if (req.baseUrl.includes('assignments') || file.fieldname === 'assignment_file') {
      subfolder = 'assignments';
    } else if (file.fieldname === 'avatar') {
      subfolder = 'avatars';
    } else if (file.fieldname === 'question_image' || file.fieldname.startsWith('answer_image_')) {
      subfolder = 'exam-images';
    }

    const destDir = path.join(config.UPLOAD_DIR, subfolder);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    cb(null, destDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBaseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\u0600-\u06FF\u2C80-\u2CFF]/g, '_');
    cb(null, `${safeBaseName}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (config.ALLOWED_FILE_TYPES.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${ext} is not allowed. Allowed types: ${config.ALLOWED_FILE_TYPES.join(', ')}`), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.MAX_FILE_SIZE
  },
  fileFilter: fileFilter
});

module.exports = upload;
