import { useEffect, useState } from 'react';

/**
 * Is there room for a two-pane layout?
 *
 * 900px is where a 250px list plus a usable reading pane stops fitting. Below
 * it the governance screens fall back to list-then-drill-in, which is what
 * every mail app does and what the existing routes already support.
 *
 * Uses matchMedia rather than a resize listener: the browser only notifies on
 * a crossing, so this does not fire on every pixel of a window drag.
 */
export function useIsWide(minWidth = 900): boolean {
  const query = `(min-width: ${minWidth}px)`;

  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setWide(e.matches);
    setWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return wide;
}
