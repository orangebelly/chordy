import { describe, expect, it } from 'vitest';
import {
  canBeModifier, DEFAULT_TYPING, digitOf, keyLabel, letterMidi, numberLabel, numbersToNotes, octaveC, readTyping,
} from './typing';

describe('numbers mode', () => {
  const C4 = 60;
  it('1–7 are the white keys', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((d) => numbersToNotes([d], C4)[0].midi)).toEqual([60, 62, 64, 65, 67, 69, 71]);
  });
  it('neighbouring numbers together play the black key between them', () => {
    expect(numbersToNotes([1, 2], C4)).toEqual([{ midi: 61, digits: [1, 2] }]); // C#
    expect(numbersToNotes([3, 2], C4)[0].midi).toBe(63); // D#
    expect(numbersToNotes([4, 5], C4)[0].midi).toBe(66); // F#
    expect(numbersToNotes([5, 6], C4)[0].midi).toBe(68); // G#
    expect(numbersToNotes([6, 7], C4)[0].midi).toBe(70); // A#
  });
  it('E+F (no black key) and non-neighbours stay separate notes', () => {
    expect(numbersToNotes([3, 4], C4).map((n) => n.midi)).toEqual([64, 65]);
    expect(numbersToNotes([1, 3], C4).map((n) => n.midi)).toEqual([60, 64]);
    expect(numbersToNotes([1, 2, 3], C4).map((n) => n.midi)).toEqual([61, 64]);
    expect(numbersToNotes([1, 1, 9], C4).map((n) => n.midi)).toEqual([60]);
  });
  it('octave keys shift by an octave', () => {
    expect(octaveC(4, false, false)).toBe(60);
    expect(octaveC(4, true, false)).toBe(48);
    expect(octaveC(4, false, true)).toBe(72);
    expect(numbersToNotes([6], octaveC(3, true, false))[0].midi).toBe(45); // "6 + −" from octave 3 = A2
  });
  it('reads digit keys from the number row and the numpad', () => {
    expect(digitOf('Digit1')).toBe(1);
    expect(digitOf('Numpad7')).toBe(7);
    expect(digitOf('Digit8')).toBe(undefined);
    expect(digitOf('KeyA')).toBe(undefined);
  });
  it('labels keys', () => {
    const s = DEFAULT_TYPING;
    expect(numberLabel(60, s)).toBe('1');
    expect(numberLabel(61, s)).toBe('12');
    expect(numberLabel(70, s)).toBe('67');
    expect(numberLabel(71, s)).toBe('7');
    expect(numberLabel(72, s)).toBe('=1');
    expect(numberLabel(57, s)).toBe('-6');
    expect(numberLabel(58, s)).toBe(undefined);
    expect(numberLabel(40, s)).toBe(undefined);
  });
});

describe('letters mode and key names', () => {
  it('maps the tracker layout from C3', () => {
    expect(letterMidi('KeyZ', 48)).toBe(48);
    expect(letterMidi('KeyQ', 48)).toBe(60);
    expect(letterMidi('BracketRight', 48)).toBe(79);
    expect(letterMidi('KeyA', 48)).toBe(undefined);
  });
  it('names keys and validates modifiers', () => {
    expect(keyLabel('KeyA')).toBe('A');
    expect(keyLabel('Minus')).toBe('-');
    expect(keyLabel('Digit9')).toBe('9');
    expect(canBeModifier('Digit3')).toBe(false);
    expect(canBeModifier('Escape')).toBe(false);
    expect(canBeModifier('Digit9')).toBe(true);
    expect(canBeModifier('KeyQ')).toBe(true);
  });
  it('repairs saved settings', () => {
    expect(readTyping(null)).toEqual(DEFAULT_TYPING);
    expect(readTyping({ mode: 'numbers', baseOctave: 9, down: 'Digit1', up: 'KeyP' })).toEqual({ mode: 'numbers', baseOctave: 4, down: 'Minus', up: 'KeyP' });
    expect(readTyping({ down: 'KeyQ', up: 'KeyQ' }).up).not.toBe('KeyQ');
  });
});

describe('reserved keys', () => {
  it('Space (play/pause) cannot be an octave key', () => {
    expect(canBeModifier('Space')).toBe(false);
  });
});
