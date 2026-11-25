import { describe, expect, it } from 'vitest';
import { chordSchedule } from './schedule';

describe('chord schedule', () => {
  const C = [48, 52, 55];
  const G = [43, 47, 50, 55];

  it('each chord stops when the next one starts', () => {
    const { notes, starts, end } = chordSchedule([{ midis: C, beats: 2 }, { midis: G, beats: 1 }, { midis: C, beats: 4 }], 120);
    expect(starts).toEqual([0, 1, 1.5]);
    expect(end).toBe(3.5);
    for (const n of notes) {
      const chord = starts.filter((s) => s <= n.start + 1e-9).length - 1;
      const next = starts[chord + 1] ?? end;
      expect(n.start + n.duration).toBeLessThanOrEqual(next + 1e-9);
    }
  });

  it('strums guitar chords but still ends them on time', () => {
    const { notes } = chordSchedule([{ midis: G, beats: 1 }, { midis: C, beats: 1 }], 60, 0.03);
    expect(notes.slice(0, 4).map((n) => +n.start.toFixed(2))).toEqual([0, 0.03, 0.06, 0.09]);
    expect(notes.slice(0, 4).every((n) => Math.abs(n.start + n.duration - 1) < 1e-9)).toBe(true);
  });

  it('shares volume across a chord’s notes and copes with empty input', () => {
    const { notes } = chordSchedule([{ midis: [60, 64, 67, 71], beats: 1 }], 100, 0, 0.8);
    expect(notes[0].volume).toBeCloseTo(0.4);
    expect(chordSchedule([], 100)).toEqual({ notes: [], starts: [], end: 0 });
  });

  it('a very short chord still sounds a little', () => {
    const { notes } = chordSchedule([{ midis: [60], beats: 0.01 }], 120);
    expect(notes[0].duration).toBeGreaterThanOrEqual(0.05);
  });
});
