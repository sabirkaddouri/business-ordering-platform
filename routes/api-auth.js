const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: { error: 'Too many login attempts from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function createAuthRoutes(db) {
  const router = express.Router();

  // POST /api/auth/login
  router.post('/login', loginLimiter, async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
      }

      const admin = await db.get('SELECT * FROM admin WHERE username = ?', [username]);
      if (!admin) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      const validPassword = bcrypt.compareSync(password, admin.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, username: admin.username });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // POST /api/auth/change-password (protected by authenticateToken middleware)
  router.post('/change-password', authenticateToken, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const adminId = req.admin.id;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new passwords are required.' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters.' });
      }

      const admin = await db.get('SELECT * FROM admin WHERE id = ?', [adminId]);
      if (!admin || !bcrypt.compareSync(currentPassword, admin.password)) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }

      const hashed = bcrypt.hashSync(newPassword, 10);
      await db.run('UPDATE admin SET password = ? WHERE id = ?', [hashed, adminId]);
      res.json({ message: 'Password changed successfully.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // POST /api/auth/update-profile
  router.post('/update-profile', authenticateToken, async (req, res) => {
    try {
      const { 
        newUsername, currentPassword, newPassword
      } = req.body;
      const adminId = req.admin.id;

      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to verify identity.' });
      }

      const admin = await db.get('SELECT * FROM admin WHERE id = ?', [adminId]);
      if (!admin || !bcrypt.compareSync(currentPassword, admin.password)) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }

      if (newUsername && newUsername.trim() !== '') {
        const usernameClean = newUsername.trim();
        const existing = await db.get('SELECT * FROM admin WHERE username = ? AND id != ?', [usernameClean, adminId]);
        if (existing) {
          return res.status(400).json({ error: 'Username is already taken.' });
        }
        await db.run('UPDATE admin SET username = ? WHERE id = ?', [usernameClean, adminId]);
      }

      if (newPassword && newPassword.trim() !== '') {
        if (newPassword.length < 6) {
          return res.status(400).json({ error: 'New password must be at least 6 characters.' });
        }
        const hashed = bcrypt.hashSync(newPassword, 10);
        await db.run('UPDATE admin SET password = ? WHERE id = ?', [hashed, adminId]);
      }

      const updatedAdmin = await db.get('SELECT * FROM admin WHERE id = ?', [adminId]);
      const newToken = jwt.sign({ id: updatedAdmin.id, username: updatedAdmin.username }, JWT_SECRET, { expiresIn: '24h' });

      res.json({
        message: 'Profile updated successfully.',
        username: updatedAdmin.username,
        token: newToken
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  return router;
}

module.exports = createAuthRoutes;
