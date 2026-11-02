const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');
const { validate, z } = require('../middleware/validate');

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(100),
  password: z.string().min(1, 'Password is required').max(255)
}).strict();

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(255),
  newPassword: z.string().min(6, 'New password must be at least 6 characters').max(255)
}).strict();

const updateProfileSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(255),
  newUsername: z.string().trim().min(1).max(100).optional(),
  newPassword: z.string().min(6, 'New password must be at least 6 characters').max(255).optional()
}).strict();

// Rate limiting: max 5 failed attempts per 15 minutes per IP and per username
const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many failed login attempts from this IP. Please try again after 15 minutes.' },
});

const loginUsernameLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => {
    return req.body && req.body.username
      ? 'user_' + String(req.body.username).toLowerCase().trim()
      : req.ip;
  },
  message: { error: 'Too many failed login attempts for this account. Please try again after 15 minutes.' },
});

function createAuthRoutes(db) {
  const router = express.Router();

  // POST /api/auth/login
  router.post('/login', loginIpLimiter, loginUsernameLimiter, validate({ body: loginSchema }), async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
      }

      const admin = await db.get('SELECT * FROM admin WHERE username = ?', [username]);
      // Use dummy hash comparison to prevent timing discrepancy / username enumeration
      const DUMMY_HASH = '$2a$12$e80yqRzK964p2E61iL8ohe.5U5GZ.Vp9.uG0o1k2l3m4n5o6p7q8r';
      const passwordToCompare = admin ? admin.password : DUMMY_HASH;
      const validPassword = bcrypt.compareSync(password, passwordToCompare);

      if (!admin || !validPassword) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      const token = jwt.sign(
        { id: admin.id, username: admin.username },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '2h' }
      );
      res.json({ token, username: admin.username });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // POST /api/auth/change-password (protected by authenticateToken middleware)
  router.post('/change-password', authenticateToken, validate({ body: changePasswordSchema }), async (req, res) => {
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

      const hashed = bcrypt.hashSync(newPassword, 12);
      await db.run('UPDATE admin SET password = ? WHERE id = ?', [hashed, adminId]);
      res.json({ message: 'Password changed successfully.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // POST /api/auth/update-profile
  router.post('/update-profile', authenticateToken, validate({ body: updateProfileSchema }), async (req, res) => {
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
        const hashed = bcrypt.hashSync(newPassword, 12);
        await db.run('UPDATE admin SET password = ? WHERE id = ?', [hashed, adminId]);
      }

      const updatedAdmin = await db.get('SELECT * FROM admin WHERE id = ?', [adminId]);
      const newToken = jwt.sign(
        { id: updatedAdmin.id, username: updatedAdmin.username },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '2h' }
      );

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
