// Chord progressions: parsing, best guitar shapes, and smooth piano voicings.

import { parseChord, type Chord } from './chordParser';
import type { ChordShape } from './guitarShapes';

export interface ProgressionItem {
  text: string;
  chord: Chord | null;
  error?: string;
}

/** Split "C Am F G" / "C, Am | F G" into chords. */
export function parseProgression(text: string): ProgressionItem[] {
  return text
    .split(/[\s,|]+/)
    .filter(Boolean)
    .map((token) => {
      const r = parseChord(token);
      return r.ok ? { text: token, chord: r.chord } : { text: token, chord: null, error: r.error };
    });
}

// ---- Guitar: choose the shapes that are easiest to play *in sequence* ------

const fretted = (s: ChordShape) => s.frets.filter((f): f is number => f !== null && f > 0);

/** Where the hand sits on the neck (average fretted position; 0 for all-open). */
export function handPosition(s: ChordShape): number {
  const f = fretted(s);
  return f.length ? f.reduce((a, b) => a + b, 0) / f.length : 0;
}

/** How hard a shape is on its own: barres, stretch, fingers, distance up the neck. */
export function shapeDifficulty(s: ChordShape): number {
  const f = fretted(s);
  const span = f.length > 1 ? Math.max(...f) - Math.min(...f) : 0;
  const fingers = Math.max(0, ...s.fingers.map((x) => x ?? 0));
  return fingers * 0.3 + s.barres.length * 1.5 + span * 0.4 + handPosition(s) * 0.15;
}

/** How hard it is to change from shape a to shape b. */
export function transitionCost(a: ChordShape, b: ChordShape): number {
  const move = Math.abs(handPosition(a) - handPosition(b));
  // Fingers that have to lift and land somewhere else.
  let changed = 0;
  b.frets.forEach((f, s) => {
    if (f !== null && f > 0 && !(a.frets[s] === f && a.fingers[s] === b.fingers[s])) changed++;
  });
  return move + changed * 0.25;
}

/**
 * Pick one shape per chord so the whole progression is as easy as possible:
 * minimise (each shape's difficulty + each change between shapes).
 * Classic dynamic programming (Viterbi) over the candidate shapes.
 * Returns the chosen index into each chord's shape list.
 */
export function optimizeShapes(shapeLists: ChordShape[][]): number[] {
  const n = shapeLists.length;
  if (n === 0) return [];
  // best[i][k] = cheapest cost of playing chords 0..i ending on shape k
  const best: number[][] = [];
  const from: number[][] = [];
  best[0] = shapeLists[0].map(shapeDifficulty);
  from[0] = shapeLists[0].map(() => -1);

  for (let i = 1; i < n; i++) {
    best[i] = [];
    from[i] = [];
    shapeLists[i].forEach((shape, k) => {
      let min = Infinity;
      let arg = 0;
      shapeLists[i - 1].forEach((prev, j) => {
        const c = best[i - 1][j] + transitionCost(prev, shape);
        if (c < min) [min, arg] = [c, j];
      });
      best[i][k] = min + shapeDifficulty(shape);
      from[i][k] = arg;
    });
  }

  const result = new Array<number>(n);
  result[n - 1] = best[n - 1].indexOf(Math.min(...best[n - 1]));
  for (let i = n - 1; i > 0; i--) result[i - 1] = from[i][result[i]];
  return result;
}

// ---- Piano: smooth voice leading ------------------------------------------

/** Close-position voicings of the chord (every inversion) in the middle register. */
function inversions(chord: Chord): number[][] {
  const pcs = [...new Set(chord.tones.map((t) => t.pitchClass))];
  const out: number[][] = [];
  for (let k = 0; k < pcs.length; k++) {
    const order = [...pcs.slice(k), ...pcs.slice(0, k)];
    for (const base of [52, 64]) {
      // stack upward from the first note at or above `base`
      const notes: number[] = [];
      let n = base + ((order[0] - base) % 12 + 12) % 12;
      notes.push(n);
      for (const pc of order.slice(1)) {
        n += ((pc - n) % 12 + 12) % 12 || 12;
        notes.push(n);
      }
      if (notes[notes.length - 1] <= 79) out.push(notes);
    }
  }
  return out;
}

const voiceDistance = (a: number[], b: number[]) =>
  b.reduce((sum, n) => sum + Math.min(...a.map((p) => Math.abs(p - n))), 0);

/**
 * Right hand: each chord uses the inversion closest to the previous one, so
 * notes move as little as possible. Left hand: the root in the bass.
 */
export function pianoVoicings(chords: Chord[]): number[][] {
  let prev: number[] | null = null;
  return chords.map((chord) => {
    const options = inversions(chord);
    const target = 64; // keep the first chord around middle C–E
    const right: number[] = prev
      ? options.reduce((a, b) => (voiceDistance(prev!, b) < voiceDistance(prev!, a) ? b : a))
      : options.reduce((a, b) => (Math.abs(b[0] - target) < Math.abs(a[0] - target) ? b : a));
    prev = right;
    const bass = 36 + (chord.bass ?? chord.root).pitchClass; // C2–B2 (a slash chord's bass note)
    return [bass, ...right];
  });
}

// ---- Playback steps ---------------------------------------------------------

export interface Step {
  chord: Chord;
  /** Best guitar shape for this position in the sequence (standard tuning only) */
  shape?: ChordShape;
  shapeIndex?: number;
  /** Voice-led piano notes (bass + right hand) */
  piano: number[];
}

/**
 * Everything needed to play a chord sequence: optimal guitar shapes chosen
 * across the whole sequence, and smooth piano voicings.
 */
export function buildSteps(chords: Chord[], shapesFor: ((c: Chord) => ChordShape[]) | null): Step[] {
  const lists = shapesFor ? chords.map(shapesFor) : [];
  const best = shapesFor ? optimizeShapes(lists) : [];
  const piano = pianoVoicings(chords);
  return chords.map((chord, i) => ({
    chord,
    shape: shapesFor ? lists[i][best[i]] : undefined,
    shapeIndex: shapesFor ? best[i] : undefined,
    piano: piano[i],
  }));
}
