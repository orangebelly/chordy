import { describe, expect, it } from 'vitest';
import { parseChord, type Chord } from './chordParser';
import { compareChords, isComparisonInProgress, parseComparison, splitComparison } from './compare';

const ch = (s: string): Chord => {
  const r = parseChord(s);
  if (!r.ok) throw new Error(r.error);
  return r.chord;
};

describe('chord comparison', () => {
  it('needs "a vs b" with spaces', () => {
    expect(splitComparison('Em7 vs C7')).toEqual(['Em7', 'C7']);
    expect(splitComparison('  em7   VS.  c7 ')).toEqual(['em7', 'c7']);
    expect(splitComparison('Em7vsC7')).toBe(null);
    expect(splitComparison('Em7 vs')).toBe(null);
    expect(splitComparison('Em7 vs C7 vs G')).toBe(null);
    expect(isComparisonInProgress('Em7 vs ')).toBe(true);
    expect(isComparisonInProgress('Em7')).toBe(false);
  });

  it('reports which side is wrong', () => {
    expect(parseComparison('Em7 vs X9')).toMatchObject({ ok: false, error: expect.stringMatching(/^Second chord/) });
    expect(parseComparison('Q vs C')).toMatchObject({ ok: false, error: expect.stringMatching(/^First chord/) });
    expect(parseComparison('C')).toBe(null);
    const ok = parseComparison('Em7 vs C7');
    expect(ok && ok.ok && [ok.a.symbol, ok.b.symbol]).toEqual(['Em7', 'C7']);
  });

  it('Em7 vs C7: shares E and G, with their roles in each chord', () => {
    const c = compareChords(ch('Em7'), ch('C7'));
    expect(c.common).toEqual(['E', 'G']);
    expect(c.onlyA).toEqual(['B', 'D']);
    expect(c.onlyB).toEqual(['C', 'Bb']);
    const e = c.rows.find((r) => r.name === 'E')!;
    expect(e.inA).toMatchObject({ symbol: '1', isRoot: true });
    expect(e.inB).toMatchObject({ symbol: '3' });
    expect(c.sameRoot).toBe(false);
  });

  it('C vs Cm: same root, only the 3rd differs', () => {
    const c = compareChords(ch('C'), ch('Cm'));
    expect(c.sameRoot).toBe(true);
    expect(c.common).toEqual(['C', 'G']);
    expect(c.onlyA).toEqual(['E']);
    expect(c.onlyB).toEqual(['Eb']);
  });

  it('slash chords: G vs G/B are the same notes; C vs C/D adds a bass note', () => {
    const g = compareChords(ch('G'), ch('G/B'));
    expect(g.onlyA).toEqual([]);
    expect(g.onlyB).toEqual([]);
    const cd = compareChords(ch('C'), ch('C/D'));
    expect(cd.onlyB).toEqual(['D']);
    expect(cd.rows.find((r) => r.name === 'D')!.inB).toMatchObject({ symbol: 'bass' });
  });
});
