// Core music theory helpers.
// Pitch math (semitones / pitch classes 0–11) is kept separate from
// note spelling (letter + accidental), so the instruments only ever
// deal with numbers and the UI decides how to name them.

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Letter = (typeof LETTERS)[number];

/** Pitch class of each natural letter. */
const LETTER_PC: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Default spelling for a bare pitch class (used for non-chord notes). */
const DEFAULT_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export const mod12 = (n: number) => ((n % 12) + 12) % 12;

export interface SpelledNote {
  letter: Letter;
  /** -2 = double flat … +2 = double sharp */
  accidental: number;
}

export function pitchClassOf(note: SpelledNote): number {
  return mod12(LETTER_PC[note.letter] + note.accidental);
}

export function noteName(note: SpelledNote): string {
  const acc = note.accidental;
  const symbol = acc > 0 ? '#'.repeat(acc) : 'b'.repeat(-acc);
  return note.letter + symbol;
}

export function defaultNoteName(pc: number): string {
  return DEFAULT_NAMES[mod12(pc)];
}

export interface Interval {
  /** Symbol shown to the user, e.g. "b3" */
  symbol: string;
  /** Full name, e.g. "Minor 3rd" */
  name: string;
  /** Distance from the root in semitones */
  semitones: number;
  /** Scale degree (1–9); determines which letter is used for spelling */
  degree: number;
}

export const INTERVALS: Record<string, Interval> = {
  '1': { symbol: '1', name: 'Root', semitones: 0, degree: 1 },
  '2': { symbol: '2', name: 'Major 2nd', semitones: 2, degree: 2 },
  b3: { symbol: 'b3', name: 'Minor 3rd', semitones: 3, degree: 3 },
  '3': { symbol: '3', name: 'Major 3rd', semitones: 4, degree: 3 },
  '4': { symbol: '4', name: 'Perfect 4th', semitones: 5, degree: 4 },
  b5: { symbol: 'b5', name: 'Diminished 5th', semitones: 6, degree: 5 },
  '5': { symbol: '5', name: 'Perfect 5th', semitones: 7, degree: 5 },
  '#5': { symbol: '#5', name: 'Augmented 5th', semitones: 8, degree: 5 },
  bb7: { symbol: 'bb7', name: 'Diminished 7th', semitones: 9, degree: 7 },
  b7: { symbol: 'b7', name: 'Minor 7th', semitones: 10, degree: 7 },
  '7': { symbol: '7', name: 'Major 7th', semitones: 11, degree: 7 },
  '9': { symbol: '9', name: 'Major 9th', semitones: 14, degree: 9 },
};

/**
 * Spell the note that sits `interval` above `root`.
 * The letter comes from the scale degree; the accidental is whatever
 * makes the pitch come out right (so D + major 3rd = F#, not Gb).
 */
export function spellInterval(root: SpelledNote, interval: Interval): SpelledNote {
  const rootIndex = LETTERS.indexOf(root.letter);
  const letter = LETTERS[(rootIndex + interval.degree - 1) % 7];
  const targetPc = mod12(pitchClassOf(root) + interval.semitones);
  let accidental = mod12(targetPc - LETTER_PC[letter]);
  if (accidental > 6) accidental -= 12; // e.g. 11 → -1 (flat)
  return { letter, accidental };
}
