'use strict';

const nodemailer = require('nodemailer');

const emailI18n = {
  fr: {
    subject: (id, total) => `Nouvelle commande #${id} - ${total} MAD`,
    title: 'Nouvelle commande reçue',
    orderNumber: 'Commande n°',
    date: 'Date',
    customerInfo: 'Informations client',
    name: 'Nom',
    phone: 'Téléphone',
    city: 'Ville',
    address: 'Adresse',
    notes: 'Notes',
    items: 'Articles commandés',
    deliveryFee: 'Frais de livraison',
    total: 'Total',
    viewInAdmin: 'Voir la commande dans l\'administration',
    testSubject: 'Test de configuration email - Shop',
    testTitle: 'Test de configuration email',
    testBody: 'Ceci est un message de test envoyé depuis votre boutique. La configuration SMTP fonctionne correctement.',
    noNotes: 'Aucune'
  },
  en: {
    subject: (id, total) => `New order #${id} - ${total} MAD`,
    title: 'New Order Received',
    orderNumber: 'Order #',
    date: 'Date',
    customerInfo: 'Customer Information',
    name: 'Name',
    phone: 'Phone',
    city: 'City',
    address: 'Address',
    notes: 'Notes',
    items: 'Ordered Items',
    deliveryFee: 'Delivery Fee',
    total: 'Total',
    viewInAdmin: 'View Order in Admin Panel',
    testSubject: 'Email Configuration Test - Shop',
    testTitle: 'Email Configuration Test',
    testBody: 'This is a test email sent from your shop. Your SMTP settings are working properly.',
    noNotes: 'None'
  },
  ar: {
    subject: (id, total) => `طلب جديد #${id} - ${total} MAD`,
    title: 'طلب جديد تم استلامه',
    orderNumber: 'طلب رقم',
    date: 'التاريخ',
    customerInfo: 'بيانات العميل',
    name: 'الاسم',
    phone: 'الهاتف',
    city: 'المدينة',
    address: 'العنوان',
    notes: 'ملاحظات',
    items: 'المنتجات المطلوبة',
    deliveryFee: 'رسوم التوصيل',
    total: 'المجموع',
    viewInAdmin: 'عرض الطلب في لوحة التحكم',
    testSubject: 'اختبار إعدادات البريد الإلكتروني - المتجر',
    testTitle: 'اختبار إعدادات البريد الإلكتروني',
    testBody: 'هذه رسالة اختبار مرسلة من متجرك. إعدادات SMTP تعمل بشكل صحيح.',
    noNotes: 'لا توجد'
  }
};

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeHeader(str) {
  return String(str || '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, 150);
}

function isEmailEnabled() {
  const host = (process.env.SMTP_HOST || '').trim();
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  const owner = (process.env.OWNER_EMAIL || '').trim();
  return Boolean(host && user && pass && owner);
}

function initMailer() {
  if (isEmailEnabled()) {
    console.log('Order email alerts enabled');
  } else {
    console.log('Order email alerts disabled');
  }
}

function getOwnerEmails() {
  return (process.env.OWNER_EMAIL || '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);
}

function getTransporter(transportOverride) {
  if (transportOverride) return transportOverride;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    connectionTimeout: 10000, // 10s
    socketTimeout: 15000      // 15s
  });
}

function getLangStrings() {
  const lang = (process.env.EMAIL_LANG || 'fr').toLowerCase();
  return emailI18n[lang] || emailI18n.fr;
}

async function sendOrderAlert(order, transportOverride) {
  if (!isEmailEnabled() && !transportOverride) {
    return { skipped: true, reason: 'disabled' };
  }

  const recipients = getOwnerEmails();
  if (recipients.length === 0) {
    return { skipped: true, reason: 'no_recipients' };
  }

  const t = getLangStrings();
  const isRtl = (process.env.EMAIL_LANG || '').toLowerCase() === 'ar';
  const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '');
  const adminUrl = siteUrl ? `${siteUrl}/admin` : '';

  const orderId = order.id || 'N/A';
  const orderTotal = order.total !== undefined ? order.total : 0;
  const deliveryFee = order.delivery_fee !== undefined ? order.delivery_fee : 0;
  const createdAt = order.created_at ? new Date(order.created_at).toLocaleString('fr-FR') : new Date().toLocaleString('fr-FR');
  const items = Array.isArray(order.items) ? order.items : [];

  // Sanitize subject (max 150 chars, no CR/LF)
  const rawSubject = t.subject(orderId, orderTotal);
  const subject = sanitizeHeader(rawSubject);

  // Build Plain Text body
  let text = `${t.title}\n`;
  text += `${'='.repeat(30)}\n`;
  text += `${t.orderNumber}: #${orderId}\n`;
  text += `${t.date}: ${createdAt}\n\n`;
  text += `${t.customerInfo}:\n`;
  text += `  ${t.name}: ${order.customer_name || ''}\n`;
  text += `  ${t.phone}: ${order.customer_phone || ''}\n`;
  text += `  ${t.city}: ${order.customer_city || ''}\n`;
  text += `  ${t.address}: ${order.customer_address || ''}\n`;
  text += `  ${t.notes}: ${order.notes || t.noNotes}\n\n`;
  text += `${t.items}:\n`;
  items.forEach(it => {
    const name = it.product_name || it.name || 'Produit';
    const qty = it.quantity || 1;
    const price = it.price !== undefined ? it.price : 0;
    text += `  - ${name} x ${qty} — ${price} MAD\n`;
  });
  text += `\n${t.deliveryFee}: ${deliveryFee} MAD\n`;
  text += `${t.total}: ${orderTotal} MAD\n`;
  if (adminUrl) {
    text += `\n${t.viewInAdmin}: ${adminUrl}\n`;
  }

  // Build HTML body
  const dirAttr = isRtl ? 'dir="rtl"' : 'dir="ltr"';
  const alignStyle = isRtl ? 'text-align: right;' : 'text-align: left;';

  let itemsHtml = '';
  items.forEach(it => {
    const name = escapeHtml(it.product_name || it.name || 'Produit');
    const qty = Number(it.quantity) || 1;
    const price = Number(it.price) || 0;
    itemsHtml += `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e0d5c5; ${alignStyle}">${name}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e0d5c5; text-align: center;">${qty}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e0d5c5; text-align: right;">${price} MAD</td>
      </tr>`;
  });

  const adminButtonHtml = adminUrl
    ? `
      <div style="margin-top: 24px; text-align: center;">
        <a href="${escapeHtml(adminUrl)}" style="background-color: #C4622D; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          ${escapeHtml(t.viewInAdmin)}
        </a>
      </div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="${escapeHtml(process.env.EMAIL_LANG || 'fr')}" ${dirAttr}>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #FAF7F2; color: #2C1810; margin: 0; padding: 20px; ${alignStyle}">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #E0D5C5; padding: 24px;">
    <h2 style="color: #C4622D; margin-top: 0;">${escapeHtml(t.title)}</h2>
    <p><strong>${escapeHtml(t.orderNumber)}:</strong> #${escapeHtml(orderId)}</p>
    <p><strong>${escapeHtml(t.date)}:</strong> ${escapeHtml(createdAt)}</p>

    <h3 style="color: #2C1810; border-bottom: 2px solid #E0D5C5; padding-bottom: 6px; margin-top: 20px;">${escapeHtml(t.customerInfo)}</h3>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
      <tr><td style="width: 30%; font-weight: bold; padding: 4px 0;">${escapeHtml(t.name)}:</td><td>${escapeHtml(order.customer_name)}</td></tr>
      <tr><td style="font-weight: bold; padding: 4px 0;">${escapeHtml(t.phone)}:</td><td>${escapeHtml(order.customer_phone)}</td></tr>
      <tr><td style="font-weight: bold; padding: 4px 0;">${escapeHtml(t.city)}:</td><td>${escapeHtml(order.customer_city)}</td></tr>
      <tr><td style="font-weight: bold; padding: 4px 0;">${escapeHtml(t.address)}:</td><td>${escapeHtml(order.customer_address)}</td></tr>
      <tr><td style="font-weight: bold; padding: 4px 0;">${escapeHtml(t.notes)}:</td><td>${escapeHtml(order.notes || t.noNotes)}</td></tr>
    </table>

    <h3 style="color: #2C1810; border-bottom: 2px solid #E0D5C5; padding-bottom: 6px;">${escapeHtml(t.items)}</h3>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
      <thead>
        <tr style="background: #F5F0E8;">
          <th style="padding: 8px 12px; ${alignStyle}">${escapeHtml(t.items)}</th>
          <th style="padding: 8px 12px; text-align: center;">Qté</th>
          <th style="padding: 8px 12px; text-align: right;">Prix</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div style="background: #F5F0E8; padding: 12px 16px; border-radius: 6px; margin-top: 16px;">
      <p style="margin: 4px 0; display: flex; justify-content: space-between;">
        <span>${escapeHtml(t.deliveryFee)}:</span>
        <strong>${escapeHtml(deliveryFee)} MAD</strong>
      </p>
      <p style="margin: 4px 0; font-size: 18px; display: flex; justify-content: space-between; color: #C4622D;">
        <span><strong>${escapeHtml(t.total)}:</strong></span>
        <strong>${escapeHtml(orderTotal)} MAD</strong>
      </p>
    </div>

    ${adminButtonHtml}
  </div>
</body>
</html>`;

  const fromAddress = (process.env.SMTP_FROM || '').trim() || (process.env.SMTP_USER || '').trim() || 'no-reply@localhost';

  const transporter = getTransporter(transportOverride);

  // Send ONLY to owner email(s), never to customer
  const info = await transporter.sendMail({
    from: fromAddress,
    to: recipients,
    subject: subject,
    text: text,
    html: html
  });

  return info;
}

async function sendTestEmail(transportOverride) {
  if (!isEmailEnabled() && !transportOverride) {
    throw new Error('SMTP is not configured. Missing required environment variables.');
  }

  const recipients = getOwnerEmails();
  if (recipients.length === 0) {
    throw new Error('OWNER_EMAIL is not set or empty.');
  }

  const t = getLangStrings();
  const fromAddress = (process.env.SMTP_FROM || '').trim() || (process.env.SMTP_USER || '').trim() || 'no-reply@localhost';
  const transporter = getTransporter(transportOverride);

  const info = await transporter.sendMail({
    from: fromAddress,
    to: recipients,
    subject: sanitizeHeader(t.testSubject),
    text: `${t.testTitle}\n\n${t.testBody}\n`,
    html: `<div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>${escapeHtml(t.testTitle)}</h2>
      <p>${escapeHtml(t.testBody)}</p>
    </div>`
  });

  return info;
}

module.exports = {
  isEmailEnabled,
  initMailer,
  sendOrderAlert,
  sendTestEmail
};
