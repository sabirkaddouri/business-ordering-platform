// checkout-notice.js
// Renders the legal notice under the checkout button.
// No inline JS in HTML; all logic here.
(function () {
  'use strict';

  function renderNotice() {
    const el = document.getElementById('checkoutLegalNotice');
    if (!el) return;

    const store = window.i18nStore || {};
    const lang = document.documentElement.lang || 'fr';
    const locale = store[lang] || store['fr'] || {};
    const legal = locale.legal || {};

    const notice = legal.checkoutNotice || 'En passant votre commande, vous acceptez nos';
    const and = legal.checkoutAnd || 'et notre';
    const termsText = legal.termsLink || 'CGV';
    const privacyText = legal.privacyLink || 'Confidentialité';

    el.textContent = '';

    const textNode = document.createTextNode(notice + ' ');
    el.appendChild(textNode);

    const termsLink = document.createElement('a');
    termsLink.href = '/terms.html';
    termsLink.target = '_blank';
    termsLink.rel = 'noopener noreferrer';
    termsLink.textContent = termsText;
    termsLink.style.cssText = 'color:var(--primary);text-decoration:underline;';
    el.appendChild(termsLink);

    el.appendChild(document.createTextNode(' ' + and + ' '));

    const privacyLink = document.createElement('a');
    privacyLink.href = '/privacy.html';
    privacyLink.target = '_blank';
    privacyLink.rel = 'noopener noreferrer';
    privacyLink.textContent = privacyText;
    privacyLink.style.cssText = 'color:var(--primary);text-decoration:underline;';
    el.appendChild(privacyLink);
  }

  // Run after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderNotice);
  } else {
    renderNotice();
  }

  // Re-render when language changes (listen for storage events from other tabs
  // and also re-render when the select changes — handled by re-running after
  // the app's own langSwitcher handler fires)
  window.addEventListener('storage', function (e) {
    if (e.key === 'lang') {
      document.documentElement.lang = e.newValue || 'fr';
      renderNotice();
    }
  });

  // Also hook into the langSwitcher select if present
  document.addEventListener('DOMContentLoaded', function () {
    const sel = document.getElementById('langSwitcher');
    if (sel) {
      sel.addEventListener('change', function () {
        // slight delay so app.js sets the lang first
        setTimeout(renderNotice, 50);
      });
    }
  });
})();
