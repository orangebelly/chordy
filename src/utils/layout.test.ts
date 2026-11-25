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

import { loadPageOrders, PAGE_SECTIONS, savePageOrders } from '../layout';
import { pageFromHash } from '../pages';

describe('per-page section order', () => {
  it('defaults to each page’s sections', () => {
    store.clear();
    expect(loadPageOrders()).toEqual(PAGE_SECTIONS);
  });
  it('migrates an old single-page order, keeping relative order per page', () => {
    store.clear();
    store.set('chord-visualizer.layout.v1', JSON.stringify(['song', 'fretboard', 'search', 'chord', 'piano', 'shape', 'progression']));
    const o = loadPageOrders();
    expect(o.explore).toEqual(['fretboard', 'search', 'chord', 'piano', 'shape']);
    expect(o.compose).toEqual(['song', 'progression']);
    expect(o.harmonize).toEqual(['melody', 'harmony']);
  });
  it('saves per page and repairs bad data', () => {
    store.clear();
    savePageOrders({ ...PAGE_SECTIONS, compose: ['song', 'progression'] });
    expect(loadPageOrders().compose).toEqual(['song', 'progression']);
    store.set('chord-visualizer.layout.v2', JSON.stringify({ explore: ['piano', 'song', 'piano'], compose: 'x' }));
    const o = loadPageOrders();
    expect(o.explore[0]).toBe('piano');
    expect([...o.explore].sort()).toEqual([...PAGE_SECTIONS.explore].sort());
    expect(o.compose).toEqual(PAGE_SECTIONS.compose);
    store.set('chord-visualizer.layout.v2', '{bad');
    expect(loadPageOrders()).toEqual(PAGE_SECTIONS);
  });
});

describe('hash pages', () => {
  it('reads the page from the hash', () => {
    expect(pageFromHash('#/compose')).toBe('compose');
    expect(pageFromHash('#harmonize')).toBe('harmonize');
    expect(pageFromHash('')).toBe(null);
    expect(pageFromHash('#/nope')).toBe(null);
  });
});
