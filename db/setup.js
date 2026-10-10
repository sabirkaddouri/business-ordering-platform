const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

let dbPool = null;
let helperInstance = null;

async function initDatabase() {
  dbPool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  const DbHelper = require('./helper');
  const db = new DbHelper(dbPool);
  helperInstance = db;

  // Create tables
  await db.run(`
    CREATE TABLE IF NOT EXISTS admin (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE,
      icon TEXT DEFAULT '🍰',
      description TEXT,
      display_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Migration: Add new columns to categories if they don't exist
  try { await db.run("ALTER TABLE categories ADD COLUMN slug TEXT"); } catch(e) {}
  try { await db.run("ALTER TABLE categories ADD COLUMN description TEXT"); } catch(e) {}
  try { await db.run("ALTER TABLE categories ADD COLUMN display_order INTEGER DEFAULT 0"); } catch(e) {}
  try { await db.run("ALTER TABLE categories ADD COLUMN created_at TIMESTAMP DEFAULT NOW()"); } catch(e) {}

  await db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      category_id INTEGER,
      image TEXT DEFAULT 'default.jpg',
      featured INTEGER DEFAULT 0,
      available INTEGER DEFAULT 1,
      stock INTEGER DEFAULT 0,
      trackStock INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);

  // Migration: Add stock columns to products if not exists
  try { await db.run('ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0'); } catch(e) {}
  try { await db.run('ALTER TABLE products ADD COLUMN trackStock INTEGER DEFAULT 0'); } catch(e) {}

  await db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT,
      customer_address TEXT NOT NULL,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      total REAL NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Migration: Add admin_note column if not exists
  try { await db.run("ALTER TABLE orders ADD COLUMN admin_note TEXT DEFAULT ''"); } catch (e) {}

  // Migration: Add customer_city column if not exists
  try { await db.run("ALTER TABLE orders ADD COLUMN customer_city TEXT DEFAULT ''"); } catch (e) {}

  await db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      description TEXT,
      address TEXT,
      googleMapsLink TEXT,
      phone TEXT,
      openHours TEXT,
      paymentTerms TEXT,
      deliveryZones TEXT,
      siteName TEXT,
      minOrderAmount REAL,
      deliveryFee REAL,
      freeDeliveryThreshold REAL,
      taxEnabled INTEGER DEFAULT 0,
      taxRate REAL,
      storeOpen INTEGER DEFAULT 1,
      storeClosedMessage TEXT,
      orderWhatsapp TEXT,
      orderEmail TEXT,
      instagramLink TEXT,
      facebookLink TEXT
    )
  `);

  // Migration: Add new settings columns if not exists
  const newCols = [
    "siteName TEXT", "minOrderAmount REAL", "deliveryFee REAL", "freeDeliveryThreshold REAL",
    "taxEnabled INTEGER DEFAULT 0", "taxRate REAL", "storeOpen INTEGER DEFAULT 1",
    "storeClosedMessage TEXT", "orderWhatsapp TEXT", "orderEmail TEXT",
    "instagramLink TEXT", "facebookLink TEXT"
  ];
  for (const colDef of newCols) {
    try {
      await db.run(`ALTER TABLE settings ADD COLUMN ${colDef}`);
    } catch (e) {}
  }

  // Promotions table
  await db.run(`
    CREATE TABLE IF NOT EXISTS promotions (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL DEFAULT 'percentage',
      value REAL NOT NULL DEFAULT 0,
      minimumOrder REAL DEFAULT 0,
      expiryDate TEXT,
      active INTEGER DEFAULT 1,
      usageCount INTEGER DEFAULT 0,
      scope TEXT DEFAULT 'all',
      targetProducts TEXT DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  try { await db.run("ALTER TABLE promotions ADD COLUMN active INTEGER DEFAULT 1"); } catch (e) {}
  try { await db.run("ALTER TABLE promotions ADD COLUMN scope TEXT DEFAULT 'all'"); } catch (e) {}
  try { await db.run("ALTER TABLE promotions ADD COLUMN targetProducts TEXT DEFAULT '[]'"); } catch (e) {}

  // Notifications table
  await db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      type TEXT DEFAULT 'new_order',
      message TEXT NOT NULL,
      orderId INTEGER,
      read INTEGER DEFAULT 0,
      createdAt TIMESTAMP DEFAULT NOW()
    )
  `);

  // Seed admin if not exists
  const adminCount = await db.get('SELECT COUNT(*) as count FROM admin');
  if (parseInt(adminCount.count) === 0) {
    if (!process.env.ADMIN_PASSWORD) {
      throw new Error('FATAL ERROR: ADMIN_PASSWORD environment variable is not set. A secure password must be provided to seed the initial admin account.');
    }
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const hashedPassword = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);
    await db.run('INSERT INTO admin (username, password) VALUES (?, ?)', [adminUsername, hashedPassword]);
    console.log(`✅ Admin account created (${adminUsername})`);
  }

  // Seed O Souly categories if table is empty
  const catCount = await db.get('SELECT COUNT(*) as count FROM categories');
  if (parseInt(catCount.count) === 0) {
    const categories = [
      ['Miels & Tartinades',    'miels-tartinades',    '🍯', 'Miels artisanaux et tartinades 100% naturelles', 1],
      ['Huiles Extra Vierge',   'huiles-extra-vierge', '🫒', "Huiles d'olive extra vierge du Maroc", 2],
      ['Épices & Aromates',     'epices-aromates',     '🌿', 'Épices et aromates sélectionnés à Marrakech', 3],
      ['Tisanes',               'tisanes',             '🍵', 'Tisanes et infusions 100% naturelles', 4],
      ['Cosmétiques',           'cosmetiques',         '🧴', 'Cosmétiques naturels du terroir marocain', 5]
    ];
    for (const [name, slug, icon, description, display_order] of categories) {
      await db.run(
        'INSERT INTO categories (name, slug, icon, description, display_order) VALUES (?, ?, ?, ?, ?)',
        [name, slug, icon, description, display_order]
      );
    }
    console.log('✅ O Souly categories seeded');
  } else {
    // Migration: backfill slugs for existing categories that don't have one
    const catsWithoutSlug = await db.all("SELECT id, name FROM categories WHERE slug IS NULL OR slug = ''");
    if (catsWithoutSlug) {
      for (const cat of catsWithoutSlug) {
        const slug = cat.name
          .toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        await db.run('UPDATE categories SET slug = ? WHERE id = ?', [slug, cat.id]);
      }
    }
  }

  // Seed products if not exists
  const prodCount = await db.get('SELECT COUNT(*) as count FROM products');
  if (parseInt(prodCount.count) === 0) {
    const products = [
      ['Cornes de Gazelle', 'Traditional Moroccan pastry with sweet almond paste and orange blossom water', 15.00, 1, 'default.jpg', 1],
      ['Briouates aux Amandes', 'Crispy sweet pastries folded into triangles, stuffed with almond paste and coated in pure honey', 12.00, 1, 'default.jpg', 1],
      ['Chebakia', 'Flower-shaped Moroccan sesame cookie, fried, coated with honey and sesame seeds', 18.00, 1, 'default.jpg', 1],
      ['Ghriba', 'Traditional Moroccan cracked cookie, crunchy on the outside and chewy inside', 10.00, 1, 'default.jpg', 0],
      ['Croissant', 'Buttery, flaky, golden classic French croissant baked fresh daily', 8.00, 2, 'default.jpg', 1],
      ['Eclair au Chocolat', 'Choux pastry filled with rich chocolate custard and topped with chocolate glaze', 15.00, 2, 'default.jpg', 0],
      ['Macaron', 'Delicate French meringue-based confection filled with chocolate ganache or raspberry', 12.00, 2, 'default.jpg', 0],
      ['Pain au Chocolat', 'Classic French puff pastry with dark chocolate bars inside', 9.00, 2, 'default.jpg', 0],
      ['Mille-feuille', 'Layers of puff pastry and vanilla pastry cream, topped with traditional icing sugar', 18.00, 2, 'default.jpg', 1],
      ['Tarte aux Fraises', 'Sweet tart pastry crust filled with crème pâtissière and topped with fresh strawberries', 25.00, 2, 'default.jpg', 0],
      ['Celebration Chocolate Cake', 'Premium chocolate cake with rich ganache frosting, perfect for any special occasion', 250.00, 3, 'default.jpg', 1],
      ['Traditional Moroccan Bread (Khobz)', 'Freshly baked traditional round crusty Moroccan bread, perfect with tea', 3.00, 4, 'default.jpg', 0],
      ['Moroccan Mint Tea', 'Fresh mint tea brewed with green gunpowder tea, served steaming hot', 10.00, 5, 'default.jpg', 0],
      ['Seasonal Almond Fruit Tart', 'Fresh seasonal fruits on a rich almond cream baked in a sweet crust', 35.00, 6, 'default.jpg', 1]
    ];
    for (const p of products) {
      await db.run('INSERT INTO products (name, description, price, category_id, image, featured) VALUES (?, ?, ?, ?, ?, ?)', p);
    }
    console.log('✅ Sample products seeded');
  }

  // Migration: Add WhatsApp settings fields
  try {
    await db.run("ALTER TABLE settings ADD COLUMN whatsappAdminNumber TEXT DEFAULT ''");
    await db.run("ALTER TABLE settings ADD COLUMN whatsappEnabled INTEGER DEFAULT 1");
    await db.run("ALTER TABLE settings ADD COLUMN whatsappTemplateConfirmation TEXT DEFAULT ''");
    await db.run("ALTER TABLE settings ADD COLUMN whatsappTemplateShipped TEXT DEFAULT ''");
    await db.run("ALTER TABLE settings ADD COLUMN whatsappTemplateDelivered TEXT DEFAULT ''");
    await db.run("ALTER TABLE settings ADD COLUMN whatsappTemplateCancelled TEXT DEFAULT ''");
  } catch(e) {}

  // Migration: Add whatsappLog to orders
  try {
    await db.run("ALTER TABLE orders ADD COLUMN whatsappLog TEXT DEFAULT '[]'");
  } catch(e) {}

  return dbPool; // return the connected Pool so server.js can wrap it
}

function saveDatabase() {
  // No-op for postgres
}

function getDb() {
  return helperInstance;
}

module.exports = { initDatabase, saveDatabase, getDb };
