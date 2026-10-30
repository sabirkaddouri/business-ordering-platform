require('dotenv').config(); // Load environment variables from .env file for production readiness

const express = require('express');
const path = require('path');
const cors = require('cors');
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files with caching
const cacheConfig = { maxAge: '1d' };
app.use('/images', express.static(path.join(__dirname, 'public', 'images'), { maxAge: '7d' }));
app.use('/admin', express.static(path.join(__dirname, 'admin'), cacheConfig));
app.use(express.static(path.join(__dirname, 'public'), cacheConfig));

async function start() {
  // Initialize database
  const rawDb = await initDatabase();
  const db = new DbHelper(rawDb, saveDatabase);

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
