const express = require('express');
const { authenticateToken } = require('../middleware/auth');

// Helper: generate slug from name
function generateSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/&/g, 'et')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function createCategoryRoutes(db) {
  const router = express.Router();

  // GET /api/categories — list all categories (public, ordered by display_order)
  router.get('/', (req, res) => {
    try {
      const categories = db.all(`
        SELECT c.*, 
               (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) as product_count
        FROM categories c
        ORDER BY c.display_order ASC, c.name ASC
      `);
      res.json(categories);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // POST /api/categories — create (admin only)
  router.post('/', authenticateToken, (req, res) => {
    try {
      const { name, icon, description, order } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Le nom de la catégorie est requis.' });
      }

      const nameClean = name.trim();

      // Check for duplicate name
      const existing = db.get('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)', [nameClean]);
      if (existing) {
        return res.status(400).json({ error: 'Une catégorie avec ce nom existe déjà.' });
      }

      const slug = generateSlug(nameClean);
      const displayOrder = parseInt(order) || 0;

      const result = db.run(
        'INSERT INTO categories (name, slug, icon, description, display_order) VALUES (?, ?, ?, ?, ?)',
        [nameClean, slug, icon || '', description || '', displayOrder]
      );

      const newCat = db.get('SELECT * FROM categories WHERE id = ?', [result.lastInsertRowid]);
      res.status(201).json(newCat);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // PUT /api/categories/:id — update (admin only)
  router.put('/:id', authenticateToken, (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = db.get('SELECT * FROM categories WHERE id = ?', [id]);
      if (!existing) return res.status(404).json({ error: 'Catégorie introuvable.' });

      const { name, icon, description, order } = req.body;

      // Check for duplicate name (excluding current category)
      if (name && name.trim().toLowerCase() !== existing.name.toLowerCase()) {
        const duplicate = db.get(
          'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id != ?',
          [name.trim(), id]
        );
        if (duplicate) {
          return res.status(400).json({ error: 'Une catégorie avec ce nom existe déjà.' });
        }
      }

      const newName = name ? name.trim() : existing.name;
      const newSlug = name ? generateSlug(newName) : existing.slug;
      const newIcon = icon !== undefined ? icon : existing.icon;
      const newDesc = description !== undefined ? description : existing.description;
      const newOrder = order !== undefined ? parseInt(order) : existing.display_order;

      db.run(
        'UPDATE categories SET name = ?, slug = ?, icon = ?, description = ?, display_order = ? WHERE id = ?',
        [newName, newSlug, newIcon, newDesc, newOrder, id]
      );

      const updated = db.get(`
        SELECT c.*, 
               (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) as product_count
        FROM categories c WHERE c.id = ?
      `, [id]);
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // DELETE /api/categories/:id — delete (admin only, blocked if products exist)
  router.delete('/:id', authenticateToken, (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = db.get('SELECT * FROM categories WHERE id = ?', [id]);
      if (!existing) return res.status(404).json({ error: 'Catégorie introuvable.' });

      // Check for products in this category
      const productCount = db.get(
        'SELECT COUNT(*) as count FROM products WHERE category_id = ?', [id]
      );
      const count = productCount ? productCount.count : 0;

      if (count > 0) {
        return res.status(400).json({
          error: `Impossible de supprimer cette catégorie car elle contient ${count} produit(s). Veuillez d'abord déplacer ou supprimer ces produits.`
        });
      }

      db.run('DELETE FROM categories WHERE id = ?', [id]);
      res.json({ message: 'Catégorie supprimée.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  return router;
}

module.exports = createCategoryRoutes;
