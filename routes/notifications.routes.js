const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');

// 1. Get User Notifications (Personal + Broadcast)
router.get('/', authenticate, async (req, res) => {
  try {
    const notifications = await db.all(`
      SELECT *
      FROM notifications
      WHERE user_id = ? OR user_id IS NULL
      ORDER BY created_at DESC
      LIMIT 30
    `, [req.user.id]);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return res.json({
      success: true,
      notifications,
      unread_count: unreadCount
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
});

// 2. Mark Single Notification as Read
router.post('/:id/read', authenticate, async (req, res) => {
  try {
    const notifId = parseInt(req.params.id, 10);
    await db.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [notifId]);
    return res.json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update notification.' });
  }
});

// 3. Mark All Notifications as Read
router.post('/mark-all-read', authenticate, async (req, res) => {
  try {
    await db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ? OR user_id IS NULL', [req.user.id]);
    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to mark notifications.' });
  }
});

// 4. Admin Broadcast Announcement
router.post('/broadcast', authenticate, requireAdmin, async (req, res) => {
  try {
    const { title, title_ar, message, message_ar, type = 'announcement', link_url = '' } = req.body;

    if (!title || !title_ar || !message || !message_ar) {
      return res.status(400).json({ success: false, message: 'Title and message in both languages are required.' });
    }

    const result = await db.run(`
      INSERT INTO notifications (user_id, title, title_ar, message, message_ar, type, link_url)
      VALUES (NULL, ?, ?, ?, ?, ?, ?)
    `, [title.trim(), title_ar.trim(), message.trim(), message_ar.trim(), type, link_url]);

    return res.status(201).json({
      success: true,
      message: 'Announcement broadcasted to all students.',
      message_ar: 'تم إرسال الإشعار لجميع الطلاب بنجاح.'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to broadcast announcement.' });
  }
});

module.exports = router;
