// Offline support: production builds register sw.js, which caches every build file on first
// visit so the app keeps working without a connection and can be installed from the browser.
export function registerServiceWorker() {
  if (!import.meta.env.PROD || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is optional */ });
  });
  // A screen's code file from an older release can be gone after an update; reload once to
  // pick up the new release instead of showing a broken screen.
  window.addEventListener('vite:preloadError', (event) => {
    try {
      if (window.sessionStorage.getItem('aiic.reloaded')) return;
      window.sessionStorage.setItem('aiic.reloaded', '1');
    } catch {
      return; // without storage there is no guard against a reload loop
    }
    event.preventDefault();
    window.location.reload();
  });
}
