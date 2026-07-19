/* ========================================
   Sweet Delights — Customer Storefront JS
   ======================================== */

const API = '';
let products = [];
let categories = [];
let cart = JSON.parse(localStorage.getItem('sd_cart') || '[]');
let activeCategory = 'all';
let otpSent = false;
let activePromo = null;

let currentLang = localStorage.getItem('sd_lang') || navigator.language.slice(0, 2) || 'fr';
if (!window.i18nStore || !window.i18nStore[currentLang]) currentLang = 'fr';

function setLanguage(lang) {
  if (!window.i18nStore?.[lang]) lang = 'fr';
  currentLang = lang;
  localStorage.setItem('sd_lang', lang);
  
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  const switcher = document.getElementById('langSwitcher');
  if(switcher) switcher.value = lang;
  
  const strings = window.i18nStore[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const keys = el.getAttribute('data-i18n').split('.');
    let val = strings;
    keys.forEach(k => val = val?.[k]);
    if (val) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = val;
      else el.innerHTML = val;
    }
  });

  applyShopSettings();

  if (products.length > 0) { renderFeatured(); renderProducts(); }
  updateCartUI();
}

window.shopSettings = {};

async function loadShopSettings() {
  try {
    const res = await fetch(`${API}/api/settings/public`);
    if (!res.ok) throw new Error();
    window.shopSettings = await res.json();
  } catch (err) {
    window.shopSettings = {};
  }
  applyShopSettings();
}

function applyShopSettings() {
  const settings = window.shopSettings || {};
  
  // 1. Phone number
  const phoneVal = settings.phone || "+212 6 61 26 95 36";
  const phoneEl = document.querySelector('[data-i18n="contact.c1Desc"]');
  if (phoneEl) phoneEl.textContent = phoneVal;
  
  // Update WhatsApp link
  const waLink = document.querySelector('a[href*="wa.me"]');
  if (waLink) {
    const cleanPhone = phoneVal.replace(/[^0-9]/g, '');
    waLink.href = `https://wa.me/${cleanPhone}`;
  }
  
  // 2. Address & Google Maps Link
  const addrVal = settings.address || "Rue Lieutenant Lamure, Résidence Palmera,\nGueliz, Marrakech, Maroc";
  const addrEl = document.querySelector('[data-i18n="contact.c2Desc"]');
  if (addrEl) {
    const displayAddr = addrVal.replace(/\n/g, '<br>');
    if (settings.googleMapsLink) {
      addrEl.innerHTML = `<a href="${settings.googleMapsLink}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;">${displayAddr}</a>`;
    } else {
      addrEl.innerHTML = displayAddr;
    }
  }
  
  // 3. Shop description
  const descVal = settings.description || "O Souly est née d'un amour profond pour les produits du terroir marocain. Chaque produit est sélectionné avec soin — 100% naturel, sans additifs, fabriqué selon un savoir-faire artisanal transmis de génération en génération. Notre mission est simple : vous apporter la nature du Maroc, directement chez vous.";
  
  const heroSubEl = document.querySelector('.hero-subtitle');
  if (heroSubEl) heroSubEl.textContent = descVal;
  
  const aboutDescEl = document.querySelector('[data-i18n="about.desc"]');
  if (aboutDescEl) aboutDescEl.textContent = descVal;
  
  // 4. Payment Terms
  const paymentVal = settings.paymentTerms || "Paiement à la livraison — Marrakech uniquement";
  document.querySelectorAll('[data-i18n="checkout.codNotice"]').forEach(el => {
    el.textContent = paymentVal;
  });
  
  // 5. Delivery Zones
  const deliveryVal = settings.deliveryZones || "Livraison gratuite à Marrakech — livraison nationale disponible";
  const shippingEl = document.querySelector('[data-i18n="cart.shipping"]');
  if (shippingEl) shippingEl.textContent = deliveryVal;

  const zoneNoticeEl = document.querySelector('[data-i18n="checkout.zoneNotice"]');
  if (zoneNoticeEl) zoneNoticeEl.textContent = settings.deliveryZones || "Prépayé — virement bancaire — Livraison nationale";

  // 6. Site Name
  const siteNameVal = settings.siteName || "O Souly";
  document.title = `${siteNameVal} — Produits du terroir marocain`;
  document.querySelectorAll('.logo-title').forEach(el => {
    el.textContent = siteNameVal;
  });

  // 7. Social Links (Instagram)
  const igLink = settings.instagramLink || "https://instagram.com/osoulymarrakech";
  const igHandle = settings.instagramLink ? "@" + settings.instagramLink.split('/').filter(Boolean).pop() : "@osoulymarrakech";
  
  const instaHandleEl = document.querySelector('[data-i18n="contact.c3Desc"]');
  if (instaHandleEl) {
    instaHandleEl.innerHTML = `<a href="${igLink}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;">${igHandle}</a>`;
  }

  // 8. Store Closed logic
  let banner = document.getElementById('storeClosedBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'storeClosedBanner';
    banner.style.cssText = "background: #f44336; color: white; text-align: center; padding: 10px; font-weight: bold; position: sticky; top: 60px; z-index: 900; display: none;";
    const nav = document.querySelector('.navbar');
    if (nav && nav.nextElementSibling) {
      nav.parentNode.insertBefore(banner, nav.nextElementSibling);
    } else {
      document.body.prepend(banner);
    }
  }

  if (settings.storeOpen === false) {
    banner.textContent = settings.storeClosedMessage || "Nous sommes actuellement fermés. Revenez bientôt.";
    banner.style.display = 'block';
  } else {
    banner.style.display = 'none';
  }
  
  // 9. Open Hours
  const hoursVal = settings.openHours || "Lundi – Samedi: 9h00 – 20h00 / Dimanche: 10h00 – 18h00";
  const hoursEl = document.querySelector('[data-i18n="contact.hoursDesc"]');
  if (hoursEl) hoursEl.textContent = hoursVal;

  // 10. Footer description update
  const footerDescEl = document.querySelector('[data-i18n="footer.desc"]');
  if (footerDescEl) {
    footerDescEl.innerHTML = `📸 ${igHandle} &nbsp;|&nbsp; 📞 ${phoneVal}<br>🕒 ${hoursVal.replace(/\n/g, ' - ')}<br>📍 ${addrVal.replace(/\n/g, ', ')}`;
  }
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  setLanguage(currentLang);
  document.getElementById('langSwitcher')?.addEventListener('change', (e) => setLanguage(e.target.value));
  
  const savedCart = localStorage.getItem('sd_cart');
  if (savedCart) cart = JSON.parse(savedCart);
  
  loadShopSettings();
  if (document.getElementById('productsGrid')) {
    loadProducts();
  }
  if (document.getElementById('cityDropdownContainer')) {
    setupCityDropdown();
  }
  if (document.getElementById('promoSection')) {
    checkPromoAvailability();
  }
  if (document.getElementById('productDetailPage')) {
    loadProductDetail();
  }
  updateCartUI();
  setupEventListeners();
  setupNavbar();
});

async function checkPromoAvailability() {
  try {
    const res = await fetch(`${API}/api/promotions/available`);
    const data = await res.json();
    const promoSection = document.getElementById('promoSection');
    if (promoSection) {
      promoSection.style.display = data.hasActivePromo ? 'block' : 'none';
    }
  } catch (err) {
    // If the request fails, hide promo section to be safe
    const promoSection = document.getElementById('promoSection');
    if (promoSection) promoSection.style.display = 'none';
  }
}


// --- Fetch Data ---
async function loadCategories() {
  try {
    const res = await fetch(`${API}/api/categories`);
    categories = await res.json();
    renderCategoryTabs();
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

async function loadProducts() {
  try {
    showSkeletons('productsGrid', 6);
    showSkeletons('featuredGrid', 3);
    const res = await fetch(`${API}/api/products?available=1`);
    products = await res.json();
    renderFeatured();
    renderProducts();
  } catch (err) {
    console.error('Failed to load products:', err);
    document.getElementById('productsGrid').innerHTML = '<p style="text-align:center;color:var(--text-light);">Failed to load products.</p>';
  }
}

// --- Render ---
function renderCategoryTabs() {
  const tabs = document.getElementById('categoryTabs');
  const allLabel = (window.i18nStore?.[currentLang]?.menu?.all) || '🍯 Tous les produits';
  let html = `<button class="cat-tab active" data-category="all"><span class="cat-icon">🍯</span> ${allLabel}</button>`;
  categories.forEach(cat => {
    html += `<button class="cat-tab" data-category="${cat.name}"><span class="cat-icon">${cat.icon}</span> ${cat.name}</button>`;
  });
  tabs.innerHTML = html;

  tabs.querySelectorAll('.cat-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.category;
      renderProducts();
    });
  });
}

function renderFeatured() {
  const grid = document.getElementById('featuredGrid');
  const featured = products.filter(p => p.featured);
  if (featured.length === 0) {
    document.getElementById('featured').style.display = 'none';
    return;
  }
  grid.innerHTML = featured.map(p => createProductCard(p)).join('');
  attachCardListeners(grid);
}

function renderProducts() {
  const grid = document.getElementById('productsGrid');
  const emptyState = document.getElementById('emptyState');
  let filtered = products;

  if (activeCategory !== 'all') {
    filtered = products.filter(p => p.category_name === activeCategory);
  }

  if (filtered.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  grid.innerHTML = filtered.map(p => createProductCard(p)).join('');
  attachCardListeners(grid);
}

function createProductCard(product) {
  const inCart = cart.find(item => item.id === product.id);
  const imgUrl = product.image && product.image.startsWith('http') ? product.image : `/images/${product.image}`;
  const imageContent = product.image && product.image !== 'default.jpg'
    ? `<img src="${imgUrl}" alt="${product.name}" loading="lazy">`
    : `<span class="placeholder-emoji">${product.category_icon || '🍰'}</span>`;

  const isOutOfStock = product.trackStock && product.stock <= 0;
  let badges = '';
  if (product.featured) badges += '<span class="card-badge" style="margin-right:4px;">⭐ Vedette</span>';
  if (isOutOfStock) badges += '<span class="card-badge" style="background:#e53e3e;">Rupture de stock</span>';

  return `
    <div class="product-card" data-id="${product.id}" style="cursor: pointer;" onclick="window.location.href='/product.html?id=${product.id}'">
      <div class="card-image">
        ${imageContent}
        <div style="position:absolute; top:12px; left:12px; display:flex;">${badges}</div>
      </div>
      <div class="card-body">
        <div class="card-category">${product.category_icon || ''} ${product.category_name || 'Sweet'}</div>
        <h3 class="card-title">${product.name}</h3>
        <p class="card-desc">${product.description || ''}</p>
        <div class="card-footer">
          <span class="card-price">${product.price.toFixed(2)} MAD</span>
          <button class="add-to-cart-btn ${inCart ? 'added' : ''}" data-id="${product.id}" ${isOutOfStock ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
            ${inCart ? window.i18nStore[currentLang].js.inCart : (isOutOfStock ? 'Épuisé' : window.i18nStore[currentLang].js.addBtn)}
          </button>
        </div>
      </div>
    </div>
  `;
}

function attachCardListeners(container) {
  container.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      addToCart(id);
      btn.classList.add('added');
      btn.textContent = window.i18nStore[currentLang].js.inCart;
    });
  });
}

// --- Cart ---
function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const existing = cart.find(item => item.id === productId);
  const currentQty = existing ? existing.quantity : 0;
  
  if (product.trackStock && currentQty >= product.stock) {
    showToast(`Stock insuffisant (${product.stock} maximum).`);
    return;
  }

  if (existing) {
    existing.quantity++;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      category_icon: product.category_icon || '🍰',
      quantity: 1
    });
  }

  saveCart();
  updateCartUI();
  showToast(`${product.name} ${window.i18nStore[currentLang].js.addedToCart}`);
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  saveCart();
  updateCartUI();
  renderProducts();
  renderFeatured();
}

function updateQuantity(productId, delta) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  const product = products.find(p => p.id === productId);
  if (delta > 0 && product && product.trackStock && item.quantity >= product.stock) {
    showToast(`Stock insuffisant (${product.stock} maximum).`);
    return;
  }

  item.quantity += delta;
  if (item.quantity <= 0) {
    removeFromCart(productId);
    return;
  }
  saveCart();
  updateCartUI();
}

function saveCart() {
  localStorage.setItem('sd_cart', JSON.stringify(cart));
}

function getCartTotals() {
  const settings = window.shopSettings || {};
  let subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  
  let discount = 0;
  if (activePromo) {
    if (activePromo.minimumOrder > 0 && subtotal < activePromo.minimumOrder) {
      activePromo = null;
    } else {
      if (activePromo.type === 'percentage') {
        discount = subtotal * (activePromo.value / 100);
      } else {
        discount = activePromo.value;
      }
      if (discount > subtotal) discount = subtotal;
    }
  }

  let deliveryFee = settings.deliveryFee || 0;
  if (settings.freeDeliveryThreshold && subtotal >= settings.freeDeliveryThreshold) {
    deliveryFee = 0;
  }
  
  let total = subtotal - discount + deliveryFee;
  let tax = 0;
  
  if (settings.taxEnabled && settings.taxRate > 0) {
    tax = total * (settings.taxRate / 100);
    total += tax;
  }
  
  return { subtotal, discount, deliveryFee, tax, total };
}

function getCartTotal() {
  return getCartTotals().total;
}

function updateCartUI() {
  const count = document.getElementById('cartCount');
  const itemsContainer = document.getElementById('cartItems');
  const footer = document.getElementById('cartFooter');
  const totalEl = document.getElementById('cartTotal');
  const emptyEl = document.getElementById('cartEmpty');

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  count.textContent = totalItems;
  count.style.display = totalItems > 0 ? 'flex' : 'none';

  if (cart.length === 0) {
    emptyEl.style.display = 'block';
    footer.style.display = 'none';
    // Remove cart items but keep empty message
    itemsContainer.querySelectorAll('.cart-item').forEach(el => el.remove());
    return;
  }

  emptyEl.style.display = 'none';
  footer.style.display = 'block';

  let html = '';
  cart.forEach(item => {
    const imgUrl = item.image && item.image.startsWith('http') ? item.image : `/images/${item.image}`;
    const imgContent = item.image && item.image !== 'default.jpg'
      ? `<img src="${imgUrl}" alt="${item.name}" loading="lazy">`
      : item.category_icon || '🍰';
    
    html += `
      <div class="cart-item">
        <div class="cart-item-image">${imgContent}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">${(item.price * item.quantity).toFixed(2)} MAD</div>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="updateQuantity(${item.id}, -1)">−</button>
          <span class="cart-item-qty">${item.quantity}</span>
          <button class="qty-btn" onclick="updateQuantity(${item.id}, 1)">+</button>
          <button class="remove-item-btn" onclick="removeFromCart(${item.id})">🗑</button>
        </div>
      </div>
    `;
  });

  // Keep empty div, replace cart items
  itemsContainer.querySelectorAll('.cart-item').forEach(el => el.remove());
  itemsContainer.insertAdjacentHTML('beforeend', html);
  
  const totals = getCartTotals();
  const settings = window.shopSettings || {};
  const store = window.i18nStore?.[currentLang] || window.i18nStore?.['fr'] || {};
  
  const subtotalRowLabel = { fr:'Sous-total', en:'Subtotal', ar:'المجموع الجزئي' }[currentLang] || 'Sous-total';
  const deliveryLabel = { fr:'Livraison', en:'Delivery', ar:'التوصيل' }[currentLang] || 'Livraison';
  const taxLabel = { fr:'TVA', en:'Tax', ar:'الضريبة' }[currentLang] || 'TVA';
  const discountLabel = { fr:'Remise', en:'Discount', ar:'خصم' }[currentLang] || 'Remise';
  const freeLabel = { fr:'Gratuite', en:'Free', ar:'مجاني' }[currentLang] || 'Gratuite';
  const totalLabel = { fr:'Total', en:'Total', ar:'الإجمالي' }[currentLang] || 'Total';
  
  let totalsHtml = `
    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
      <span style="color:var(--text-light)">${subtotalRowLabel}</span>
      <span>${totals.subtotal.toFixed(2)} MAD</span>
    </div>
  `;
  
  if (totals.discount > 0 && activePromo) {
    totalsHtml += `
      <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
        <span style="color:var(--text-light)">${discountLabel} (${activePromo.code})</span>
        <span style="color:#22c55e;">-${totals.discount.toFixed(2)} MAD</span>
      </div>
    `;
  }
  
  if (settings.deliveryFee > 0) {
    totalsHtml += `
      <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
        <span style="color:var(--text-light)">${deliveryLabel}</span>
        <span>${totals.deliveryFee === 0 ? freeLabel : totals.deliveryFee.toFixed(2) + ' MAD'}</span>
      </div>
    `;
  }
  
  if (settings.taxEnabled && settings.taxRate > 0) {
    totalsHtml += `
      <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
        <span style="color:var(--text-light)">${taxLabel} (${settings.taxRate}%)</span>
        <span>${totals.tax.toFixed(2)} MAD</span>
      </div>
    `;
  }
  
  totalsHtml += `
    <div style="display:flex; justify-content:space-between; font-weight:bold; margin-top:10px; padding-top:10px; border-top:1px solid var(--sand);">
      <span>${totalLabel}</span>
      <span id="cartTotal">${totals.total.toFixed(2)} MAD</span>
    </div>
  `;
  
  // Create or replace totals container
  let tc = document.getElementById('cartTotalsContainer');
  if (!tc) {
    tc = document.createElement('div');
    tc.id = 'cartTotalsContainer';
    tc.style.marginBottom = '15px';
    tc.style.fontSize = '14px';
    totalEl.parentNode.insertBefore(tc, totalEl);
    totalEl.style.display = 'none'; // hide old total element
  }
  tc.innerHTML = totalsHtml;

  // Checkout block logic
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (checkoutBtn) {
    const minOrder = settings.minOrderAmount || 0;
    const store = window.i18nStore?.[currentLang] || window.i18nStore?.['fr'] || {};
    if (settings.storeOpen === false) {
      checkoutBtn.disabled = true;
      checkoutBtn.textContent = store.cart?.storeClosed || "Boutique fermée";
    } else if (minOrder > 0 && totals.subtotal < minOrder) {
      checkoutBtn.disabled = true;
      const minText = store.cart?.minOrder || "Min. commande: {min} MAD";
      checkoutBtn.textContent = minText.replace('{min}', minOrder);
    } else {
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = store.cart?.btn || "Passer la commande";
    }
  }
}

// --- Cart Toggle ---
function openCart() {
  document.getElementById('cartSidebar').classList.add('active');
  document.getElementById('cartOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cartSidebar').classList.remove('active');
  document.getElementById('cartOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

// --- Order ---
function renderOrderSummary() {
  const summary = document.getElementById('orderSummary');
  if (!summary) return;
  const store = window.i18nStore?.[currentLang] || window.i18nStore?.['fr'] || {};
  const totals = getCartTotals();
  const settings = window.shopSettings || {};

  let html = '';
  cart.forEach(item => {
    html += `<div class="order-summary-item">
      <span>${item.name} × ${item.quantity}</span>
      <span>${(item.price * item.quantity).toFixed(2)} MAD</span>
    </div>`;
  });

  const subtotalLabel = store.cart?.total || 'Total';
  const deliveryLabel = { fr:'Livraison', en:'Delivery', ar:'التوصيل' }[currentLang] || 'Livraison';
  const taxLabel = { fr:'TVA', en:'Tax', ar:'الضريبة' }[currentLang] || 'TVA';
  const discountLabel = { fr:'Remise', en:'Discount', ar:'خصم' }[currentLang] || 'Remise';
  const freeLabel = { fr:'Gratuite', en:'Free', ar:'مجاني' }[currentLang] || 'Gratuite';
  const subtotalRowLabel = { fr:'Sous-total', en:'Subtotal', ar:'المجموع الجزئي' }[currentLang] || 'Sous-total';

  let totalsHtml = `
    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
      <span style="color:var(--text-light)">${subtotalRowLabel}</span>
      <span>${totals.subtotal.toFixed(2)} MAD</span>
    </div>
  `;
  if (totals.discount > 0 && activePromo) {
    totalsHtml += `
      <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
        <span style="color:var(--text-light)">${discountLabel} (${activePromo.code})</span>
        <span style="color:#22c55e;">-${totals.discount.toFixed(2)} MAD</span>
      </div>
    `;
  }
  if (settings.deliveryFee > 0) {
    totalsHtml += `
      <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
        <span style="color:var(--text-light)">${deliveryLabel}</span>
        <span>${totals.deliveryFee === 0 ? freeLabel : totals.deliveryFee.toFixed(2) + ' MAD'}</span>
      </div>
    `;
  }
  if (settings.taxEnabled && settings.taxRate > 0) {
    totalsHtml += `
      <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
        <span style="color:var(--text-light)">${taxLabel} (${settings.taxRate}%)</span>
        <span>${totals.tax.toFixed(2)} MAD</span>
      </div>
    `;
  }
  totalsHtml += `
    <div class="order-summary-total" style="display:flex; justify-content:space-between; font-weight:bold; margin-top:10px; padding-top:10px; border-top:1px solid var(--sand);">
      <span>${subtotalLabel}</span>
      <span>${totals.total.toFixed(2)} MAD</span>
    </div>
  `;
  summary.innerHTML = html + totalsHtml;
}

function openCheckout() {
  closeCart();
  otpSent = false;
  const otpGroup = document.getElementById('otpGroup');
  if (otpGroup) {
    otpGroup.style.display = 'none';
    document.getElementById('otpCode').value = '';
  }
  const btn = document.getElementById('orderForm').querySelector('button[type="submit"]');
  if (btn) btn.textContent = window.i18nStore[currentLang].checkout.btn;

  renderOrderSummary();
  checkPromoAvailability();

  const modal = document.getElementById('orderModal');
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeOrderModal() {
  document.getElementById('orderModal').classList.remove('active');
  document.body.style.overflow = '';
}

async function submitOrder(e) {
  e.preventDefault();

  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const customer_phone = form.customer_phone.value.trim();

  if (!customer_phone) return showToast(window.i18nStore[currentLang].js.phoneReq);

  // Place Order Flow
  btn.disabled = true;
  btn.textContent = window.i18nStore[currentLang].js.placingOrder;

  // Use the value from the hidden input set by the dropdown
  const finalCity = form.customer_city ? form.customer_city.value.trim() : '';

  const orderData = {
    customer_name: form.customer_name.value.trim(),
    customer_phone,
    customer_email: form.customer_email.value.trim(),
    customer_city: finalCity,
    customer_address: form.customer_address.value.trim(),
    notes: form.notes.value.trim(),
    promoCode: activePromo ? activePromo.code : null,
    items: cart.map(item => ({
      product_id: item.id,
      quantity: item.quantity
    }))
  };

  try {
    const res = await fetch(`${API}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || window.i18nStore[currentLang].js.orderErr);
    }

    const order = await res.json();

    // Clear cart
    cart = [];
    saveCart();
    updateCartUI();
    renderProducts();
    renderFeatured();

    // Close order modal, show success
    closeOrderModal();
    document.getElementById('orderIdDisplay').textContent = `${window.i18nStore[currentLang].js.orderPrefix}${order.id}`;
    document.getElementById('successModal').classList.add('active');
    form.reset();
  } catch (err) {
    showToast(err.message || window.i18nStore[currentLang].js.orderTryAgain);
  } finally {
    btn.disabled = false;
    btn.textContent = window.i18nStore[currentLang].checkout.btn;
  }
}

// --- Event Listeners ---
function setupEventListeners() {
  document.getElementById('cartToggle').addEventListener('click', openCart);
  document.getElementById('cartClose').addEventListener('click', closeCart);
  document.getElementById('cartOverlay').addEventListener('click', closeCart);
  document.getElementById('checkoutBtn').addEventListener('click', openCheckout);
  document.getElementById('orderModalClose').addEventListener('click', closeOrderModal);
  document.getElementById('orderForm').addEventListener('submit', submitOrder);
  
  const applyPromoBtn = document.getElementById('applyPromoBtn');
  if (applyPromoBtn) {
    applyPromoBtn.addEventListener('click', async () => {
      const code = document.getElementById('promoCodeInput').value.trim().toUpperCase();
      if (!code) return;

      const store = window.i18nStore?.[currentLang] || window.i18nStore?.['fr'] || {};
      const applyLabel = { fr: 'Appliquer', en: 'Apply', ar: 'تطبيق' }[currentLang] || 'Appliquer';
      applyPromoBtn.disabled = true;
      applyPromoBtn.textContent = '...';

      try {
        const res = await fetch(`${API}/api/promotions/validate`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            code, 
            cartTotal: getCartTotals().subtotal,
            cartProductIds: cart.map(item => item.id) 
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        activePromo = data.promotion;
        const promoAppliedMsg = { fr: 'Code promo appliqué !', en: 'Promo code applied!', ar: 'تم تطبيق رمز الترقية!' }[currentLang] || 'Code promo appliqué !';
        showToast(promoAppliedMsg);
        // Update cart sidebar totals AND re-render summary in-place (keep modal open, keep form data)
        updateCartUI();
        renderOrderSummary();
      } catch (err) {
        showToast(err.message);
        activePromo = null;
        updateCartUI();
        renderOrderSummary();
      } finally {
        applyPromoBtn.disabled = false;
        applyPromoBtn.textContent = applyLabel;
      }
    });
  }

  document.getElementById('successClose').addEventListener('click', () => {
    document.getElementById('successModal').classList.remove('active');
    document.body.style.overflow = '';
  });

  // Mobile menu
  document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    document.querySelector('.nav-links').classList.toggle('active');
  });

  // Close mobile menu on link click
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      document.querySelector('.nav-links').classList.remove('active');
    });
  });
}

// --- Navbar scroll ---
function setupNavbar() {
  window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });
}

// --- Toast ---
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// --- Skeletons ---
function showSkeletons(containerId, count) {
  const container = document.getElementById(containerId);
  container.innerHTML = Array(count).fill('<div class="skeleton skeleton-card"></div>').join('');
}

// --- City Dropdown Logic ---
const setupCityDropdown = (function() {
  function setup() {
    const searchInput = document.getElementById('citySearchInput');
    const hiddenInput = document.getElementById('customerCity');
    const dropdownList = document.getElementById('cityDropdownList');
    const otherInput = document.getElementById('customerCityOther');
    
    if (!searchInput || typeof MOROCCAN_CITIES === 'undefined') return;

    const citiesList = [...MOROCCAN_CITIES.map(c => c.name), "Autre ville"];

    function renderList(filter = '') {
      const term = filter.toLowerCase();
      const filtered = citiesList.filter(c => c.toLowerCase().includes(term));
      
      dropdownList.innerHTML = '';
      if (filtered.length === 0) {
        dropdownList.innerHTML = '<li style="padding:8px 12px; color:var(--text-light); font-size:13px;">Aucune ville trouvée</li>';
      } else {
        filtered.forEach(city => {
          const li = document.createElement('li');
          li.textContent = city;
          li.style.cssText = 'padding:8px 12px; cursor:pointer; font-size:14px; border-bottom:1px solid var(--dark-border); color:var(--text);';
          li.onmouseover = () => li.style.background = 'rgba(139,90,43,0.1)';
          li.onmouseout = () => li.style.background = 'transparent';
          li.onmousedown = (e) => {
            // use mousedown so it fires before input blur
            e.preventDefault();
            selectCity(city);
          };
          dropdownList.appendChild(li);
        });
      }
    }

    function selectCity(city) {
      searchInput.value = city;
      if (city === 'Autre ville') {
        hiddenInput.value = 'Autre ville';
        otherInput.style.display = 'block';
        otherInput.required = true;
      } else {
        hiddenInput.value = city;
        otherInput.style.display = 'none';
        otherInput.required = false;
        otherInput.value = '';
      }
      dropdownList.style.display = 'none';
    }

    searchInput.addEventListener('focus', () => {
      renderList(searchInput.value);
      dropdownList.style.display = 'block';
    });

    searchInput.addEventListener('input', (e) => {
      renderList(e.target.value);
      dropdownList.style.display = 'block';
      hiddenInput.value = ''; // clear hidden value when typing to enforce selection from list
      otherInput.style.display = 'none';
      otherInput.required = false;
    });

    searchInput.addEventListener('blur', () => {
      dropdownList.style.display = 'none';
      // If they click away without valid selection, revert to previous hidden valid value or empty
      if (hiddenInput.value === '') {
        searchInput.value = '';
      } else {
        searchInput.value = hiddenInput.value;
      }
    });
  }

  return setup;
})();


// --- Product Detail Page ---
async function loadProductDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');
  
  const container = document.getElementById('productDetailContainer');
  if (!id) {
    container.innerHTML = '<div style="padding: 40px; text-align: center;"><h3>Produit introuvable</h3><a href="/" class="btn btn-primary" style="margin-top: 16px;">Retour à la boutique</a></div>';
    return;
  }

  try {
    const res = await fetch(`${API}/api/products/${id}`);
    if (!res.ok) throw new Error('Not found');
    const product = await res.json();
    
    // Update Page Meta
    document.title = `${product.name} — O Souly`;
    let metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', (product.description || '').substring(0, 150));
    }

    renderProductDetailUI(product);
    
    // Load related products
    fetch(`${API}/api/products?available=1&category=${encodeURIComponent(product.category_name || '')}`)
      .then(r => r.json())
      .then(related => {
        const relatedGrid = document.getElementById('relatedProductsGrid');
        if (!relatedGrid) return;
        const others = related.filter(p => p.id !== product.id).slice(0, 4);
        if (others.length > 0) {
          relatedGrid.innerHTML = others.map(p => createProductCard(p)).join('');
          attachCardListeners(relatedGrid);
          document.getElementById('relatedProductsSection').style.display = 'block';
        } else {
          document.getElementById('relatedProductsSection').style.display = 'none';
        }
      });
      
  } catch (err) {
    container.innerHTML = '<div style="padding: 40px; text-align: center;"><h3>Produit introuvable</h3><a href="/" class="btn btn-primary" style="margin-top: 16px;">Retour à la boutique</a></div>';
  }
}

function renderProductDetailUI(product) {
  // Breadcrumb
  const bcCat = document.getElementById('bcCategory');
  if (bcCat) {
    bcCat.textContent = product.category_name || 'Boutique';
    bcCat.href = `/?category=${encodeURIComponent(product.category_name || 'all')}`;
  }
  const bcProd = document.getElementById('bcProduct');
  if (bcProd) bcProd.textContent = product.name;

  // Image
  const imgUrl = product.image && product.image !== 'default.jpg' 
    ? (product.image.startsWith('http') ? product.image : `/images/${product.image}`)
    : null;
  
  const pdImage = document.getElementById('pdImage');
  if (pdImage) {
    if (imgUrl) {
      pdImage.innerHTML = `<img src="${imgUrl}" alt="${product.name}" style="width:100%; border-radius:12px; object-fit:cover; aspect-ratio: 1/1;">`;
    } else {
      pdImage.innerHTML = `<div class="card-image" style="aspect-ratio: 1/1; border-radius:12px; height:100%;"><span class="placeholder-emoji">${product.category_icon || '🍰'}</span></div>`;
    }
  }

  // Info
  if (document.getElementById('pdName')) document.getElementById('pdName').textContent = product.name;
  if (document.getElementById('pdCategory')) document.getElementById('pdCategory').innerHTML = `${product.category_icon || ''} ${product.category_name || 'Boutique'}`;
  
  if (product.featured && document.getElementById('pdFeatured')) {
    document.getElementById('pdFeatured').innerHTML = '<span class="card-badge" style="margin-bottom:12px; display:inline-block;">⭐ Coup de cœur</span>';
  }

  // Tags (mock implementation if tags exist in product object)
  if (product.tags && product.tags.length > 0 && document.getElementById('pdTags')) {
    const tagsHtml = product.tags.map(t => `<span class="card-badge" style="background: var(--sand); color: var(--text); border: 1px solid var(--dark-border); margin-right: 8px; margin-bottom: 12px; display:inline-block;">${t}</span>`).join('');
    document.getElementById('pdTags').innerHTML = tagsHtml;
  }

  // Price & Size (mock implementation for sizes if provided)
  const priceContainer = document.getElementById('pdPriceContainer');
  if (priceContainer) {
    if (product.sizeOptions && product.sizeOptions.length > 0) {
      let sizeOptionsHtml = '<select id="pdSizeSelect" class="select-input" style="margin-bottom:16px;">';
      product.sizeOptions.forEach((size, idx) => {
        sizeOptionsHtml += `<option value="${size.price}" ${idx === 0 ? 'selected' : ''}>${size.label}</option>`;
      });
      sizeOptionsHtml += `</select><div id="pdDynamicPrice" class="card-price" style="font-size:24px; margin-bottom: 24px;">${product.sizeOptions[0].price.toFixed(2)} MAD</div>`;
      priceContainer.innerHTML = sizeOptionsHtml;

      document.getElementById('pdSizeSelect').addEventListener('change', (e) => {
        document.getElementById('pdDynamicPrice').textContent = `${parseFloat(e.target.value).toFixed(2)} MAD`;
      });
    } else {
      priceContainer.innerHTML = `<div class="card-price" style="font-size:24px; margin-bottom: 24px;">${product.price.toFixed(2)} MAD</div>`;
    }
  }

  // Stock & Add to Cart
  const isOutOfStock = product.trackStock && product.stock <= 0;
  const stockWarning = document.getElementById('pdStockWarning');
  const qtyInput = document.getElementById('pdQuantity');
  const addBtn = document.getElementById('pdAddBtn');

  if (stockWarning) stockWarning.innerHTML = ''; // reset
  
  if (isOutOfStock) {
    if (stockWarning) stockWarning.innerHTML = '<span class="card-badge" style="background:#e53e3e; margin-bottom:16px; display:inline-block;">Rupture de stock</span>';
    if (addBtn) {
      addBtn.disabled = true;
      addBtn.textContent = 'Indisponible';
      addBtn.style.opacity = '0.5';
      addBtn.style.cursor = 'not-allowed';
    }
    if (qtyInput) qtyInput.disabled = true;
  } else {
    if (product.trackStock && product.stock <= 5 && stockWarning) {
      stockWarning.innerHTML = `<span class="card-badge" style="background:var(--secondary); margin-bottom:16px; display:inline-block;">Plus que ${product.stock} en stock</span>`;
    }
    
    if (addBtn && qtyInput) {
      if (product.trackStock) {
        qtyInput.max = product.stock;
      } else {
        qtyInput.max = 99;
      }
      
      addBtn.onclick = () => {
        const qty = parseInt(qtyInput.value) || 1;
        const existing = cart.find(item => item.id === product.id);
        const currentQty = existing ? existing.quantity : 0;
        
        if (product.trackStock && currentQty + qty > product.stock) {
          showToast(`Stock insuffisant (${product.stock} maximum).`);
          return;
        }
        
        if (existing) {
          existing.quantity += qty;
        } else {
          cart.push({
            id: product.id,
            name: product.name,
            price: product.price, // if sizes were used, we'd pick the size price here
            image: product.image,
            category_icon: product.category_icon || '🍰',
            quantity: qty
          });
        }
        saveCart();
        updateCartUI();
        showToast(`${product.name} ajouté au panier`);
      };
    }
  }

  // Description
  const descText = product.description ? product.description.replace(/\n/g, '<br>') : 'Aucune description disponible.';
  if (document.getElementById('pdDescription')) document.getElementById('pdDescription').innerHTML = descText;

  // Ingredients
  if (product.ingredients && product.ingredients.trim() !== '') {
    const ingSec = document.getElementById('pdIngredientsSection');
    if (ingSec) ingSec.style.display = 'block';
    if (document.getElementById('pdIngredients')) document.getElementById('pdIngredients').innerHTML = product.ingredients.replace(/\n/g, '<br>');
  }

  // Metadata
  let metaHtml = '';
  if (product.weight) metaHtml += `<li><strong>Poids :</strong> ${product.weight}</li>`;
  if (product.brand) metaHtml += `<li><strong>Marque :</strong> ${product.brand}</li>`;
  if (product.origin) metaHtml += `<li><strong>Origine :</strong> ${product.origin}</li>`;
  metaHtml += `<li><strong>Catégorie :</strong> ${product.category_name || 'Général'}</li>`;
  
  if (metaHtml) {
    if (document.getElementById('pdMetaList')) document.getElementById('pdMetaList').innerHTML = metaHtml;
    if (document.getElementById('pdMetaSection')) document.getElementById('pdMetaSection').style.display = 'block';
  }
}
