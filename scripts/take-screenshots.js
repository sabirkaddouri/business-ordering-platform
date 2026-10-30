/**
 * scripts/take-screenshots.js
 * Generates clean, generic demo screenshots for documentation/README using Playwright.
 * Uses an isolated demo server connected to a local demo database.
 */

const { spawn } = require('child_process');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const DEMO_PORT = 5099;
const DEMO_DB_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/shop_demo';
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'docs', 'screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function prepareDemoDb() {
  const pool = new Pool({ connectionString: DEMO_DB_URL });
  const hash = bcrypt.hashSync('demo-admin-pass123', 10);
  await pool.query('UPDATE admin SET password = $1 WHERE username = $2', [hash, 'admin']);
  await pool.end();
  console.log('✅ Demo database admin password ensured.');
}

async function startDemoServer() {
  console.log(`🚀 Starting temporary demo server on port ${DEMO_PORT}...`);
  const serverProcess = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(DEMO_PORT),
      DATABASE_URL: DEMO_DB_URL,
      JWT_SECRET: 'demo-secret-key-12345',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'demo-admin-pass123',
      NODE_ENV: 'development'
    },
    stdio: 'pipe'
  });

  // Wait for server ready
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://localhost:${DEMO_PORT}/api/products`);
      if (res.ok) {
        console.log('✅ Demo server ready.');
        return serverProcess;
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 500));
  }

  serverProcess.kill();
  throw new Error('Failed to start demo server within 15 seconds.');
}

async function takeScreenshots() {
  await prepareDemoDb();
  const server = await startDemoServer();

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  try {
    // 1. Desktop Home
    console.log('📸 Capturing storefront-home-desktop.png...');
    const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await desktopContext.newPage();
    await page.goto(`http://localhost:${DEMO_PORT}/`, { waitUntil: 'networkidle' });

    // Switch to English
    if (await page.locator('.lang-switcher, #langSelect').count() > 0) {
      await page.selectOption('.lang-switcher, #langSelect', 'en');
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'storefront-home-desktop.png') });

    // 2. Mobile Home
    console.log('📸 Capturing storefront-home-mobile.png...');
    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`http://localhost:${DEMO_PORT}/`, { waitUntil: 'networkidle' });
    if (await mobilePage.locator('.lang-switcher, #langSelect').count() > 0) {
      await mobilePage.selectOption('.lang-switcher, #langSelect', 'en');
      await mobilePage.waitForTimeout(500);
    }
    await mobilePage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'storefront-home-mobile.png') });

    // 3. Product Page
    console.log('📸 Capturing storefront-product.png...');
    const prodRes = await fetch(`http://localhost:${DEMO_PORT}/api/products`);
    const prods = await prodRes.json();
    const firstProdId = prods[0]?.id || 1;
    await page.goto(`http://localhost:${DEMO_PORT}/product.html?id=${firstProdId}`, { waitUntil: 'networkidle' });
    if (await page.locator('.lang-switcher, #langSelect').count() > 0) {
      await page.selectOption('.lang-switcher, #langSelect', 'en');
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'storefront-product.png') });

    // 4. Cart / Checkout Drawer
    console.log('📸 Capturing storefront-cart.png...');
    await page.goto(`http://localhost:${DEMO_PORT}/`, { waitUntil: 'networkidle' });
    if (await page.locator('.lang-switcher, #langSelect').count() > 0) {
      await page.selectOption('.lang-switcher, #langSelect', 'en');
      await page.waitForTimeout(400);
    }
    const addBtn = page.locator('.add-to-cart-btn').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(300);
    }
    const cartBtn = page.locator('#cartToggle, .cart-btn');
    if (await cartBtn.isVisible()) {
      await cartBtn.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'storefront-cart.png') });

    // 5. Admin Dashboard
    console.log('📸 Capturing admin-dashboard.png...');
    const adminPage = await desktopContext.newPage();
    await adminPage.goto(`http://localhost:${DEMO_PORT}/admin/`, { waitUntil: 'networkidle' });
    await adminPage.fill('#loginUsername', 'admin');
    await adminPage.fill('#loginPassword', 'demo-admin-pass123');
    await adminPage.click('#loginForm button[type="submit"]');
    await adminPage.waitForTimeout(1000);

    // Switch admin language to English
    const adminLang = adminPage.locator('#langSwitcherDash');
    if (await adminLang.isVisible()) {
      await adminLang.selectOption('en');
      await adminPage.waitForTimeout(500);
    }
    await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-dashboard.png') });

    // 6. Admin Orders
    console.log('📸 Capturing admin-orders.png...');
    const ordersNav = adminPage.locator('#navOrders');
    if (await ordersNav.count() > 0) {
      await ordersNav.click();
      await adminPage.waitForTimeout(600);
    }
    await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'admin-orders.png') });

    console.log('🎉 All demo screenshots captured in docs/screenshots/!');
  } finally {
    await browser.close();
    server.kill();
  }
}

takeScreenshots().catch(err => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
