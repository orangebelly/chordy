// Order of the page sections (user-arrangeable by drag), saved per browser.

export type SectionId =
  | 'search' | 'chord' | 'piano' | 'shape' | 'fretboard' | 'progression' | 'song'
  | 'melody' | 'harmony';

/** The original single-page order (v1). Still used to migrate old saved layouts. */
export const DEFAULT_ORDER: SectionId[] = ['search', 'chord', 'piano', 'shape', 'fretboard', 'progression', 'song'];

export const SECTION_TITLES: Record<SectionId, string> = {
  search: 'Chord search',
  chord: 'Chord breakdown',
  piano: 'Piano',
  shape: 'Guitar chord shape',
  fretboard: 'Guitar fretboard',
  progression: 'Chord progression',
  song: 'My song',
  melody: 'Melody',
  harmony: 'Harmony suggestions',
};

const KEY = 'chord-visualizer.layout.v1';

/** Saved order, repaired if sections were added/removed since it was saved. */
export function loadOrder(): SectionId[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!Array.isArray(saved)) return DEFAULT_ORDER;
    const known = saved.filter((id): id is SectionId => DEFAULT_ORDER.includes(id));
    const unique = [...new Set(known)];
    return [...unique, ...DEFAULT_ORDER.filter((id) => !unique.includes(id))];
  } catch {
    return DEFAULT_ORDER;
  }
}

export function saveOrder(order: SectionId[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(order));
  } catch {
    /* not persisted */
  }
}

/** Move `id` so it ends up at `index` in the list without it. */
export function moveTo<T>(order: T[], id: T, index: number): T[] {
  const rest = order.filter((x) => x !== id);
  const i = Math.max(0, Math.min(index, rest.length));
  return [...rest.slice(0, i), id, ...rest.slice(i)];
}

// ---- Per-page order (v2) ---------------------------------------------------

export type PageId = 'explore' | 'compose' | 'harmonize';

export const PAGE_SECTIONS: Record<PageId, SectionId[]> = {
  explore: ['search', 'chord', 'piano', 'shape', 'fretboard'],
  compose: ['progression', 'song'],
  harmonize: ['melody', 'harmony'],
};

export type PageOrders = Record<PageId, SectionId[]>;

const PAGES_KEY = 'chord-visualizer.layout.v2';

/** Keep the saved ids that belong to the page (once each), then append any missing ones in default order. */
function repair(saved: unknown, defaults: SectionId[]): SectionId[] {
  if (!Array.isArray(saved)) return defaults;
  const unique = [...new Set(saved.filter((id): id is SectionId => defaults.includes(id)))];
  return [...unique, ...defaults.filter((id) => !unique.includes(id))];
}

/**
 * Saved per-page orders. If only an old single-page (v1) order exists, each
 * page keeps the relative order its sections had there.
 */
export function loadPageOrders(): PageOrders {
  const pages = Object.keys(PAGE_SECTIONS) as PageId[];
  let saved: Partial<Record<PageId, unknown>> = {};
  try {
    const v2 = JSON.parse(localStorage.getItem(PAGES_KEY) ?? 'null');
    if (v2 && typeof v2 === 'object' && !Array.isArray(v2)) saved = v2;
    else {
      const v1 = JSON.parse(localStorage.getItem(KEY) ?? 'null');
      if (Array.isArray(v1)) for (const p of pages) saved[p] = v1;
    }
  } catch {
    /* corrupt — use defaults */
  }
  return Object.fromEntries(pages.map((p) => [p, repair(saved[p], PAGE_SECTIONS[p])])) as PageOrders;
}

export function savePageOrders(orders: PageOrders) {
  try {
    localStorage.setItem(PAGES_KEY, JSON.stringify(orders));
  } catch {
    /* not persisted */
  }
}
