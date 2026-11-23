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
const fs = require('fs');
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
const { initMailer } = require('./services/mailer');

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

async function start() {
  // Initialize database
  const rawDb = await initDatabase();
  const db = new DbHelper(rawDb, saveDatabase);

  // ── SEO Helpers ────────────────────────────────────────────────────────────

  // Helper: get base URL from env or request
  function getBaseUrl(req) {
    if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    return proto + '://' + req.headers.host;
  }

  // Helper: XML-escape a string
  function xmlEsc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // Helper: HTML-escape a string (for server-rendered HTML attributes/text)
  function htmlEsc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Helper: safely escape JSON-LD output
  function escapeJsonLd(jsonString) {
    return String(jsonString || '')
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  }

  // Simple in-memory cache for settings (60s TTL)
  let _settingsCache = null;
  let _settingsCacheAt = 0;
  async function getCachedSettings() {
    if (_settingsCache && Date.now() - _settingsCacheAt < 60000) return _settingsCache;
    const row = await db.get('SELECT * FROM settings ORDER BY id DESC LIMIT 1');
    if (!row) {
      _settingsCache = { siteName: '', description: '', phone: '', address: '', instagramLink: '' };
    } else {
      const v = (k) => (row[k] !== undefined ? row[k] : (row[k.toLowerCase()] || ''));
      _settingsCache = {
        siteName: v('siteName') || '',
        description: v('description') || '',
        phone: v('phone') || '',
        address: v('address') || '',
        instagramLink: v('instagramLink') || ''
      };
    }
    _settingsCacheAt = Date.now();
    return _settingsCache;
  }

  // ── X-Robots-Tag: noindex on /admin and /api ───────────────────────────────
  app.use(['/admin', '/api'], (req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
  });

  // ── Server-side HTML render routes (before static middleware) ───────────────
  const indexHtmlPath = path.join(__dirname, 'public', 'index.html');
  const productHtmlPath = path.join(__dirname, 'public', 'product.html');

  app.get('/', async (req, res, next) => {
    try {
      let html = fs.readFileSync(indexHtmlPath, 'utf8');
      const settings = await getCachedSettings();
      const base = getBaseUrl(req);
      const title = settings.siteName
        ? htmlEsc(settings.siteName) + ' — Boutique en ligne'
        : 'Boutique en ligne';
      const desc = settings.description
        ? htmlEsc(settings.description.slice(0, 200))
        : 'Découvrez notre boutique en ligne.';

      const jsonLdParts = { '@context': 'https://schema.org', '@type': 'Store', name: settings.siteName || '' };
      if (settings.phone) jsonLdParts.telephone = settings.phone;
      if (settings.address) jsonLdParts.address = settings.address;
      if (settings.instagramLink) jsonLdParts.sameAs = [settings.instagramLink];
      jsonLdParts.url = base;
      const jsonLd = escapeJsonLd(JSON.stringify(jsonLdParts));

      const metaBlock = [
        '<title>' + title + '</title>',
        '  <link rel="canonical" href="' + htmlEsc(base + '/') + '">',
        '  <meta name="description" content="' + desc + '">',
        '  <meta property="og:title" content="' + title + '">',
        '  <meta property="og:description" content="' + desc + '">',
        '  <meta property="og:type" content="website">',
        '  <meta property="og:url" content="' + htmlEsc(base + '/') + '">',
        '  <meta name="twitter:card" content="summary">',
        '  <script type="application/ld+json">' + jsonLd + '</script>'
      ].join('\n');

      html = html.replace(/<title>[^<]*<\/title>/, '');
      html = html.replace(/<meta name="description"[^>]*>/, '');
      html = html.replace('<head>', () => '<head>\n  ' + metaBlock);
      res.type('text/html').send(html);
    } catch (err) {
      console.error('index render error:', err);
      next();
    }
  });

  app.get('/product.html', async (req, res, next) => {
    try {
      let html = fs.readFileSync(productHtmlPath, 'utf8');
      const base = getBaseUrl(req);
      const id = parseInt(req.query.id, 10);
      if (id && !isNaN(id)) {
        const product = await db.get('SELECT * FROM products WHERE id = ? LIMIT 1', [id]);
        if (product) {
          const settings = await getCachedSettings();
          const pName = product.name || '';
          const pDesc = product.description || '';
          const title = htmlEsc(pName) + (settings.siteName ? ' — ' + htmlEsc(settings.siteName) : '');
          const desc = htmlEsc(pDesc.slice(0, 200)) || htmlEsc(pName);

          const rawImage = (product.image || '').trim();
          let image = '';
          if (rawImage && rawImage !== 'default.jpg') {
            image = rawImage.startsWith('http') ? rawImage : (base + '/images/' + rawImage);
          }

          const price = product.price || 0;
          const inStock = product.available !== false && product.available !== 0;
          const offers = {
            '@type': 'Offer',
            priceCurrency: 'MAD',
            price: price,
            availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
          };
          const jsonLdObj = {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: pName,
            description: pDesc.slice(0, 500),
            offers: offers,
            url: base + '/product.html?id=' + id
          };
          if (image) jsonLdObj.image = image;
          const jsonLd = escapeJsonLd(JSON.stringify(jsonLdObj));

          const metaBlock = [
            '<title>' + title + '</title>',
            '  <link rel="canonical" href="' + htmlEsc(base + '/product.html?id=' + id) + '">',
            '  <meta name="description" content="' + desc + '">',
            '  <meta property="og:title" content="' + title + '">',
            '  <meta property="og:description" content="' + desc + '">',
            '  <meta property="og:type" content="product">',
            '  <meta property="og:url" content="' + htmlEsc(base + '/product.html?id=' + id) + '">',
            image ? '  <meta property="og:image" content="' + htmlEsc(image) + '">' : '',
            '  <meta name="twitter:card" content="' + (image ? 'summary_large_image' : 'summary') + '">',
            '  <script type="application/ld+json">' + jsonLd + '</script>'
          ].filter(Boolean).join('\n');

          html = html.replace(/<title>[^<]*<\/title>/, '');
          html = html.replace(/<meta name="description"[^>]*>/, '');
          html = html.replace('<head>', () => '<head>\n  ' + metaBlock);
          return res.type('text/html').send(html);
        }
      }
      next();
    } catch (err) {
      console.error('product render error:', err);
      next();
    }
  });

  // Serve static files (after SEO routes, before API routes)
  app.use('/admin', express.static(path.join(__dirname, 'admin'), cacheConfig));
  // Public static — index:false so app.get('/') handles the home page for meta injection
  app.use(express.static(path.join(__dirname, 'public'), Object.assign({}, cacheConfig, { index: false })));

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

  // ── GET /robots.txt ────────────────────────────────────────────────────────
  app.get('/robots.txt', (req, res) => {
    const base = getBaseUrl(req);
    const body = [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /api/',
      'Sitemap: ' + base + '/sitemap.xml'
    ].join('\n');
    res.type('text/plain').send(body);
  });

  // ── GET /sitemap.xml ───────────────────────────────────────────────────────
  app.get('/sitemap.xml', async (req, res) => {
    try {
      const base = getBaseUrl(req);
      const products = await db.all(
        'SELECT id, name FROM products WHERE available != 0 ORDER BY id'
      );
      const today = new Date().toISOString().split('T')[0];
      const urls = [
        { loc: base + '/', priority: '1.0' },
        { loc: base + '/privacy.html', priority: '0.3' },
        { loc: base + '/terms.html', priority: '0.3' },
        { loc: base + '/legal.html', priority: '0.3' }
      ];
      for (const p of products) {
        urls.push({ loc: base + '/product.html?id=' + xmlEsc(String(p.id)), priority: '0.8' });
      }
      const urlEntries = urls.map((u) =>
        '  <url>\n    <loc>' + xmlEsc(u.loc) + '</loc>\n    <lastmod>' + today + '</lastmod>\n    <priority>' + u.priority + '</priority>\n  </url>'
      ).join('\n');
      const xml =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        urlEntries + '\n' +
        '</urlset>';
      res.set('Cache-Control', 'public, max-age=3600');
      res.type('application/xml').send(xml);
    } catch (err) {
      console.error('sitemap error:', err);
      res.status(500).send('<!-- sitemap error -->');
    }
  });

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
    initMailer();
    console.log(`📦 Customer store: http://localhost:${PORT}`);
    console.log(`🔧 Admin dashboard: http://localhost:${PORT}/admin`);
    console.log(`📡 API: http://localhost:${PORT}/api\n`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
