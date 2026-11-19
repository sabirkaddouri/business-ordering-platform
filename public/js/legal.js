// legal.js — shared JS for privacy.html and terms.html
// No inline JS in HTML; all logic lives here.
(function () {
  'use strict';

  // ── i18n ──────────────────────────────────────────────────────────────────
  const DEFAULT_LANG = 'fr';
  const store = window.i18nStore || {};

  function t(key, replacements) {
    const lang = document.documentElement.lang || DEFAULT_LANG;
    const locale = store[lang] || store[DEFAULT_LANG] || {};
    const parts = key.split('.');
    let val = locale;
    for (const p of parts) {
      val = val && val[p];
      if (val === undefined) break;
    }
    let str = (val !== undefined && val !== null) ? String(val) : key;
    if (replacements) {
      for (const [k, v] of Object.entries(replacements)) {
        str = str.replace(new RegExp('{' + k + '}', 'g'), v);
      }
    }
    return str;
  }

  function applyI18n() {
    const lang = document.documentElement.lang || DEFAULT_LANG;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });
    // RTL
    if (lang === 'ar') {
      document.documentElement.setAttribute('dir', 'rtl');
    } else {
      document.documentElement.setAttribute('dir', 'ltr');
    }
  }

  // ── Language switcher ─────────────────────────────────────────────────────
  function setLang(lang) {
    document.documentElement.lang = lang;
    localStorage.setItem('lang', lang);
    applyI18n();
    // Re-run dynamic content after language change
    populateDynamic();
  }

  const switcher = document.getElementById('langSwitcher');
  if (switcher) {
    const saved = localStorage.getItem('lang') || DEFAULT_LANG;
    document.documentElement.lang = saved;
    switcher.value = saved;
    switcher.addEventListener('change', function () {
      setLang(this.value);
    });
  }

  // ── Shared: populate shop name from settings ──────────────────────────────
  function populateDynamic() {
    const cfg = window.LEGAL_CONFIG || {};
    const days = cfg.returnDays || 7;

    // Returns body: replace {days}
    const returnsEl = document.getElementById('tReturnsBody');
    if (returnsEl) {
      returnsEl.textContent = t('legal.tSection6Body', { days: days });
    }

    // Settings-based content (already fetched — stored in window.__shopSettings)
    const s = window.__shopSettings || {};

    // Shop name in nav + footer
    const shopName = s.siteName || '';
    document.querySelectorAll('#navShopName, #footerShopName').forEach(function (el) {
      if (shopName) el.textContent = shopName;
    });

    // shopNameLine under title
    const shopLine = document.getElementById('shopNameLine');
    if (shopLine && shopName) shopLine.textContent = shopName;

    // Contact email
    const emailEls = document.querySelectorAll('#contactEmail');
    emailEls.forEach(function (el) {
      if (cfg.contactEmail) {
        el.textContent = cfg.contactEmail;
      } else if (s.orderEmail) {
        el.textContent = s.orderEmail;
      } else {
        el.closest && el.closest('.legal-section') && (el.textContent = '');
      }
    });

    // Terms only: phone + address
    const phoneEl = document.getElementById('contactPhone');
    if (phoneEl) phoneEl.textContent = s.phone || '';
    const addrEl = document.getElementById('contactAddress');
    if (addrEl) addrEl.textContent = s.address || '';

    // CNDP (privacy only)
    const cndpSection = document.getElementById('cndpSection');
    const cndpRef = document.getElementById('cndpRef');
    if (cndpSection && cndpRef) {
      if (cfg.cndpReference) {
        cndpRef.textContent = cfg.cndpReference;
        cndpSection.style.display = '';
      } else {
        cndpSection.style.display = 'none';
      }
    }

    // Terms legal info block
    const legalInfoSection = document.getElementById('legalInfoSection');
    if (legalInfoSection) {
      let anyVisible = false;
      function showRow(rowId, valId, value) {
        const row = document.getElementById(rowId);
        const valEl = document.getElementById(valId);
        if (row && valEl) {
          if (value) {
            valEl.textContent = value;
            row.style.display = '';
            anyVisible = true;
          } else {
            row.style.display = 'none';
          }
        }
      }
      showRow('legalNameRow', 'legalNameVal', cfg.legalName);
      showRow('iceRow', 'iceVal', cfg.ice);
      showRow('rcRow', 'rcVal', cfg.rc);
      legalInfoSection.style.display = anyVisible ? '' : 'none';
    }

    // Page title (also set via data-i18n, but make sure <title> matches)
    const titleKey = document.querySelector('[data-i18n="legal.privacyTitle"]') ? 'legal.privacyTitle' : 'legal.termsTitle';
    const pageTitle = t(titleKey);
    document.title = shopName ? (pageTitle + ' — ' + shopName) : pageTitle;
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  applyI18n();

  // Fetch public settings
  fetch('/api/settings/public')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      window.__shopSettings = data;
      populateDynamic();
    })
    .catch(function () {
      window.__shopSettings = {};
      populateDynamic();
    });
})();
