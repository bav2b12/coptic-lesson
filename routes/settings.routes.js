const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { requireSuperAdmin } = require('../middleware/rbac');
const { logActivity } = require('../middleware/audit');

// 1. Get Platform Settings (Public & Authenticated)
router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT key, value FROM platform_settings');
    const settings = {};
    rows.forEach(r => {
      settings[r.key] = r.value;
    });

    return res.json({ success: true, settings });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch settings.' });
  }
});

// 2. Update Platform Settings (Super Admin Only)
router.put('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { settings = {} } = req.body;

    for (const [key, value] of Object.entries(settings)) {
      await db.run(`
        INSERT INTO platform_settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
      `, [key, String(value), String(value)]);
    }

    await logActivity(req, 'UPDATE_SETTINGS', 'PlatformSettings', null, 'Updated platform configuration settings.');

    return res.json({
      success: true,
      message: 'Platform settings updated successfully.',
      message_ar: 'تم حفظ إعدادات المنصة بنجاح.'
    });
  } catch (error) {
    console.error('Settings update error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update platform settings.' });
  }
});

module.exports = router;
