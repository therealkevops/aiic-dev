import { useEffect, useState } from 'react';

// Tailwind's breakpoints, for layout changes CSS alone can't express (which pane to render).
export const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280 };

/** True while the viewport is at least `px` wide; follows window resizes and rotation. */
export function useMinWidth(px) {
  const query = `(min-width: ${px}px)`;
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : true);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
