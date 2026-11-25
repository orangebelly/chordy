// Melody harmonization: find the key, then choose one chord per bar (or half bar).
//
//   1. Key: Krumhansl–Schmuckler. Build a duration-weighted pitch-class histogram
//      and correlate it with the 24 rotated Krumhansl–Kessler key profiles.
//   2. Chords: for each plan style, a Viterbi search over the diatonic candidates
//      maximising  melody fit  +  progression smoothness  +  start/cadence bonuses.
//
// Pure functions, no DOM or audio. Chords come from parseChord(), so the rest of
// the app can display and play them unchanged.

import { parseChord, type Chord } from './chordParser';
import { LETTERS, mod12, noteName, pitchClassOf, defaultNoteName, type SpelledNote } from './musicTheory';

/** Only the timing and pitch of a note matter here (beats = quarter notes). */
export interface NoteLike {
  midi: number;
  start: number;
  duration: number;
}

export type Mode = 'major' | 'minor';
export interface Key {
  tonic: number;
  mode: Mode;
}

// ---- Key detection -----------------------------------------------------------

// Krumhansl & Kessler (1982) probe-tone profiles, index 0 = tonic.
const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/**
 * Time spent on each pitch class. The first and last notes count a little extra:
 * melodies usually start and (especially) end on the tonic, which helps tell a
 * major key from its relative minor.
 */
export function pitchClassWeights(notes: NoteLike[]): number[] {
  const w = new Array<number>(12).fill(0);
  if (!notes.length) return w;
  const sorted = [...notes].sort((a, b) => a.start - b.start);
  sorted.forEach((n, i) => {
    const boost = i === sorted.length - 1 ? 1.5 : i === 0 ? 1.2 : 1;
    w[mod12(n.midi)] += Math.max(0, n.duration) * boost;
  });
  return w;
}

function correlation(x: number[], y: number[]): number {
  const mx = x.reduce((a, b) => a + b, 0) / x.length;
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < x.length; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

/**
 * All 24 keys, best match first. The histogram is square-rooted before
 * correlating: with short melodies one long held note otherwise outweighs
 * *which* notes occur (e.g. a C natural that marks A minor rather than A major).
 */
export function rankKeys(notes: NoteLike[]): { key: Key; score: number }[] {
  const w = pitchClassWeights(notes).map(Math.sqrt);
  const out: { key: Key; score: number }[] = [];
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const mode of ['major', 'minor'] as const) {
      const profile = mode === 'major' ? KK_MAJOR : KK_MINOR;
      const rotated = w.map((_, pc) => profile[mod12(pc - tonic)]);
      out.push({ key: { tonic, mode }, score: correlation(w, rotated) });
    }
  }
  // Stable: ties keep C-first / major-first order.
  return out.sort((a, b) => b.score - a.score);
}

/** Most likely key; C major when there's nothing to go on. */
export function detectKey(notes: NoteLike[]): Key {
  if (!notes.some((n) => n.duration > 0)) return { tonic: 0, mode: 'major' };
  return rankKeys(notes)[0].key;
}

// Conventional key spellings (fewest accidentals; F# major / F# minor, Eb minor).
const MAJOR_TONICS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_TONICS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];

function tonicNote(key: Key): SpelledNote {
  const name = (key.mode === 'major' ? MAJOR_TONICS : MINOR_TONICS)[key.tonic];
  return { letter: name[0] as SpelledNote['letter'], accidental: name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0 };
}

export const keyName = (key: Key) => `${noteName(tonicNote(key))} ${key.mode}`;

export const ALL_KEYS: Key[] = (['major', 'minor'] as const).flatMap((mode) =>
  Array.from({ length: 12 }, (_, tonic) => ({ tonic, mode })),
);

export const sameKey = (a: Key, b: Key) => a.tonic === b.tonic && a.mode === b.mode;

const SCALE: Record<Mode, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

/** Pitch classes of the key's scale (minor includes the raised 7th used by V and vii°). */
export function scalePitchClasses(key: Key): Set<number> {
  const pcs = SCALE[key.mode].map((s) => mod12(key.tonic + s));
  if (key.mode === 'minor') pcs.push(mod12(key.tonic + 11));
  return new Set(pcs);
}

// ---- Candidate chords ----------------------------------------------------------

export type PlanStyle = 'simple' | 'pop' | 'jazz';

interface CandidateDef {
  degree: number; // 0 = I … 6 = VII
  suffix: string;
  roman: string;
  /** small cost for less common / more colourful chords */
  cost: number;
  /** minor keys: root on the raised 7th (vii°) */
  raised?: boolean;
}

const c = (degree: number, suffix: string, roman: string, cost = 0, raised = false): CandidateDef => ({
  degree, suffix, roman, cost, raised,
});

const CANDIDATES: Record<Mode, Record<PlanStyle, CandidateDef[]>> = {
  major: {
    simple: [c(0, '', 'I'), c(1, 'm', 'ii', 0.4), c(3, '', 'IV'), c(4, '', 'V'), c(5, 'm', 'vi', 0.3)],
    pop: [
      c(0, '', 'I'), c(1, 'm', 'ii', 0.2), c(2, 'm', 'iii', 0.4), c(3, '', 'IV'), c(4, '', 'V'), c(5, 'm', 'vi'),
      c(4, '7', 'V7', 0.2), c(0, 'add9', 'Iadd9', 0.35), c(3, 'add9', 'IVadd9', 0.35),
    ],
    jazz: [
      c(0, 'maj7', 'Imaj7'), c(1, 'm7', 'ii7'), c(2, 'm7', 'iii7', 0.2), c(3, 'maj7', 'IVmaj7'),
      c(4, '7', 'V7'), c(5, 'm7', 'vi7'), c(6, 'm7b5', 'viiø7', 0.4),
    ],
  },
  minor: {
    simple: [c(0, 'm', 'i'), c(3, 'm', 'iv'), c(4, '', 'V'), c(5, '', 'VI', 0.3), c(2, '', 'III', 0.4), c(6, '', 'VII', 0.4)],
    pop: [
      c(0, 'm', 'i'), c(2, '', 'III', 0.1), c(3, 'm', 'iv'), c(4, '', 'V', 0.1), c(4, 'm', 'v', 0.3),
      c(5, '', 'VI'), c(6, '', 'VII'), c(4, '7', 'V7', 0.2),
    ],
    jazz: [
      c(0, 'm7', 'im7'), c(1, 'm7b5', 'iiø7'), c(2, 'maj7', 'IIImaj7', 0.1), c(3, 'm7', 'ivm7'),
      c(4, '7', 'V7'), c(5, 'maj7', 'VImaj7'), c(6, '7', 'VII7', 0.2), c(6, 'dim7', 'vii°7', 0.4, true),
    ],
  },
};

interface Candidate extends CandidateDef {
  chord: Chord;
}

/** Spell the chord root from the key (D major's vii is C#, not Db), then parse it. */
function buildCandidate(key: Key, def: CandidateDef): Candidate | null {
  const tonic = tonicNote(key);
  const letter = LETTERS[(LETTERS.indexOf(tonic.letter) + def.degree) % 7];
  const pc = mod12(key.tonic + SCALE[key.mode][def.degree] + (def.raised ? 1 : 0));
  let acc = mod12(pc - pitchClassOf({ letter, accidental: 0 }));
  if (acc > 6) acc -= 12;
  // parseChord takes one accidental at most; fall back to the plain name (e.g. F## → G).
  const root = Math.abs(acc) <= 1 ? noteName({ letter, accidental: acc }) : defaultNoteName(pc);
  const r = parseChord(root + def.suffix);
  return r.ok ? { ...def, chord: r.chord } : null;
}

export function candidatesFor(key: Key, style: PlanStyle): Candidate[] {
  return CANDIDATES[key.mode][style].map((d) => buildCandidate(key, d)).filter((x): x is Candidate => !!x);
}

// ---- Progression smoothness ------------------------------------------------------

// How natural it is to move from one scale degree to another (rows: from, cols: to).
// Built around tonic → subdominant → dominant → tonic, with the usual
// relatives (vi ≈ tonic, ii ≈ subdominant, vii° ≈ dominant).
const FLOW = [
  //  I     ii    iii   IV    V     vi    vii
  [0, 0.5, 0.2, 1.0, 0.9, 0.7, 0.3], // I
  [-0.4, 0, -0.5, 0.2, 1.2, -0.3, 0.6], // ii
  [0.1, 0.3, 0, 0.7, 0.2, 0.9, -0.3], // iii
  [0.7, 0.5, -0.2, 0, 1.1, 0.2, 0.6], // IV
  [1.3, -0.6, -0.2, -0.4, 0, 0.7, -0.2], // V
  [0.1, 0.9, 0.1, 0.9, 0.5, 0, 0.2], // vi
  [1.1, -0.5, 0.3, -0.5, 0.2, 0.2, 0], // vii
];

const isDominant = (cand: CandidateDef, mode: Mode) =>
  cand.degree === 4 || (cand.degree === 6 && (mode === 'major' || !!cand.raised));

function flow(from: Candidate, to: Candidate, style: PlanStyle, mode: Mode, emptySlot: boolean): number {
  const same = from.chord.symbol === to.chord.symbol;
  if (same) {
    // Holding a chord through a rest is natural; otherwise each style has its own taste for change.
    const hold = { simple: 1.0, pop: 0.2, jazz: 0.1 }[style];
    return emptySlot ? hold + 0.6 : hold;
  }
  let v = FLOW[from.degree][to.degree];
  // In minor, the natural VII leads to III (it is III's dominant) rather than home.
  if (mode === 'minor' && from.degree === 6 && !from.raised) v = to.degree === 2 ? 1.0 : to.degree === 0 ? 0.6 : v;
  if (style === 'pop') {
    // I–V–vi–IV territory: the deceptive V → vi and vi → IV are staples.
    if (from.degree === 4 && to.degree === 5) v = 1.1;
    if (from.degree === 5 && to.degree === 3) v = 1.2;
    if (from.degree === 3 && to.degree === 0) v = 1.0;
    if (from.degree === 0 && to.degree === 4) v = 1.1;
    if (from.degree === 4 && to.degree === 3) v = 0.3;
  }
  if (style === 'jazz') {
    // Roots falling by a fifth (vi → ii → V → I) are the backbone of jazz harmony.
    if (mod12(from.chord.root.pitchClass - to.chord.root.pitchClass) === 7) v += 0.5;
  }
  // Same degree, different colour (V → V7, I → Iadd9): a gentle change.
  if (from.degree === to.degree) v = 0.3;
  return v;
}

// ---- Melody fit ------------------------------------------------------------------

export interface FitOptions {
  beatsPerBar: number;
}

/** Strong beats weigh more: downbeat > middle of a 4/4 bar > other beats > off-beats. */
export function metricWeight(beat: number, beatsPerBar: number): number {
  const pos = ((beat % beatsPerBar) + beatsPerBar) % beatsPerBar;
  if (Math.abs(pos) < 1e-6) return 1.5;
  if (beatsPerBar === 4 && Math.abs(pos - 2) < 1e-6) return 1.2;
  if (Math.abs(pos - Math.round(pos)) < 1e-6) return 1.0;
  return 0.7;
}

type Motion = 'passing' | 'neighbor' | 'step' | 'leap' | 'inner';

/**
 * How each note moves within the melody line (the top voice): passing tones
 * and neighbour tones are the classic ways a non-chord note is "allowed".
 */
function classifyMotion(notes: NoteLike[]): Map<NoteLike, Motion> {
  const byStart = new Map<number, NoteLike>();
  for (const n of notes) {
    const cur = byStart.get(n.start);
    if (!cur || n.midi > cur.midi) byStart.set(n.start, n);
  }
  const line = [...byStart.values()].sort((a, b) => a.start - b.start);
  const out = new Map<NoteLike, Motion>(notes.map((n) => [n, 'inner']));
  line.forEach((n, i) => {
    const a = i > 0 ? n.midi - line[i - 1].midi : null;
    const b = i < line.length - 1 ? line[i + 1].midi - n.midi : null;
    const step = (d: number | null) => d !== null && d !== 0 && Math.abs(d) <= 2;
    let m: Motion = 'leap';
    if (step(a) && step(b)) m = Math.sign(a!) === Math.sign(b!) ? 'passing' : 'neighbor';
    else if (step(a) || step(b)) m = 'step';
    out.set(n, m);
  });
  return out;
}

const NON_CHORD_PENALTY: Record<Motion, number> = { passing: 0.25, neighbor: 0.3, step: 0.6, leap: 1.0, inner: 0.8 };

function slotFit(
  chord: Chord,
  notes: NoteLike[],
  start: number,
  end: number,
  motion: Map<NoteLike, Motion>,
  scale: Set<number>,
  beatsPerBar: number,
): number {
  let score = 0;
  for (const n of notes) {
    const overlap = Math.min(end, n.start + n.duration) - Math.max(start, n.start);
    if (overlap <= 1e-9) continue;
    const attacked = n.start >= start - 1e-9;
    const w = overlap * (attacked ? metricWeight(n.start, beatsPerBar) : 0.6);
    if (chord.pitchClasses.has(mod12(n.midi))) {
      score += w;
    } else {
      const onStrongBeat = attacked && metricWeight(n.start, beatsPerBar) >= 1.2;
      let p = NON_CHORD_PENALTY[motion.get(n) ?? 'leap'];
      // Passing/neighbour notes belong on weak beats; on a strong beat they clash more.
      if (onStrongBeat && p < 1) p = Math.min(1, p + 0.35);
      // A chromatic note can't be a chord tone of any diatonic chord — don't let it decide.
      if (!scale.has(mod12(n.midi))) p *= 0.5;
      score -= w * p;
    }
  }
  return score;
}

// ---- Plans -----------------------------------------------------------------------

export interface HarmonySlot {
  /** beats */
  start: number;
  duration: number;
  bar: number;
  chord: Chord;
  roman: string;
}

export interface HarmonyPlan {
  style: PlanStyle;
  name: string;
  /** One sentence: why these chords */
  reason: string;
  slots: HarmonySlot[];
  /** Share of melody time that sits on chord tones (0–1) */
  coverage: number;
  /** Some chords were swapped by the user */
  edited?: boolean;
}

export interface HarmonizeOptions {
  beatsPerBar: number;
  /** 1 = one chord per bar, 2 = one per half bar */
  chordsPerBar?: 1 | 2;
  /** Force a key instead of detecting it */
  key?: Key;
  /** Number of bars (default: just enough for the melody) */
  bars?: number;
}

export interface HarmonizeResult {
  key: Key;
  detectedKey: Key;
  bars: number;
  plans: HarmonyPlan[];
}

const PLAN_NAMES: Record<PlanStyle, string> = { simple: 'Simple', pop: 'Pop', jazz: 'Jazz' };

/** Best chord sequence for one style (Viterbi over slots × candidates). */
export function planFor(notes: NoteLike[], key: Key, style: PlanStyle, opts: HarmonizeOptions & { bars: number }): HarmonySlot[] {
  const per = opts.chordsPerBar ?? 1;
  const slotLen = opts.beatsPerBar / per;
  const nSlots = opts.bars * per;
  const cands = candidatesFor(key, style);
  const motion = classifyMotion(notes);
  const scale = scalePitchClasses(key);
  const tonicIdx = cands.findIndex((x) => x.degree === 0);
  // If the melody ends on a note of the tonic triad, the last chord should really be the tonic.
  const finalNote = notes.reduce<NoteLike | null>((a, n) => (!a || n.start + n.duration >= a.start + a.duration ? n : a), null);
  const tonicTriad = [0, key.mode === 'major' ? 4 : 3, 7].map((i) => mod12(key.tonic + i));
  const endsHome = !!finalNote && tonicTriad.includes(mod12(finalNote.midi));

  const slotStart = (s: number) => s * slotLen;
  const isEmpty = (s: number) =>
    !notes.some((n) => n.start < slotStart(s) + slotLen - 1e-9 && n.start + n.duration > slotStart(s) + 1e-9);

  const best: number[][] = [];
  const from: number[][] = [];
  for (let s = 0; s < nSlots; s++) {
    best[s] = [];
    from[s] = [];
    const last = s === nSlots - 1;
    const empty = isEmpty(s);
    cands.forEach((cand, k) => {
      let local = slotFit(cand.chord, notes, slotStart(s), slotStart(s) + slotLen, motion, scale, opts.beatsPerBar) - cand.cost;
      if (cand.degree === 0 && s === 0) local += 1.2; // start at home
      if (cand.degree === 0 && last) local += endsHome ? 4.5 : 2.0; // and end there
      if (s === 0) {
        best[s][k] = local;
        from[s][k] = -1;
        return;
      }
      let max = -Infinity;
      let arg = 0;
      cands.forEach((prev, j) => {
        let t = best[s - 1][j] + flow(prev, cand, style, key.mode, empty);
        if (last && cand.degree === 0 && isDominant(prev, key.mode)) t += 1.0; // authentic cadence
        if (t > max) [max, arg] = [t, j];
      });
      best[s][k] = max + local;
      from[s][k] = arg;
    });
  }

  const path = new Array<number>(nSlots);
  const lastRow = best[nSlots - 1];
  path[nSlots - 1] = lastRow.indexOf(Math.max(...lastRow));
  if (path[nSlots - 1] < 0) path[nSlots - 1] = Math.max(0, tonicIdx);
  for (let s = nSlots - 1; s > 0; s--) path[s - 1] = from[s][path[s]];

  return path.map((k, s) => ({
    start: slotStart(s),
    duration: slotLen,
    bar: Math.floor(s / per),
    chord: cands[k].chord,
    roman: cands[k].roman,
  }));
}

/** Share of melody duration that sounds over a chord containing that note. */
export function chordToneCoverage(notes: NoteLike[], slots: HarmonySlot[]): number {
  let total = 0, inside = 0;
  for (const n of notes) {
    for (const sl of slots) {
      const ov = Math.min(sl.start + sl.duration, n.start + n.duration) - Math.max(sl.start, n.start);
      if (ov <= 0) continue;
      total += ov;
      if (sl.chord.pitchClasses.has(mod12(n.midi))) inside += ov;
    }
  }
  return total ? inside / total : 1;
}

function explain(style: PlanStyle, slots: HarmonySlot[], coverage: number, key: Key): string {
  const pct = `${Math.round(coverage * 100)}%`;
  const n = slots.length;
  const romans = slots.map((s) => s.roman);
  const dominantEnd = n >= 2 && /^(V(?!I)|vii)/.test(romans[n - 2]) && /^[Ii](?![iIvV])/.test(romans[n - 1]);
  const cadence = dominantEnd ? `, closing with a ${romans[n - 2]} → ${romans[n - 1]} cadence` : '';
  const distinct = new Set(slots.map((s) => s.chord.symbol)).size;
  if (style === 'simple') {
    const primary = key.mode === 'major' ? 'I, IV and V' : 'i, iv and V';
    return `Sticks to the primary chords ${primary} and keeps a chord while the melody still fits it; ${pct} of the melody lands on chord tones${cadence}.`;
  }
  if (style === 'pop') {
    const usesSix = romans.some((r) => /^(vi|VI)/.test(r));
    return `Changes chords more freely (${distinct} different)${usesSix ? ' and leans on the relative minor/major for colour' : ''}, like a pop song; ${pct} of the melody lands on chord tones${cadence}.`;
  }
  const iiVI = romans.some((r, i) => /^ii(?!i)/.test(r) && /^V(?!I)/.test(romans[i + 1] ?? '') && /^[Ii]/.test(romans[i + 2] ?? ''));
  return `Every chord is a 7th chord for a richer, jazzier colour${iiVI ? ', with a ii–V–I along the way' : ''}; ${pct} of the melody lands on chord tones${cadence}.`;
}

/** Detect the key (unless given) and propose up to three different harmonizations. */
export function harmonize(notes: NoteLike[], opts: HarmonizeOptions): HarmonizeResult {
  const valid = notes.filter((n) => n.duration > 0 && Number.isFinite(n.start));
  const detectedKey = detectKey(valid);
  const key = opts.key ?? detectedKey;
  const end = valid.reduce((e, n) => Math.max(e, n.start + n.duration), 0);
  const bars = opts.bars ?? Math.max(1, Math.ceil(end / opts.beatsPerBar - 1e-9));
  if (!valid.length) return { key, detectedKey, bars, plans: [] };

  const plans: HarmonyPlan[] = [];
  for (const style of ['simple', 'pop', 'jazz'] as const) {
    const slots = planFor(valid, key, style, { ...opts, bars });
    // Skip a plan that came out identical to an earlier one.
    const sig = slots.map((s) => s.chord.symbol).join(' ');
    if (plans.some((p) => p.slots.map((s) => s.chord.symbol).join(' ') === sig)) continue;
    const coverage = chordToneCoverage(valid, slots);
    plans.push({ style, name: PLAN_NAMES[style], reason: explain(style, slots, coverage, key), slots, coverage });
  }
  return { key, detectedKey, bars, plans };
}

/** "C F | G C" — bars separated by "|", ready for the progression editor. */
export function planToText(plan: HarmonyPlan): string {
  const bars: string[][] = [];
  for (const s of plan.slots) (bars[s.bar] ??= []).push(s.chord.symbol);
  return bars.map((b) => b.join(' ')).join(' | ');
}

// ---- Alternatives for one slot, and user swaps -------------------------------------

// Extra colours offered as alternatives (never chosen automatically).
const EXTRAS: Record<Mode, CandidateDef[]> = {
  major: [
    c(0, 'sus2', 'Isus2', 0.4), c(0, 'sus4', 'Isus4', 0.4), c(3, 'sus2', 'IVsus2', 0.4),
    c(4, 'sus4', 'Vsus4', 0.3), c(4, '9', 'V9', 0.3), c(0, 'maj9', 'Imaj9', 0.4), c(1, 'm9', 'ii9', 0.4),
    c(5, 'm9', 'vi9', 0.4), c(4, 'sus4add9', 'Vsus4add9', 0.5),
  ],
  minor: [
    c(0, 'm9', 'im9', 0.4), c(0, 'sus2', 'isus2', 0.4), c(4, 'sus4', 'Vsus4', 0.3), c(3, 'm9', 'iv9', 0.4),
    c(6, 'dim', 'vii°', 0.3, true), c(1, 'dim', 'ii°', 0.3),
  ],
};

export interface ChordOption {
  chord: Chord;
  roman: string;
  /** Share of the slot's melody (by time) that sits on chord tones; null if the slot is silent */
  fit: number | null;
  score: number;
}

/**
 * Every diatonic chord (triads, 7ths and a few colours) ranked by how well it fits
 * the melody in [start, start + duration). Best first.
 */
export function chordOptions(notes: NoteLike[], key: Key, slot: { start: number; duration: number }, beatsPerBar: number): ChordOption[] {
  const defs = [
    ...CANDIDATES[key.mode].simple, ...CANDIDATES[key.mode].pop, ...CANDIDATES[key.mode].jazz, ...EXTRAS[key.mode],
  ];
  const motion = classifyMotion(notes);
  const scale = scalePitchClasses(key);
  const seen = new Set<string>();
  const out: ChordOption[] = [];
  for (const d of defs) {
    const cand = buildCandidate(key, d);
    if (!cand || seen.has(cand.chord.symbol)) continue;
    seen.add(cand.chord.symbol);
    const score = slotFit(cand.chord, notes, slot.start, slot.start + slot.duration, motion, scale, beatsPerBar) - cand.cost;
    const fake: HarmonySlot = { start: slot.start, duration: slot.duration, bar: 0, chord: cand.chord, roman: cand.roman };
    const inSlot = notes.some((n) => n.start < slot.start + slot.duration && n.start + n.duration > slot.start);
    out.push({ chord: cand.chord, roman: cand.roman, fit: inSlot ? chordToneCoverage(notes, [fake]) : null, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

export interface SlotOverride {
  symbol: string;
  roman: string;
}

/** A plan with some slots swapped for chords the user picked. */
export function withOverrides(plan: HarmonyPlan, overrides: Record<number, SlotOverride> | undefined, notes: NoteLike[]): HarmonyPlan {
  if (!overrides || !Object.keys(overrides).length) return plan;
  let changed = false;
  const slots = plan.slots.map((s, i) => {
    const o = overrides[i];
    const r = o ? parseChord(o.symbol) : null;
    if (!o || !r?.ok || r.chord.symbol === s.chord.symbol) return s;
    changed = true;
    return { ...s, chord: r.chord, roman: o.roman };
  });
  return changed ? { ...plan, slots, coverage: chordToneCoverage(notes, slots), edited: true } : plan;
}
