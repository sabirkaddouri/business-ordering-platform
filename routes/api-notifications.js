const express = require('express');
const { authenticateToken } = require('../middleware/auth');

function createNotificationRoutes(db) {
  const router = express.Router();

  // GET /api/notifications — list recent notifications (admin only)
  router.get('/', authenticateToken, (req, res) => {
    try {
      const notifications = db.all(
        'SELECT * FROM notifications ORDER BY createdAt DESC LIMIT 50'
      );
      const unreadCount = db.get('SELECT COUNT(*) as count FROM notifications WHERE read = 0');
      res.json({ notifications, unreadCount: unreadCount.count });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // PUT /api/notifications/read-all — mark all as read (admin only)
  router.put('/read-all', authenticateToken, (req, res) => {
    try {
      db.run('UPDATE notifications SET read = 1 WHERE read = 0');
      res.json({ message: 'All notifications marked as read.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // PUT /api/notifications/:id/read — mark one as read (admin only)
  router.put('/:id/read', authenticateToken, (req, res) => {
    try {
      db.run('UPDATE notifications SET read = 1 WHERE id = ?', [parseInt(req.params.id)]);
      res.json({ message: 'Notification marked as read.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  return router;
}

module.exports = createNotificationRoutes;
