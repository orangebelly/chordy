import { describe, expect, it } from 'vitest';
import { barCount, melodyEnd, midiName, quantize, type RawNote } from './melody';

const raw = (midi: number, start: number, end: number, id = `${midi}-${start}`): RawNote => ({ id, midi, start, end });

describe('quantize', () => {
  it('snaps start and end to the grid, so hold time becomes note length', () => {
    // Held for 0.93 beats → a quarter; 0.47 → an eighth; 1.9 → a half (on a 1/8 grid)
    const q = quantize([raw(60, 0.04, 0.97), raw(62, 1.02, 1.49), raw(64, 1.52, 3.44)], 0.5);
    expect(q.map((n) => [n.midi, n.start, n.duration])).toEqual([
      [60, 0, 1],
      [62, 1, 0.5],
      [64, 1.5, 2],
    ]);
  });

  it('keeps gaps between notes as rests', () => {
    const q = quantize([raw(60, 0, 1), raw(62, 2.03, 3)], 0.5);
    expect(q[1].start).toBe(2);
    expect(q[0].start + q[0].duration).toBe(1);
  });

  it('gives very short taps one grid step', () => {
    expect(quantize([raw(60, 1, 1.05)], 0.25)[0].duration).toBe(0.25);
    expect(quantize([raw(60, 1, 1.05)], 1)[0].duration).toBe(1);
  });

  it('re-quantizes losslessly on a coarser or finer grid', () => {
    const notes = [raw(60, 0.27, 0.74)];
    expect(quantize(notes, 0.25)[0]).toMatchObject({ start: 0.25, duration: 0.5 });
    expect(quantize(notes, 1)[0]).toMatchObject({ start: 0, duration: 1 });
  });

  it('trims a late release that overlaps the next note, but keeps chords', () => {
    const q = quantize([raw(60, 0, 1.3), raw(62, 1, 2)], 0.5);
    expect(q[0].duration).toBe(1);
    const chord = quantize([raw(60, 0, 1), raw(64, 0.02, 1)], 0.5);
    expect(chord.map((n) => n.duration)).toEqual([1, 1]);
  });

  it('clamps notes played a touch early in the count-in to beat 0 and drops ones that ended before it', () => {
    const q = quantize([raw(60, -0.1, 0.9), raw(62, -2, -1)], 0.5);
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ midi: 60, start: 0, duration: 1 });
  });

  it('handles empty input', () => {
    expect(quantize([], 0.5)).toEqual([]);
    expect(melodyEnd([])).toBe(0);
    expect(barCount([], 4)).toBe(1);
  });
});

describe('helpers', () => {
  it('counts bars and names notes', () => {
    expect(barCount([{ start: 0, duration: 4 }], 4)).toBe(1);
    expect(barCount([{ start: 3.5, duration: 1 }], 4)).toBe(2);
    expect(midiName(60)).toBe('C4');
    expect(midiName(70)).toBe('Bb4');
  });
});

import { DEFAULT_SESSION, loadMelodySession, saveMelodySession } from './melody';

describe('melody session storage', () => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
  it('round-trips and repairs bad data', () => {
    expect(loadMelodySession()).toEqual(DEFAULT_SESSION);
    const s = { ...DEFAULT_SESSION, raw: [raw(60, 0, 1)], bpm: 120, grid: 0.25, key: { tonic: 9, mode: 'minor' as const } };
    saveMelodySession(s);
    expect(loadMelodySession()).toEqual(s);
    store.set('chord-visualizer.harmonize.v1', JSON.stringify({ raw: [{ id: 'x', midi: 'C' }, raw(62, 1, 2)], bpm: 9999, grid: 0.3, chordsPerBar: 5 }));
    const r = loadMelodySession();
    expect(r.raw).toHaveLength(1);
    expect(r.bpm).toBe(DEFAULT_SESSION.bpm);
    expect(r.grid).toBe(0.5);
    expect(r.chordsPerBar).toBe(1);
    store.set('chord-visualizer.harmonize.v1', '{oops');
    expect(loadMelodySession()).toEqual(DEFAULT_SESSION);
  });
});

import { editNote } from './melody';

describe('editing notes by hand', () => {
  const take = [raw(60, 0.03, 0.96, 'a'), raw(62, 1.02, 1.6, 'b'), raw(64, 2.1, 3.9, 'c')];

  it('moves a note in time and pitch by whole grid steps', () => {
    const q = quantize(editNote(take, 'b', { kind: 'move', beats: 0.6, semitones: 3 }, 0.5), 0.5);
    expect(q.find((n) => n.id === 'b')).toMatchObject({ midi: 65, start: 1.5, duration: 0.5 });
  });

  it('never moves before beat 0 and keeps pitch in range', () => {
    const q = quantize(editNote(take, 'a', { kind: 'move', beats: -3, semitones: -40 }, 0.5, 48, 84), 0.5);
    expect(q[0]).toMatchObject({ id: 'a', midi: 48, start: 0, duration: 1 });
  });

  it('lengthens and shortens from either edge, at least one grid step', () => {
    const longer = quantize(editNote(take, 'a', { kind: 'resize-end', beats: 0.5 }, 0.5), 0.5);
    expect(longer.find((n) => n.id === 'a')!.duration).toBe(1.5); // overlaps "b": kept, it was edited by hand
    const shorter = quantize(editNote(take, 'c', { kind: 'resize-end', beats: -5 }, 0.5), 0.5);
    expect(shorter.find((n) => n.id === 'c')!.duration).toBe(0.5);
    const later = quantize(editNote(take, 'c', { kind: 'resize-start', beats: 1 }, 0.5), 0.5);
    expect(later.find((n) => n.id === 'c')).toMatchObject({ start: 3, duration: 1 });
    const tooFar = quantize(editNote(take, 'c', { kind: 'resize-start', beats: 9 }, 0.5), 0.5);
    expect(tooFar.find((n) => n.id === 'c')).toMatchObject({ start: 3.5, duration: 0.5 });
  });

  it('leaves the other notes alone', () => {
    const edited = editNote(take, 'b', { kind: 'move', beats: 1, semitones: 0 }, 0.5);
    expect(edited[0]).toBe(take[0]);
    expect(edited[2]).toBe(take[2]);
  });
});

import { editNotes, previewEdit, rollRange } from './melody';

describe('group edits', () => {
  const take = [raw(60, 0, 1, 'a'), raw(64, 1, 2, 'b'), raw(67, 2, 4, 'c'), raw(72, 4, 5, 'd')];

  it('moves a group together, keeping its shape', () => {
    const q = quantize(editNotes(take, ['a', 'b', 'c'], { kind: 'move', beats: 1, semitones: 2 }, 0.5), 0.5);
    expect(q.filter((n) => n.id !== 'd').map((n) => [n.midi, n.start, n.duration])).toEqual([[62, 1, 1], [66, 2, 1], [69, 3, 2]]);
    expect(q.find((n) => n.id === 'd')).toMatchObject({ midi: 72, start: 4 });
  });

  it('stops the whole group at beat 0 and at the pitch limits', () => {
    const q = quantize(editNotes(take, ['b', 'c'], { kind: 'move', beats: -5, semitones: 30 }, 0.5, 48, 72), 0.5);
    expect(q.find((n) => n.id === 'b')).toMatchObject({ start: 0, midi: 69 }); // 67 + 5 = 72 is the top
    expect(q.find((n) => n.id === 'c')).toMatchObject({ start: 1, midi: 72 });
  });

  it('resizes every selected note by its own edge', () => {
    const q = quantize(editNotes(take, ['a', 'c'], { kind: 'resize-end', beats: -1 }, 0.5), 0.5);
    expect(q.find((n) => n.id === 'a')!.duration).toBe(0.5);
    expect(q.find((n) => n.id === 'c')!.duration).toBe(1);
  });

  it('preview on quantized notes matches the committed edit', () => {
    const notes = quantize(take, 0.5);
    const edit = { kind: 'move' as const, beats: 1.5, semitones: -3 };
    const viaRaw = quantize(editNotes(take, ['b', 'd'], edit, 0.5), 0.5);
    const preview = previewEdit(notes, ['b', 'd'], edit, 0.5);
    for (const id of ['b', 'd']) expect(preview.find((n) => n.id === id)).toMatchObject(viaRaw.find((n) => n.id === id)!);
  });

  it('ignores unknown ids', () => {
    expect(editNotes(take, ['zz'], { kind: 'move', beats: 1, semitones: 1 }, 0.5)).toEqual(take);
  });
});

describe('roll range', () => {
  it('keeps the default window until notes go outside it', () => {
    expect(rollRange([], 60, 72, 48, 84)).toEqual([60, 72]);
    expect(rollRange([62, 70], 60, 72, 48, 84)).toEqual([60, 72]);
    expect(rollRange([60, 72], 60, 72, 48, 84)).toEqual([60, 72]);
    expect(rollRange([57, 76], 60, 72, 48, 84)).toEqual([56, 77]);
    expect(rollRange([48, 84], 60, 72, 48, 84)).toEqual([48, 84]);
  });
});
