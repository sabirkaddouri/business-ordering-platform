/* ========================================
   Sweet Delights — Admin Dashboard JS
   ======================================== */

const API = '';
let token = localStorage.getItem('sd_admin_token');
let adminUsername = localStorage.getItem('sd_admin_user') || 'مدير';
let allProducts = [];
let allCategories = [];

// --- Init ---

let currentLang = localStorage.getItem('sd_admin_lang') || navigator.language.slice(0, 2) || 'fr';
if (!window.i18nAdminStore || !window.i18nAdminStore[currentLang]) currentLang = 'fr';

function setLanguage(lang) {
  if (!i18nAdminStore[lang]) lang = 'fr';
  currentLang = lang;
  localStorage.setItem('sd_admin_lang', lang);
  
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  
  const swLogin = document.getElementById('langSwitcherLogin');
  const swDash = document.getElementById('langSwitcherDash');
  if (swLogin) swLogin.value = lang;
  if (swDash) swDash.value = lang;
  
  const strings = i18nAdminStore[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const keys = el.getAttribute('data-i18n').split('.');
    let val = strings;
    keys.forEach(k => val = val?.[k]);
    if (val) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = val;
      else el.innerHTML = val;
    }
  });

  populateCategorySelect();
  if (allProducts.length) renderProductsTable();
    if (typeof renderPromoProductCheckboxes === "function") renderPromoProductCheckboxes(); // Init promo products
  if (document.getElementById('dashboard').style.display !== 'none') {
    loadOrders();
    loadRecentOrders();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setLanguage(currentLang);
  document.getElementById('langSwitcherLogin')?.addEventListener('change', (e) => setLanguage(e.target.value));
  document.getElementById('langSwitcherDash')?.addEventListener('change', (e) => setLanguage(e.target.value));

  if (token) {
    showDashboard();
  } else {
    showLogin();
  }
  setupEventListeners();
});

// --- Auth ---
function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('dashboard').style.display = 'none';
}

function showDashboard() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'flex';
  document.getElementById('adminName').textContent = adminUsername;
  loadDashboardData();
}

async function login(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');

  errorEl.textContent = '';

  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || i18nAdminStore[currentLang].login.err);

    token = data.token;
    adminUsername = data.username;
    localStorage.setItem('sd_admin_token', token);
    localStorage.setItem('sd_admin_user', adminUsername);
    showDashboard();
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

function logout() {
  token = null;
  localStorage.removeItem('sd_admin_token');
  localStorage.removeItem('sd_admin_user');
  showLogin();
}

function authHeaders() {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

// --- Navigation ---
function switchPanel(panelName) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-panel]').forEach(n => n.classList.remove('active'));

  document.getElementById(`panel${capitalize(panelName)}`).classList.add('active');
  document.querySelector(`.nav-item[data-panel="${panelName}"]`).classList.add('active');
  
  // Try translating the page title if an i18n key exists, otherwise capitalize
  const i18nKey = document.querySelector(`.nav-item[data-panel="${panelName}"]`).getAttribute('data-i18n');
  if (i18nKey && i18nAdminStore[currentLang]) {
    const keys = i18nKey.split('.');
    let val = i18nAdminStore[currentLang];
    for (let k of keys) { if (val) val = val[k]; }
    if (val) {
      document.getElementById('pageTitle').textContent = val;
    } else {
      document.getElementById('pageTitle').textContent = capitalize(panelName);
    }
  } else {
    document.getElementById('pageTitle').textContent = capitalize(panelName);
  }

  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('active');

  // Lazy load data
  if (panelName === 'analytics' && typeof loadAnalytics === 'function') loadAnalytics();
  if (panelName === 'promotions' && typeof loadPromotions === 'function') loadPromotions();
  if (panelName === 'citydelivery' && typeof loadCityDelivery === 'function') loadCityDelivery();
  if (panelName === 'categories' && typeof loadCategoriesPanel === 'function') loadCategoriesPanel();
  
  const dd = document.getElementById('notifDropdown');
  if (dd) dd.style.display = 'none';
}

function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

// --- Data Loading ---
async function loadDashboardData() {
  await Promise.all([
    loadStats(),
    loadCategories(),
    loadProducts(),
    loadOrders(),
    loadRecentOrders()
  ]);
  loadShopSettings();
  startNotificationPolling();
}

async function loadShopSettings() {
  try {
    const res = await fetch(`${API}/api/settings/public`);
    if (!res.ok) throw new Error();
    const settings = await res.json();

    document.getElementById('settingSiteName').value = settings.siteName || "";
    document.getElementById('settingDescription').value = settings.description || "";
    document.getElementById('settingAddress').value = settings.address || "";
    document.getElementById('settingGoogleMapsLink').value = settings.googleMapsLink || "";
    document.getElementById('settingPhone').value = settings.phone || "";
    document.getElementById('settingOpenHours').value = settings.openHours || "";
    
    document.getElementById('settingPaymentTerms').value = settings.paymentTerms || "";
    document.getElementById('settingDeliveryZones').value = settings.deliveryZones || "";
    document.getElementById('settingMinOrderAmount').value = settings.minOrderAmount || "";
    document.getElementById('settingDeliveryFee').value = settings.deliveryFee || "";
    document.getElementById('settingFreeDeliveryThreshold').value = settings.freeDeliveryThreshold || "";
    document.getElementById('settingTaxEnabled').checked = settings.taxEnabled || false;
    document.getElementById('settingTaxRate').value = settings.taxRate || "";
    
    document.getElementById('settingStoreOpen').checked = settings.storeOpen !== false;
    document.getElementById('settingStoreClosedMessage').value = settings.storeClosedMessage || "";
    
    document.getElementById('settingOrderWhatsapp').value = settings.orderWhatsapp || "";
    document.getElementById('settingOrderEmail').value = settings.orderEmail || "";
    
    document.getElementById('settingInstagramLink').value = settings.instagramLink || "";
    document.getElementById('settingFacebookLink').value = settings.facebookLink || "";

    // Fetch whatsapp settings securely
    try {
      const waRes = await fetch(`${API}/api/settings/whatsapp`, { headers: authHeaders() });
      if (waRes.ok) {
        const waSettings = await waRes.json();
        window.whatsappAdminConfig = waSettings;
        document.getElementById('settingWhatsappAdminNumber').value = waSettings.whatsappAdminNumber || "";
        document.getElementById('settingWhatsappEnabled').checked = waSettings.whatsappEnabled !== false;
        
        const defaultConfirm = "Bonjour {clientName} 👋\nMerci pour votre commande chez O Souly ! 🌿\nVotre commande numéro #{orderId} a bien été reçue.\n📦 Produits commandés:\n{orderItems}\n💰 Total: {orderTotal} MAD\n📍 Adresse de livraison: {clientAddress}, {clientCity}\nNous vous contacterons bientôt pour confirmer la livraison. Merci de votre confiance ! ✨";
        document.getElementById('settingWhatsappTemplateConfirmation').value = waSettings.whatsappTemplateConfirmation || defaultConfirm;
        
        const defaultShipped = "Bonjour {clientName} 👋\nBonne nouvelle ! Votre commande O Souly numéro #{orderId} a été expédiée. 🚚\n📍 Adresse de livraison: {clientAddress}, {clientCity}\nVous recevrez votre colis très bientôt. Merci pour votre confiance ! 🌿";
        document.getElementById('settingWhatsappTemplateShipped').value = waSettings.whatsappTemplateShipped || defaultShipped;
        
        const defaultDelivered = "Bonjour {clientName} 👋\nVotre commande O Souly numéro #{orderId} a bien été livrée ! ✅\nNous espérons que vous êtes satisfait(e) de vos produits. 🌿\nN'hésitez pas à nous contacter pour toute question. À bientôt !";
        document.getElementById('settingWhatsappTemplateDelivered').value = waSettings.whatsappTemplateDelivered || defaultDelivered;
        
        const defaultCancelled = "Bonjour {clientName} 👋\nNous sommes désolés de vous informer que votre commande O Souly numéro #{orderId} a été annulée.\nPour toute question, n'hésitez pas à nous contacter directement. Merci de votre compréhension. 🌿";
        document.getElementById('settingWhatsappTemplateCancelled').value = waSettings.whatsappTemplateCancelled || defaultCancelled;
      }
    } catch (err) {
      console.error("Failed to load WhatsApp settings", err);
    }

  } catch (err) {
    console.error("Failed to load settings:", err);
  }
}

async function loadStats() {
  try {
    const res = await fetch(`${API}/api/orders/stats/summary`, { headers: authHeaders() });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) return logout();
      return;
    }
    const stats = await res.json();
    document.getElementById('statTotalOrders').textContent = stats.totalOrders;
    document.getElementById('statPending').textContent = stats.pendingOrders;
    document.getElementById('statRevenue').textContent = `${stats.totalRevenue.toFixed(2)} MAD`;
    document.getElementById('statProducts').textContent = stats.totalProducts;
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

async function loadCategories() {
  try {
    const res = await fetch(`${API}/api/categories`);
    allCategories = await res.json();
    populateCategorySelect();
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

function populateCategorySelect() {
  const select = document.getElementById('productCategory');
  select.innerHTML = `<option value="">${i18nAdminStore[currentLang].js.catSelect}</option>`;
  allCategories.forEach(cat => {
    select.innerHTML += `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`;
  });
}

async function loadProducts() {
  try {
    const res = await fetch(`${API}/api/products`);
    allProducts = await res.json();
    renderProductsTable();
  } catch (err) {
    console.error('Failed to load products:', err);
  }
}

function renderProductsTable() {
  const tbody = document.getElementById('productsBody');
  if (allProducts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-light);">${i18nAdminStore[currentLang].prodPanel.empty}</td></tr>`;
    return;
  }

  tbody.innerHTML = allProducts.map(p => {
    const imgUrl = p.image && p.image.startsWith('http') ? p.image : `/images/${p.image}`;
    const img = p.image && p.image !== 'default.jpg'
      ? `<div class="table-image"><img src="${imgUrl}" alt="${p.name}"></div>`
      : `<div class="table-image">${p.category_icon || '🍰'}</div>`;

    let stockCell;
    if (!p.trackStock) {
      stockCell = `<span style="color:var(--text-light);font-size:12px;">Non suivi</span>`;
    } else if (p.stock === 0) {
      stockCell = `<span style="color:#e53e3e;font-weight:700;">Rupture</span>`;
    } else if (p.stock > 0 && p.stock < 5) {
      stockCell = `<span style="color:#d97706;font-weight:700;">${p.stock} (faible)</span>`;
    } else {
      stockCell = `<span style="color:var(--success);font-weight:600;">${p.stock}</span>`;
    }

    const rowStyle = p.trackStock && p.stock > 0 && p.stock < 5 ? 'background:rgba(217,119,6,0.07);' : (p.trackStock && p.stock === 0 ? 'background:rgba(229,62,62,0.07);' : '');

    return `
      <tr style="${rowStyle}">
        <td>${img}</td>
        <td><strong>${p.name}</strong></td>
        <td>${p.category_name || '—'}</td>
        <td>${p.price.toFixed(2)} MAD</td>
        <td><span class="toggle-badge ${p.featured ? 'toggle-on' : 'toggle-off'}">${p.featured ? i18nAdminStore[currentLang].js.yes : i18nAdminStore[currentLang].js.no}</span></td>
        <td><span class="toggle-badge ${p.available ? 'toggle-on' : 'toggle-off'}">${p.available ? i18nAdminStore[currentLang].js.yes : i18nAdminStore[currentLang].js.no}</span></td>
        <td>${stockCell}</td>
        <td>
          <button class="btn-icon" onclick="editProduct(${p.id})" title="Edit">✏️</button>
          <button class="btn-icon danger" onclick="deleteProduct(${p.id})" title="Delete">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function loadOrders() {
  try {
    const status = document.getElementById('orderStatusFilter').value;
    const url = status ? `${API}/api/orders?status=${status}` : `${API}/api/orders`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) return logout();
      return;
    }
    const data = await res.json();
    renderOrdersTable(data.orders);
  } catch (err) {
    console.error('Failed to load orders:', err);
  }
}

async function loadRecentOrders() {
  try {
    const res = await fetch(`${API}/api/orders?limit=5`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    renderRecentOrders(data.orders);
  } catch (err) {
    console.error('Failed to load recent orders:', err);
  }
}

function renderRecentOrders(orders) {
  const tbody = document.getElementById('recentOrdersBody');
  if (!orders || orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-light);">${i18nAdminStore[currentLang].ordPanel.empty}</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td>#${o.id}</td>
      <td>${o.customer_name}</td>
      <td>${o.items ? o.items.length : 0} ${i18nAdminStore[currentLang].js.items}</td>
      <td>${o.total.toFixed(2)} MAD</td>
      <td><span class="status-badge status-${o.status}">${o.status}</span></td>
      <td>${formatDate(o.created_at)}</td>
    </tr>
  `).join('');
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById('ordersBody');
  if (!orders || orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-light);">${i18nAdminStore[currentLang].ordPanel.empty}</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td>#${o.id}</td>
      <td>${o.customer_name}</td>
      <td>${o.customer_phone}</td>
      <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;">${o.customer_address}</td>
      <td>${o.items ? o.items.length : 0} ${i18nAdminStore[currentLang].js.items}</td>
      <td>${o.total.toFixed(2)} MAD</td>
      <td>
        <select class="select-input" style="padding:6px 28px 6px 10px;min-width:120px;font-size:12px;" onchange="updateOrderStatus(${o.id}, this.value)">
          <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>${i18nAdminStore[currentLang].status.pending}</option>
          <option value="confirmed" ${o.status === 'confirmed' ? 'selected' : ''}>${i18nAdminStore[currentLang].status.confirmed}</option>
          <option value="preparing" ${o.status === 'preparing' ? 'selected' : ''}>${i18nAdminStore[currentLang].status.preparing}</option>
          <option value="ready" ${o.status === 'ready' ? 'selected' : ''}>${i18nAdminStore[currentLang].status.ready}</option>
          <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>${i18nAdminStore[currentLang].status.delivered}</option>
          <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>${i18nAdminStore[currentLang].status.cancelled}</option>
        </select>
      </td>
      <td>${formatDate(o.created_at)}</td>
      <td>
        <button class="btn-icon" onclick="viewOrderDetail(${o.id})" title="View">👁️</button>
        <button class="btn-icon danger" onclick="deleteOrder(${o.id})" title="Delete">🗑️</button>
      </td>
    </tr>
  `).join('');
}

// --- Product CRUD ---
function openProductModal(product = null) {
  const modal = document.getElementById('productModal');
  const title = document.getElementById('productModalTitle');

  if (product) {
    title.textContent = i18nAdminStore[currentLang].prodModal.editTitle;
    document.getElementById('productId').value = product.id;
    document.getElementById('productName').value = product.name;
    document.getElementById('productDescription').value = product.description || '';
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productCategory').value = product.category_id || '';
    document.getElementById('productFeatured').checked = product.featured;
    document.getElementById('productAvailable').checked = product.available;
    document.getElementById('productTrackStock').checked = !!product.trackStock;
    document.getElementById('productStock').value = product.stock || 0;
    document.getElementById('stockQtyGroup').style.display = product.trackStock ? 'block' : 'none';
    
    // Show existing image
    const preview = document.getElementById('imagePreview');
    if (product.image && product.image !== 'default.jpg') {
      preview.innerHTML = `<img src="/images/${product.image}" alt="Current image">`;
    } else {
      preview.innerHTML = '';
    }
  } else {
    title.textContent = i18nAdminStore[currentLang].prodModal.addTitle;
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('productAvailable').checked = true;
    document.getElementById('productTrackStock').checked = false;
    document.getElementById('stockQtyGroup').style.display = 'none';
    document.getElementById('imagePreview').innerHTML = '';
  }

  modal.classList.add('active');
}

function closeProductModal() {
  document.getElementById('productModal').classList.remove('active');
  document.getElementById('productForm').reset();
  document.getElementById('imagePreview').innerHTML = '';
}

function editProduct(id) {
  const product = allProducts.find(p => p.id === id);
  if (product) openProductModal(product);
}

async function saveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('productId').value;
  const formData = new FormData();

  formData.append('name', document.getElementById('productName').value.trim());
  formData.append('description', document.getElementById('productDescription').value.trim());
  formData.append('price', document.getElementById('productPrice').value);
  formData.append('category_id', document.getElementById('productCategory').value);
  formData.append('featured', document.getElementById('productFeatured').checked ? 1 : 0);
  formData.append('available', document.getElementById('productAvailable').checked ? 1 : 0);
  formData.append('trackStock', document.getElementById('productTrackStock').checked ? 1 : 0);
  formData.append('stock', document.getElementById('productStock').value || 0);

  const imageFile = document.getElementById('productImage').files[0];
  if (imageFile) {
    formData.append('image', imageFile);
  }

  try {
    const url = id ? `${API}/api/products/${id}` : `${API}/api/products`;
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save product');
    }

    closeProductModal();
    await loadProducts();
    await loadStats();
    showAdminToast(id ? i18nAdminStore[currentLang].js.prodUpd : i18nAdminStore[currentLang].js.prodAdd, 'success');
  } catch (err) {
    showAdminToast(err.message, 'error');
  }
}

async function deleteProduct(id) {
  if (!(await showCustomConfirm(i18nAdminStore[currentLang].js.delProdConf))) return;

  try {
    const res = await fetch(`${API}/api/products/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete');
    }

    await loadProducts();
    await loadStats();
    showAdminToast(i18nAdminStore[currentLang].js.prodDel, 'success');
  } catch (err) {
    showAdminToast(err.message, 'error');
  }
}

// --- Order Management ---
async function updateOrderStatus(id, status) {
  try {
    const res = await fetch(`${API}/api/orders/${id}/status`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ status })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update status');
    }

    await loadStats();
    await loadRecentOrders();
    showAdminToast(`Order #${id} → ${status}`, 'success');
  } catch (err) {
    showAdminToast(err.message, 'error');
  }
}

async function viewOrderDetail(id) {
  try {
    const res = await fetch(`${API}/api/orders/${id}`, { headers: authHeaders() });
    if (!res.ok) return;
    const order = await res.json();

    const modal = document.getElementById('orderDetailModal');
    document.getElementById('orderDetailTitle').textContent = `${i18nAdminStore[currentLang].js.ordPrefix}${order.id}`;

    let itemsHtml = '';
    if (order.items) {
      itemsHtml = `<ul class="order-items-list">
        ${order.items.map(i => {
          const imgUrl = i.image && i.image.startsWith('http') ? i.image : `/images/${i.image}`;
          const img = i.image && i.image !== 'default.jpg'
            ? `<div class="table-image" style="margin-right:12px;"><img src="${imgUrl}" alt="${i.product_name}"></div>`
            : `<div class="table-image" style="margin-right:12px;">🍰</div>`;
          return `<li style="align-items:center; justify-content:flex-start;">
            ${img}
            <div style="flex:1;">
              <div style="font-weight:600;">${i.product_name}</div>
              <div style="font-size:12px;color:var(--text-light);">Qty: ${i.quantity}</div>
            </div>
            <span style="font-weight:600;">${(i.price * i.quantity).toFixed(2)} MAD</span>
          </li>`;
        }).join('')}
      </ul>
      <div class="order-total-row"><span>${i18nAdminStore[currentLang].js.total}</span><span>${order.total.toFixed(2)} MAD</span></div>`;
    }

    let actionButtons = '';
    if (order.status === 'pending') {
      actionButtons += `
        <button class="btn btn-primary btn-sm" onclick="acceptOrder(${order.id})" style="background: var(--success); box-shadow: none;">
          ✅ ${i18nAdminStore[currentLang].ordModal.acceptOrder}
        </button>
      `;
    }
    if (order.status !== 'cancelled' && order.status !== 'delivered') {
      actionButtons += `
        <button class="btn btn-outline btn-sm" onclick="cancelOrder(${order.id})" style="color: var(--danger); border-color: rgba(239,68,68,0.5);">
          ❌ ${i18nAdminStore[currentLang].ordModal.cancelOrder}
        </button>
      `;
    }
    actionButtons += `
      <button class="btn btn-outline btn-sm" onclick="deleteOrder(${order.id}); document.getElementById('orderDetailModal').classList.remove('active');" style="color: var(--text-light); border-color: var(--dark-border);">
        🗑️ ${currentLang === 'ar' ? 'حذف' : 'Delete'}
      </button>
    `;

    document.getElementById('orderDetailBody').innerHTML = `
      <div class="customer-info-card" style="background: rgba(255,255,255,0.03); border: 1px solid var(--dark-border); padding: 18px; border-radius: 10px; margin-bottom: 20px;">
        <div style="font-weight: 700; font-size: 15px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; color: var(--primary);">
          👤 ${i18nAdminStore[currentLang].ordModal.custInfo}
        </div>
        <div style="display: grid; grid-template-columns: 1fr; gap: 10px; font-size: 13px;">
          <div><strong>${i18nAdminStore[currentLang].js.cust}:</strong> <span style="font-size: 14px; font-weight: 600;">${order.customer_name}</span></div>
          <div><strong>${i18nAdminStore[currentLang].ordPanel.phone}:</strong> <a href="tel:${order.customer_phone}" style="color: var(--primary); text-decoration: none;">${order.customer_phone}</a></div>
          ${order.customer_email ? `<div><strong>Email:</strong> ${order.customer_email}</div>` : ''}
          <div><strong>${i18nAdminStore[currentLang].ordPanel.address}:</strong> <span style="color: var(--text-light);">${order.customer_address}</span></div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
        <div class="order-detail-section">
          <h4>${i18nAdminStore[currentLang].js.status}</h4>
          <p><span class="status-badge status-${order.status}">${order.status}</span></p>
        </div>
        <div class="order-detail-section">
          <h4>${i18nAdminStore[currentLang].js.date}</h4>
          <p>${formatDate(order.created_at)}</p>
        </div>
      </div>

      <div class="order-detail-section">
        <h4>${i18nAdminStore[currentLang].js.itemsLbl}</h4>
        ${itemsHtml}
      </div>

      ${order.notes ? `
        <div class="order-detail-section" style="margin-top: 15px; background: rgba(255,255,255,0.01); border: 1px dashed var(--dark-border); padding: 12px; border-radius: 8px;">
          <h4>💬 ${i18nAdminStore[currentLang].js.notes}</h4>
          <p style="font-style: italic;">${order.notes}</p>
        </div>
      ` : ''}

      <div class="order-detail-section" style="margin-top: 20px; border-top: 1px solid var(--dark-border); padding-top: 20px;">
        <h4 style="display: flex; align-items: center; gap: 6px;">📝 ${i18nAdminStore[currentLang].ordModal.adminNote}</h4>
        <textarea id="adminOrderNote" style="width: 100%; min-height: 80px; padding: 10px; border-radius: 8px; border: 1px solid var(--dark-border); background: var(--bg-input); color: var(--text); resize: vertical; margin-top: 8px; font-family: inherit; font-size: 13px;" placeholder="${i18nAdminStore[currentLang].ordModal.adminNote}">${order.admin_note || ''}</textarea>
        <button class="btn btn-primary btn-sm" onclick="saveOrderNote(${order.id})" style="margin-top: 8px;">
          💾 ${i18nAdminStore[currentLang].ordModal.saveNote}
        </button>
      </div>

      <div class="order-detail-section" style="margin-top: 20px; border-top: 1px solid var(--dark-border); padding-top: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
        ${actionButtons}
      </div>
      
      ${(window.whatsappAdminConfig && window.whatsappAdminConfig.whatsappEnabled) ? `
      <div class="order-detail-section" style="margin-top: 20px; border-top: 1px solid var(--dark-border); padding-top: 20px;">
        <h4 style="display: flex; align-items: center; gap: 6px; color: #25D366; margin-bottom: 12px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
          </svg>
          Actions WhatsApp
        </h4>
        
        <div class="wa-actions-wrapper">
          <button class="wa-mobile-toggle" onclick="this.nextElementSibling.classList.toggle('mobile-open')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
            </svg>
            WhatsApp
          </button>
          <div class="wa-desktop-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-sm" style="background: #25D366; color: white; border: none;" onclick="openWhatsappModal(${order.id}, 'confirmation')">Confirmer</button>
            <button class="btn btn-sm" style="background: #25D366; color: white; border: none;" onclick="openWhatsappModal(${order.id}, 'shipped')">Expédiée</button>
            <button class="btn btn-sm" style="background: #25D366; color: white; border: none;" onclick="openWhatsappModal(${order.id}, 'delivered')">Livrée</button>
            <button class="btn btn-sm" style="background: #A83232; color: white; border: none;" onclick="openWhatsappModal(${order.id}, 'cancelled')">Annuler</button>
            <button class="btn btn-sm" style="background: #6B7C3E; color: #F5F0E8; border: none;" onclick="openWhatsappModal(${order.id}, 'custom')">Message libre</button>
          </div>
        </div>
      </div>
      
      <div class="order-detail-section" style="margin-top: 20px; border-top: 1px solid var(--dark-border); padding-top: 20px;">
        <h4 style="margin-bottom: 12px;">Historique WhatsApp</h4>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${(() => {
            let logHtml = '';
            let log = [];
            try {
              log = JSON.parse(order.whatsappLog || '[]');
            } catch(e) {}
            
            if (log.length === 0) {
              return '<p style="color: var(--text-light); font-size: 13px; font-style: italic;">Aucun message WhatsApp envoyé pour cette commande.</p>';
            }
            
            logHtml = log.map(entry => {
              const date = new Date(entry.timestamp).toLocaleString(currentLang === 'fr' ? 'fr-FR' : 'en-GB');
              return `
                <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--dark-border); padding: 12px; border-radius: 8px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span class="status-badge" style="background: #E8F5E9; color: #2E7D32;">${entry.templateType}</span>
                    <span style="font-size: 11px; color: var(--text-light);">${date}</span>
                  </div>
                  <div style="font-size: 12px; color: var(--text); background: var(--bg-input); padding: 8px; border-radius: 4px;">${entry.messagePreview || '...'}</div>
                </div>
              `;
            }).join('');
            
            return logHtml;
          })()}
        </div>
      </div>
      ` : ''}
    `;

    modal.classList.add('active');
  } catch (err) {
    showAdminToast('Failed to load order details.', 'error');
  }
}

async function deleteOrder(id) {
  if (!(await showCustomConfirm(i18nAdminStore[currentLang].js.delOrdConf))) return;

  try {
    const res = await fetch(`${API}/api/orders/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete');
    }

    await loadOrders();
    await loadRecentOrders();
    await loadStats();
    showAdminToast(i18nAdminStore[currentLang].js.ordDel, 'success');
  } catch (err) {
    showAdminToast(err.message, 'error');
  }
}

// --- Settings ---
async function saveShopSettings(e) {
  e.preventDefault();
  try {
    const body = {
      siteName: document.getElementById('settingSiteName').value.trim(),
      description: document.getElementById('settingDescription').value.trim(),
      address: document.getElementById('settingAddress').value.trim(),
      googleMapsLink: document.getElementById('settingGoogleMapsLink').value.trim(),
      phone: document.getElementById('settingPhone').value.trim(),
      openHours: document.getElementById('settingOpenHours').value.trim(),
      paymentTerms: document.getElementById('settingPaymentTerms').value.trim(),
      deliveryZones: document.getElementById('settingDeliveryZones').value.trim(),
      minOrderAmount: parseFloat(document.getElementById('settingMinOrderAmount').value) || 0,
      deliveryFee: parseFloat(document.getElementById('settingDeliveryFee').value) || 0,
      freeDeliveryThreshold: parseFloat(document.getElementById('settingFreeDeliveryThreshold').value) || null,
      taxEnabled: document.getElementById('settingTaxEnabled').checked,
      taxRate: parseFloat(document.getElementById('settingTaxRate').value) || 0,
      storeOpen: document.getElementById('settingStoreOpen').checked,
      storeClosedMessage: document.getElementById('settingStoreClosedMessage').value.trim(),
      orderWhatsapp: document.getElementById('settingOrderWhatsapp').value.trim(),
      orderEmail: document.getElementById('settingOrderEmail').value.trim(),
      instagramLink: document.getElementById('settingInstagramLink').value.trim(),
      facebookLink: document.getElementById('settingFacebookLink').value.trim(),

      whatsappAdminNumber: (document.getElementById('settingWhatsappAdminNumber').value || '').replace(/[\s+\-()]/g, ''),
      whatsappEnabled: document.getElementById('settingWhatsappEnabled').checked,
      whatsappTemplateConfirmation: document.getElementById('settingWhatsappTemplateConfirmation').value,
      whatsappTemplateShipped: document.getElementById('settingWhatsappTemplateShipped').value,
      whatsappTemplateDelivered: document.getElementById('settingWhatsappTemplateDelivered').value,
      whatsappTemplateCancelled: document.getElementById('settingWhatsappTemplateCancelled').value,

    };

    const res = await fetch(`${API}/api/settings`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save shop settings');

    showAdminToast(i18nAdminStore[currentLang].js.shopSaved, 'success');
  } catch (err) {
    showAdminToast(err.message, 'error');
  }
}

async function updateAdminProfile(e) {
  e.preventDefault();
  const newUsername = document.getElementById('profileNewUsername').value.trim();
  const current = document.getElementById('profileCurrentPassword').value;
  const newPw = document.getElementById('profileNewPassword').value;
  const confirm = document.getElementById('profileConfirmPassword').value;

  if (newPw && newPw !== confirm) {
    showAdminToast(i18nAdminStore[currentLang].js.passErr, 'error');
    return;
  }

  try {
    const body = { currentPassword: current };
    if (newUsername) body.newUsername = newUsername;
    if (newPw) body.newPassword = newPw;

    const res = await fetch(`${API}/api/auth/update-profile`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update profile');

    if (data.username) {
      adminUsername = data.username;
      localStorage.setItem('sd_admin_user', adminUsername);
      document.getElementById('adminName').textContent = adminUsername;
    }
    if (data.token) {
      token = data.token;
      localStorage.setItem('sd_admin_token', token);
    }

    document.getElementById('profileNewUsername').value = '';
    document.getElementById('profileCurrentPassword').value = '';
    document.getElementById('profileNewPassword').value = '';
    document.getElementById('profileConfirmPassword').value = '';

    showAdminToast(i18nAdminStore[currentLang].js.passOk, 'success');
  } catch (err) {
    showAdminToast(err.message, 'error');
  }
}

// --- Event Listeners ---
function setupEventListeners() {
  document.getElementById('loginForm').addEventListener('submit', login);
  document.getElementById('logoutBtn').addEventListener('click', logout);

  // Navigation
  document.querySelectorAll('.nav-item[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
  });

  // Sidebar toggle (mobile)
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('active');
  });

  // Product modal
  document.getElementById('addProductBtn').addEventListener('click', () => openProductModal());
  document.getElementById('productModalClose').addEventListener('click', closeProductModal);
  document.getElementById('cancelProductBtn').addEventListener('click', closeProductModal);
  document.getElementById('productForm').addEventListener('submit', saveProduct);

  // Image preview
  document.getElementById('productImage').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        document.getElementById('imagePreview').innerHTML = `<img src="${ev.target.result}" alt="Preview">`;
      };
      reader.readAsDataURL(file);
    }
  });

  // Order filter
  document.getElementById('orderStatusFilter').addEventListener('change', loadOrders);

  // Order detail close
  document.getElementById('orderDetailClose').addEventListener('click', () => {
    document.getElementById('orderDetailModal').classList.remove('active');
  });

  // Settings
  document.getElementById('adminProfileForm').addEventListener('submit', updateAdminProfile);
  document.getElementById('shopSettingsForm').addEventListener('submit', saveShopSettings);

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('active');
    });
  });
}

async function saveOrderNote(id) {
  const noteVal = document.getElementById('adminOrderNote').value.trim();
  try {
    const res = await fetch(`${API}/api/orders/${id}/admin-note`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ admin_note: noteVal })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save admin note');
    }
    showAdminToast(i18nAdminStore[currentLang].js.noteSaved, 'success');
  } catch (err) {
    showAdminToast(err.message, 'error');
  }
}

async function acceptOrder(id) {
  try {
    const res = await fetch(`${API}/api/orders/${id}/status`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ status: 'confirmed' })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to accept order');
    }
    document.getElementById('orderDetailModal').classList.remove('active');
    await loadOrders();
    await loadRecentOrders();
    await loadStats();
    showAdminToast(i18nAdminStore[currentLang].js.ordAccepted, 'success');
  } catch (err) {
    showAdminToast(err.message, 'error');
  }
}

async function cancelOrder(id) {
  try {
    const res = await fetch(`${API}/api/orders/${id}/status`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ status: 'cancelled' })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to cancel order');
    }
    document.getElementById('orderDetailModal').classList.remove('active');
    await loadOrders();
    await loadRecentOrders();
    await loadStats();
    showAdminToast(`Order #${id} cancelled`, 'success');
  } catch (err) {
    showAdminToast(err.message, 'error');
  }
}

window.saveOrderNote = saveOrderNote;
window.acceptOrder = acceptOrder;
window.cancelOrder = cancelOrder;

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Custom confirmation modal using Promise
async function showCustomConfirm(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    const msgEl = document.getElementById('confirmModalMessage');
    const confirmBtn = document.getElementById('confirmModalConfirmBtn');
    const cancelBtn = document.getElementById('confirmModalCancelBtn');
    const closeBtn = document.getElementById('confirmModalClose');

    // Set message
    msgEl.textContent = message;
    // Show modal
    modal.classList.add('active');

    const cleanup = () => {
      modal.classList.remove('active');
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      closeBtn.removeEventListener('click', onCancel);
    };

    const onConfirm = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    closeBtn.addEventListener('click', onCancel);
  });
}

// Ensure existing modal close behavior stays functional
const confirmModalCloseBtn = document.getElementById('confirmModalClose');
if (confirmModalCloseBtn) {
  confirmModalCloseBtn.addEventListener('click', () => {
    const cm = document.getElementById('confirmModal');
    if (cm) cm.classList.remove('active');
  });
}

function showAdminToast(message, type = '') {
  const toast = document.getElementById('adminToast');
  let icon = '';
  if (type === 'success') icon = '✅ ';
  if (type === 'error') icon = '❌ ';
  toast.textContent = icon + message;
  toast.className = 'toast show' + (type ? ` ${type}` : '');
  setTimeout(() => { toast.className = 'toast'; }, 3000);
}

// =============================================
// STOCK TOGGLE HELPER
// =============================================
function toggleStockInput() {
  const checked = document.getElementById('productTrackStock').checked;
  document.getElementById('stockQtyGroup').style.display = checked ? 'block' : 'none';
}
window.toggleStockInput = toggleStockInput;

// =============================================
// ANALYTICS
// =============================================
let ordersChartInstance = null;

async function loadAnalytics() {
  try {
    const res = await fetch(`${API}/api/analytics`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById('anaTotalRev').textContent = data.totalRevenue.toFixed(2) + ' MAD';
    document.getElementById('anaMonthRev').textContent = data.monthRevenue.toFixed(2) + ' MAD';
    document.getElementById('anaWeekRev').textContent = data.weekRevenue.toFixed(2) + ' MAD';
    document.getElementById('anaAvgOrder').textContent = data.avgOrderValue.toFixed(2) + ' MAD';

    const ctx = document.getElementById('ordersChart').getContext('2d');
    if (ordersChartInstance) ordersChartInstance.destroy();
    ordersChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.dailyOrders.map(d => d.day.slice(5)),
        datasets: [{
          label: 'Commandes',
          data: data.dailyOrders.map(d => d.count),
          backgroundColor: 'rgba(139,90,43,0.65)',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } },
          x: { ticks: { maxRotation: 45 } }
        }
      }
    });

    const tbody = document.getElementById('topProductsBody');
    if (!data.topProducts || data.topProducts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--text-light);">Aucune donn\u00e9e</td></tr>';
    } else {
      tbody.innerHTML = data.topProducts.map(p => `
        <tr>
          <td><strong>${p.product_name}</strong></td>
          <td>${p.orderCount}</td>
          <td>${p.revenue.toFixed(2)} MAD</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load analytics:', err);
  }
}



// =============================================
// PROMOTIONS
// =============================================
async function loadPromotions() {
  try {
    const res = await fetch(`${API}/api/promotions`, { headers: authHeaders() });
    if (!res.ok) return;
    const promos = await res.json();
    renderPromotionsTable(promos);
  } catch (err) { console.error('Failed to load promotions:', err); }
}

function renderPromotionsTable(promos) {
  const tbody = document.getElementById('promosBody');
  if (!promos || promos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-light);">Aucun code promo créé.</td></tr>';
    return;
  }
  tbody.innerHTML = promos.map(p => {
    const typeLabel = p.type === 'percentage' ? `${p.value}%` : `${p.value} MAD fixe`;
    const minLabel = p.minimumOrder > 0 ? `${p.minimumOrder} MAD` : '—';
    const expiryLabel = p.expiryDate ? p.expiryDate.slice(0, 10) : '—';
    
    const badge = p.active
      ? `<span style="display:inline-block; margin-right:8px; padding:2px 6px; border-radius:4px; background:#e6f4ea; color:#1e8e3e; font-size:11px; font-weight:bold;">Actif</span>`
      : `<span style="display:inline-block; margin-right:8px; padding:2px 6px; border-radius:4px; background:#fce8e6; color:#d93025; font-size:11px; font-weight:bold;">Inactif</span>`;
      
    const statusLabel = `
      <div style="display:flex; align-items:center;">
        ${badge}
        <label class="switch" style="transform:scale(0.8); margin:0;">
          <input type="checkbox" onchange="togglePromo(${p.id})" ${p.active ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>
    `;

    let porteeLabel = 'Tous les produits';
    if (p.scope === 'specific_products') {
      try {
        const ids = JSON.parse(p.targetProducts || '[]');
        if (ids.length > 0) {
          const names = ids.map(id => {
            const prod = allProducts.find(pr => pr.id == id);
            return prod ? prod.name : `ID #${id}`;
          });
          const displayNames = names.slice(0, 3).join(', ');
          porteeLabel = names.length > 3 ? `${displayNames} + ${names.length - 3} autres` : displayNames;
        } else {
          porteeLabel = 'Aucun produit spécifié';
        }
      } catch(e) { porteeLabel = 'Erreur'; }
    }

    return `
      <tr>
        <td><strong>${p.code}</strong></td>
        <td>${p.type === 'percentage' ? 'Pourcentage' : 'Fixe'}</td>
        <td>${typeLabel}</td>
        <td>${minLabel}</td>
        <td>${expiryLabel}</td>
        <td>${statusLabel}</td>
        <td style="font-size:12px; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${porteeLabel}">${porteeLabel}</td>
        <td>${p.usageCount}</td>
        <td>
          <button class="btn-icon danger" onclick="deletePromo(${p.id})" title="Supprimer">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function createPromo(e) {
  e.preventDefault();
  const code = document.getElementById('promoCode').value.trim().toUpperCase();
  const type = document.getElementById('promoType').value;
  const value = parseFloat(document.getElementById('promoValue').value);
  const minimumOrder = parseFloat(document.getElementById('promoMinOrder').value) || 0;
  const expiryDate = document.getElementById('promoExpiry').value || null;
  const active = document.getElementById('promoActive').checked;
  const scope = document.querySelector('input[name="promoScope"]:checked').value;
  const targetProducts = scope === 'specific_products' ? getCheckedPromoProductIds() : [];

  try {
    const res = await fetch(`${API}/api/promotions`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ code, type, value, minimumOrder, expiryDate, active, scope, targetProducts })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur création');
    
    document.getElementById('promoForm').reset();
    // Reset checkbox list
    document.querySelectorAll('#promoProductCheckboxList input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.getElementById('promoProductsGroup').style.display = 'none';
    
    loadPromotions();
    showAdminToast('Code promo créé !', 'success');
  } catch (err) { showAdminToast(err.message, 'error'); }
}

async function togglePromo(id) {
  try {
    const res = await fetch(`${API}/api/promotions/${id}/toggle`, { method: 'PUT', headers: authHeaders() });
    if (!res.ok) throw new Error('Erreur toggle');
    loadPromotions();
  } catch (err) { showAdminToast(err.message, 'error'); }
}

async function deletePromo(id) {
  if (!(await showCustomConfirm('Supprimer ce code promo ?'))) return;
  try {
    const res = await fetch(`${API}/api/promotions/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) throw new Error('Erreur suppression');
    loadPromotions();
    showAdminToast('Code supprim\u00e9.', 'success');
  } catch (err) { showAdminToast(err.message, 'error'); }
}

window.togglePromo = togglePromo;
window.deletePromo = deletePromo;


document.addEventListener('DOMContentLoaded', () => {
  const pf = document.getElementById('promoForm');
  if (pf) pf.addEventListener('submit', createPromo);
  
  // Promo Scope radio toggle — show/hide product checkbox list
  document.querySelectorAll('input[name="promoScope"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const group = document.getElementById('promoProductsGroup');
      if (e.target.value === 'specific_products') {
        group.style.display = 'block';
        renderPromoProductCheckboxes();
      } else {
        group.style.display = 'none';
      }
    });
  });
});

// Render all products as checkboxes inside the promo product list
function renderPromoProductCheckboxes() {
  const container = document.getElementById('promoProductCheckboxList');
  if (!container) return;

  if (!allProducts || allProducts.length === 0) {
    container.innerHTML = '<span style="color:var(--text-light); font-size:13px;">Aucun produit disponible.</span>';
    return;
  }

  container.innerHTML = '';
  allProducts.forEach(p => {
    const label = document.createElement('label');
    label.style.cssText = 'display:flex; align-items:center; gap:10px; padding:6px 4px; cursor:pointer; font-size:14px; border-bottom:1px solid var(--dark-border);';
    
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = p.id;
    cb.id = `promoProductCb_${p.id}`;
    cb.style.cssText = 'width:16px; height:16px; cursor:pointer; accent-color:#8B5A2B;';
    
    const name = document.createElement('span');
    name.textContent = p.name;
    
    label.appendChild(cb);
    label.appendChild(name);
    container.appendChild(label);
  });
}

// Get checked product IDs from the checkbox list
function getCheckedPromoProductIds() {
  const checked = document.querySelectorAll('#promoProductCheckboxList input[type="checkbox"]:checked');
  return Array.from(checked).map(cb => parseInt(cb.value));
}


// =============================================
// NOTIFICATIONS
// =============================================
let notifPollInterval = null;

async function fetchNotifications() {
  if (!token) return;
  try {
    const res = await fetch(`${API}/api/notifications`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    renderNotifications(data.notifications, data.unreadCount);
  } catch (err) { /* silent */ }
}

function renderNotifications(notifications, unreadCount) {
  const badge = document.getElementById('notifBadge');
  const list = document.getElementById('notifList');
  if (unreadCount > 0) {
    badge.textContent = unreadCount;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
  if (!notifications || notifications.length === 0) {
    list.innerHTML = '<p style="padding:16px;color:var(--text-light);font-size:13px;">Aucune notification.</p>';
    return;
  }
  list.innerHTML = notifications.slice(0, 20).map(n => {
    const elapsed = timeAgo(n.createdAt);
    const bg = !n.read ? 'background:rgba(139,90,43,0.07);font-weight:600;' : '';
    return `
      <div onclick="openOrderFromNotif(${n.id},${n.orderId})"
           style="padding:12px 16px;border-bottom:1px solid var(--dark-border);cursor:pointer;${bg}display:flex;flex-direction:column;gap:4px;">
        <span style="font-size:13px;">${n.message}</span>
        <span style="font-size:11px;color:var(--text-light);">${elapsed}</span>
      </div>`;
  }).join('');
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `il y a ${diff}s`;
  if (diff < 3600) return `il y a ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff/3600)}h`;
  return `il y a ${Math.floor(diff/86400)}j`;
}

function toggleNotifDropdown() {
  const dd = document.getElementById('notifDropdown');
  if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

async function markAllNotifsRead() {
  try {
    await fetch(`${API}/api/notifications/read-all`, { method: 'PUT', headers: authHeaders() });
    fetchNotifications();
  } catch (err) { /* silent */ }
}

async function openOrderFromNotif(notifId, orderId) {
  try { await fetch(`${API}/api/notifications/${notifId}/read`, { method: 'PUT', headers: authHeaders() }); } catch(e) {}
  document.getElementById('notifDropdown').style.display = 'none';
  window.switchPanel('orders');
  if (orderId) setTimeout(() => viewOrderDetail(orderId), 300);
  fetchNotifications();
}

function startNotificationPolling() {
  fetchNotifications();
  if (notifPollInterval) clearInterval(notifPollInterval);
  notifPollInterval = setInterval(fetchNotifications, 30000);
}

document.addEventListener('click', (e) => {
  const dd = document.getElementById('notifDropdown');
  const bell = document.getElementById('notifBellWrapper');
  if (dd && bell && !bell.contains(e.target) && !dd.contains(e.target)) {
    dd.style.display = 'none';
  }
});

window.toggleNotifDropdown = toggleNotifDropdown;
window.markAllNotifsRead = markAllNotifsRead;
window.openOrderFromNotif = openOrderFromNotif;

// =============================================
// CITY DELIVERY DASHBOARD
// =============================================
let cityOrdersData = [];
let cityChartInstance = null;

async function loadCityDelivery() {
  try {
    const res = await fetch(`${API}/api/orders?limit=10000`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    
    // Fallback: if customer_city is not populated, try to guess from customer_address or use "Inconnue"
    cityOrdersData = (data.orders || []).map(o => {
      let city = (o.customer_city || '').trim();
      if (!city) {
        // Try to match against the predefined list of cities
        const lowerAddr = o.customer_address ? o.customer_address.toLowerCase() : '';
        if (typeof MOROCCAN_CITIES !== 'undefined') {
          const matched = MOROCCAN_CITIES.find(c => lowerAddr.includes(c.name.toLowerCase()));
          if (matched) city = matched.name;
        }
        
        // Final fallback if no match found
        if (!city) {
          if (lowerAddr.includes('marrakech')) city = 'Marrakech';
          else if (lowerAddr.includes('casablanca')) city = 'Casablanca';
          else if (lowerAddr.includes('rabat')) city = 'Rabat';
          else city = 'Inconnue';
        }
      }
      // Normalize city name
      city = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
      o.normalizedCity = city;
      return o;
    });

    populateCityFilterDropdown();
    renderCityGroups();
  } catch (err) {
    console.error('Failed to load city delivery data:', err);
  }
}

function populateCityFilterDropdown() {
  const select = document.getElementById('cityFilterSelect');
  const allOrderCities = [...new Set(cityOrdersData.map(o => o.normalizedCity))].sort();
  
  let standardCities = [];
  if (typeof MOROCCAN_CITIES !== 'undefined') {
    standardCities = MOROCCAN_CITIES.map(c => c.name).sort();
  }
  
  const customCities = allOrderCities.filter(c => !standardCities.includes(c) && c !== 'Inconnue');
  
  let options = '<option value="">Toutes les villes</option>';
  options += standardCities.map(c => `<option value="${c}">${c}</option>`).join('');
  
  if (customCities.length > 0) {
    options += '<optgroup label="Autres villes">';
    options += customCities.map(c => `<option value="${c}">${c}</option>`).join('');
    options += '</optgroup>';
  }
  if (allOrderCities.includes('Inconnue')) {
    options += `<option value="Inconnue">Inconnue</option>`;
  }
  
  select.innerHTML = options;

  const dataList = document.getElementById('adminCityDataList');
  if (dataList) {
    let dlOptions = '';
    const autocompleteCities = [...new Set([...standardCities, ...customCities])].sort();
    autocompleteCities.forEach(c => {
      if (c !== 'Inconnue') {
        dlOptions += `<option value="${c}">`;
      }
    });
    dataList.innerHTML = dlOptions;
  }
}

function renderCityGroups() {
  const searchStr = document.getElementById('citySearchInput').value.toLowerCase();
  const selectedCity = document.getElementById('cityFilterSelect').value;
  const selectedStatus = document.getElementById('cityStatusFilter').value;
  const sortMode = document.getElementById('citySortSelect').value;

  // Filter orders
  let filtered = cityOrdersData.filter(o => {
    if (selectedCity && o.normalizedCity !== selectedCity) return false;
    if (selectedStatus && o.status !== selectedStatus) return false;
    if (searchStr) {
      const matchName = (o.customer_name || '').toLowerCase().includes(searchStr);
      const matchAddress = (o.customer_address || '').toLowerCase().includes(searchStr);
      const matchCity = o.normalizedCity.toLowerCase().includes(searchStr);
      if (!matchName && !matchAddress && !matchCity) return false;
    }
    return true;
  });

  // Group by city
  const cityGroups = {};
  filtered.forEach(o => {
    if (!cityGroups[o.normalizedCity]) {
      cityGroups[o.normalizedCity] = { name: o.normalizedCity, orders: [], revenue: 0 };
    }
    cityGroups[o.normalizedCity].orders.push(o);
    cityGroups[o.normalizedCity].revenue += o.total;
  });

  let groupsArray = Object.values(cityGroups);

  // Update Stats
  const homeCity = 'Marrakech';
  document.getElementById('cityStatVilles').textContent = groupsArray.length;
  
  if (groupsArray.length > 0) {
    const topCityObj = [...groupsArray].sort((a,b) => b.orders.length - a.orders.length)[0];
    document.getElementById('cityStatTopVille').textContent = `${topCityObj.name} (${topCityObj.orders.length})`;
  } else {
    document.getElementById('cityStatTopVille').textContent = '—';
  }

  const outOfHomeCount = filtered.filter(o => o.normalizedCity.toLowerCase() !== homeCity.toLowerCase()).length;
  document.getElementById('cityStatHorsMarrakech').textContent = outOfHomeCount;

  // Update Chart (Top 10 by order count)
  updateCityChart(groupsArray);

  // Sort groups
  groupsArray.sort((a, b) => {
    if (sortMode === 'count') return b.orders.length - a.orders.length;
    if (sortMode === 'revenue') return b.revenue - a.revenue;
    if (sortMode === 'alpha') return a.name.localeCompare(b.name);
    return 0;
  });

  const container = document.getElementById('cityGroupsContainer');
  if (groupsArray.length === 0) {
    container.innerHTML = `<div class="card" style="padding:40px;text-align:center;color:var(--text-light);">Aucune commande pour le moment</div>`;
    return;
  }

  container.innerHTML = groupsArray.map((group, index) => {
    return `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center;" onclick="toggleCityGroup(${index})">
          <h3 style="margin:0; display:flex; align-items:center; gap:8px;">
            <span id="cityChevron-${index}">▼</span>
            ${group.name} 
            <span class="badge" style="background:var(--primary);color:#fff;padding:2px 8px;border-radius:12px;font-size:12px;">${group.orders.length}</span>
          </h3>
          <div style="font-weight:600; color:var(--green);">${group.revenue.toFixed(2)} MAD</div>
        </div>
        <div id="cityGroupContent-${index}" class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Client</th>
                <th>Adresse complète</th>
                <th>Téléphone</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${group.orders.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).map(o => `
                <tr>
                  <td>#${o.id}</td>
                  <td><strong>${o.customer_name}</strong></td>
                  <td style="max-width:200px; white-space:normal;">${o.customer_address}</td>
                  <td><a href="tel:${o.customer_phone}" style="color:var(--primary);text-decoration:none;">${o.customer_phone}</a></td>
                  <td>${o.total.toFixed(2)} MAD</td>
                  <td>
                    <select class="select-input" style="padding:4px 24px 4px 8px;min-width:110px;font-size:12px;" onchange="updateOrderStatus(${o.id}, this.value)">
                      <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Nouvelle</option>
                      <option value="confirmed" ${o.status === 'confirmed' ? 'selected' : ''}>Confirmée</option>
                      <option value="preparing" ${o.status === 'preparing' ? 'selected' : ''}>En préparation</option>
                      <option value="ready" ${o.status === 'ready' ? 'selected' : ''}>Expédiée</option>
                      <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Livrée</option>
                      <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Annulée</option>
                    </select>
                  </td>
                  <td>${new Date(o.created_at).toLocaleDateString()}</td>
                  <td>
                    ${(window.whatsappAdminConfig && window.whatsappAdminConfig.whatsappEnabled) ? `
                      <button class="btn btn-sm" style="background: #25D366; color: white; border: none; padding: 4px 8px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;" onclick="openWhatsappModal(${o.id}, 'confirmation')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                        WhatsApp
                      </button>
                    ` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');
}

window.toggleCityGroup = function(index) {
  const content = document.getElementById(`cityGroupContent-${index}`);
  const chevron = document.getElementById(`cityChevron-${index}`);
  if (content.style.display === 'none') {
    content.style.display = 'block';
    chevron.textContent = '▼';
  } else {
    content.style.display = 'none';
    chevron.textContent = '▶';
  }
};

function updateCityChart(groupsArray) {
  const top10 = [...groupsArray].sort((a,b) => b.orders.length - a.orders.length).slice(0, 10);
  
  const ctx = document.getElementById('cityOrdersChart');
  if(!ctx) return;
  
  if (cityChartInstance) cityChartInstance.destroy();
  
  cityChartInstance = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: top10.map(g => g.name),
      datasets: [{
        label: 'Nombre de commandes',
        data: top10.map(g => g.orders.length),
        backgroundColor: 'rgba(139,90,43,0.7)',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
        x: { ticks: { autoSkip: false } }
      }
    }
  });
}

window.exportCityCSV = function() {
  const selectedCity = document.getElementById('cityFilterSelect').value;
  
  // Get currently filtered data as shown in groups (so search and status filters apply)
  // Re-run the filter logic to get flat array
  const searchStr = document.getElementById('citySearchInput').value.toLowerCase();
  const selectedStatus = document.getElementById('cityStatusFilter').value;
  
  let exportData = cityOrdersData.filter(o => {
    if (selectedCity && o.normalizedCity !== selectedCity) return false;
    if (selectedStatus && o.status !== selectedStatus) return false;
    if (searchStr) {
      const matchName = (o.customer_name || '').toLowerCase().includes(searchStr);
      const matchAddress = (o.customer_address || '').toLowerCase().includes(searchStr);
      const matchCity = o.normalizedCity.toLowerCase().includes(searchStr);
      if (!matchName && !matchAddress && !matchCity) return false;
    }
    return true;
  });

  // Sort by city alphabetically
  exportData.sort((a,b) => a.normalizedCity.localeCompare(b.normalizedCity));

  let csvContent = "Ville,Nom du client,Téléphone,Adresse complète,Total commande,Statut,Date de commande\n";
  
  exportData.forEach(o => {
    const safeName = `"${(o.customer_name || '').replace(/"/g, '""')}"`;
    const safePhone = `"${(o.customer_phone || '').replace(/"/g, '""')}"`;
    const safeAddress = `"${(o.customer_address || '').replace(/"/g, '""')}"`;
    const dateStr = new Date(o.created_at).toLocaleDateString();
    
    csvContent += `${o.normalizedCity},${safeName},${safePhone},${safeAddress},${o.total},${o.status},${dateStr}\n`;
  });

  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute("download", `livraisons_${selectedCity || 'toutes'}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

// --- Categories Management ---
async function loadCategoriesPanel() {
  await loadCategories();
  renderCategoriesTable();
}

function renderCategoriesTable() {
  const tbody = document.getElementById('categoriesBody');
  if (!allCategories || allCategories.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-light);">Aucune catégorie</td></tr>';
    return;
  }

  tbody.innerHTML = allCategories.map(cat => {
    return `<tr>
      <td>${cat.display_order}</td>
      <td style="font-size: 24px;">${cat.icon || '📦'}</td>
      <td><strong>${cat.name}</strong><br><small style="color:var(--text-light);">${cat.slug}</small></td>
      <td><span class="status-badge" style="background:#f0f4f8;color:var(--text);">${cat.product_count || 0} produits</span></td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon" onclick="editCategory(${cat.id})" title="Modifier">✏️</button>
          <button class="btn-icon delete" onclick="deleteCategory(${cat.id})" title="Supprimer">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function resetCatForm() {
  document.getElementById('categoryForm').reset();
  document.getElementById('catEditId').value = '';
  document.getElementById('catFormTitle').textContent = 'Nouvelle catégorie';
  document.getElementById('catCancelBtn').style.display = 'none';
  document.getElementById('catFormError').style.display = 'none';
}

function editCategory(id) {
  const cat = allCategories.find(c => c.id === id);
  if (!cat) return;
  
  document.getElementById('catEditId').value = cat.id;
  document.getElementById('catName').value = cat.name;
  document.getElementById('catIcon').value = cat.icon || '';
  document.getElementById('catDescription').value = cat.description || '';
  document.getElementById('catOrder').value = cat.display_order || 0;
  
  document.getElementById('catFormTitle').textContent = 'Modifier la catégorie';
  document.getElementById('catCancelBtn').style.display = 'inline-block';
  document.getElementById('catFormError').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('categoryForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('catEditId').value;
  const name = document.getElementById('catName').value;
  const icon = document.getElementById('catIcon').value;
  const description = document.getElementById('catDescription').value;
  const order = document.getElementById('catOrder').value;
  const errEl = document.getElementById('catFormError');
  errEl.style.display = 'none';

  const method = id ? 'PUT' : 'POST';
  const url = id ? `${API}/api/categories/${id}` : `${API}/api/categories`;

  try {
    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify({ name, icon, description, order })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');
    
    resetCatForm();
    await loadCategoriesPanel(); // refresh list
  } catch(err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
});


// --- Custom Category Delete Modal Logic ---
let pendingDeleteCatId = null;

function showCatToast(message) {
  const toast = document.getElementById('catToast');
  if (!toast) return;
  // Remove existing timeout if any to not stack
  if (toast.hideTimeout) clearTimeout(toast.hideTimeout);
  if (toast.removeTimeout) clearTimeout(toast.removeTimeout);
  
  toast.textContent = message;
  toast.classList.remove('hide');
  toast.classList.add('show');
  
  toast.hideTimeout = setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    toast.removeTimeout = setTimeout(() => {
      toast.classList.remove('hide');
    }, 300);
  }, 3000);
}

function closeCatDelModal() {
  const modal = document.getElementById('catDelModal');
  const overlay = document.getElementById('catDelOverlay');
  
  // start close animation
  modal.classList.remove('show');
  modal.classList.add('hide');
  overlay.classList.remove('show');
  
  setTimeout(() => {
    modal.classList.remove('hide'); // reset state completely after transition
  }, 150);
  
  document.body.style.overflow = '';
  pendingDeleteCatId = null;
  document.getElementById('catDelError').style.display = 'none';
  
  // reset button state just in case
  const confirmBtn = document.getElementById('catDelConfirmBtn');
  confirmBtn.disabled = false;
  confirmBtn.textContent = 'Oui, supprimer';
}

function deleteCategory(id) {
  // Step 4: Open modal and populate
  const cat = allCategories.find(c => c.id === id);
  if (!cat) return;
  
  pendingDeleteCatId = id;
  const count = cat.product_count || 0;
  
  document.getElementById('catDelNameHighlight').textContent = cat.name;
  
  const warningBox = document.getElementById('catDelProductsWarning');
  const confirmBtn = document.getElementById('catDelConfirmBtn');
  
  if (count > 0) {
    warningBox.style.display = 'block';
    document.getElementById('catDelCount').textContent = count;
    confirmBtn.disabled = true;
  } else {
    warningBox.style.display = 'none';
    confirmBtn.disabled = false;
  }
  
  confirmBtn.textContent = 'Oui, supprimer';
  document.getElementById('catDelError').style.display = 'none';
  
  // Show modal
  document.getElementById('catDelOverlay').classList.add('show');
  document.getElementById('catDelModal').classList.add('show');
  document.body.style.overflow = 'hidden';
}

// Step 5: Modal close logic listeners
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('catDelCloseBtn');
  const cancelBtn = document.getElementById('catDelCancelBtn');
  const overlay = document.getElementById('catDelOverlay');
  const confirmBtn = document.getElementById('catDelConfirmBtn');
  
  if (closeBtn) closeBtn.addEventListener('click', closeCatDelModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeCatDelModal);
  if (overlay) overlay.addEventListener('click', closeCatDelModal);
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('catDelModal')?.classList.contains('show')) {
      closeCatDelModal();
    }
  });
  
  // Step 6: Modal confirm logic
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if (!pendingDeleteCatId || confirmBtn.disabled) return;
      
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Suppression...';
      document.getElementById('catDelError').style.display = 'none';
      
      try {
        const res = await fetch(`${API}/api/categories/${pendingDeleteCatId}`, {
          method: 'DELETE',
          headers: authHeaders()
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur lors de la suppression');
        
        // Success
        closeCatDelModal();
        showCatToast('Catégorie supprimée avec succès');
        
        // Remove from DOM without reloading page (or fast reload)
        // Since loadCategoriesPanel rebuilds the list quickly, we can just call it
        await loadCategoriesPanel();
        
      } catch(err) {
        // Error
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Oui, supprimer';
        const errEl = document.getElementById('catDelError');
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      }
    });
  }
});


// --- WhatsApp Integration ---
let currentWhatsappOrder = null;
let currentWhatsappTemplate = '';

function buildWhatsAppMessage(template, order) {
  if (!template) return '';
  let itemsList = '';
  if (order.items && order.items.length) {
    itemsList = order.items.map(item => `- ${item.product_name} x${item.quantity} — ${item.price * item.quantity} MAD`).join('\n');
  }
  
  return template
    .replace(/\{clientName\}/g, order.customer_name || '')
    .replace(/\{orderId\}/g, order.id || '')
    .replace(/\{orderItems\}/g, itemsList)
    .replace(/\{orderTotal\}/g, order.total || '')
    .replace(/\{clientAddress\}/g, order.customer_address || '')
    .replace(/\{clientCity\}/g, order.customer_city || '')
    .replace(/\{clientPhone\}/g, order.customer_phone || '');
}

window.openWhatsappModal = function(orderId, templateType) {
  try {
    if (!window.whatsappAdminConfig) {
      // Config not loaded yet — try loading it inline
      showAdminToast("Configuration WhatsApp en cours de chargement...", "info");
      fetch(`${API}/api/settings/whatsapp`, { headers: authHeaders() })
        .then(r => r.json())
        .then(cfg => {
          window.whatsappAdminConfig = cfg;
          window.openWhatsappModal(orderId, templateType);
        })
        .catch(() => showAdminToast("Impossible de charger la config WhatsApp", "error"));
      return;
    }
    if (!window.whatsappAdminConfig.whatsappEnabled) {
      showAdminToast("WhatsApp est désactivé. Activez-le dans Paramètres → Intégration WhatsApp.", "error");
      return;
    }
    
    // Fetch order details
    fetch(`${API}/api/orders/${orderId}`, { headers: authHeaders() })
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(order => {
        currentWhatsappOrder = order;
        currentWhatsappTemplate = templateType;
        
        document.getElementById('waPreviewName').textContent = order.customer_name || '';
        document.getElementById('waPreviewPhone').textContent = order.customer_phone || '';
        document.getElementById('waPreviewCity').textContent = order.customer_city || '';
        document.getElementById('waPreviewTotal').textContent = order.total || '';
        
        let templateStr = '';
        if (templateType === 'confirmation') templateStr = window.whatsappAdminConfig.whatsappTemplateConfirmation;
        else if (templateType === 'shipped') templateStr = window.whatsappAdminConfig.whatsappTemplateShipped;
        else if (templateType === 'delivered') templateStr = window.whatsappAdminConfig.whatsappTemplateDelivered;
        else if (templateType === 'cancelled') templateStr = window.whatsappAdminConfig.whatsappTemplateCancelled;
        else templateStr = ''; // custom message is empty initially
        
        const message = buildWhatsAppMessage(templateStr, order);
        const textarea = document.getElementById('waPreviewMessage');
        textarea.value = message;
        updateWaCharCount();
        
        document.getElementById('waPreviewReset').onclick = (e) => {
          e.preventDefault();
          textarea.value = message;
          updateWaCharCount();
        };
        
        const modal = document.getElementById('whatsappPreviewModal');
        if (!modal) {
          showAdminToast("Erreur: Élément modal introuvable.", "error");
          return;
        }
        modal.style.display = 'flex';
      })
      .catch(err => {
        console.error(err);
        showAdminToast('Erreur lors de la récupération de la commande: ' + err.message, 'error');
      });
  } catch (err) {
    showAdminToast('Erreur inattendue: ' + err.message, 'error');
    console.error('openWhatsappModal Error:', err);
  }
};

function updateWaCharCount() {
  const textarea = document.getElementById('waPreviewMessage');
  const count = textarea.value.length;
  document.getElementById('waPreviewCount').textContent = `${count} caractères`;
}

document.getElementById('waPreviewMessage')?.addEventListener('input', updateWaCharCount);

window.closeWhatsappModal = function() {
  document.getElementById('whatsappPreviewModal').style.display = 'none';
  currentWhatsappOrder = null;
  currentWhatsappTemplate = '';
};

window.sendWhatsappMessage = function() {
  if (!currentWhatsappOrder) {
    showAdminToast('Erreur: Aucune commande sélectionnée', 'error');
    return;
  }
  if (!window.whatsappAdminConfig) {
    showAdminToast('Erreur: Configuration WhatsApp manquante', 'error');
    return;
  }
  
  const text = document.getElementById('waPreviewMessage').value;
  let phone = currentWhatsappOrder.customer_phone || '';
  
  // Format Moroccan phone number
  phone = phone.replace(/[\s+\-()]/g, '');
  if (phone.startsWith('0')) {
    phone = '212' + phone.substring(1);
  } else if (!phone.startsWith('212') && !phone.startsWith('00212')) {
    phone = '212' + phone; // Fallback
  }
  if (phone.startsWith('00212')) {
    phone = phone.substring(2);
  }
  
  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  
  // Open window synchronously to avoid popup blockers
  const newWin = window.open(waUrl, '_blank');
  if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
    // Popup was blocked
    showAdminToast('Le navigateur a bloqué l\'ouverture de WhatsApp. Veuillez autoriser les pop-ups.', 'error');
    // Fallback to current window
    window.location.href = waUrl;
  } else {
    showAdminToast('WhatsApp ouvert — envoyez le message depuis votre téléphone', 'success');
  }
  
  closeWhatsappModal();
  
  // Log action asynchronously
  (async () => {
    try {
      await fetch(`${API}/api/orders/${currentWhatsappOrder.id}/whatsapp-log`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          templateType: currentWhatsappTemplate,
          messagePreview: text
        })
      });
      // Refresh order details if it's currently open
      if (document.getElementById('orderDetailsModal')?.style.display === 'flex') {
        viewOrder(currentWhatsappOrder.id);
      }
    } catch (err) {
      console.error('Failed to log WhatsApp action', err);
    }
  })();
};
