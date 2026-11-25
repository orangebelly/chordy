import {
  INTERVALS,
  noteName,
  pitchClassOf,
  spellInterval,
  type Interval,
  type Letter,
  type SpelledNote,
} from './musicTheory';

interface ChordType {
  name: string;
  /** Canonical suffix used when displaying the chord symbol */
  suffix: string;
  intervals: string[];
  aliases: string[];
}

// Aliases are case-sensitive on purpose: "M7" (major 7) ≠ "m7" (minor 7).
export const CHORD_TYPES: ChordType[] = [
  { name: 'Major', suffix: '', intervals: ['1', '3', '5'], aliases: ['', 'maj', 'major', 'M'] },
  { name: 'Minor', suffix: 'm', intervals: ['1', 'b3', '5'], aliases: ['m', 'min', 'minor', '-'] },
  { name: 'Diminished', suffix: 'dim', intervals: ['1', 'b3', 'b5'], aliases: ['dim', '°', 'o'] },
  { name: 'Augmented', suffix: 'aug', intervals: ['1', '3', '#5'], aliases: ['aug', '+'] },
  { name: 'Suspended 2nd', suffix: 'sus2', intervals: ['1', '2', '5'], aliases: ['sus2'] },
  { name: 'Suspended 4th', suffix: 'sus4', intervals: ['1', '4', '5'], aliases: ['sus4', 'sus'] },
  { name: 'Dominant 7th', suffix: '7', intervals: ['1', '3', '5', 'b7'], aliases: ['7', 'dom7'] },
  { name: 'Dominant 9th', suffix: '9', intervals: ['1', '3', '5', 'b7', '9'], aliases: ['9', 'dom9'] },
  { name: 'Major 7th', suffix: 'maj7', intervals: ['1', '3', '5', '7'], aliases: ['maj7', 'M7', 'major7', 'Δ', 'Δ7'] },
  { name: 'Minor 7th', suffix: 'm7', intervals: ['1', 'b3', '5', 'b7'], aliases: ['m7', 'min7', 'minor7', '-7'] },
  {
    name: 'Minor Major 7th',
    suffix: 'mMaj7',
    intervals: ['1', 'b3', '5', '7'],
    aliases: ['mMaj7', 'mmaj7', 'mM7', 'minmaj7', 'm(maj7)'],
  },
  { name: 'Diminished 7th', suffix: 'dim7', intervals: ['1', 'b3', 'b5', 'bb7'], aliases: ['dim7', '°7', 'o7'] },
  {
    name: 'Half-diminished 7th',
    suffix: 'm7b5',
    intervals: ['1', 'b3', 'b5', 'b7'],
    aliases: ['m7b5', 'min7b5', 'ø', 'ø7'],
  },
  { name: 'Add 9', suffix: 'add9', intervals: ['1', '3', '5', '9'], aliases: ['add9'] },
  {
    name: 'Suspended 4th add 9',
    suffix: 'sus4add9',
    intervals: ['1', '4', '5', '9'],
    aliases: ['sus4add9', 'sus4(add9)', 'add9sus4', 'sus4add2'],
  },
  { name: 'Major 9th', suffix: 'maj9', intervals: ['1', '3', '5', '7', '9'], aliases: ['maj9', 'M9'] },
  { name: 'Minor 9th', suffix: 'm9', intervals: ['1', 'b3', '5', 'b7', '9'], aliases: ['m9', 'min9'] },
];

export interface ChordTone {
  note: SpelledNote;
  name: string;
  pitchClass: number;
  interval: Interval;
  isRoot: boolean;
}

export interface Chord {
  symbol: string;
  typeName: string;
  /** Canonical suffix, e.g. "maj7" — used to look up guitar shapes */
  suffix: string;
  root: ChordTone;
  tones: ChordTone[];
  /** Distinct pitch classes in the chord — what the instruments highlight (includes a slash bass) */
  pitchClasses: Set<number>;
  /** Slash chord bass ("G/B" → B). Absent for ordinary chords. */
  bass?: BassNote;
}

export interface BassNote {
  note: SpelledNote;
  name: string;
  pitchClass: number;
  /** The bass is one of the chord's own tones (an inversion), not an added note */
  inChord: boolean;
}

export type ParseResult = { ok: true; chord: Chord } | { ok: false; error: string };

const ROOT_RE = /^([A-Ga-g])([#♯b♭]?)(.*)$/;
const SLASH_RE = /^(.+)\/([A-Ga-g])([#♯b♭]?)$/;

/** Put a bass note under a chord. A bass equal to the root changes nothing (C/C = C). */
export function withBass(chord: Chord, bass: SpelledNote): Chord {
  const pitchClass = pitchClassOf(bass);
  if (pitchClass === chord.root.pitchClass) return chord;
  const name = noteName(bass);
  return {
    ...chord,
    symbol: `${chord.symbol}/${name}`,
    bass: { note: bass, name, pitchClass, inChord: chord.pitchClasses.has(pitchClass) },
    pitchClasses: new Set([...chord.pitchClasses, pitchClass]),
  };
}

/** "1st inversion" for G/B, "added bass note" for C/D; null for ordinary chords. */
export function bassDescription(chord: Chord): string | null {
  if (!chord.bass) return null;
  const tone = chord.tones.find((t) => t.pitchClass === chord.bass!.pitchClass);
  if (!tone) return 'added bass note';
  const deg = tone.interval.degree;
  return deg === 3 || deg === 2 || deg === 4 ? '1st inversion' : deg === 5 ? '2nd inversion' : deg === 7 ? '3rd inversion' : `${tone.interval.name} in the bass`;
}

export function parseChord(input: string): ParseResult {
  const text = input.trim().replace(/\s+/g, '');
  if (!text) return { ok: false, error: 'Type a chord name, e.g. Dmaj7.' };

  // Slash chord: "G/B", "D/F#", "Am7/G" — a chord over a bass note.
  const slash = SLASH_RE.exec(text);
  if (slash) {
    const base = parseChord(slash[1]);
    if (!base.ok) return base;
    const acc = slash[3] === '#' || slash[3] === '♯' ? 1 : slash[3] ? -1 : 0;
    return { ok: true, chord: withBass(base.chord, { letter: slash[2].toUpperCase() as Letter, accidental: acc }) };
  }
  if (text.includes('/')) {
    return { ok: false, error: `After "/" put the bass note (A–G), e.g. G/B or D/F#.` };
  }

  const match = ROOT_RE.exec(text);
  if (!match) {
    return { ok: false, error: `"${input.trim()}" doesn't start with a note name (A–G).` };
  }

  const [, letterRaw, accRaw, suffix] = match;
  const letter = letterRaw.toUpperCase() as Letter;
  const accidental = accRaw === '#' || accRaw === '♯' ? 1 : accRaw === 'b' || accRaw === '♭' ? -1 : 0;

  const type = CHORD_TYPES.find((t) => t.aliases.includes(suffix));
  if (!type) {
    return {
      ok: false,
      error: `Sorry, the chord type "${suffix}" isn't supported. Try maj7, m7, 7, dim, aug, sus4, add9…`,
    };
  }

  const rootNote: SpelledNote = { letter, accidental };
  const tones: ChordTone[] = type.intervals.map((sym) => {
    const interval = INTERVALS[sym];
    const note = spellInterval(rootNote, interval);
    return { note, name: noteName(note), pitchClass: pitchClassOf(note), interval, isRoot: sym === '1' };
  });

  return {
    ok: true,
    chord: {
      symbol: noteName(rootNote) + type.suffix,
      typeName: type.name,
      suffix: type.suffix,
      root: tones[0],
      tones,
      pitchClasses: new Set(tones.map((t) => t.pitchClass)),
    },
  };
}

/** Look up how the chord spells a pitch class (e.g. 6 → "F#" in D major). */
export function chordNoteName(chord: Chord, pc: number): string | undefined {
  return chord.tones.find((t) => t.pitchClass === pc)?.name ?? (chord.bass?.pitchClass === pc ? chord.bass.name : undefined);
}

/**
 * MIDI notes for playback: root in octave 3 (C3–B3), other tones stacked
 * above it by their interval. Shared by "Play Chord" and "Play Arpeggio".
 */
export function chordMidiNotes(chord: Chord): number[] {
  const rootMidi = 48 + chord.root.pitchClass;
  const notes = chord.tones.map((t) => rootMidi + t.interval.semitones);
  if (!chord.bass) return notes;
  // Slash chord: the bass sounds below the root.
  return [rootMidi - (((chord.root.pitchClass - chord.bass.pitchClass) % 12) + 12) % 12, ...notes];
}
