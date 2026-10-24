// Progressive Web App (PWA) Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .catch((error) => {
        console.warn('PWA service worker registration failed:', error);
      });
  });
}
