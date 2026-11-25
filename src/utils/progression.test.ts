import { describe, expect, it } from 'vitest';
import { chordShapes } from './guitarShapes';
import { mod12 } from './musicTheory';
import {
  optimizeShapes,
  parseProgression,
  pianoVoicings,
  shapeDifficulty,
  transitionCost,
} from './progression';
import type { Chord } from './chordParser';

const chordsOf = (text: string) => parseProgression(text).map((p) => p.chord!) as Chord[];
const shapeStr = (text: string) => {
  const chords = chordsOf(text);
  const lists = chords.map(chordShapes);
  return optimizeShapes(lists).map((k, i) => lists[i][k].frets.map((f) => f ?? 'x').join(''));
};
const totalCost = (lists: ReturnType<typeof chordShapes>[], idx: number[]) =>
  idx.reduce((sum, k, i) => sum + shapeDifficulty(lists[i][k]) + (i ? transitionCost(lists[i - 1][idx[i - 1]], lists[i][k]) : 0), 0);

describe('parseProgression', () => {
  it('splits on spaces, commas and bars', () => {
    expect(parseProgression('C Am, F | G7').map((p) => p.chord?.symbol)).toEqual(['C', 'Am', 'F', 'G7']);
  });
  it('flags invalid chords without throwing', () => {
    const p = parseProgression('C Hx G');
    expect(p[1].chord).toBeNull();
    expect(p[1].error).toBeTruthy();
    expect(p[2].chord?.symbol).toBe('G');
  });
  it('empty input → empty list', () => expect(parseProgression('  ')).toEqual([]));
});

describe('optimizeShapes', () => {
  it('pop progression stays in open position', () => {
    expect(shapeStr('C Am F G')).toEqual(['x32010', 'x02210', '133211', '320003']);
  });
  it('is never worse than always taking the first shape, and is optimal (brute force)', () => {
    for (const prog of ['C Am F G', 'Bb Eb F Cm', 'Dm7 G7 Cmaj7', 'F#m Bm C#7 F#m', 'Ab Db Eb7 Ab', 'E B C#m A']) {
      const lists = chordsOf(prog).map(chordShapes);
      const best = optimizeShapes(lists);
      const first = lists.map(() => 0);
      expect(totalCost(lists, best)).toBeLessThanOrEqual(totalCost(lists, first) + 1e-9);
      // brute force every combination
      let min = Infinity;
      const walk = (i: number, acc: number[]) => {
        if (i === lists.length) return void (min = Math.min(min, totalCost(lists, acc)));
        lists[i].forEach((_, k) => walk(i + 1, [...acc, k]));
      };
      walk(0, []);
      expect(totalCost(lists, best)).toBeCloseTo(min, 9);
    }
  });
  it('keeps barre-chord progressions in one area of the neck', () => {
    const chosen = shapeStr('Bb Eb F Cm');
    const positions = chosen.map((s) => {
      const f = [...s].filter((c) => c !== 'x').map(Number).filter((n) => n > 0);
      return f.reduce((a, b) => a + b, 0) / f.length;
    });
    expect(Math.max(...positions) - Math.min(...positions)).toBeLessThanOrEqual(5);
  });
});

describe('pianoVoicings', () => {
  it('contains exactly the chord tones plus a root bass', () => {
    const chords = chordsOf('C Am F G7 Dmaj7');
    pianoVoicings(chords).forEach((v, i) => {
      expect(mod12(v[0])).toBe(chords[i].root.pitchClass);
      expect(new Set(v.map(mod12))).toEqual(chords[i].pitchClasses);
    });
  });
  it('moves the right hand smoothly (C → F → G)', () => {
    const [c, f, g] = pianoVoicings(chordsOf('C F G')).map((v) => v.slice(1));
    // each voice moves at most a few semitones
    for (const [a, b] of [[c, f], [f, g]]) {
      for (const n of b) expect(Math.min(...a.map((p) => Math.abs(p - n)))).toBeLessThanOrEqual(3);
    }
  });
});
