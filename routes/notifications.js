// Notifications + reminders routes
// Mounted at /api/notifications in server.js

import express from 'express';

export function createNotificationsRouter({ db, checkAuth }) {
  const router = express.Router();
  router.use(checkAuth);

  router.get('/', (req, res) => {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    db.query(
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, limit],
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        const unreadCount = rows.filter((r) => !r.is_read).length;
        res.json({ success: true, notifications: rows, unread_count: unreadCount });
      }
    );
  });

  router.put('/:id/read', (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    db.query(
      `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
      [id, userId],
      (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
      }
    );
  });

  router.put('/read-all', (req, res) => {
    const userId = req.user.id;
    db.query(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
      [userId],
      (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
      }
    );
  });

  router.delete('/:id', (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    db.query(
      `DELETE FROM notifications WHERE id = ? AND user_id = ?`,
      [id, userId],
      (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
      }
    );
  });

  return router;
}
