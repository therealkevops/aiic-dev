// Hash routes, so the back button and bookmarks work without a router dependency:
//   #/            home (mode chooser)
//   #/learn       learning mode (lesson list); #/learn/<lessonId> opens a lesson
//   #/advanced    the full calculator
//   #/guide       architecture guide; #/guide/<docId> opens a chapter
import { useEffect, useState } from 'react';

const MODE_KEY = 'aiic.mode';

export function parseRoute(hash) {
  const parts = String(hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  switch (parts[0]) {
    case 'learn': return { page: 'learn', lessonId: parts[1] || null };
    case 'advanced': return { page: 'advanced' };
    case 'guide': return { page: 'guide', docId: parts[1] || null };
    default: return { page: 'home' };
  }
}

export function routeHash(route) {
  if (route.page === 'learn') return route.lessonId ? `#/learn/${route.lessonId}` : '#/learn';
  if (route.page === 'home') return '#/';
  if (route.page === 'guide' && route.docId) return `#/guide/${route.docId}`;
  return `#/${route.page}`;
}

/** The mode last used ('learn' | 'advanced'), or null on a first visit. */
export function rememberedMode() {
  try {
    const m = window.localStorage.getItem(MODE_KEY);
    return m === 'learn' || m === 'advanced' ? m : null;
  } catch {
    return null;
  }
}

function rememberMode(mode) {
  try { window.localStorage.setItem(MODE_KEY, mode); } catch { /* storage unavailable */ }
}

/**
 * Current route plus a navigate() function. An empty hash on load opens the home page on a
 * first visit and the last-used mode after that.
 */
export function useRoute() {
  const initial = () => {
    const hash = window.location.hash;
    if (!hash || hash === '#' || hash === '#/') {
      const mode = rememberedMode();
      if (mode) return { page: mode, lessonId: null };
    }
    return parseRoute(hash);
  };
  const [route, setRoute] = useState(initial);

  useEffect(() => {
    const expected = routeHash(route);
    if (window.location.hash !== expected) window.history.replaceState(null, '', expected);
    const onHash = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (route.page === 'learn' || route.page === 'advanced') rememberMode(route.page);
  }, [route.page]);

  const navigate = (next) => {
    const hash = routeHash(next);
    if (window.location.hash !== hash) window.location.hash = hash;
    setRoute(next);
  };
  return [route, navigate];
}
