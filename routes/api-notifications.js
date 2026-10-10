const express = require('express');
const { authenticateToken } = require('../middleware/auth');

function createNotificationRoutes(db) {
  const router = express.Router();

  // GET /api/notifications — list recent notifications (admin only)
  router.get('/', authenticateToken, async (req, res) => {
    try {
      const notifications = await db.all(
        'SELECT *, createdat AS "createdAt", orderid AS "orderId" FROM notifications ORDER BY createdat DESC LIMIT 50'
      );
      const unreadCount = await db.get('SELECT COUNT(*) as count FROM notifications WHERE read = 0');
      res.json({ notifications, unreadCount: parseInt(unreadCount.count) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // PUT /api/notifications/read-all — mark all as read (admin only)
  router.put('/read-all', authenticateToken, async (req, res) => {
    try {
      await db.run('UPDATE notifications SET read = 1 WHERE read = 0');
      res.json({ message: 'All notifications marked as read.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // PUT /api/notifications/:id/read — mark one as read (admin only)
  router.put('/:id/read', authenticateToken, async (req, res) => {
    try {
      await db.run('UPDATE notifications SET read = 1 WHERE id = ?', [parseInt(req.params.id)]);
      res.json({ message: 'Notification marked as read.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  return router;
}

module.exports = createNotificationRoutes;
