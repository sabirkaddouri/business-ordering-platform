require('dotenv').config(); // Load environment variables from .env file for production readiness

// Check for non-production environment connecting to remote database
if (process.env.NODE_ENV !== 'production' && process.env.DATABASE_URL) {
  try {
    const parsed = new URL(process.env.DATABASE_URL);
    const host = parsed.hostname.toLowerCase();
    if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1') {
      console.warn('\n' + '!'.repeat(72));
      console.warn('⚠️  WARNING: Production security checks are DISABLED!');
      console.warn('⚠️  DATABASE_URL points to a remote host (' + host + ') but NODE_ENV is not "production".');
      console.warn('⚠️  Strict JWT, password strength, CORS, and HSTS protections are INACTIVE.');
      console.warn('⚠️  Set NODE_ENV=production on your host/server to enable full security.');
      console.warn('!'.repeat(72) + '\n');
    }
  } catch (_) {
    const lower = process.env.DATABASE_URL.toLowerCase();
    if (!lower.includes('localhost') && !lower.includes('127.0.0.1')) {
      console.warn('\n' + '!'.repeat(72));
      console.warn('⚠️  WARNING: Production security checks are DISABLED!');
      console.warn('⚠️  DATABASE_URL points to a remote host but NODE_ENV is not "production".');
      console.warn('⚠️  Set NODE_ENV=production on your host/server to enable full security.');
      console.warn('!'.repeat(72) + '\n');
    }
  }
}

// Validate critical security env vars in production
if (process.env.NODE_ENV === 'production') {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    console.error('FATAL SECURITY ERROR: JWT_SECRET is missing or shorter than 32 characters in production.');
    process.exit(1);
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminPassword) {
    if (adminPassword.length < 12) {
      console.error('FATAL SECURITY ERROR: ADMIN_PASSWORD must be at least 12 characters in production.');
      process.exit(1);
    }
    const lower = adminPassword.toLowerCase();
    const weakList = ['admin', 'admin123', 'password', 'password123', '123456', '12345678', 'admin@123', 'root', 'changeme', 'secret'];
    if (weakList.some(w => lower === w || lower.includes(w))) {
      console.error('FATAL SECURITY ERROR: ADMIN_PASSWORD is a known weak or default value.');
      process.exit(1);
    }
  }
}

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const { initDatabase, saveDatabase } = require('./db/setup');
const DbHelper = require('./db/helper');
const createAuthRoutes = require('./routes/api-auth');
const createProductRoutes = require('./routes/api-products');
const createOrderRoutes = require('./routes/api-orders');
const createSettingsRoutes = require('./routes/api-settings');
const createAnalyticsRoutes = require('./routes/api-analytics');
const createPromotionRoutes = require('./routes/api-promotions');
const createNotificationRoutes = require('./routes/api-notifications');
const createCategoryRoutes = require('./routes/api-categories');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for reverse proxies (like Railway)
app.set('trust proxy', 1);

// Disable X-Powered-By header
app.disable('x-powered-by');

// Redirect HTTP to HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// Helmet HTTP security headers with tailored CSP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        styleSrcAttr: ["'unsafe-inline'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://*.cloudinary.com"],
        connectSrc: ["'self'"],
        manifestSrc: ["'self'"],
        workerSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: process.env.NODE_ENV === 'production' ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    } : false,
  })
);

// Middleware
app.use(compression());

// Configure CORS — explicit whitelist required in production, wildcard only in development
const corsOriginConfig = (() => {
  if (process.env.ALLOWED_ORIGINS) {
    const origins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
    return (origin, callback) => {
      if (!origin || origins.includes(origin)) callback(null, true);
      else callback(new Error('Not allowed by CORS'));
    };
  }
  if (process.env.NODE_ENV === 'production') {
    console.warn('WARNING: ALLOWED_ORIGINS is not set in production. CORS will reject all cross-origin requests.');
    return (origin, callback) => {
      if (!origin) callback(null, true); // same-origin / server-to-server
      else callback(new Error('Not allowed by CORS'));
    };
  }
  return '*'; // development: allow all
})();
app.use(cors({
  origin: corsOriginConfig,
  credentials: true
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Serve static files with caching
const cacheConfig = { maxAge: '1d' };
app.use('/images', express.static(path.join(__dirname, 'public', 'images'), { maxAge: '7d' }));
app.use('/admin', express.static(path.join(__dirname, 'admin'), cacheConfig));
app.use(express.static(path.join(__dirname, 'public'), cacheConfig));

async function start() {
  // Initialize database
  const rawDb = await initDatabase();
  const db = new DbHelper(rawDb, saveDatabase);

  // General API rate limiter (300 requests per 15 minutes per IP)
  const generalApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' }
  });
  app.use('/api/', generalApiLimiter);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // API Routes
  app.use('/api/auth', createAuthRoutes(db));
  app.use('/api/products', createProductRoutes(db));
  app.use('/api/orders', createOrderRoutes(db));
  app.use('/api/settings', createSettingsRoutes(db));
  app.use('/api/analytics', createAnalyticsRoutes(db));
  app.use('/api/promotions', createPromotionRoutes(db));
  app.use('/api/notifications', createNotificationRoutes(db));
  app.use('/api/categories', createCategoryRoutes(db));

  // API 404 handler
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  // Central error handler — no stack traces or internal details in production
  app.use((err, req, res, next) => {
    // Handle multer file size errors
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    // Handle multer file filter errors
    if (err.message === 'Only image files are allowed.') {
      return res.status(400).json({ error: err.message });
    }

    console.error('Unhandled error:', err);
    const statusCode = err.status || err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production'
      ? 'Internal server error.'
      : err.message || 'Internal server error.';
    res.status(statusCode).json({ error: message });
  });

  // Fallback routes
  app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
  });

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`📦 Customer store: http://localhost:${PORT}`);
    console.log(`🔧 Admin dashboard: http://localhost:${PORT}/admin`);
    console.log(`📡 API: http://localhost:${PORT}/api\n`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
