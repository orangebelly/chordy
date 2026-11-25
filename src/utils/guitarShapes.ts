// Playable chord shapes (fingerings) for standard tuning.
// Two sources:
//   1. A short table of the classic open-position shapes beginners learn first.
//   2. Movable templates (root on the 6th string / root on the 5th string) that
//      are shifted up the neck, so every root × chord type gets a shape.
// Every shape is verified against the chord's pitch classes in the tests.

import type { Chord } from './chordParser';
import { mod12 } from './musicTheory';

/** One entry per string, low E → high E. null = muted (don't play). */
export type Frets = (number | null)[];

export interface Barre {
  fret: number;
  fromString: number;
  toString: number;
  finger: number;
}

export interface ChordShape {
  label: string;
  frets: Frets;
  /** Finger number (1 = index … 4 = pinky) per string, null for open/muted */
  fingers: (number | null)[];
  barres: Barre[];
}

export const STANDARD_TUNING = [40, 45, 50, 55, 59, 64];

const x = null;

/** Classic open shapes, keyed by `${rootPitchClass}:${suffix}`. */
const OPEN_SHAPES: Record<string, Frets> = {
  // Major
  '0:': [x, 3, 2, 0, 1, 0], // C
  '2:': [x, x, 0, 2, 3, 2], // D
  '4:': [0, 2, 2, 1, 0, 0], // E
  '7:': [3, 2, 0, 0, 0, 3], // G
  '9:': [x, 0, 2, 2, 2, 0], // A
  // Minor
  '2:m': [x, x, 0, 2, 3, 1], // Dm
  '4:m': [0, 2, 2, 0, 0, 0], // Em
  '9:m': [x, 0, 2, 2, 1, 0], // Am
  // Dominant 7
  '0:7': [x, 3, 2, 3, 1, 0], // C7
  '2:7': [x, x, 0, 2, 1, 2], // D7
  '4:7': [0, 2, 0, 1, 0, 0], // E7
  '7:7': [3, 2, 0, 0, 0, 1], // G7
  '9:7': [x, 0, 2, 0, 2, 0], // A7
  '11:7': [x, 2, 1, 2, 0, 2], // B7
  // Major 7
  '0:maj7': [x, 3, 2, 0, 0, 0], // Cmaj7
  '2:maj7': [x, x, 0, 2, 2, 2], // Dmaj7
  '4:maj7': [0, 2, 1, 1, 0, 0], // Emaj7
  '5:maj7': [x, x, 3, 2, 1, 0], // Fmaj7
  '7:maj7': [3, 2, 0, 0, 0, 2], // Gmaj7
  '9:maj7': [x, 0, 2, 1, 2, 0], // Amaj7
  // Minor 7
  '2:m7': [x, x, 0, 2, 1, 1], // Dm7
  '4:m7': [0, 2, 0, 0, 0, 0], // Em7
  '9:m7': [x, 0, 2, 0, 1, 0], // Am7
  // Suspended
  '2:sus2': [x, x, 0, 2, 3, 0], // Dsus2
  '9:sus2': [x, 0, 2, 2, 0, 0], // Asus2
  '2:sus4': [x, x, 0, 2, 3, 3], // Dsus4
  '4:sus4': [0, 2, 2, 2, 0, 0], // Esus4
  '9:sus4': [x, 0, 2, 2, 3, 0], // Asus4
  // Add 9
  '0:add9': [x, 3, 2, 0, 3, 0], // Cadd9
};

interface Template {
  rootString: 0 | 1 | 2; // 0 = 6th string (E shape), 1 = 5th (A shape), 2 = 4th (D shape)
  offsets: Frets; // relative to the root's fret
}

/** Movable shapes per chord suffix: [root on 6th string, root on 5th string]. */
const TEMPLATES: Record<string, Template[]> = {
  '': [
    { rootString: 0, offsets: [0, 2, 2, 1, 0, 0] },
    { rootString: 1, offsets: [x, 0, 2, 2, 2, 0] },
    { rootString: 2, offsets: [x, x, 0, 2, 3, 2] },
  ],
  m: [
    { rootString: 0, offsets: [0, 2, 2, 0, 0, 0] },
    { rootString: 1, offsets: [x, 0, 2, 2, 1, 0] },
    { rootString: 2, offsets: [x, x, 0, 2, 3, 1] },
  ],
  dim: [
    { rootString: 0, offsets: [0, 1, 2, 0, x, x] },
    { rootString: 1, offsets: [x, 0, 1, 2, 1, x] },
    { rootString: 2, offsets: [x, x, 0, 1, 3, 1] },
  ],
  aug: [
    { rootString: 0, offsets: [0, 3, 2, 1, 1, 0] },
    { rootString: 1, offsets: [x, 0, -1, -2, -2, x] },
    { rootString: 2, offsets: [x, x, 0, 3, 3, 2] },
  ],
  sus2: [
    { rootString: 0, offsets: [0, 2, 4, 4, 0, 0] },
    { rootString: 1, offsets: [x, 0, 2, 2, 0, 0] },
    { rootString: 2, offsets: [x, x, 0, 2, 3, 0] },
  ],
  sus4: [
    { rootString: 0, offsets: [0, 2, 2, 2, 0, 0] },
    { rootString: 1, offsets: [x, 0, 2, 2, 3, 0] },
    { rootString: 2, offsets: [x, x, 0, 2, 3, 3] },
  ],
  '7': [
    { rootString: 0, offsets: [0, 2, 0, 1, 0, 0] },
    { rootString: 1, offsets: [x, 0, 2, 0, 2, 0] },
    { rootString: 2, offsets: [x, x, 0, 2, 1, 2] },
  ],
  maj7: [
    { rootString: 0, offsets: [0, 2, 1, 1, 0, 0] },
    { rootString: 1, offsets: [x, 0, 2, 1, 2, 0] },
    { rootString: 2, offsets: [x, x, 0, 2, 2, 2] },
  ],
  m7: [
    { rootString: 0, offsets: [0, 2, 0, 0, 0, 0] },
    { rootString: 1, offsets: [x, 0, 2, 0, 1, 0] },
    { rootString: 2, offsets: [x, x, 0, 2, 1, 1] },
  ],
  mMaj7: [
    { rootString: 0, offsets: [0, 2, 1, 0, 0, 0] },
    { rootString: 1, offsets: [x, 0, 2, 1, 1, 0] },
    { rootString: 2, offsets: [x, x, 0, 2, 2, 1] },
  ],
  dim7: [
    { rootString: 0, offsets: [0, x, -1, 0, -1, x] },
    { rootString: 1, offsets: [x, 0, 1, -1, 1, -1] },
    { rootString: 2, offsets: [x, x, 0, 1, 0, 1] },
  ],
  m7b5: [
    { rootString: 0, offsets: [0, x, 0, 0, -1, x] },
    { rootString: 1, offsets: [x, 0, 1, 0, 1, x] },
    { rootString: 2, offsets: [x, x, 0, 1, 1, 1] },
  ],
  add9: [
    { rootString: 0, offsets: [0, 2, 4, 1, 0, 0] },
    { rootString: 1, offsets: [x, 0, 2, 4, 2, 0] },
  ],
  maj9: [
    { rootString: 0, offsets: [0, x, 1, 1, 0, 2] },
    { rootString: 1, offsets: [x, 0, -1, 1, 0, x] },
  ],
  m9: [
    { rootString: 0, offsets: [0, x, 0, 0, 0, 2] },
    { rootString: 1, offsets: [x, 0, -2, 0, 0, 0] },
  ],
};

const MAX_FRET = 12;

/**
 * Work out which finger presses each string.
 * Prefer one finger per string (how open chords are taught). If that needs
 * more than 4 fingers, the index finger barres the lowest fret (unless an
 * open, muted or lower string sits between); if still too many, other fingers
 * may barre too (e.g. the ring-finger barre in some movable shapes).
 * Fingers are handed out from the lowest fret up, low string first.
 * Returns null if the shape can't be played with 4 fingers.
 */
export function assignFingers(frets: Frets): { fingers: (number | null)[]; barres: Barre[] } | null {
  return fingerWith(frets, 'none') ?? fingerWith(frets, 'lowest') ?? fingerWith(frets, 'any');
}

function fingerWith(frets: Frets, barre: 'none' | 'lowest' | 'any') {
  const fingers: (number | null)[] = frets.map(() => null);
  const barres: Barre[] = [];
  const fretted = [...new Set(frets.filter((f): f is number => f !== null && f > 0))].sort((a, b) => a - b);
  let next = 1;

  fretted.forEach((fret, i) => {
    const canBarre = barre === 'any' || (barre === 'lowest' && i === 0);
    let run: number[] = [];
    const flush = () => {
      if (!run.length) return;
      const finger = next++;
      run.forEach((s) => (fingers[s] = finger));
      if (run.length > 1) barres.push({ fret, fromString: run[0], toString: run[run.length - 1], finger });
      run = [];
    };
    frets.forEach((f, s) => {
      if (f === fret) {
        if (!canBarre) flush();
        run.push(s);
      } else if (run.length && (f === null || f < fret)) flush(); // can't barre across this string
    });
    flush();
  });
  return next - 1 <= 4 ? { fingers, barres } : null;
}

function makeShape(label: string, frets: Frets): ChordShape | null {
  const assigned = assignFingers(frets);
  return assigned && { label, frets, ...assigned };
}

/** All playable shapes for a chord in standard tuning, easiest first. */
export function chordShapes(chord: Chord): ChordShape[] {
  const rootPc = chord.root.pitchClass;
  const suffix = chord.suffix;
  const shapes: ChordShape[] = [];

  const open = OPEN_SHAPES[`${rootPc}:${suffix}`];
  if (open) {
    const s = makeShape('Open position', open);
    if (s) shapes.push(s);
  }

  const movable: ChordShape[] = [];
  for (const t of TEMPLATES[suffix] ?? []) {
    const base = mod12(rootPc - mod12(STANDARD_TUNING[t.rootString]));
    for (const rootFret of [base, base + 12]) {
      const frets = t.offsets.map((o) => (o === null ? null : o + rootFret));
      if (frets.some((f) => f !== null && (f < 0 || f > MAX_FRET))) continue;
      const stringName = ['6th', '5th', '4th'][t.rootString];
      const label = frets.every((f) => f === null || f <= 4) && frets.includes(0)
        ? `Open position (root on ${stringName} string)`
        : `Root on ${stringName} string · fret ${rootFret}`;
      const s = makeShape(label, frets);
      if (s) movable.push(s);
    }
  }

  // Easiest (lowest on the neck) first; drop duplicates of the open shape.
  const highest = (s: ChordShape) => Math.max(...s.frets.map((f) => f ?? 0));
  movable.sort((a, b) => highest(a) - highest(b));
  for (const s of movable) {
    if (!shapes.some((e) => e.frets.join() === s.frets.join())) shapes.push(s);
  }
  return shapes;
}

/** MIDI notes a shape sounds, low string → high string (for strumming). */
export function shapeMidiNotes(shape: ChordShape): number[] {
  return shape.frets.flatMap((f, s) => (f === null ? [] : [STANDARD_TUNING[s] + f]));
}
