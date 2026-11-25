import { beforeEach, describe, expect, it } from 'vitest';
import {
  addMeasure, arrangeAppend, arrangeMove, arrangeRemoveAt, deleteMeasure, EMPTY_SONG, loadSong, saveSong, updateMeasure,
} from './song';
import { buildSteps, parseProgression } from './progression';
import { chordShapes } from './guitarShapes';

// Minimal in-memory localStorage for the node test environment.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
};

describe('song editing', () => {
  it('adds, names, arranges, repeats, moves and deletes measures', () => {
    let { song, id: verse } = addMeasure(EMPTY_SONG, 'C Am F G');
    const r = addMeasure(song, 'F G C');
    song = r.song;
    const chorus = r.id;
    expect(song.measures.map((m) => m.name)).toEqual(['Measure 1', 'Measure 2']);
    song = arrangeAppend(song, verse); // verse, chorus, verse
    expect(song.arrangement).toEqual([verse, chorus, verse]);
    song = arrangeMove(song, 0, 1);
    expect(song.arrangement).toEqual([chorus, verse, verse]);
    expect(arrangeMove(song, 0, -1)).toBe(song); // can't move past the start
    song = updateMeasure(song, verse, { name: 'Verse', chords: 'C G' });
    expect(song.measures[0]).toMatchObject({ name: 'Verse', chords: 'C G' });
    song = arrangeRemoveAt(song, 2);
    expect(song.arrangement).toEqual([chorus, verse]);
    song = deleteMeasure(song, verse);
    expect(song.arrangement).toEqual([chorus]);
    expect(song.measures).toHaveLength(1);
  });

  it('names never collide after deletes', () => {
    let { song, id } = addMeasure(EMPTY_SONG, 'C');
    song = addMeasure(song, 'D').song; // Measure 1, Measure 2
    song = deleteMeasure(song, id); // Measure 2 left
    song = addMeasure(song, 'E').song;
    expect(song.measures.map((m) => m.name)).toEqual(['Measure 2', 'Measure 3']);
  });
});

describe('persistence', () => {
  beforeEach(() => store.clear());
  it('round-trips through storage', () => {
    const { song } = addMeasure({ ...EMPTY_SONG, title: 'Test', bpm: 120 }, 'Am F C G');
    saveSong(song);
    expect(loadSong()).toEqual(song);
  });
  it('survives corrupt or missing data', () => {
    expect(loadSong()).toEqual(EMPTY_SONG);
    store.set('chord-visualizer.song.v1', '{not json');
    expect(loadSong()).toEqual(EMPTY_SONG);
    store.set('chord-visualizer.song.v1', JSON.stringify({ measures: [{ id: 'a', name: 'A', chords: 'C' }, { bad: 1 }], arrangement: ['a', 'ghost'], bpm: 9999 }));
    const s = loadSong();
    expect(s.measures).toHaveLength(1);
    expect(s.arrangement).toEqual(['a']);
    expect(s.bpm).toBe(EMPTY_SONG.bpm);
  });
});

describe('buildSteps', () => {
  it('optimises shapes across measure boundaries', () => {
    const chords = parseProgression('C Am F G C Am F G').map((p) => p.chord!);
    const steps = buildSteps(chords, chordShapes);
    expect(steps).toHaveLength(8);
    expect(steps.map((s) => s.shape!.frets.map((f) => f ?? 'x').join(''))).toEqual([
      'x32010', 'x02210', '133211', '320003', 'x32010', 'x02210', '133211', '320003',
    ]);
    expect(buildSteps(chords, null)[0].shape).toBeUndefined();
  });
});
