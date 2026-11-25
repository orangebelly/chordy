import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PageId } from '../layout';
import { CloseIcon } from './Icons';

// How-to for each page, kept out of the pages themselves and opened from the "?" button.

const K = ({ children }: { children: ReactNode }) => <kbd>{children}</kbd>;

const HELP: Record<PageId, { title: string; sections: { h: string; items: ReactNode[] }[] }> = {
  explore: {
    title: 'Explore a chord',
    sections: [
      {
        h: 'Find a chord',
        items: [
          <>Type a chord name — C, Am7, G7, Dmaj7, Bbmaj9, Asus4add9… — or click one of the examples.</>,
          <>Colours mean the same everywhere: <b className="help-root">orange</b> is the root, <b className="help-tone">blue</b> the other chord tones.</>,
        ],
      },
      {
        h: 'Piano and guitar',
        items: [
          <>Piano: <b>Play</b> sounds the chord; click any key to hear that note.</>,
          <>Chord shape: numbers are fingers (1 index · 2 middle · 3 ring · 4 pinky), × = don’t play, ○ = open string. Use the arrows for other shapes, <b>Strum</b> to hear it.</>,
          <>Fretboard: hover any fret to see its note. Ringed dots are the current shape. Change the tuning from the menu.</>,
        ],
      },
      {
        h: 'Page',
        items: [
          <>Drag a section by its ⠿ handle to reorder it (or focus the handle and use <K>↑</K> <K>↓</K>); click a title to fold it.</>,
          <>The bar at the bottom plays the chord or an arpeggio on piano or guitar.</>,
        ],
      },
    ],
  },
  compose: {
    title: 'Compose',
    sections: [
      {
        h: 'Chord progression',
        items: [
          <>Type chords separated by spaces (<code>C Am F G</code>); <code>|</code> can mark bars.</>,
          <>Guitar shapes are chosen together so your hand moves as little as possible. Click a chord to load it into the instruments.</>,
          <>Tempo and beats per chord control playback.</>,
        ],
      },
      {
        h: 'My song',
        items: [
          <><b>Save as measure</b> stores the progression and adds it to the song.</>,
          <>Use a measure as many times as you like; editing it (click its name, then <b>Update measure</b>) changes every repeat.</>,
          <>Reorder or remove measures with the buttons on each one. Everything is saved in this browser.</>,
          <><b>Speed</b> (0.75× – 1.5×) plays the whole song — and the play-along — faster or slower without changing its tempo setting.</>,
        ],
      },
      {
        h: 'Chord lengths',
        items: [
          <>Click a measure in the arrangement (or a saved measure’s chords, or <b>Lengths</b>) to open its chord lengths: each chord is a block on a beat grid. Drag a block’s right edge to make it longer or shorter (half-beat steps); the chords after it move along.</>,
          <>Or focus the edge and use <K>←</K> <K>→</K> (<K>Shift</K> = a whole beat). Click a block to hear the chord. <b>Reset</b> goes back to equal lengths.</>,
          <>A small number next to a chord in the arrangement shows a changed length. Changing the measure’s chords to a different number of chords resets its lengths.</>,
        ],
      },
      {
        h: 'Play along (guitar)',
        items: [
          <><b>Play along</b> opens a full-screen view of the whole song: the current and next chord shapes, and every shape of the song below, grouped by measure.</>,
          <>One bar of count-in clicks, then a strum on every beat (accent on the first). Untick <b>Strum every beat</b> for one strum per chord.</>,
          <>Shapes are picked across the whole song so your hand moves as little as possible. Click any shape to start from there. <K>Space</K> plays / stops, <K>Esc</K> closes.</>,
        ],
      },
    ],
  },
  harmonize: {
    title: 'Harmonize a melody',
    sections: [
      {
        h: 'Record',
        items: [
          <>Set tempo, time signature and grid, then press <b>Record</b>. After one bar of count-in, play: hold a key as long as the note should last.</>,
          <>Notes snap to the grid (1/4, 1/8, 1/16). <b>Record more</b> continues after the last bar.</>,
        ],
      },
      {
        h: 'Computer keyboard',
        items: [
          <><b>Letters:</b> <K>Z</K>…<K>M</K> plays C3–B3 and <K>Q</K>…<K>]</K> plays C4 up; the rows above them are the black keys.</>,
          <><b>Numbers:</b> <K>1</K>–<K>7</K> = C D E F G A B. Press two neighbours together for the black key between them: <K>1</K>+<K>2</K> = C#, <K>2</K>+<K>3</K> = D#, <K>4</K>+<K>5</K> = F#, <K>5</K>+<K>6</K> = G#, <K>6</K>+<K>7</K> = A#.</>,
          <>Hold the octave keys (<K>-</K> / <K>=</K> by default) with a number for an octave lower / higher. Click an octave-key button and press any key to change it. <b>1 =</b> picks the octave.</>,
        ],
      },
      {
        h: 'Edit notes',
        items: [
          <>Click a note to select it; <K>Shift</K>-click adds more; drag across empty space to box-select; <K>⌘</K><K>A</K> selects all.</>,
          <>Drag a note to move it — the whole selection moves together. Drag a note’s edge to change its length. Double-click empty space to add a note.</>,
          <><K>↑</K><K>↓</K> pitch (<K>Shift</K> = octave), <K>←</K><K>→</K> move, <K>Shift</K>+<K>←</K><K>→</K> length, <K>Del</K> delete, <K>⌘</K><K>Z</K> undo, <K>Esc</K> deselect.</>,
        ],
      },
      {
        h: 'Play',
        items: [
          <>Hover the roll to choose where playback starts (the thin line). Click in the roll, then <K>Space</K> plays and pauses; pausing keeps the position.</>,
          <>Space plays the melody with the selected plan’s chords; <b>Play melody</b> plays the melody alone.</>,
        ],
      },
      {
        h: 'Chords',
        items: [
          <>Three plans: Simple (I, IV, V), Pop, Jazz (7th chords). Notes in the roll are coloured by the chord above them: <b className="help-root">root</b>, <b className="help-tone">chord tone</b>, grey = not in the chord.</>,
          <>Hover a chord to see its guitar shape and other chords that fit; click one to swap it in. <b>Reset</b> undoes swaps.</>,
          <><b>Send to Compose</b> or <b>Save as measure</b> takes the plan to the Compose page.</>,
          <>How they’re chosen: the key comes from the Krumhansl–Schmuckler method (notes weighted by length). Each chord scores for melody notes it contains — long notes and strong beats count most, passing and neighbour notes cost little — and for how naturally the progression moves (tonic → subdominant → dominant → tonic, ending with a cadence).</>,
        ],
      },
    ],
  },
};

/** A "?" button on the side of the page that opens how-to for the current page. */
export function HelpPanel({ page }: { page: PageId }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const help = HELP[page];

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button ref={btnRef} className={`help-fab${open ? ' is-open' : ''}`} onClick={() => setOpen(!open)}
        aria-expanded={open} aria-controls="help-panel" aria-label="How to use this page" title="How to use this page">
        ?
      </button>
      {open && <div className="help-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside id="help-panel" className={`help-panel${open ? ' is-open' : ''}`} aria-label="Help" aria-hidden={!open} inert={!open}>
        <header className="help-head">
          <h2>{help.title}</h2>
          <button ref={closeRef} className="icon-btn" onClick={() => setOpen(false)} aria-label="Close help"><CloseIcon /></button>
        </header>
        {help.sections.map((s) => (
          <section key={s.h} className="help-section">
            <h3>{s.h}</h3>
            <ul>
              {s.items.map((it, i) => <li key={i}>{it}</li>)}
            </ul>
          </section>
        ))}
      </aside>
    </>
  );
}
