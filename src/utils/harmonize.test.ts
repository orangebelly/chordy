import { describe, expect, it } from 'vitest';
import { detectKey, harmonize, keyName, planFor, planToText, rankKeys, type NoteLike } from './harmonize';

/** Build a melody from [midi, beats] pairs played one after another (midi null = rest). */
function seq(...items: [number | null, number][]): NoteLike[] {
  let t = 0;
  const out: NoteLike[] = [];
  for (const [midi, d] of items) {
    if (midi !== null) out.push({ midi, start: t, duration: d });
    t += d;
  }
  return out;
}

const [C, D, E, F, G, A] = [60, 62, 64, 65, 67, 69];
// "Twinkle, Twinkle": C C G G | A A G- | F F E E | D D C-
const twinkle = seq([C, 1], [C, 1], [G, 1], [G, 1], [A, 1], [A, 1], [G, 2], [F, 1], [F, 1], [E, 1], [E, 1], [D, 1], [D, 1], [C, 2]);

describe('key detection', () => {
  it('finds C major for Twinkle Twinkle', () => {
    expect(detectKey(twinkle)).toEqual({ tonic: 0, mode: 'major' });
    expect(keyName(detectKey(twinkle))).toBe('C major');
  });

  it('recognises a minor-key melody', () => {
    // A minor with its raised leading tone: A C E | D C B | C B G# | A-
    const aMinor = seq([69, 1], [72, 1], [76, 2], [74, 1], [72, 1], [71, 2], [72, 1], [71, 1], [68, 2], [69, 4]);
    expect(detectKey(aMinor)).toEqual({ tonic: 9, mode: 'minor' });
    // E minor, natural: E G B | A G F# | E-
    const eMinor = seq([64, 1], [67, 1], [71, 2], [69, 1], [67, 1], [66, 2], [64, 4]);
    expect(detectKey(eMinor).mode).toBe('minor');
    expect(keyName(detectKey(eMinor))).toBe('E minor');
  });

  it('is not fooled by a phrase that stops on the 2nd degree', () => {
    // Ode to Joy, first phrase: E E F G | G F E D | C C D E | E. D D-
    const ode = seq([E, 1], [E, 1], [F, 1], [G, 1], [G, 1], [F, 1], [E, 1], [D, 1], [C, 1], [C, 1], [D, 1], [E, 1], [E, 1.5], [D, 0.5], [D, 2]);
    expect(keyName(detectKey(ode))).toBe('C major');
  });

  it('copes with empty and one-note melodies', () => {
    expect(detectKey([])).toEqual({ tonic: 0, mode: 'major' });
    expect(detectKey([{ midi: 67, start: 0, duration: 1 }]).tonic).toBe(7);
    expect(rankKeys([])).toHaveLength(24);
  });

  it('spells keys conventionally', () => {
    expect(keyName({ tonic: 10, mode: 'major' })).toBe('Bb major');
    expect(keyName({ tonic: 1, mode: 'minor' })).toBe('C# minor');
    expect(keyName({ tonic: 6, mode: 'major' })).toBe('F# major');
  });
});

describe('harmonize', () => {
  it('gives Twinkle Twinkle the textbook I–I–IV–I–IV–I–V–I (two chords per 4/4 bar)', () => {
    const r = harmonize(twinkle, { beatsPerBar: 4, chordsPerBar: 2 });
    const simple = r.plans.find((p) => p.style === 'simple')!;
    expect(simple.slots.map((s) => s.roman)).toEqual(['I', 'I', 'IV', 'I', 'IV', 'I', 'V', 'I']);
    expect(simple.slots.map((s) => s.chord.symbol).join(' ')).toBe('C C F C F C G C');
    expect(planToText(simple)).toBe('C C | F C | F C | G C');
  });

  it('gives the same answer in 2/4 with one chord per bar', () => {
    const plan = planFor(twinkle, { tonic: 0, mode: 'major' }, 'simple', { beatsPerBar: 2, bars: 8 });
    expect(plan.map((s) => s.roman).join(' ')).toBe('I I IV I IV I V I');
  });

  it('one chord per 4/4 bar: starts and ends at home, with a dominant before the end', () => {
    const r = harmonize(twinkle, { beatsPerBar: 4 });
    for (const p of r.plans) {
      expect(p.slots).toHaveLength(4);
      expect(p.slots[0].chord.root.pitchClass).toBe(0);
      expect(p.slots[3].chord.root.pitchClass).toBe(0);
    }
    expect(r.plans.find((p) => p.style === 'simple')!.slots[3].roman).toBe('I');
  });

  it('offers 2–3 distinct plans, each with a reason, built from parseChord chords', () => {
    const r = harmonize(twinkle, { beatsPerBar: 4, chordsPerBar: 2 });
    expect(r.plans.length).toBeGreaterThanOrEqual(2);
    expect(r.plans.length).toBeLessThanOrEqual(3);
    const sigs = r.plans.map((p) => p.slots.map((s) => s.chord.symbol).join());
    expect(new Set(sigs).size).toBe(sigs.length);
    for (const p of r.plans) {
      expect(p.reason.length).toBeGreaterThan(20);
      expect(p.coverage).toBeGreaterThan(0.5);
      for (const s of p.slots) expect(s.chord.tones.length).toBeGreaterThanOrEqual(3);
    }
    const jazz = r.plans.find((p) => p.style === 'jazz')!;
    expect(jazz.slots.every((s) => s.chord.tones.length === 4)).toBe(true);
  });

  it('handles an empty melody', () => {
    const r = harmonize([], { beatsPerBar: 4 });
    expect(r.plans).toEqual([]);
    expect(r.bars).toBe(1);
  });

  it('handles a single note', () => {
    const r = harmonize([{ midi: 64, start: 0, duration: 1 }], { beatsPerBar: 4 });
    expect(r.plans.length).toBeGreaterThan(0);
    for (const p of r.plans) {
      expect(p.slots).toHaveLength(1);
      expect(p.slots[0].chord.pitchClasses.has(4)).toBe(true); // E is a chord tone
    }
  });

  it('harmonizes a minor melody with minor-key chords and a major V', () => {
    const aMinor = seq([69, 1], [72, 1], [76, 2], [74, 1], [77, 1], [74, 2], [71, 1], [74, 1], [68, 2], [69, 4]);
    const r = harmonize(aMinor, { beatsPerBar: 4 });
    expect(keyName(r.key)).toBe('A minor');
    const simple = r.plans.find((p) => p.style === 'simple')!;
    expect(simple.slots[0].chord.symbol).toBe('Am');
    expect(simple.slots.at(-1)!.chord.symbol).toBe('Am');
    expect(simple.slots.map((s) => s.chord.symbol)).toContain('E'); // G# in the melody → E major
  });

  it('respects a key chosen by the user and spells chords from it', () => {
    const r = harmonize(twinkle, { beatsPerBar: 4, key: { tonic: 7, mode: 'major' } });
    expect(r.key).toEqual({ tonic: 7, mode: 'major' });
    expect(r.detectedKey).toEqual({ tonic: 0, mode: 'major' });
    const symbols = r.plans.flatMap((p) => p.slots.map((s) => s.chord.symbol));
    expect(symbols.some((s) => s.startsWith('F') && !s.startsWith('F#'))).toBe(false); // G major has F#, not F
  });

  it('builds chords in every key without failing (incl. double-sharp leading tones)', () => {
    for (let tonic = 0; tonic < 12; tonic++)
      for (const mode of ['major', 'minor'] as const) {
        const r = harmonize(twinkle.map((n) => ({ ...n, midi: n.midi + tonic })), { beatsPerBar: 4, key: { tonic, mode } });
        expect(r.plans.length).toBeGreaterThan(0);
      }
  });

  it('holds the chord through a rest', () => {
    const withRest = seq([C, 1], [E, 1], [G, 2], [null, 4], [G, 1], [F, 1], [D, 2], [C, 4]);
    const simple = harmonize(withRest, { beatsPerBar: 4 }).plans[0];
    expect(simple.slots[1].chord.symbol).toBe(simple.slots[0].chord.symbol);
  });
});

import { chordOptions, withOverrides } from './harmonize';

describe('alternatives and swaps', () => {
  const C_MAJOR = { tonic: 0, mode: 'major' as const };

  it('ranks the chords that contain the slot’s melody first', () => {
    // bar 2 of Twinkle: A A G-  → F (A) or Am/F-family should beat G
    const opts = chordOptions(twinkle, C_MAJOR, { start: 4, duration: 4 }, 4);
    expect(new Set(opts.map((o) => o.chord.symbol)).size).toBe(opts.length);
    expect(opts.length).toBeGreaterThan(10);
    const top = opts.slice(0, 3).map((o) => o.chord.symbol);
    expect(top.some((s) => s.startsWith('F') || s.startsWith('Am'))).toBe(true);
    const best = opts[0];
    expect(best.fit).toBeGreaterThan(0.5);
    const g = opts.find((o) => o.chord.symbol === 'G')!;
    expect(best.score).toBeGreaterThan(g.score);
  });

  it('reports no fit for a silent slot, and works for an empty melody', () => {
    expect(chordOptions([], C_MAJOR, { start: 0, duration: 4 }, 4)[0].fit).toBe(null);
  });

  it('swaps chords in a plan and recomputes the fit', () => {
    const plan = harmonize(twinkle, { beatsPerBar: 4, chordsPerBar: 2 }).plans[0];
    const edited = withOverrides(plan, { 1: { symbol: 'Am', roman: 'vi' } }, twinkle);
    expect(edited.slots[1].chord.symbol).toBe('Am');
    expect(edited.slots[1].roman).toBe('vi');
    expect(edited.edited).toBe(true);
    expect(edited.slots[0]).toBe(plan.slots[0]);
    expect(withOverrides(plan, {}, twinkle)).toBe(plan);
    expect(withOverrides(plan, { 0: { symbol: 'nonsense', roman: '?' } }, twinkle)).toBe(plan);
  });
});
