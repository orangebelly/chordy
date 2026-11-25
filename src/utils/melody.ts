import { defaultNoteName } from './musicTheory';
import { DEFAULT_TYPING, readTyping, type TypingSettings } from './typing';

// A recorded melody: notes measured in beats (quarter notes) from the first downbeat.
// Raw notes keep the exact played timing; quantize() snaps them to a grid for
// display, playback and harmonization, so changing the grid re-snaps losslessly.

export interface RawNote {
  id: string;
  midi: number;
  /** beats from the start of bar 1 (may be slightly negative if played early) */
  start: number;
  end: number;
  /** Placed or edited by hand: keep its exact length (no legato trimming). */
  locked?: boolean;
}

export interface MelodyNote {
  id: string;
  midi: number;
  /** beats */
  start: number;
  duration: number;
}

export interface TimeSignature {
  /** beats per bar, counted in quarter notes */
  beats: number;
  label: string;
}

export const TIME_SIGNATURES: TimeSignature[] = [
  { beats: 4, label: '4/4' },
  { beats: 3, label: '3/4' },
  { beats: 2, label: '2/4' },
];

/** Grid sizes in beats: 1/4 note = 1 beat, 1/8 = ½, 1/16 = ¼. */
export const GRIDS = [
  { beats: 1, label: '1/4' },
  { beats: 0.5, label: '1/8' },
  { beats: 0.25, label: '1/16' },
];

const snap = (x: number, grid: number) => Math.round(x / grid) * grid;

/**
 * Snap starts and ends to the grid. Every note lasts at least one grid step.
 * Melody notes are treated as one line: a note that would overlap the next
 * (a sloppy, late release) is cut where the next one starts. Notes that start
 * together (a chord) are kept as they are, and so are notes edited by hand.
 */
export function quantize(raw: RawNote[], grid: number): MelodyNote[] {
  const notes = raw
    .filter((n) => n.end > 0)
    .map((n) => {
      const start = Math.max(0, snap(n.start, grid));
      const end = Math.max(start + grid, snap(n.end, grid));
      return { id: n.id, midi: n.midi, start, duration: end - start, locked: !!n.locked };
    })
    .sort((a, b) => a.start - b.start || a.midi - b.midi);

  // Same pitch twice on the same grid point → keep one.
  const unique = notes.filter((n, i) => !notes.slice(0, i).some((p) => p.midi === n.midi && p.start === n.start));

  return unique.map(({ locked, ...n }) => {
    const next = unique.find((m) => m.start > n.start);
    if (!locked && next && n.start + n.duration > next.start) return { ...n, duration: next.start - n.start };
    return n;
  });
}

// ---- Hand editing ------------------------------------------------------------

export type NoteEdit =
  | { kind: 'move'; beats: number; semitones: number }
  | { kind: 'resize-start'; beats: number }
  | { kind: 'resize-end'; beats: number };

interface Span {
  id: string;
  midi: number;
  start: number;
  end: number;
}

/**
 * Apply a drag/nudge to a group of notes. Each note is first snapped to the grid
 * (as it is shown), then changed by whole grid steps.
 * A move shifts the whole group by the same amount, limited so that no note goes
 * before beat 0 or outside [low, high]: the group keeps its shape.
 * A resize changes each selected note's own edge; every note keeps ≥ 1 grid step.
 */
export function applyEdit<T extends Span>(items: T[], ids: Iterable<string>, edit: NoteEdit, grid: number, low = 0, high = 127): T[] {
  const sel = new Set(ids);
  const snapped = new Map<string, Span>();
  for (const n of items) {
    if (!sel.has(n.id)) continue;
    const start = Math.max(0, snap(n.start, grid));
    snapped.set(n.id, { id: n.id, midi: n.midi, start, end: Math.max(start + grid, snap(n.end, grid)) });
  }
  if (!snapped.size) return items;
  const group = [...snapped.values()];
  const d = snap(edit.beats, grid);
  let shift = 0;
  let semis = 0;
  if (edit.kind === 'move') {
    shift = Math.max(-Math.min(...group.map((n) => n.start)), d);
    const lo = Math.min(...group.map((n) => n.midi));
    const hi = Math.max(...group.map((n) => n.midi));
    semis = Math.min(high - hi, Math.max(low - lo, edit.semitones));
  }
  return items.map((n) => {
    const g = snapped.get(n.id);
    if (!g) return n;
    let { start, end, midi } = g;
    if (edit.kind === 'move') {
      start += shift;
      end += shift;
      midi += semis;
    } else if (edit.kind === 'resize-end') {
      end = Math.max(start + grid, end + d);
    } else {
      start = Math.min(end - grid, Math.max(0, start + d));
    }
    return { ...n, midi, start, end };
  });
}

/** Edit recorded notes by hand; edited notes are marked so they keep their exact length. */
export function editNotes(raw: RawNote[], ids: Iterable<string>, edit: NoteEdit, grid: number, low = 0, high = 127): RawNote[] {
  const sel = new Set(ids);
  return applyEdit(raw, sel, edit, grid, low, high).map((n, i) => (n !== raw[i] && sel.has(n.id) ? { ...n, locked: true } : n));
}

/** One note (kept for convenience). */
export const editNote = (raw: RawNote[], id: string, edit: NoteEdit, grid: number, low = 0, high = 127) =>
  editNotes(raw, [id], edit, grid, low, high);

/** The same edit on quantized notes — what the roll shows while dragging. */
export function previewEdit(notes: MelodyNote[], ids: Iterable<string>, edit: NoteEdit, grid: number, low = 0, high = 127): MelodyNote[] {
  const spans = notes.map((n) => ({ ...n, end: n.start + n.duration }));
  return applyEdit(spans, ids, edit, grid, low, high).map(({ end, ...n }) => ({ ...n, duration: end - n.start }));
}

/**
 * Pitch range for the piano roll: a comfortable default window that only grows
 * when notes fall outside it (with one semitone of headroom), within [min, max].
 */
export function rollRange(midis: number[], defaultLow: number, defaultHigh: number, min: number, max: number): [number, number] {
  const min0 = Math.min(defaultLow, ...midis);
  const max0 = Math.max(defaultHigh, ...midis);
  // Headroom only when the window actually had to grow.
  const lo = min0 < defaultLow ? min0 - 1 : min0;
  const hi = max0 > defaultHigh ? max0 + 1 : max0;
  return [Math.max(min, lo), Math.min(max, hi)];
}

/** A new hand-placed note. */
export const placedNote = (id: string, midi: number, start: number, length: number): RawNote => ({
  id, midi, start, end: start + length, locked: true,
});

/** Last beat any note sounds (0 for an empty melody). */
export const melodyEnd = (notes: { start: number; duration: number }[]) =>
  notes.reduce((e, n) => Math.max(e, n.start + n.duration), 0);

/** Whole bars needed to hold the melody (at least 1). */
export const barCount = (notes: { start: number; duration: number }[], beatsPerBar: number) =>
  Math.max(1, Math.ceil(melodyEnd(notes) / beatsPerBar - 1e-9));

/** 61 → "C#4" (default spelling, for labels). */
export const midiName = (midi: number) => `${defaultNoteName(midi)}${Math.floor(midi / 12) - 1}`;

// ---- Harmonize page session (saved in localStorage) ---------------------------

export interface MelodySession {
  raw: RawNote[];
  bpm: number;
  beatsPerBar: number;
  /** grid size in beats */
  grid: number;
  metronome: boolean;
  chordsPerBar: 1 | 2;
  /** user-chosen key; null = detect */
  key: { tonic: number; mode: 'major' | 'minor' } | null;
  /** selected plan style */
  plan: string | null;
  /**
   * Chords the user swapped in, per plan and slot index. `sig` identifies the
   * melody + settings they were chosen for; once those change they no longer apply.
   */
  swaps: { sig: string; plans: Record<string, Record<number, { symbol: string; roman: string }>> } | null;
  /** how the computer keyboard plays the melody keyboard */
  typing: TypingSettings;
}

export const DEFAULT_SESSION: MelodySession = {
  raw: [], bpm: 90, beatsPerBar: 4, grid: 0.5, metronome: true, chordsPerBar: 1, key: null, plan: null, swaps: null, typing: DEFAULT_TYPING,
};

const SESSION_KEY = 'chord-visualizer.harmonize.v1';

export function loadMelodySession(): MelodySession {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as Partial<MelodySession> | null;
    if (!s || typeof s !== 'object') return DEFAULT_SESSION;
    const d = DEFAULT_SESSION;
    const raw = Array.isArray(s.raw)
      ? s.raw.filter((n): n is RawNote => !!n && typeof n.id === 'string' && [n.midi, n.start, n.end].every(Number.isFinite) && n.end > n.start)
      : [];
    const key = s.key && Number.isInteger(s.key.tonic) && s.key.tonic >= 0 && s.key.tonic < 12 && (s.key.mode === 'major' || s.key.mode === 'minor')
      ? { tonic: s.key.tonic, mode: s.key.mode } : null;
    return {
      raw,
      bpm: typeof s.bpm === 'number' && s.bpm >= 40 && s.bpm <= 200 ? s.bpm : d.bpm,
      beatsPerBar: TIME_SIGNATURES.some((t) => t.beats === s.beatsPerBar) ? s.beatsPerBar! : d.beatsPerBar,
      grid: GRIDS.some((g) => g.beats === s.grid) ? s.grid! : d.grid,
      metronome: typeof s.metronome === 'boolean' ? s.metronome : d.metronome,
      chordsPerBar: s.chordsPerBar === 2 ? 2 : 1,
      key,
      plan: typeof s.plan === 'string' ? s.plan : null,
      swaps: s.swaps && typeof s.swaps.sig === 'string' && s.swaps.plans && typeof s.swaps.plans === 'object' ? s.swaps : null,
      typing: readTyping(s.typing),
    };
  } catch {
    return DEFAULT_SESSION;
  }
}

export function saveMelodySession(s: MelodySession) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* not persisted */
  }
}
