const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { validate, z } = require('../middleware/validate');

const settingsSchema = z.object({
  siteName: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  address: z.string().max(300).optional(),
  googleMapsLink: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  openHours: z.string().max(200).optional(),
  paymentTerms: z.string().max(1000).optional(),
  deliveryZones: z.string().max(2000).optional(),
  minOrderAmount: z.preprocess(v => (v === '' ? 0 : v), z.coerce.number().min(0).optional()),
  deliveryFee: z.preprocess(v => (v === '' ? 0 : v), z.coerce.number().min(0).optional()),
  freeDeliveryThreshold: z.preprocess(v => (v === '' || v === null ? null : v), z.coerce.number().min(0).nullable().optional()),
  taxEnabled: z.coerce.boolean().optional(),
  taxRate: z.preprocess(v => (v === '' ? 0 : v), z.coerce.number().min(0).max(100).optional()),
  storeOpen: z.coerce.boolean().optional(),
  storeClosedMessage: z.string().max(500).optional(),
  orderWhatsapp: z.string().max(50).optional(),
  orderEmail: z.string().max(100).optional(),
  instagramLink: z.string().max(300).optional(),
  facebookLink: z.string().max(300).optional(),
  whatsappAdminNumber: z.string().max(50).optional(),
  whatsappEnabled: z.coerce.boolean().optional(),
  whatsappTemplateConfirmation: z.string().max(2000).optional(),
  whatsappTemplateShipped: z.string().max(2000).optional(),
  whatsappTemplateDelivered: z.string().max(2000).optional(),
  whatsappTemplateCancelled: z.string().max(2000).optional()
}).strict();
function createSettingsRoutes(db) {
  const router = express.Router();

  // GET /api/settings/public - public route
  router.get('/public', async (req, res) => {
    try {
      const row = await db.get('SELECT * FROM settings ORDER BY id DESC LIMIT 1');
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
      const val = (key) => row[key] !== undefined ? row[key] : row[key.toLowerCase()];
      res.json({
        description: val('description') || '',
        address: val('address') || '',
        googleMapsLink: val('googleMapsLink') || '',
        phone: val('phone') || '',
        openHours: val('openHours') || '',
        paymentTerms: val('paymentTerms') || '',
        deliveryZones: val('deliveryZones') || '',
        siteName: val('siteName') || '',
        minOrderAmount: val('minOrderAmount') || 0,
        deliveryFee: val('deliveryFee') || 0,
        freeDeliveryThreshold: val('freeDeliveryThreshold') || null,
        taxEnabled: val('taxEnabled') === 1,
        taxRate: val('taxRate') || 0,
        storeOpen: val('storeOpen') !== 0,
        storeClosedMessage: val('storeClosedMessage') || '',
        orderWhatsapp: val('orderWhatsapp') || '',
        orderEmail: val('orderEmail') || '',
        instagramLink: val('instagramLink') || '',
        facebookLink: val('facebookLink') || ''
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /api/settings - protected route to save settings
  router.post('/', authenticateToken, validate({ body: settingsSchema }), async (req, res) => {
    try {
      const body = req.body;

      const countRow = await db.get('SELECT COUNT(*) as count FROM settings');
      if (parseInt(countRow.count) === 0) {
        // No settings row yet — insert with provided values
        await db.run(
          `INSERT INTO settings (
            description, address, googleMapsLink, phone, openHours, paymentTerms, deliveryZones,
            siteName, minOrderAmount, deliveryFee, freeDeliveryThreshold,
            taxEnabled, taxRate, storeOpen, storeClosedMessage,
            orderWhatsapp, orderEmail, instagramLink, facebookLink,
            whatsappAdminNumber, whatsappEnabled, whatsappTemplateConfirmation,
            whatsappTemplateShipped, whatsappTemplateDelivered, whatsappTemplateCancelled
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            body.description || '', body.address || '', body.googleMapsLink || '',
            body.phone || '', body.openHours || '', body.paymentTerms || '', body.deliveryZones || '',
            body.siteName || '', body.minOrderAmount || 0, body.deliveryFee || 0, body.freeDeliveryThreshold || null,
            body.taxEnabled ? 1 : 0, body.taxRate || 0, body.storeOpen !== false ? 1 : 0, body.storeClosedMessage || '',
            body.orderWhatsapp || '', body.orderEmail || '', body.instagramLink || '', body.facebookLink || '',
            body.whatsappAdminNumber || '', body.whatsappEnabled ? 1 : 0,
            body.whatsappTemplateConfirmation || '', body.whatsappTemplateShipped || '',
            body.whatsappTemplateDelivered || '', body.whatsappTemplateCancelled || ''
          ]
        );
      } else {
        // Existing row — fetch it first, then merge only what was sent
        const existing = (await db.get('SELECT * FROM settings ORDER BY id DESC LIMIT 1')) || {};
        const m = (key, fallback) => {
          if (body[key] !== undefined) return body[key];
          if (existing[key] !== undefined) return existing[key];
          if (existing[key.toLowerCase()] !== undefined) return existing[key.toLowerCase()];
          return fallback;
        };

        await db.run(
          `UPDATE settings SET
            description = ?, address = ?, googleMapsLink = ?, phone = ?, openHours = ?,
            paymentTerms = ?, deliveryZones = ?, siteName = ?,
            minOrderAmount = ?, deliveryFee = ?, freeDeliveryThreshold = ?,
            taxEnabled = ?, taxRate = ?, storeOpen = ?, storeClosedMessage = ?,
            orderWhatsapp = ?, orderEmail = ?, instagramLink = ?, facebookLink = ?,
            whatsappAdminNumber = ?, whatsappEnabled = ?,
            whatsappTemplateConfirmation = ?, whatsappTemplateShipped = ?,
            whatsappTemplateDelivered = ?, whatsappTemplateCancelled = ?
          WHERE id = (SELECT id FROM settings ORDER BY id DESC LIMIT 1)`,
          [
            m('description', ''), m('address', ''), m('googleMapsLink', ''),
            m('phone', ''), m('openHours', ''), m('paymentTerms', ''), m('deliveryZones', ''),
            m('siteName', ''),
            m('minOrderAmount', 0), m('deliveryFee', 0), m('freeDeliveryThreshold', null),
            m('taxEnabled', 0) ? 1 : 0, m('taxRate', 0),
            m('storeOpen', 1) !== false && m('storeOpen', 1) !== 0 ? 1 : 0,
            m('storeClosedMessage', ''),
            m('orderWhatsapp', ''), m('orderEmail', ''), m('instagramLink', ''), m('facebookLink', ''),
            m('whatsappAdminNumber', ''),
            m('whatsappEnabled', 0) ? 1 : 0,
            m('whatsappTemplateConfirmation', ''), m('whatsappTemplateShipped', ''),
            m('whatsappTemplateDelivered', ''), m('whatsappTemplateCancelled', '')
          ]
        );
      }

      res.json({ message: 'Settings saved successfully.' });
    } catch (err) {
      console.error('Settings save error:', err);
      res.status(500).json({ error: 'Server error.' });
    }
  });


  // GET /api/settings/whatsapp - protected route to get whatsapp settings
  router.get('/whatsapp', authenticateToken, async (req, res) => {
    try {
      const row = (await db.get('SELECT * FROM settings ORDER BY id DESC LIMIT 1')) || {};
      const val = (key) => row[key] !== undefined ? row[key] : row[key.toLowerCase()];
      res.json({
        whatsappAdminNumber: val('whatsappAdminNumber') || '',
        whatsappEnabled: val('whatsappEnabled') === 1,
        whatsappTemplateConfirmation: val('whatsappTemplateConfirmation') || '',
        whatsappTemplateShipped: val('whatsappTemplateShipped') || '',
        whatsappTemplateDelivered: val('whatsappTemplateDelivered') || '',
        whatsappTemplateCancelled: val('whatsappTemplateCancelled') || ''
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;

}

module.exports = createSettingsRoutes;
