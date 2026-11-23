// legal.js — shared JS for privacy.html, terms.html and legal.html
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

  // ── Shared: populate shop name from settings & legal config ───────────────
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

    // Contact email (privacy & terms)
    const emailEls = document.querySelectorAll('#contactEmail');
    emailEls.forEach(function (el) {
      if (cfg.contactEmail) {
        el.textContent = cfg.contactEmail;
      } else if (s.orderEmail) {
        el.textContent = s.orderEmail;
      } else {
        el.textContent = '';
      }
    });

    // Terms only: phone + address
    const phoneEl = document.getElementById('contactPhone');
    if (phoneEl) {
      phoneEl.textContent = (cfg.phone && cfg.phone.trim()) || s.phone || '';
    }
    const addrEl = document.getElementById('contactAddress');
    if (addrEl) {
      addrEl.textContent = (cfg.address && cfg.address.trim()) || s.address || '';
    }

    // CNDP (privacy & legal)
    const cndpSection = document.getElementById('cndpSection');
    const cndpRef = document.getElementById('cndpRef');
    if (cndpSection && cndpRef) {
      if (cfg.cndpReference && String(cfg.cndpReference).trim()) {
        cndpRef.textContent = String(cfg.cndpReference).trim();
        cndpSection.style.display = '';
      } else {
        cndpSection.style.display = 'none';
      }
    }

    // Terms legal info block
    const legalInfoSection = document.getElementById('legalInfoSection');
    if (legalInfoSection) {
      let anyVisible = false;
      function showTermsRow(rowId, valId, value) {
        const row = document.getElementById(rowId);
        const valEl = document.getElementById(valId);
        if (row && valEl) {
          if (value && String(value).trim()) {
            valEl.textContent = String(value).trim();
            row.style.display = '';
            anyVisible = true;
          } else {
            row.style.display = 'none';
          }
        }
      }
      showTermsRow('legalNameRow', 'legalNameVal', cfg.legalName);
      showTermsRow('iceRow', 'iceVal', cfg.ice);
      showTermsRow('rcRow', 'rcVal', cfg.rc);
      legalInfoSection.style.display = anyVisible ? '' : 'none';
    }

    // ── Legal Notice (legal.html) specific dynamic content ───────────────────
    const pubSection = document.getElementById('publisherSection');
    const hostSection = document.getElementById('hostSection');
    const legalEmptyNotice = document.getElementById('legalEmptyNotice');

    if (pubSection || hostSection || legalEmptyNotice) {
      const effAddr = (cfg.address && cfg.address.trim()) || s.address || '';
      const effPhone = (cfg.phone && cfg.phone.trim()) || s.phone || '';
      const effEmail = (cfg.contactEmail && cfg.contactEmail.trim()) || s.orderEmail || '';

      // Check if user provided any custom legal config
      const hasLegalConfig = Boolean(
        cfg.legalName || cfg.legalForm || cfg.capital || cfg.ice || cfg.rc ||
        cfg.publicationDirector || cfg.hostName || cfg.hostAddress || cfg.hostPhone ||
        cfg.cndpReference || (cfg.address && cfg.address.trim()) || (cfg.phone && cfg.phone.trim()) ||
        (cfg.contactEmail && cfg.contactEmail.trim())
      );

      let pubVisible = false;
      function setPubRow(rowId, valId, val) {
        const row = document.getElementById(rowId);
        const valEl = document.getElementById(valId);
        if (row && valEl) {
          if (val && String(val).trim()) {
            valEl.textContent = String(val).trim();
            row.style.display = '';
            pubVisible = true;
          } else {
            row.style.display = 'none';
          }
        }
      }

      if (hasLegalConfig) {
        setPubRow('pubShopRow', 'pubShopVal', s.siteName);
        setPubRow('pubNameRow', 'pubNameVal', cfg.legalName);
        setPubRow('pubFormRow', 'pubFormVal', cfg.legalForm);
        setPubRow('pubCapitalRow', 'pubCapitalVal', cfg.capital);
        setPubRow('pubAddressRow', 'pubAddressVal', effAddr);
        setPubRow('pubPhoneRow', 'pubPhoneVal', effPhone);
        setPubRow('pubEmailRow', 'pubEmailVal', effEmail);
        setPubRow('pubICERow', 'pubICEVal', cfg.ice);
        setPubRow('pubRCRow', 'pubRCVal', cfg.rc);
        setPubRow('pubDirectorRow', 'pubDirectorVal', cfg.publicationDirector);
      }

      if (pubSection) {
        pubSection.style.display = (hasLegalConfig && pubVisible) ? '' : 'none';
      }

      let hostVisible = false;
      function setHostRow(rowId, valId, val) {
        const row = document.getElementById(rowId);
        const valEl = document.getElementById(valId);
        if (row && valEl) {
          if (val && String(val).trim()) {
            valEl.textContent = String(val).trim();
            row.style.display = '';
            hostVisible = true;
          } else {
            row.style.display = 'none';
          }
        }
      }

      if (hasLegalConfig) {
        setHostRow('hostNameRow', 'hostNameVal', cfg.hostName);
        setHostRow('hostAddressRow', 'hostAddressVal', cfg.hostAddress);
        setHostRow('hostPhoneRow', 'hostPhoneVal', cfg.hostPhone);
      }

      if (hostSection) {
        hostSection.style.display = (hasLegalConfig && hostVisible) ? '' : 'none';
      }

      if (legalEmptyNotice) {
        const anyFilled = hasLegalConfig && (pubVisible || hostVisible || (cfg.cndpReference && String(cfg.cndpReference).trim()));
        legalEmptyNotice.style.display = anyFilled ? 'none' : '';
      }
    }

    // Page title (also set via data-i18n, but make sure <title> matches)
    const isPrivacy = !!document.querySelector('[data-i18n="legal.privacyTitle"]');
    const isTerms = !!document.querySelector('[data-i18n="legal.termsTitle"]');
    const titleKey = isPrivacy ? 'legal.privacyTitle' : (isTerms ? 'legal.termsTitle' : 'legal.legalTitle');
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
