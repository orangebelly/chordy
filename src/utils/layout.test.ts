import { describe, expect, it } from 'vitest';
import { DEFAULT_ORDER, loadOrder, moveTo, saveOrder } from '../layout';

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
};

describe('section order', () => {
  it('moveTo places an item at an index of the remaining list', () => {
    expect(moveTo(['a', 'b', 'c', 'd'], 'a', 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveTo(['a', 'b', 'c', 'd'], 'd', 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveTo(['a', 'b', 'c'], 'b', 99)).toEqual(['a', 'c', 'b']);
  });
  it('persists and repairs saved orders', () => {
    store.clear();
    expect(loadOrder()).toEqual(DEFAULT_ORDER);
    saveOrder(['song', 'piano', ...DEFAULT_ORDER.filter((x) => x !== 'song' && x !== 'piano')]);
    expect(loadOrder().slice(0, 2)).toEqual(['song', 'piano']);
    store.set('chord-visualizer.layout.v1', JSON.stringify(['piano', 'bogus', 'piano']));
    const repaired = loadOrder();
    expect(repaired[0]).toBe('piano');
    expect([...repaired].sort()).toEqual([...DEFAULT_ORDER].sort());
    store.set('chord-visualizer.layout.v1', '{bad');
    expect(loadOrder()).toEqual(DEFAULT_ORDER);
  });
});
