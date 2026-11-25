// Playing the melody keyboard from the computer keyboard.
//
//   letters: tracker layout. Z-row/A-row = C3 octave, Q-row/number row = C4 up.
//   numbers: 1–7 = C D E F G A B. Two neighbouring numbers pressed together play
//            the black key between them (1+2 = C#, 2+3 = D#, 4+5 = F#, 5+6 = G#, 6+7 = A#).
//            Holding the "octave down" / "octave up" key shifts by an octave.
// Key *codes* (physical positions) are used, so any keyboard layout works.

export type TypingMode = 'letters' | 'numbers';

export interface TypingSettings {
  mode: TypingMode;
  /** octave the 1–7 keys play in (4 → 1 = C4) */
  baseOctave: number;
  /** key codes held to shift an octave */
  down: string;
  up: string;
}

export const DEFAULT_TYPING: TypingSettings = { mode: 'letters', baseOctave: 4, down: 'Minus', up: 'Equal' };

export const BASE_OCTAVES = [3, 4, 5];

// ---- letters ---------------------------------------------------------------------

export const LETTER_KEYS: [code: string, label: string][] = [
  ['KeyZ', 'Z'], ['KeyS', 'S'], ['KeyX', 'X'], ['KeyD', 'D'], ['KeyC', 'C'], ['KeyV', 'V'], ['KeyG', 'G'],
  ['KeyB', 'B'], ['KeyH', 'H'], ['KeyN', 'N'], ['KeyJ', 'J'], ['KeyM', 'M'],
  ['KeyQ', 'Q'], ['Digit2', '2'], ['KeyW', 'W'], ['Digit3', '3'], ['KeyE', 'E'], ['KeyR', 'R'], ['Digit5', '5'],
  ['KeyT', 'T'], ['Digit6', '6'], ['KeyY', 'Y'], ['Digit7', '7'], ['KeyU', 'U'], ['KeyI', 'I'], ['Digit9', '9'],
  ['KeyO', 'O'], ['Digit0', '0'], ['KeyP', 'P'], ['BracketLeft', '['], ['Equal', '='], ['BracketRight', ']'],
];
const LETTER_OFFSET = new Map(LETTER_KEYS.map(([code], i) => [code, i]));

/** Letters mode: the MIDI note for a key code, counting up from `lowC` (C3). */
export const letterMidi = (code: string, lowC: number): number | undefined => {
  const i = LETTER_OFFSET.get(code);
  return i === undefined ? undefined : lowC + i;
};

// ---- numbers ---------------------------------------------------------------------

const DEGREE = [0, 2, 4, 5, 7, 9, 11]; // 1–7 → semitones above C

/** "Digit3" / "Numpad3" → 3 (only 1–7). */
export function digitOf(code: string): number | undefined {
  const m = /^(?:Digit|Numpad)([1-7])$/.exec(code);
  return m ? Number(m[1]) : undefined;
}

/** C of the octave being played: the base octave, shifted while a modifier is held. */
export const octaveC = (baseOctave: number, downHeld: boolean, upHeld: boolean) =>
  12 * (baseOctave + 1) + (upHeld ? 12 : 0) - (downHeld ? 12 : 0);

/** Pairs that have a black key between them: 1+2 = C#, 2+3 = D#, 4+5 = F#, 5+6 = G#, 6+7 = A#. */
const BLACK_PAIRS = new Set([1, 2, 4, 5, 6]);

/**
 * Turn numbers pressed together into notes. Neighbouring pairs with a black key
 * between them become that black key; everything else plays as itself.
 * Returns each note with the numbers that make it (so releasing either ends it).
 */
export function numbersToNotes(digits: number[], cOfOctave: number): { midi: number; digits: number[] }[] {
  const set = [...new Set(digits.filter((d) => d >= 1 && d <= 7))].sort((a, b) => a - b);
  const used = new Set<number>();
  const out: { midi: number; digits: number[] }[] = [];
  for (const d of set) {
    if (used.has(d)) continue;
    if (BLACK_PAIRS.has(d) && set.includes(d + 1) && !used.has(d + 1)) {
      used.add(d).add(d + 1);
      out.push({ midi: cOfOctave + DEGREE[d - 1] + 1, digits: [d, d + 1] });
    } else {
      used.add(d);
      out.push({ midi: cOfOctave + DEGREE[d - 1], digits: [d] });
    }
  }
  return out;
}

/** What to print on a piano key in numbers mode (undefined = no label). */
export function numberLabel(midi: number, s: TypingSettings): string | undefined {
  const c = octaveC(s.baseOctave, false, false);
  const rel = midi - c;
  const oct = Math.floor(rel / 12);
  const pc = ((rel % 12) + 12) % 12;
  const white = DEGREE.indexOf(pc);
  if (oct === 0) return white >= 0 ? String(white + 1) : `${DEGREE.indexOf(pc - 1) + 1}${DEGREE.indexOf(pc - 1) + 2}`;
  if ((oct === -1 || oct === 1) && white >= 0) return `${keyLabel(oct < 0 ? s.down : s.up)}${white + 1}`;
  return undefined;
}

// ---- key names -------------------------------------------------------------------

const NAMES: Record<string, string> = {
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'",
  Comma: ',', Period: '.', Slash: '/', Backquote: '`', Space: 'Space', ShiftLeft: '⇧', ShiftRight: '⇧',
  NumpadAdd: '+', NumpadSubtract: '−', NumpadMultiply: '×', NumpadDivide: '÷', NumpadDecimal: '.', NumpadEnter: '⏎',
};

/** "KeyA" → "A", "Digit8" → "8", "Minus" → "-". */
export function keyLabel(code: string): string {
  if (NAMES[code]) return NAMES[code];
  const m = /^(?:Key|Digit|Numpad)(.+)$/.exec(code);
  return m ? m[1] : code;
}

/** A key can be an octave modifier if it isn't one of the note keys or a key the page needs. */
export const canBeModifier = (code: string) =>
  digitOf(code) === undefined && !['Escape', 'Space', 'Tab', 'Enter', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight'].includes(code);

/** Repair saved settings. */
export function readTyping(x: unknown): TypingSettings {
  const t = (x && typeof x === 'object' ? x : {}) as Partial<TypingSettings>;
  const d = DEFAULT_TYPING;
  const down = typeof t.down === 'string' && canBeModifier(t.down) ? t.down : d.down;
  const up = typeof t.up === 'string' && canBeModifier(t.up) && t.up !== down ? t.up : down === d.up ? d.down : d.up;
  return {
    mode: t.mode === 'numbers' ? 'numbers' : 'letters',
    baseOctave: BASE_OCTAVES.includes(t.baseOctave as number) ? t.baseOctave! : d.baseOctave,
    down,
    up,
  };
}
