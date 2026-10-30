/**
 * scripts/seed-demo.js
 * Inserts generic demo data into a target PostgreSQL database for screenshots / demo testing.
 *
 * SAFETY RULES:
 * 1. REFUSES to run unless DATABASE_URL points to localhost or 127.0.0.1.
 * 2. Does NOT delete or truncate any existing data.
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ ERROR: DATABASE_URL environment variable is required.');
  process.exit(1);
}

// 1. Safety check: URL must strictly point to localhost or 127.0.0.1
try {
  const parsed = new URL(dbUrl);
  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    console.error('❌ SAFETY REFUSAL: DATABASE_URL must point to localhost or 127.0.0.1 to avoid touching remote databases.');
    process.exit(1);
  }
} catch (e) {
  console.error('❌ ERROR: Invalid DATABASE_URL format.');
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl });

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Checking and seeding demo data (no deletions)...');

    // 1. Settings (Demo Shop)
    const settingsCheck = await client.query('SELECT COUNT(*) FROM settings');
    if (parseInt(settingsCheck.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO settings (
          siteName, description, address, googleMapsLink, phone, openHours,
          paymentTerms, deliveryZones, storeOpen, taxEnabled, taxRate
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, 1, 0, 0
        )
      `, [
        'Demo Shop',
        'A modern generic storefront template demo showcasing e-commerce features.',
        '123 Demo Street, Demo City',
        'https://maps.google.com',
        '+212 6 00 00 00 00',
        'Mon - Sat: 9:00 AM - 7:00 PM',
        'Cash on delivery available nationwide.',
        'Local delivery: 20 MAD / Free over 300 MAD'
      ]);
      console.log('  ✅ Seeded Demo Shop settings');
    } else {
      await client.query(`UPDATE settings SET siteName = $1 WHERE id = (SELECT id FROM settings LIMIT 1)`, ['Demo Shop']);
      console.log('  ℹ️ Updated existing settings to siteName = "Demo Shop"');
    }

    // 2. Admin account
    const adminCheck = await client.query('SELECT COUNT(*) FROM admin');
    if (parseInt(adminCheck.rows[0].count) === 0) {
      const username = process.env.ADMIN_USERNAME || 'admin';
      const password = process.env.ADMIN_PASSWORD || 'demo-admin-pass123';
      const hash = bcrypt.hashSync(password, 10);
      await client.query('INSERT INTO admin (username, password) VALUES ($1, $2)', [username, hash]);
      console.log(`  ✅ Seeded demo admin user (${username})`);
    }

    // 3. Categories (3 categories)
    const catCheck = await client.query('SELECT COUNT(*) FROM categories');
    let catIds = [];
    if (parseInt(catCheck.rows[0].count) === 0) {
      const cats = [
        ['Artisan Homeware', 'artisan-homeware', '🏺', 'Handcrafted ceramic and clay wares for everyday living', 1],
        ['Handmade Textiles', 'handmade-textiles', '🧵', 'Woven blankets, runners, and decorative cushion covers', 2],
        ['Natural Botanicals', 'natural-botanicals', '🌿', 'Pure herbal infusions and botanical wellness goods', 3]
      ];
      for (const [name, slug, icon, desc, order] of cats) {
        const res = await client.query(
          'INSERT INTO categories (name, slug, icon, description, display_order) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [name, slug, icon, desc, order]
        );
        catIds.push(res.rows[0].id);
      }
      console.log('  ✅ Seeded 3 demo categories');
    } else {
      const existingCats = await client.query('SELECT id FROM categories ORDER BY id ASC LIMIT 3');
      catIds = existingCats.rows.map(r => r.id);
    }

    // 4. Products (8 products)
    const prodCheck = await client.query('SELECT COUNT(*) FROM products');
    let productIds = [];
    if (parseInt(prodCheck.rows[0].count) === 0) {
      const c1 = catIds[0];
      const c2 = catIds[1] || catIds[0];
      const c3 = catIds[2] || catIds[0];

      const prods = [
        ['Ceramic Pitcher', 'Handmade ceramic pitcher with textured glaze', 85.00, c1, 'default.jpg', 1, 1, 15, 1],
        ['Clay Bowl Set', 'Set of 3 earthenware bowls for dining and serving', 120.00, c1, 'default.jpg', 1, 1, 20, 1],
        ['Terracotta Planter', 'Natural terracotta planter with drainage plate', 65.00, c1, 'default.jpg', 0, 1, 30, 1],
        ['Woven Throw Blanket', 'Soft woven cotton throw with fringe accents', 210.00, c2, 'default.jpg', 1, 1, 12, 1],
        ['Linen Table Runner', 'Pure linen runner for festive and daily table decor', 140.00, c2, 'default.jpg', 0, 1, 25, 1],
        ['Cotton Cushion Cover', 'Hand-stitched cushion cover in earthy neutrals', 95.00, c2, 'default.jpg', 0, 1, 18, 1],
        ['Organic Herbal Infusion', 'Dried chamomile and wild mint leaves infusion', 45.00, c3, 'default.jpg', 1, 1, 50, 1],
        ['Aromatic Botanical Balm', 'Soothing handcrafted herbal balm with beeswax', 75.00, c3, 'default.jpg', 0, 1, 40, 1]
      ];

      for (const p of prods) {
        const res = await client.query(`
          INSERT INTO products (name, description, price, category_id, image, featured, available, stock, trackStock)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
        `, p);
        productIds.push(res.rows[0].id);
      }
      console.log('  ✅ Seeded 8 demo products');
    } else {
      const existingProds = await client.query('SELECT id FROM products ORDER BY id ASC LIMIT 8');
      productIds = existingProds.rows.map(r => r.id);
    }

    // 5. Orders (3 sample orders)
    const ordCheck = await client.query('SELECT COUNT(*) FROM orders');
    if (parseInt(ordCheck.rows[0].count) === 0) {
      const orders = [
        ['Jane Doe', '+212 6 11 11 11 11', 'jane.doe@example.com', '14 Palm Avenue', 'Casablanca', 'delivered', 205.00, 'Left at front desk'],
        ['John Smith', '+212 6 22 22 22 22', 'john.smith@example.com', '82 Olive Boulevard', 'Rabat', 'confirmed', 210.00, 'Call upon arrival'],
        ['Alice Martin', '+212 6 33 33 33 33', 'alice.martin@example.com', '5 Atlas Road', 'Marrakech', 'pending', 130.00, '']
      ];

      for (const o of orders) {
        const res = await client.query(`
          INSERT INTO orders (customer_name, customer_phone, customer_email, customer_address, customer_city, status, total, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
        `, o);
        const orderId = res.rows[0].id;

        // add 1-2 items per order
        const p1 = productIds[0] || 1;
        await client.query(`
          INSERT INTO order_items (order_id, product_id, product_name, quantity, price)
          VALUES ($1, $2, 'Demo Artisan Item', 1, $3)
        `, [orderId, p1, o[6]]);
      }
      console.log('  ✅ Seeded 3 sample demo orders');
    }

    console.log('🎉 Demo seeding complete!');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
