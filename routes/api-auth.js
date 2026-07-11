const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

function createAuthRoutes(db) {
  const router = express.Router();

  // POST /api/auth/login
  router.post('/login', (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
      }

      const admin = db.get('SELECT * FROM admin WHERE username = ?', [username]);
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
  router.post('/change-password', authenticateToken, (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const adminId = req.admin.id;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new passwords are required.' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters.' });
      }

      const admin = db.get('SELECT * FROM admin WHERE id = ?', [adminId]);
      if (!admin || !bcrypt.compareSync(currentPassword, admin.password)) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }

      const hashed = bcrypt.hashSync(newPassword, 10);
      db.run('UPDATE admin SET password = ? WHERE id = ?', [hashed, adminId]);
      res.json({ message: 'Password changed successfully.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // POST /api/auth/update-profile — update admin username and/or password (protected by authenticateToken middleware)
  router.post('/update-profile', authenticateToken, (req, res) => {
    try {
      const { 
        newUsername, currentPassword, newPassword
      } = req.body;
      const adminId = req.admin.id;

      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to verify identity.' });
      }

      const admin = db.get('SELECT * FROM admin WHERE id = ?', [adminId]);
      if (!admin || !bcrypt.compareSync(currentPassword, admin.password)) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }

      if (newUsername && newUsername.trim() !== '') {
        const usernameClean = newUsername.trim();
        const existing = db.get('SELECT * FROM admin WHERE username = ? AND id != ?', [usernameClean, adminId]);
        if (existing) {
          return res.status(400).json({ error: 'Username is already taken.' });
        }
        db.run('UPDATE admin SET username = ? WHERE id = ?', [usernameClean, adminId]);
      }

      if (newPassword && newPassword.trim() !== '') {
        if (newPassword.length < 6) {
          return res.status(400).json({ error: 'New password must be at least 6 characters.' });
        }
        const hashed = bcrypt.hashSync(newPassword, 10);
        db.run('UPDATE admin SET password = ? WHERE id = ?', [hashed, adminId]);
      }

      const updatedAdmin = db.get('SELECT * FROM admin WHERE id = ?', [adminId]);
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
