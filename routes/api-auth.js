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
  newPassword: z.string().min(12, 'New password must be at least 12 characters').max(255)
}).strict();

const updateProfileSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(255),
  newUsername: z.string().trim().min(1).max(100).optional(),
  newPassword: z.string().min(12, 'New password must be at least 12 characters').max(255).optional()
}).strict();

// Configurable admin login lockout settings (defaults: 5 attempts, 10 minutes)
const LOGIN_MAX_ATTEMPTS = parseInt(process.env.LOGIN_MAX_ATTEMPTS, 10) || 5;
const LOGIN_LOCKOUT_MINUTES = parseInt(process.env.LOGIN_LOCKOUT_MINUTES, 10) || 10;
const LOGIN_WINDOW_MS = LOGIN_LOCKOUT_MINUTES * 60 * 1000;

let loginIpLimiter, loginUsernameLimiter;

const getIpKey = (req) => req.ip;
const getUsernameKey = (req) => {
  return req.body && req.body.username
    ? 'user_' + String(req.body.username).toLowerCase().trim()
    : req.ip;
};

function createLockoutHandler(getOtherLimiter, getOtherKey) {
  return async (req, res) => {
    let resetTime = req.rateLimit?.resetTime;
    const otherLimiter = getOtherLimiter();
    if (otherLimiter && typeof otherLimiter.getKey === 'function' && getOtherKey) {
      try {
        const otherKey = getOtherKey(req);
        const otherRecord = await otherLimiter.getKey(otherKey);
        if (otherRecord && otherRecord.totalHits >= LOGIN_MAX_ATTEMPTS) {
          if (otherRecord.resetTime && (!resetTime || new Date(otherRecord.resetTime) > new Date(resetTime))) {
            resetTime = otherRecord.resetTime;
          }
        }
      } catch (_) {}
    }

    const msUntilReset = resetTime ? new Date(resetTime).getTime() - Date.now() : LOGIN_WINDOW_MS;
    const retryAfterSeconds = Math.max(1, Math.ceil(msUntilReset / 1000));

    res.set('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      error: 'Too many failed login attempts.',
      retryAfterSeconds
    });
  };
}

loginIpLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  max: LOGIN_MAX_ATTEMPTS,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLockoutHandler(() => loginUsernameLimiter, getUsernameKey)
});

loginUsernameLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  max: LOGIN_MAX_ATTEMPTS,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: getUsernameKey,
  handler: createLockoutHandler(() => loginIpLimiter, getIpKey)
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

      if (newPassword.length < 12) {
        return res.status(400).json({ error: 'New password must be at least 12 characters.' });
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
        if (newPassword.length < 12) {
          return res.status(400).json({ error: 'New password must be at least 12 characters.' });
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
