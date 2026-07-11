const express = require('express');
const { authenticateToken } = require('../middleware/auth');

function createSettingsRoutes(db) {
  const router = express.Router();

  // GET /api/settings/public - public route
  router.get('/public', (req, res) => {
    try {
      const row = db.get('SELECT * FROM settings ORDER BY id DESC LIMIT 1');
      if (!row) {
        return res.json({
          description: '',
          address: '',
          googleMapsLink: '',
          phone: '',
          openHours: '',
          paymentTerms: '',
          deliveryZones: '',
          siteName: '',
          minOrderAmount: 0,
          deliveryFee: 0,
          freeDeliveryThreshold: null,
          taxEnabled: false,
          taxRate: 0,
          storeOpen: true,
          storeClosedMessage: '',
          orderWhatsapp: '',
          orderEmail: '',
          instagramLink: '',
          facebookLink: ''
        });
      }
      res.json({
        description: row.description || '',
        address: row.address || '',
        googleMapsLink: row.googleMapsLink || '',
        phone: row.phone || '',
        openHours: row.openHours || '',
        paymentTerms: row.paymentTerms || '',
        deliveryZones: row.deliveryZones || '',
        siteName: row.siteName || '',
        minOrderAmount: row.minOrderAmount || 0,
        deliveryFee: row.deliveryFee || 0,
        freeDeliveryThreshold: row.freeDeliveryThreshold || null,
        taxEnabled: row.taxEnabled === 1,
        taxRate: row.taxRate || 0,
        storeOpen: row.storeOpen !== 0,
        storeClosedMessage: row.storeClosedMessage || '',
        orderWhatsapp: row.orderWhatsapp || '',
        orderEmail: row.orderEmail || '',
        instagramLink: row.instagramLink || '',
        facebookLink: row.facebookLink || ''
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /api/settings - protected route to save settings
  router.post('/', authenticateToken, (req, res) => {
    try {
      const { 
        description, address, googleMapsLink, phone, openHours, paymentTerms, deliveryZones,
        siteName, minOrderAmount, deliveryFee, freeDeliveryThreshold,
        taxEnabled, taxRate, storeOpen, storeClosedMessage,
        orderWhatsapp, orderEmail, instagramLink, facebookLink
      } = req.body;
      
      const countRow = db.get('SELECT COUNT(*) as count FROM settings');
      if (countRow.count === 0) {
        db.run(
          `INSERT INTO settings (
            description, address, googleMapsLink, phone, openHours, paymentTerms, deliveryZones,
            siteName, minOrderAmount, deliveryFee, freeDeliveryThreshold,
            taxEnabled, taxRate, storeOpen, storeClosedMessage,
            orderWhatsapp, orderEmail, instagramLink, facebookLink
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            description, address, googleMapsLink, phone, openHours, paymentTerms, deliveryZones,
            siteName, minOrderAmount, deliveryFee, freeDeliveryThreshold,
            taxEnabled ? 1 : 0, taxRate, storeOpen ? 1 : 0, storeClosedMessage,
            orderWhatsapp, orderEmail, instagramLink, facebookLink
          ]
        );
      } else {
        db.run(
          `UPDATE settings SET 
            description = ?, address = ?, googleMapsLink = ?, phone = ?, openHours = ?, paymentTerms = ?, deliveryZones = ?,
            siteName = ?, minOrderAmount = ?, deliveryFee = ?, freeDeliveryThreshold = ?,
            taxEnabled = ?, taxRate = ?, storeOpen = ?, storeClosedMessage = ?,
            orderWhatsapp = ?, orderEmail = ?, instagramLink = ?, facebookLink = ?
           WHERE id = (SELECT id FROM settings ORDER BY id DESC LIMIT 1)`,
          [
            description, address, googleMapsLink, phone, openHours, paymentTerms, deliveryZones,
            siteName, minOrderAmount, deliveryFee, freeDeliveryThreshold,
            taxEnabled ? 1 : 0, taxRate, storeOpen ? 1 : 0, storeClosedMessage,
            orderWhatsapp, orderEmail, instagramLink, facebookLink
          ]
        );
      }
      
      res.json({ message: 'Settings saved successfully.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
}

module.exports = createSettingsRoutes;
