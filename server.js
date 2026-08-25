const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config/config');
const { seedDatabase } = require('./database/seed');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static Assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/users.routes'));
app.use('/api/courses', require('./routes/courses.routes'));
app.use('/api/lessons', require('./routes/lessons.routes'));
app.use('/api/exams', require('./routes/exams.routes'));
app.use('/api/assignments', require('./routes/assignments.routes'));
app.use('/api/access-codes', require('./routes/accessCodes.routes'));
app.use('/api/medios', require('./routes/accessCodes.routes')); // proxies GET /medios
app.use('/api/files', require('./routes/files.routes'));
app.use('/api/reports', require('./routes/reports.routes'));
app.use('/api/notifications', require('./routes/notifications.routes'));
app.use('/api/settings', require('./routes/settings.routes'));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', platform: 'Doros Coptic LMS', time: new Date().toISOString() });
});

// Single Page Application Fallback for direct links (Express v5 compatible)
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return res.status(404).json({ success: false, message: 'Endpoint not found.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    message_ar: 'حدث خطأ في الخادم.'
  });
});

// Auto-seed database if empty and start server
async function startServer() {
  try {
    await seedDatabase(false);
    app.listen(config.PORT, () => {
      console.log(`=======================================================`);
      console.log(`  🌟 DOROS COPTIC LMS (دروس قبطي) is running!`);
      console.log(`  🔗 Server URL: http://localhost:${config.PORT}`);
      console.log(`  📂 Database: ${config.DB_PATH}`);
      console.log(`  ⚡ Ready for students, teachers, and admins!`);
      console.log(`=======================================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
}

startServer();

module.exports = app;
