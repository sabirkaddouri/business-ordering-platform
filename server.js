require('dotenv').config(); // Load environment variables from .env file for production readiness

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

// Configure CORS for production readiness with environment variable support
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : '*';
app.use(cors({
  origin: allowedOrigins,
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

  // API Routes
  app.use('/api/auth', createAuthRoutes(db));
  app.use('/api/products', createProductRoutes(db));
  app.use('/api/orders', createOrderRoutes(db));
  app.use('/api/settings', createSettingsRoutes(db));
  app.use('/api/analytics', createAnalyticsRoutes(db));
  app.use('/api/promotions', createPromotionRoutes(db));
  app.use('/api/notifications', createNotificationRoutes(db));
  app.use('/api/categories', createCategoryRoutes(db));

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
