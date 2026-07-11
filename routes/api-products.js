const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

// Configure multer for image uploads with optional Cloudinary support for production
let storage;

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  const cloudinary = require('cloudinary').v2;
  const { CloudinaryStorage } = require('multer-storage-cloudinary');

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'sweet-delights',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp']
    }
  });
} else {
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, '..', 'public', 'images');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
      cb(null, uniqueName);
    }
  });
}

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Only image files are allowed.'));
  }
});

function createProductRoutes(db) {
  const router = express.Router();

  // GET /api/products/meta/categories — list all categories (public)
  router.get('/meta/categories', (req, res) => {
    try {
      const categories = db.all('SELECT * FROM categories ORDER BY name');
      res.json(categories);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // GET /api/products — list all (public)
  router.get('/', (req, res) => {
    try {
      const { category, featured, available } = req.query;
      let sql = `SELECT p.*, c.name as category_name, c.icon as category_icon 
                 FROM products p 
                 LEFT JOIN categories c ON p.category_id = c.id`;
      const conditions = [];
      const params = [];

      if (category) {
        conditions.push('c.name = ?');
        params.push(category);
      }
      if (featured !== undefined) {
        conditions.push('p.featured = ?');
        params.push(parseInt(featured));
      }
      if (available !== undefined) {
        conditions.push('p.available = ?');
        params.push(parseInt(available));
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      sql += ' ORDER BY p.featured DESC, p.created_at DESC';

      const products = db.all(sql, params);
      res.json(products);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // GET /api/products/:id — single product (public)
  router.get('/:id', (req, res) => {
    try {
      const product = db.get(
        `SELECT p.*, c.name as category_name, c.icon as category_icon 
         FROM products p 
         LEFT JOIN categories c ON p.category_id = c.id 
         WHERE p.id = ?`,
        [parseInt(req.params.id)]
      );

      if (!product) return res.status(404).json({ error: 'Product not found.' });
      res.json(product);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // POST /api/products — create (admin only)
  router.post('/', authenticateToken, upload.single('image'), (req, res) => {
    try {
      const { name, description, price, category_id, featured, available, stock, trackStock } = req.body;

      if (!name || price === undefined) {
        return res.status(400).json({ error: 'Name and price are required.' });
      }

      const nameClean = name.trim();
      if (!nameClean) {
        return res.status(400).json({ error: 'Name cannot be empty.' });
      }

      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum < 0) {
        return res.status(400).json({ error: 'Price must be a valid positive number.' });
      }

      const image = req.file 
        ? (req.file.path && req.file.path.startsWith('http') ? req.file.path : req.file.filename) 
        : 'default.jpg';
      const result = db.run(
        'INSERT INTO products (name, description, price, category_id, image, featured, available, stock, trackStock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [nameClean, description || '', priceNum, parseInt(category_id) || null, image, featured ? 1 : 0, available !== undefined ? parseInt(available) : 1, parseInt(stock) || 0, trackStock ? 1 : 0]
      );

      const newProduct = db.get('SELECT * FROM products WHERE id = ?', [result.lastInsertRowid]);
      res.status(201).json(newProduct);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // PUT /api/products/:id — update (admin only)
  router.put('/:id', authenticateToken, upload.single('image'), (req, res) => {
    try {
      const existing = db.get('SELECT * FROM products WHERE id = ?', [parseInt(req.params.id)]);
      if (!existing) return res.status(404).json({ error: 'Product not found.' });

      const { name, description, price, category_id, featured, available, stock, trackStock } = req.body;
      
      if (price !== undefined) {
        const priceNum = parseFloat(price);
        if (isNaN(priceNum) || priceNum < 0) {
          return res.status(400).json({ error: 'Price must be a valid positive number.' });
        }
      }

      const image = req.file 
        ? (req.file.path && req.file.path.startsWith('http') ? req.file.path : req.file.filename) 
        : existing.image;

      // Delete old local image if a new one is uploaded and the old one was local
      if (req.file && existing.image && existing.image !== 'default.jpg' && !existing.image.startsWith('http')) {
        const oldPath = path.join(__dirname, '..', 'public', 'images', existing.image);
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch (err) {
            console.error('Failed to delete old local image file:', err);
          }
        }
      }

      const priceVal = price ? parseFloat(price) : existing.price;

      db.run(
        `UPDATE products SET name=?, description=?, price=?, category_id=?, image=?, featured=?, available=?, stock=?, trackStock=? WHERE id=?`,
        [
          name ? name.trim() : existing.name,
          description !== undefined ? description : existing.description,
          priceVal,
          category_id !== undefined ? (parseInt(category_id) || null) : existing.category_id,
          image,
          featured !== undefined ? parseInt(featured) : existing.featured,
          available !== undefined ? parseInt(available) : existing.available,
          stock !== undefined ? parseInt(stock) : existing.stock,
          trackStock !== undefined ? (trackStock ? 1 : 0) : existing.trackStock,
          parseInt(req.params.id)
        ]
      );

      const updated = db.get(
        `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`,
        [parseInt(req.params.id)]
      );
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // DELETE /api/products/:id — delete (admin only)
  router.delete('/:id', authenticateToken, (req, res) => {
    try {
      const existing = db.get('SELECT * FROM products WHERE id = ?', [parseInt(req.params.id)]);
      if (!existing) return res.status(404).json({ error: 'Product not found.' });

      // Delete product image if it's local
      if (existing.image && existing.image !== 'default.jpg' && !existing.image.startsWith('http')) {
        const imgPath = path.join(__dirname, '..', 'public', 'images', existing.image);
        if (fs.existsSync(imgPath)) {
          try {
            fs.unlinkSync(imgPath);
          } catch (err) {
            console.error('Failed to delete local image file:', err);
          }
        }
      }

      db.run('DELETE FROM products WHERE id = ?', [parseInt(req.params.id)]);
      res.json({ message: 'Product deleted.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  return router;
}

module.exports = createProductRoutes;
