import { describe, expect, it } from 'vitest';
import { chordMidiNotes, parseChord, type Chord } from './chordParser';
import { fretboardPositions, TUNINGS } from './guitarNotes';
import { mod12 } from './musicTheory';

function notes(symbol: string): string[] {
  const r = parseChord(symbol);
  if (!r.ok) throw new Error(r.error);
  return r.chord.tones.map((t) => t.name);
}
function chord(symbol: string): Chord {
  const r = parseChord(symbol);
  if (!r.ok) throw new Error(r.error);
  return r.chord;
}

describe('required examples', () => {
  it.each([
    ['Dmaj7', ['D', 'F#', 'A', 'C#']],
    ['D7', ['D', 'F#', 'A', 'C']],
    ['Dm7', ['D', 'F', 'A', 'C']],
    ['C', ['C', 'E', 'G']],
    ['Am7', ['A', 'C', 'E', 'G']],
    ['G7', ['G', 'B', 'D', 'F']],
  ])('%s', (sym, expected) => expect(notes(sym)).toEqual(expected));
});

describe('all chord types (root C)', () => {
  it.each([
    ['C', 'C E G'],
    ['Cm', 'C Eb G'],
    ['Cdim', 'C Eb Gb'],
    ['Caug', 'C E G#'],
    ['Csus2', 'C D G'],
    ['Csus4', 'C F G'],
    ['C7', 'C E G Bb'],
    ['Cmaj7', 'C E G B'],
    ['Cm7', 'C Eb G Bb'],
    ['CmMaj7', 'C Eb G B'],
    ['Cdim7', 'C Eb Gb Bbb'],
    ['Cm7b5', 'C Eb Gb Bb'],
    ['Cadd9', 'C E G D'],
    ['Cmaj9', 'C E G B D'],
    ['Cm9', 'C Eb G Bb D'],
    ['C9', 'C E G Bb D'],
    ['Csus4add9', 'C F G D'],
  ])('%s', (sym, expected) => expect(notes(sym).join(' ')).toBe(expected));
});

describe('aliases', () => {
  it.each([
    [['C', 'Cmaj', 'Cmajor'], 'Major'],
    [['Cm', 'Cmin'], 'Minor'],
    [['Cmaj7', 'CM7'], 'Major 7th'],
    [['Cm7', 'Cmin7'], 'Minor 7th'],
  ])('%j → %s', (syms, type) => {
    for (const s of syms) expect(chord(s).typeName).toBe(type);
  });
  it('sus4add9 and 9 aliases', () => {
    for (const s of ['Csus4add9', 'Csus4(add9)', 'Cadd9sus4']) expect(chord(s).typeName).toBe('Suspended 4th add 9');
    expect(chord('Cdom9').typeName).toBe('Dominant 9th');
    expect(notes('E9')).toEqual(['E', 'G#', 'B', 'D', 'F#']);
    expect(notes('Dsus4add9')).toEqual(['D', 'G', 'A', 'E']);
  });
  it('M7 and m7 are different', () => {
    expect(chord('CM7').typeName).toBe('Major 7th');
    expect(chord('Cm7').typeName).toBe('Minor 7th');
  });
});

describe('roots and enharmonics', () => {
  it('handles sharps and flats', () => {
    expect(notes('F#')).toEqual(['F#', 'A#', 'C#']);
    expect(notes('Bb')).toEqual(['Bb', 'D', 'F']);
    expect(notes('Ebm7')).toEqual(['Eb', 'Gb', 'Bb', 'Db']);
    expect(notes('Abmaj7')).toEqual(['Ab', 'C', 'Eb', 'G']);
    expect(notes('C#m')).toEqual(['C#', 'E', 'G#']);
  });
  it('enharmonic roots give the same pitch classes', () => {
    expect([...chord('C#7').pitchClasses]).toEqual([...chord('Db7').pitchClasses]);
    expect([...chord('Gbmaj7').pitchClasses]).toEqual([...chord('F#maj7').pitchClasses]);
  });
  it('all 12 roots parse for every type', () => {
    const roots = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];
    const suffixes = ['', 'm', 'dim', 'aug', 'sus2', 'sus4', '7', 'maj7', 'm7', 'mMaj7', 'dim7', 'm7b5', 'add9', 'maj9', 'm9', '9', 'sus4add9'];
    for (const r of roots)
      for (const s of suffixes) {
        const c = chord(r + s);
        // spelled pitch must equal root + semitones for every tone
        for (const t of c.tones) expect(t.pitchClass).toBe(mod12(c.root.pitchClass + t.interval.semitones));
      }
  });
  it('lowercase root and whitespace are accepted', () => {
    expect(notes(' am7 ')).toEqual(['A', 'C', 'E', 'G']);
  });
});

describe('invalid input', () => {
  it.each(['', 'H7', 'Cxyz', '7', 'C#b', '!!'])('%j returns an error, no throw', (s) => {
    const r = parseChord(s);
    expect(r.ok).toBe(false);
  });
});

describe('playback notes', () => {
  it('Dmaj7 plays D3 F#3 A3 C#4', () => {
    expect(chordMidiNotes(chord('Dmaj7'))).toEqual([50, 54, 57, 61]);
  });
});

describe('guitar fretboard', () => {
  const std = fretboardPositions(TUNINGS[0]);
  const at = (s: number, f: number) => std.find((p) => p.stringIndex === s && p.fret === f)!;
  it('open strings are E2 A2 D3 G3 B3 E4', () => {
    expect([0, 1, 2, 3, 4, 5].map((s) => at(s, 0).midi)).toEqual([40, 45, 50, 55, 59, 64]);
  });
  it('known frets', () => {
    expect(at(0, 3).pitchClass).toBe(7); // G on low E
    expect(at(1, 3).pitchClass).toBe(0); // C on A
    expect(at(4, 1).pitchClass).toBe(0); // C on B
    expect(at(5, 12).midi).toBe(76); // E5
  });
  it('highlighted pitch classes match the piano for C major', () => {
    const c = chord('C');
    const highlighted = new Set(std.filter((p) => c.pitchClasses.has(p.pitchClass)).map((p) => p.pitchClass));
    expect([...highlighted].sort()).toEqual([...c.pitchClasses].sort());
    // 13 frets × 6 strings; C/E/G each appear on every string in a 12-fret span
    expect(std.filter((p) => c.pitchClasses.has(p.pitchClass)).length).toBeGreaterThan(18);
  });
});
