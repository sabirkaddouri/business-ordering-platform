const express = require('express');
const { authenticateToken } = require('../middleware/auth');

function createOrderRoutes(db) {
  const router = express.Router();
  const otpStore = new Map();

  // POST /api/orders/send-otp (mock SMS agent)
  router.post('/send-otp', (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone is required.' });
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(phone, {
      code,
      expires: Date.now() + 5 * 60 * 1000 // 5 minutes
    });

    console.log(`\n=== 📱 MOCK SMS AGENT ===\nTo: ${phone}\nMessage: Your Kawthar Boulangerie Patisserie OTP is ${code}. Expires in 5m.\n=========================\n`);
    res.json({ message: 'OTP sent successfully.' });
  });

  // GET /api/orders/stats/summary — dashboard stats (admin only)
  router.get('/stats/summary', authenticateToken, (req, res) => {
    try {
      const totalOrders = db.get('SELECT COUNT(*) as count FROM orders');
      const pendingOrders = db.get("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'");
      const totalRevenue = db.get('SELECT COALESCE(SUM(total), 0) as sum FROM orders');
      const totalProducts = db.get('SELECT COUNT(*) as count FROM products');
      const todayOrders = db.get(
        "SELECT COUNT(*) as count FROM orders WHERE date(created_at) = date('now')"
      );

      res.json({
        totalOrders: totalOrders.count,
        pendingOrders: pendingOrders.count,
        totalRevenue: Math.round(totalRevenue.sum * 100) / 100,
        totalProducts: totalProducts.count,
        todayOrders: todayOrders.count
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // POST /api/orders — place order (public)
  router.post('/', (req, res) => {
    try {
      const { customer_name, customer_phone, customer_email, customer_address, customer_city, notes, items, otp, promoCode } = req.body;

      const nameClean = customer_name ? customer_name.trim() : '';
      const phoneClean = customer_phone ? customer_phone.trim() : '';
      const emailClean = customer_email ? customer_email.trim().toLowerCase() : '';
      const addressClean = customer_address ? customer_address.trim() : '';
      const cityClean = customer_city ? customer_city.trim() : '';
      const notesClean = notes ? notes.trim() : '';

      if (!nameClean || !phoneClean || !addressClean) {
        return res.status(400).json({ error: 'Name, phone, and address are required.' });
      }

      if (emailClean && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
        return res.status(400).json({ error: 'Invalid email address format.' });
      }

      // Validate OTP if required by environment or if OTP code is supplied
      if (process.env.ENFORCE_OTP === 'true' || otp !== undefined) {
        const stored = otpStore.get(phoneClean);
        if (!stored || stored.code !== otp || Date.now() > stored.expires) {
          return res.status(400).json({ error: 'Invalid or expired verification code.' });
        }
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'At least one item is required.' });
      }

      // Validate all items and calculate subtotal
      let subtotal = 0;
      const validatedItems = [];

      for (const item of items) {
        const product = db.get('SELECT * FROM products WHERE id = ? AND available = 1', [parseInt(item.product_id)]);
        if (!product) {
          return res.status(400).json({ error: `Product not found or unavailable: ID ${item.product_id}` });
        }
        const qty = parseInt(item.quantity) || 1;
        subtotal += product.price * qty;
        validatedItems.push({
          product_id: product.id,
          product_name: product.name,
          quantity: qty,
          price: product.price
        });
      }

      // Apply Settings to Total
      const settingsRow = db.get('SELECT * FROM settings ORDER BY id DESC LIMIT 1') || {};
      if (settingsRow.storeOpen === 0) {
        return res.status(400).json({ error: 'The store is currently closed.' });
      }
      
      const minOrder = settingsRow.minOrderAmount || 0;
      if (minOrder > 0 && subtotal < minOrder) {
        return res.status(400).json({ error: `Minimum order amount is ${minOrder} MAD.` });
      }

      let finalDeliveryFee = settingsRow.deliveryFee || 0;
      if (settingsRow.freeDeliveryThreshold && subtotal >= settingsRow.freeDeliveryThreshold) {
        finalDeliveryFee = 0;
      }

      let finalTotal = subtotal + finalDeliveryFee;

      if (settingsRow.taxEnabled === 1 && settingsRow.taxRate > 0) {
        finalTotal += finalTotal * (settingsRow.taxRate / 100);
      }

      // Apply promo code discount if provided
      let appliedPromo = null;
      let discountAmount = 0;
      if (promoCode) {
        const promo = db.get('SELECT * FROM promotions WHERE code = ? COLLATE NOCASE AND active = 1', [promoCode.trim().toUpperCase()]);
        if (promo) {
          const notExpired = !promo.expiryDate || new Date(promo.expiryDate) >= new Date();
          const meetsMin = !promo.minimumOrder || subtotal >= promo.minimumOrder;
          if (notExpired && meetsMin) {
            if (promo.type === 'percentage') {
              discountAmount = finalTotal * (promo.value / 100);
            } else {
              discountAmount = Math.min(promo.value, finalTotal);
            }
            finalTotal = Math.max(0, finalTotal - discountAmount);
            appliedPromo = promo;
          }
        }
      }

      const total = Math.round(finalTotal * 100) / 100;

      // Insert order using cleaned inputs
      const orderResult = db.run(
        'INSERT INTO orders (customer_name, customer_phone, customer_email, customer_address, customer_city, notes, total) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [nameClean, phoneClean, emailClean, addressClean, cityClean, notesClean, total]
      );

      const orderId = orderResult.lastInsertRowid;

      // Insert order items
      for (const item of validatedItems) {
        db.run(
          'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)',
          [orderId, item.product_id, item.product_name, item.quantity, item.price]
        );
        // Decrement stock if trackStock is enabled
        db.run(
          'UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ? AND trackStock = 1',
          [item.quantity, item.product_id]
        );
      }

      // Increment promo usage count if a promo was applied
      if (appliedPromo) {
        db.run('UPDATE promotions SET usageCount = usageCount + 1 WHERE id = ?', [appliedPromo.id]);
      }

      // Create notification for new order
      const order = db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
      const notifMsg = `Nouvelle commande #${orderId} de ${nameClean} — ${total} MAD`;
      db.run(
        'INSERT INTO notifications (type, message, orderId) VALUES (?, ?, ?)',
        ['new_order', notifMsg, orderId]
      );

      const orderItems = db.all('SELECT oi.*, p.image FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?', [orderId]);

      otpStore.delete(phoneClean);
      res.status(201).json({ ...order, items: orderItems });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // GET /api/orders — list all orders (admin only)
  router.get('/', authenticateToken, (req, res) => {
    try {
      const { status, page = 1, limit = 50 } = req.query;
      let sql = 'SELECT * FROM orders';
      const params = [];

      if (status) {
        sql += ' WHERE status = ?';
        params.push(status);
      }

      sql += ' ORDER BY created_at DESC';
      sql += ` LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

      const orders = db.all(sql, params);

      // Attach items to each order
      const ordersWithItems = orders.map(order => ({
        ...order,
        items: db.all('SELECT oi.*, p.image FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?', [order.id])
      }));

      // Count totals
      let countSql = 'SELECT COUNT(*) as total FROM orders';
      const countParams = [];
      if (status) {
        countSql += ' WHERE status = ?';
        countParams.push(status);
      }
      const countResult = db.get(countSql, countParams);

      res.json({
        orders: ordersWithItems,
        total: countResult.total,
        page: parseInt(page),
        pages: Math.ceil(countResult.total / parseInt(limit))
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // GET /api/orders/:id — single order (admin only)
  router.get('/:id', authenticateToken, (req, res) => {
    try {
      const order = db.get('SELECT * FROM orders WHERE id = ?', [parseInt(req.params.id)]);
      if (!order) return res.status(404).json({ error: 'Order not found.' });

      const items = db.all('SELECT oi.*, p.image FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?', [order.id]);
      res.json({ ...order, items });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // PUT /api/orders/:id/status — update order status (admin only)
  router.put('/:id/status', authenticateToken, (req, res) => {
    try {
      const { status } = req.body;
      const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];

      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
      }

      const existing = db.get('SELECT * FROM orders WHERE id = ?', [parseInt(req.params.id)]);
      if (!existing) return res.status(404).json({ error: 'Order not found.' });

      db.run('UPDATE orders SET status = ? WHERE id = ?', [status, parseInt(req.params.id)]);
      const updated = db.get('SELECT * FROM orders WHERE id = ?', [parseInt(req.params.id)]);
      const items = db.all('SELECT oi.*, p.image FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?', [updated.id]);

      res.json({ ...updated, items });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // PUT /api/orders/:id/admin-note — update admin note (admin only)
  router.put('/:id/admin-note', authenticateToken, (req, res) => {
    try {
      const { admin_note } = req.body;
      const existing = db.get('SELECT * FROM orders WHERE id = ?', [parseInt(req.params.id)]);
      if (!existing) return res.status(404).json({ error: 'Order not found.' });

      db.run('UPDATE orders SET admin_note = ? WHERE id = ?', [admin_note || '', parseInt(req.params.id)]);
      const updated = db.get('SELECT * FROM orders WHERE id = ?', [parseInt(req.params.id)]);
      const items = db.all('SELECT oi.*, p.image FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?', [updated.id]);

      res.json({ ...updated, items });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  // DELETE /api/orders/:id — delete order (admin only)
  router.delete('/:id', authenticateToken, (req, res) => {
    try {
      const existing = db.get('SELECT * FROM orders WHERE id = ?', [parseInt(req.params.id)]);
      if (!existing) return res.status(404).json({ error: 'Order not found.' });

      db.run('DELETE FROM order_items WHERE order_id = ?', [parseInt(req.params.id)]);
      db.run('DELETE FROM orders WHERE id = ?', [parseInt(req.params.id)]);
      res.json({ message: 'Order deleted.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

  return router;
}

module.exports = createOrderRoutes;
