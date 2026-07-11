const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Use process.env.SQLITE_DB_PATH if set, so DB file can be stored on a persistent volume in production (e.g. Railway)
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, 'store.db');

let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    const tempDb = new SQL.Database(fileBuffer);
    let needsMigration = false;
    try {
      const checkCupcakes = tempDb.exec("SELECT COUNT(*) as count FROM categories WHERE name = 'Cupcakes'");
      if (checkCupcakes[0] && checkCupcakes[0].values[0][0] > 0) {
        needsMigration = true;
      }
    } catch (e) {
      // Safe to ignore
    } finally {
      tempDb.close();
    }

    if (needsMigration) {
      console.log('🔄 Old database detected. Migrating to Kawthar Boulangerie Marrakech schema...');
      try {
        fs.unlinkSync(DB_PATH);
      } catch (err) {
        console.error('Failed to delete old DB, will try to clear manually', err);
      }
      db = new SQL.Database();
    } else {
      db = new SQL.Database(fileBuffer);
    }
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      icon TEXT DEFAULT '🍰'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      category_id INTEGER,
      image TEXT DEFAULT 'default.jpg',
      featured INTEGER DEFAULT 0,
      available INTEGER DEFAULT 1,
      stock INTEGER DEFAULT 0,
      trackStock INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);

  // Migration: Add stock columns to products if not exists
  try { db.run('ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0'); } catch(e) {}
  try { db.run('ALTER TABLE products ADD COLUMN trackStock INTEGER DEFAULT 0'); } catch(e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT,
      customer_address TEXT NOT NULL,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      total REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: Add admin_note column if not exists
  try {
    db.run("ALTER TABLE orders ADD COLUMN admin_note TEXT DEFAULT ''");
  } catch (e) {
    // Column already exists, safe to ignore
  }

  // Migration: Add customer_city column if not exists (new orders will have it; existing orders get NULL)
  try {
    db.run("ALTER TABLE orders ADD COLUMN customer_city TEXT DEFAULT ''");
  } catch (e) {
    // Column already exists, safe to ignore
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      db.run(`ALTER TABLE settings ADD COLUMN ${colDef}`);
    } catch (e) {
      // Column already exists, safe to ignore
    }
  }

  // Promotions table
  db.run(`
    CREATE TABLE IF NOT EXISTS promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL DEFAULT 'percentage',
      value REAL NOT NULL DEFAULT 0,
      minimumOrder REAL DEFAULT 0,
      expiryDate TEXT,
      active INTEGER DEFAULT 1,
      usageCount INTEGER DEFAULT 0,
      scope TEXT DEFAULT 'all',
      targetProducts TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try { db.run("ALTER TABLE promotions ADD COLUMN active INTEGER DEFAULT 1"); } catch (e) {}
  try { db.run("ALTER TABLE promotions ADD COLUMN scope TEXT DEFAULT 'all'"); } catch (e) {}
  try { db.run("ALTER TABLE promotions ADD COLUMN targetProducts TEXT DEFAULT '[]'"); } catch (e) {}


  // Notifications table
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT DEFAULT 'new_order',
      message TEXT NOT NULL,
      orderId INTEGER,
      read INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed admin if not exists
  const adminCount = db.exec('SELECT COUNT(*) as count FROM admin');
  if (adminCount[0].values[0][0] === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.run('INSERT INTO admin (username, password) VALUES (?, ?)', ['admin', hashedPassword]);
    console.log('✅ Default admin created (admin / admin123)');
  }

  // Seed categories if not exists
  const catCount = db.exec('SELECT COUNT(*) as count FROM categories');
  if (catCount[0].values[0][0] === 0) {
    const categories = [
      ['Moroccan Pastries', '🇲🇦'],
      ['French Pastries', '🥐'],
      ['Cakes', '🎂'],
      ['Bread', '🥖'],
      ['Drinks', '☕'],
      ['Seasonal', '🍁']
    ];
    for (const [name, icon] of categories) {
      db.run('INSERT INTO categories (name, icon) VALUES (?, ?)', [name, icon]);
    }
    console.log('✅ Categories seeded');
  }

  // Seed products if not exists
  const prodCount = db.exec('SELECT COUNT(*) as count FROM products');
  if (prodCount[0].values[0][0] === 0) {
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
      db.run('INSERT INTO products (name, description, price, category_id, image, featured) VALUES (?, ?, ?, ?, ?, ?)', p);
    }
    console.log('✅ Sample products seeded');
  }

  // Save to disk
  saveDatabase();

  return db;
}

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function getDb() {
  return db;
}

module.exports = { initDatabase, saveDatabase, getDb, DB_PATH };
