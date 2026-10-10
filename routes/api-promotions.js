const express = require('express');
const { authenticateToken } = require('../middleware/auth');

function createPromotionRoutes(db) {
  const router = express.Router();

  // POST /api/promotions/validate — public: validate a promo code
  router.post('/validate', async (req, res) => {
    try {
      const { code, cartTotal, cartProductIds = [] } = req.body;
      if (!code) return res.status(400).json({ error: 'Code is required.' });

      // Changed COLLATE NOCASE to LOWER()
      const promo = await db.get('SELECT id, code, type, value, minimumorder AS "minimumOrder", expirydate AS "expiryDate", active, scope, targetproducts AS "targetProducts", usagecount AS "usageCount", created_at FROM promotions WHERE LOWER(code) = LOWER(?)', [code.trim()]);
      if (!promo) return res.status(400).json({ error: 'Code invalide ou expiré.' });
      
      if (!promo.active) {
        return res.status(400).json({ error: 'Ce code promo est actuellement désactivé.' });
      }

      if (promo.scope === 'specific_products') {
        try {
          const targetIds = JSON.parse(promo.targetProducts || '[]');
          const hasMatch = cartProductIds.some(id => targetIds.includes(String(id)) || targetIds.includes(Number(id)));
          if (!hasMatch) {
            return res.status(400).json({ error: "Ce code promo ne s'applique pas aux produits dans votre panier." });
          }
        } catch (e) {
          console.error('Error parsing targetProducts', e);
        }
      }

      // Check expiry
      if (promo.expiryDate) {
        const expiry = new Date(promo.expiryDate);
        if (expiry < new Date()) return res.status(400).json({ error: 'Code invalide ou expiré.' });
      }

      // Check minimum order
      const total = parseFloat(cartTotal) || 0;
      if (promo.minimumOrder && total < promo.minimumOrder) {
        return res.status(400).json({ error: `Montant minimum de commande: ${promo.minimumOrder} MAD.` });
      }

      // Calculate discount
      let discount = 0;
      if (promo.type === 'percentage') {
        discount = total * (promo.value / 100);
      } else {
        discount = Math.min(promo.value, total);
      }
      discount = Math.round(discount * 100) / 100;

      res.json({
        valid: true,
        promotion: {
          id: promo.id,
          code: promo.code,
          type: promo.type,
          value: promo.value,
          minimumOrder: promo.minimumOrder,
          expiryDate: promo.expiryDate
        },
        discount
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // GET /api/promotions/available — public: check if any active promo codes exist
  router.get('/available', async (req, res) => {
    try {
      const now = new Date().toISOString().slice(0, 10);
      const active = await db.get(
        "SELECT id FROM promotions WHERE active = 1 AND (expiryDate IS NULL OR expiryDate >= ?) LIMIT 1",
        [now]
      );
      res.json({ hasActivePromo: !!active });
    } catch (err) {
      res.json({ hasActivePromo: false });
    }
  });

  // GET /api/promotions — list all (admin only)
  router.get('/', authenticateToken, async (req, res) => {
    try {
      const promos = await db.all('SELECT id, code, type, value, minimumorder AS "minimumOrder", expirydate AS "expiryDate", active, scope, targetproducts AS "targetProducts", usagecount AS "usageCount", created_at FROM promotions ORDER BY created_at DESC');
      res.json(promos);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // POST /api/promotions — create (admin only)
  router.post('/', authenticateToken, async (req, res) => {
    try {
      const { code, type, value, minimumOrder, expiryDate, active, scope, targetProducts } = req.body;
      if (!code || !type || value === undefined) {
        return res.status(400).json({ error: 'Code, type, and value are required.' });
      }
      if (!['percentage', 'fixed'].includes(type)) {
        return res.status(400).json({ error: 'Type must be percentage or fixed.' });
      }
      const cleanCode = code.trim().toUpperCase();
      const result = await db.run(
        'INSERT INTO promotions (code, type, value, minimumOrder, expiryDate, active, scope, targetProducts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          cleanCode, 
          type, 
          parseFloat(value), 
          parseFloat(minimumOrder) || 0, 
          expiryDate || null, 
          active !== false ? 1 : 0,
          scope || 'all',
          JSON.stringify(targetProducts || [])
        ]
      );
      const newPromo = await db.get('SELECT id, code, type, value, minimumorder AS "minimumOrder", expirydate AS "expiryDate", active, scope, targetproducts AS "targetProducts", usagecount AS "usageCount", created_at FROM promotions WHERE id = ?', [result.lastInsertRowid]);
      res.status(201).json(newPromo);
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('unique')) {
        return res.status(400).json({ error: 'Ce code existe déjà.' });
      }
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // PUT /api/promotions/:id/toggle — activate/deactivate (admin only)
  router.put('/:id/toggle', authenticateToken, async (req, res) => {
    try {
      const promo = await db.get('SELECT id, code, type, value, minimumorder AS "minimumOrder", expirydate AS "expiryDate", active, scope, targetproducts AS "targetProducts", usagecount AS "usageCount", created_at FROM promotions WHERE id = ?', [parseInt(req.params.id)]);
      if (!promo) return res.status(404).json({ error: 'Promotion not found.' });
      await db.run('UPDATE promotions SET active = ? WHERE id = ?', [promo.active ? 0 : 1, promo.id]);
      const updated = await db.get('SELECT id, code, type, value, minimumorder AS "minimumOrder", expirydate AS "expiryDate", active, scope, targetproducts AS "targetProducts", usagecount AS "usageCount", created_at FROM promotions WHERE id = ?', [promo.id]);
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // DELETE /api/promotions/:id — delete (admin only)
  router.delete('/:id', authenticateToken, async (req, res) => {
    try {
      const promo = await db.get('SELECT * FROM promotions WHERE id = ?', [parseInt(req.params.id)]);
      if (!promo) return res.status(404).json({ error: 'Promotion not found.' });
      await db.run('DELETE FROM promotions WHERE id = ?', [promo.id]);
      res.json({ message: 'Promotion deleted.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  return router;
}

module.exports = createPromotionRoutes;
