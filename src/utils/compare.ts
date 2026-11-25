// Compare two chords: "Em7 vs C7" → which notes they share and what each note is in each chord.

import { parseChord, type Chord } from './chordParser';

/** "Em7 vs C7" → ["Em7", "C7"]. Needs spaces around "vs" (or "vs."); otherwise null. */
export function splitComparison(input: string): [string, string] | null {
  const parts = input.trim().split(/\s+vs\.?\s+/i);
  if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) return null;
  return [parts[0].trim(), parts[1].trim()];
}

/** Typed "Em7 vs" and still going: don't flag it as an error yet. */
export const isComparisonInProgress = (input: string) => /\S\s+vs\.?\s*$/i.test(input);

export type ComparisonParse =
  | { ok: true; a: Chord; b: Chord }
  | { ok: false; error: string }
  | null; // not a comparison

export function parseComparison(input: string): ComparisonParse {
  const pair = splitComparison(input);
  if (!pair) return null;
  const a = parseChord(pair[0]);
  const b = parseChord(pair[1]);
  if (!a.ok) return { ok: false, error: `First chord: ${a.error}` };
  if (!b.ok) return { ok: false, error: `Second chord: ${b.error}` };
  return { ok: true, a: a.chord, b: b.chord };
}

export interface Role {
  /** "1", "b3", "7"… or "bass" for a slash chord's added bass note */
  symbol: string;
  /** "Root", "Minor 3rd"… */
  name: string;
  isRoot: boolean;
}

export interface CompareRow {
  pitchClass: number;
  /** Spelled as in the first chord that has it */
  name: string;
  inA: Role | null;
  inB: Role | null;
}

export interface Comparison {
  rows: CompareRow[];
  common: string[];
  onlyA: string[];
  onlyB: string[];
  sameRoot: boolean;
}

function roleIn(chord: Chord, pc: number): Role | null {
  const t = chord.tones.find((x) => x.pitchClass === pc);
  if (t) return { symbol: t.interval.symbol, name: t.interval.name, isRoot: t.isRoot };
  if (chord.bass?.pitchClass === pc) return { symbol: 'bass', name: 'Bass note', isRoot: false };
  return null;
}

function nameIn(chord: Chord, pc: number): string | undefined {
  return chord.tones.find((t) => t.pitchClass === pc)?.name ?? (chord.bass?.pitchClass === pc ? chord.bass.name : undefined);
}

/** Every note of either chord, in the first chord's order, then the second chord's new notes. */
export function compareChords(a: Chord, b: Chord): Comparison {
  const order = (c: Chord) => [...(c.bass ? [c.bass.pitchClass] : []), ...c.tones.map((t) => t.pitchClass)];
  const pcs = [...new Set([...order(a), ...order(b)])];
  const rows = pcs.map((pc) => ({ pitchClass: pc, name: nameIn(a, pc) ?? nameIn(b, pc)!, inA: roleIn(a, pc), inB: roleIn(b, pc) }));
  return {
    rows,
    common: rows.filter((r) => r.inA && r.inB).map((r) => r.name),
    onlyA: rows.filter((r) => r.inA && !r.inB).map((r) => r.name),
    onlyB: rows.filter((r) => !r.inA && r.inB).map((r) => nameIn(b, r.pitchClass)!),
    sameRoot: a.root.pitchClass === b.root.pitchClass,
  };
}
