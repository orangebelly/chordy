// Top-level pages, addressed by URL hash (#/explore, #/compose, #/harmonize). No router library.

import { useEffect, useState } from 'react';
import type { PageId } from './layout';

export const PAGES: { id: PageId; label: string; hint: string }[] = [
  { id: 'explore', label: 'Explore', hint: 'Learn one chord' },
  { id: 'compose', label: 'Compose', hint: 'Progressions and songs' },
  { id: 'harmonize', label: 'Harmonize', hint: 'Chords for a melody' },
];

export const DEFAULT_PAGE: PageId = 'explore';

/** "#/compose" → "compose"; anything unknown → null. */
export function pageFromHash(hash: string): PageId | null {
  const id = hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return PAGES.some((p) => p.id === id) ? (id as PageId) : null;
}

export const hashFor = (page: PageId) => `#/${page}`;

/** Current page, kept in sync with the URL hash (back/forward work too). */
export function useHashPage(): [PageId, (p: PageId) => void] {
  const [page, setPage] = useState<PageId>(() => pageFromHash(location.hash) ?? DEFAULT_PAGE);
  useEffect(() => {
    // Normalise an empty or unknown hash without adding a history entry.
    if (!pageFromHash(location.hash)) history.replaceState(null, '', hashFor(page));
    const onHash = () => setPage(pageFromHash(location.hash) ?? DEFAULT_PAGE);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (p: PageId) => {
    if (location.hash !== hashFor(p)) location.hash = hashFor(p);
  };
  return [page, go];
}
