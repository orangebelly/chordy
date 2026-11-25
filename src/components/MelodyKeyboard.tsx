import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { NextIcon, PrevIcon } from './Icons';
import { defaultNoteName, mod12 } from '../utils/musicTheory';
import type { Chord } from '../utils/chordParser';
import {
  digitOf, LETTER_KEYS, letterMidi, numberLabel, numbersToNotes, octaveC, type TypingSettings,
} from '../utils/typing';

const BLACK_PCS = new Set([1, 3, 6, 8, 10]);

/** Numbers pressed within this window count as "together" (1+2 = C#). */
const CHORD_WINDOW_MS = 45;

interface Props {
  low: number;
  high: number;
  /** keys currently held (any source) */
  held: Set<number>;
  /** highlight a chord in the learning colours (e.g. during playback) */
  chord?: Chord | null;
  /** how computer keys play (letters or numbers mode) */
  typing: TypingSettings;
  /** `at`: performance.now() of the key press, when it was decided a little later (numbers mode) */
  onNoteOn: (midi: number, at?: number) => void;
  onNoteOff: (midi: number) => void;
}

/** True while the media query matches (e.g. a phone-width screen). */
function useMedia(query: string) {
  const [match, setMatch] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

/**
 * A press-and-hold keyboard: a note sounds from pointer down until pointer up,
 * or until the pointer slides off the key / is cancelled. Mouse, pen and multi-touch,
 * plus the computer keyboard in two layouts (see utils/typing.ts).
 */
export function MelodyKeyboard({ low, high, held, chord, typing, onNoteOn, onNoteOff }: Props) {
  // Phones show a two-octave window that can be shifted; typing keys always cover the full range.
  const narrow = useMedia('(max-width: 720px)');
  const [winLow, setWinLow] = useState(() => Math.min(Math.max(low, 60), Math.max(low, high - 24)));
  const viewLow = narrow ? winLow : low;
  const viewHigh = narrow ? Math.min(high, winLow + 24) : high;
  const pointers = useRef(new Map<number, number>()); // pointerId → midi
  const typed = useRef(new Map<string, number>()); // key code → midi it is holding
  const cb = useRef({ onNoteOn, onNoteOff });
  cb.current = { onNoteOn, onNoteOff };

  const keys = Array.from({ length: viewHigh - viewLow + 1 }, (_, i) => viewLow + i);
  const base = low + mod12(-low); // first C at or above `low`: where the typing keys start
  const label = (midi: number) =>
    typing.mode === 'letters' ? LETTER_KEYS[midi - base]?.[1] : numberLabel(midi, typing);
  const whites = keys.filter((m) => !BLACK_PCS.has(mod12(m)));
  const ww = 100 / whites.length;

  const end = (pointerId: number) => {
    const midi = pointers.current.get(pointerId);
    if (midi === undefined) return;
    pointers.current.delete(pointerId);
    cb.current.onNoteOff(midi);
  };

  const down = (midi: number) => (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    // Touch pointers are implicitly captured by the key they hit; release so that
    // sliding off the key fires pointerleave and ends the note.
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    end(e.pointerId);
    pointers.current.set(e.pointerId, midi);
    cb.current.onNoteOn(midi);
  };
  const up = (e: PointerEvent) => end(e.pointerId);

  useEffect(() => {
    const mods = new Set<string>(); // octave keys held (numbers mode)
    let pending: { digit: number; code: string; at: number; released: boolean }[] = [];
    let timer = 0;

    /** Release one held key; a two-key black note ends when either key lifts. */
    const releaseCode = (code: string) => {
      const midi = typed.current.get(code);
      if (midi === undefined) return;
      for (const [c, m] of [...typed.current]) if (m === midi) typed.current.delete(c);
      cb.current.onNoteOff(midi);
    };
    const allOff = () => {
      clearTimeout(timer);
      pending = [];
      mods.clear();
      for (const id of [...pointers.current.keys()]) end(id);
      for (const code of [...typed.current.keys()]) releaseCode(code);
    };
    /** Numbers mode: decide what the keys pressed together mean, then play it. */
    const flush = () => {
      timer = 0;
      const batch = pending;
      pending = [];
      const c = octaveC(typing.baseOctave, mods.has(typing.down), mods.has(typing.up));
      for (const note of numbersToNotes(batch.map((p) => p.digit), c)) {
        if (note.midi < low || note.midi > high) continue;
        const keys = batch.filter((p) => note.digits.includes(p.digit));
        const at = Math.min(...keys.map((k) => k.at));
        keys.forEach((k) => typed.current.set(k.code, note.midi));
        cb.current.onNoteOn(note.midi, at);
        // Tapped so quickly that a key was already up: end the note straight away.
        if (keys.some((k) => k.released)) releaseCode(keys[0].code);
      }
    };
    const onUp = (e: globalThis.PointerEvent) => end(e.pointerId); // released outside any key
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) {
        if (e.repeat && (typed.current.has(e.code) || mods.has(e.code))) e.preventDefault();
        return;
      }
      if (typing.mode === 'letters') {
        const midi = letterMidi(e.code, base);
        if (midi === undefined || midi > high || typed.current.has(e.code)) return;
        e.preventDefault();
        typed.current.set(e.code, midi);
        cb.current.onNoteOn(midi);
        return;
      }
      if (e.code === typing.down || e.code === typing.up) {
        e.preventDefault();
        mods.add(e.code);
        return;
      }
      const digit = digitOf(e.code);
      if (digit === undefined || typed.current.has(e.code) || pending.some((p) => p.code === e.code)) return;
      e.preventDefault();
      pending.push({ digit, code: e.code, at: performance.now(), released: false });
      if (!timer) timer = window.setTimeout(flush, CHORD_WINDOW_MS);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      mods.delete(e.code);
      const p = pending.find((x) => x.code === e.code);
      if (p) p.released = true;
      releaseCode(e.code);
    };
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', allOff);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      allOff();
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', allOff);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [low, high, typing.mode, typing.baseOctave, typing.down, typing.up]); // eslint-disable-line react-hooks/exhaustive-deps

  const cls = (midi: number) => {
    const pc = mod12(midi);
    const hl = chord?.pitchClasses.has(pc) ? (pc === chord.root.pitchClass ? ' hl-root' : ' hl-tone') : '';
    return `${hl}${held.has(midi) ? ' is-down' : ''}`;
  };
  const handlers = (midi: number) => ({
    onPointerDown: down(midi),
    onPointerUp: up,
    onPointerLeave: up,
    onPointerCancel: up,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    'data-midi': midi,
    tabIndex: -1,
    'aria-label': `${defaultNoteName(midi)}${Math.floor(midi / 12) - 1}`,
  });

  return (
    <div className="piano-case melody-keys">
      <div className="melody-keys-scroll">
      {narrow && (
        <div className="keys-window">
          <button className="icon-btn icon-btn--sm" onClick={() => setWinLow(Math.max(low, winLow - 12))} disabled={winLow <= low} aria-label="Lower octave"><PrevIcon /></button>
          <span>{defaultNoteName(viewLow)}{Math.floor(viewLow / 12) - 1}–{defaultNoteName(viewHigh)}{Math.floor(viewHigh / 12) - 1}</span>
          <button className="icon-btn icon-btn--sm" onClick={() => setWinLow(Math.min(high - 24, winLow + 12))} disabled={winLow + 24 >= high} aria-label="Higher octave"><NextIcon /></button>
        </div>
      )}
      <div className="piano-felt" aria-hidden="true" />
      <div className="piano" role="group" aria-label="Melody keyboard: press and hold to play">
        {whites.map((midi) => (
          <button key={midi} className={`key white${cls(midi)}`} style={{ width: `${ww}%` }} {...handlers(midi)}>
            {label(midi) && <kbd className="key-letter">{label(midi)}</kbd>}
            {mod12(midi) === 0 && <span className="key-octave">C{midi / 12 - 1}</span>}
          </button>
        ))}
        {keys
          .filter((m) => BLACK_PCS.has(mod12(m)))
          .map((midi) => (
            <button
              key={midi}
              className={`key black${cls(midi)}`}
              style={{ left: `${whites.filter((w) => w < midi).length * ww}%`, width: `${ww * 0.6}%` }}
              {...handlers(midi)}
            >
              {label(midi) && <kbd className="key-letter">{label(midi)}</kbd>}
            </button>
          ))}
      </div>
      </div>
    </div>
  );
}
