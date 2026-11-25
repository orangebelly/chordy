// Colour themes. The page reads `data-theme` on <html>; styles.css defines each palette.
// Orange (root) and blue (chord tones) keep their meaning in every theme.

export type ThemeId = 'system' | 'dark' | 'light' | 'midnight' | 'sepia';
export type ResolvedTheme = Exclude<ThemeId, 'system'>;

export const THEMES: { id: ThemeId; name: string; swatch: [string, string] }[] = [
  { id: 'system', name: 'Match system', swatch: ['#f5f3ee', '#131312'] },
  { id: 'dark', name: 'Studio (dark)', swatch: ['#131312', '#2a2a27'] },
  { id: 'light', name: 'Paper (light)', swatch: ['#f5f3ee', '#dcd8ce'] },
  { id: 'midnight', name: 'Midnight', swatch: ['#0e1116', '#26303d'] },
  { id: 'sepia', name: 'Sepia', swatch: ['#efe6d6', '#cdbb9c'] },
];

const KEY = 'chord-visualizer.theme.v1';

export function loadTheme(): ThemeId {
  try {
    const t = localStorage.getItem(KEY) as ThemeId | null;
    return t && THEMES.some((x) => x.id === t) ? t : 'dark';
  } catch {
    return 'dark';
  }
}

export function saveTheme(t: ThemeId) {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* not persisted */
  }
}

const prefersLight = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches;

export function resolveTheme(t: ThemeId): ResolvedTheme {
  return t === 'system' ? (prefersLight() ? 'light' : 'dark') : t;
}

export function applyTheme(t: ThemeId) {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(t);
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#131312');
}

/** Re-apply when the OS theme changes (only matters for "Match system"). */
export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const mq = matchMedia('(prefers-color-scheme: light)');
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
