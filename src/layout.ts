// Order of the page sections (user-arrangeable by drag), saved per browser.

export type SectionId = 'search' | 'chord' | 'piano' | 'shape' | 'fretboard' | 'progression' | 'song';

export const DEFAULT_ORDER: SectionId[] = ['search', 'chord', 'piano', 'shape', 'fretboard', 'progression', 'song'];

export const SECTION_TITLES: Record<SectionId, string> = {
  search: 'Chord search',
  chord: 'Chord breakdown',
  piano: 'Piano',
  shape: 'Guitar chord shape',
  fretboard: 'Guitar fretboard',
  progression: 'Chord progression',
  song: 'My song',
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
