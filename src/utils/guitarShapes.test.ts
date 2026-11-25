import { describe, expect, it } from 'vitest';
import { parseChord, type Chord } from './chordParser';
import { assignFingers, chordShapes, STANDARD_TUNING } from './guitarShapes';
import { mod12 } from './musicTheory';

function chord(symbol: string): Chord {
  const r = parseChord(symbol);
  if (!r.ok) throw new Error(r.error);
  return r.chord;
}

const ROOTS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const SUFFIXES = ['', 'm', 'dim', 'aug', 'sus2', 'sus4', '7', 'maj7', 'm7', 'mMaj7', 'dim7', 'm7b5', 'add9', 'maj9', 'm9', '9', 'sus4add9'];

describe('chord shapes', () => {
  it('every root × type has a valid shape', () => {
    for (const r of ROOTS)
      for (const suf of SUFFIXES) {
        const c = chord(r + suf);
        const shapes = chordShapes(c);
        expect(shapes.length, `${r}${suf}`).toBeGreaterThan(0);
        for (const s of shapes) {
          const sounding = s.frets.flatMap((f, i) => (f === null ? [] : [mod12(STANDARD_TUNING[i] + f)]));
          const where = `${r}${suf} ${s.frets.map((f) => f ?? 'x').join('')}`;
          // only chord tones
          for (const pc of sounding) expect(c.pitchClasses.has(pc), where).toBe(true);
          // root in the bass
          expect(sounding[0], where).toBe(c.root.pitchClass);
          // every tone present, except the perfect 5th may be left out
          for (const t of c.tones)
            if (t.interval.symbol !== '5') expect(sounding.includes(t.pitchClass), `${where} missing ${t.name}`).toBe(true);
          // playable: at most 4 fingers, within the 0–12 fret display
          expect(Math.max(...s.fingers.map((f) => f ?? 0)), where).toBeLessThanOrEqual(4);
          for (const f of s.frets) if (f !== null) expect(f).toBeLessThanOrEqual(12);
          expect(s.frets.filter((f) => f !== null).length, where).toBeGreaterThanOrEqual(3);
        }
      }
  });

  it('uses the familiar open shapes first', () => {
    const first = (sym: string) => chordShapes(chord(sym))[0].frets.map((f) => f ?? 'x').join('');
    expect(first('C')).toBe('x32010');
    expect(first('G')).toBe('320003');
    expect(first('Am')).toBe('x02210');
    expect(first('E')).toBe('022100');
    expect(first('Dmaj7')).toBe('xx0222');
    expect(first('G7')).toBe('320001');
    expect(first('F')).toBe('133211'); // F barre chord
  });

  it('assigns standard fingerings', () => {
    expect(assignFingers([null, 3, 2, 0, 1, 0])!.fingers).toEqual([null, 3, 2, null, 1, null]); // C
    expect(assignFingers([3, 2, 0, 0, 0, 3])!.fingers).toEqual([2, 1, null, null, null, 3]); // G
    const f = assignFingers([1, 3, 3, 2, 1, 1])!; // F barre
    expect(f.fingers).toEqual([1, 3, 4, 2, 1, 1]);
    expect(f.barres).toEqual([{ fret: 1, fromString: 0, toString: 5, finger: 1 }]);
    expect(assignFingers([null, null, 0, 2, 2, 2])!.fingers).toEqual([null, null, null, 1, 2, 3]); // Dmaj7
    expect(assignFingers([null, 0, 2, 2, 2, 0])!.fingers).toEqual([null, null, 1, 2, 3, null]); // A
  });
});
