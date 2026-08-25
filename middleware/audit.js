const db = require('../database/db');

async function logActivity(req, action, targetType, targetId = null, details = '') {
  try {
    const adminId = req.user ? req.user.id : null;
    const adminName = req.user ? req.user.name : 'System';
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

    await db.run(`
      INSERT INTO activity_logs (admin_id, admin_name, action, target_type, target_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [adminId, adminName, action, targetType, targetId ? String(targetId) : null, details, String(ipAddress)]);
  } catch (error) {
    console.error('Failed to record activity log:', error);
  }
}

module.exports = { logActivity };
