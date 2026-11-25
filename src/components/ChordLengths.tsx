import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import type { Chord } from '../utils/chordParser';
import type { ProgressionItem } from '../utils/progression';
import { LENGTH_STEP, MAX_BEATS, MIN_BEATS } from '../utils/song';

interface Props {
  items: ProgressionItem[];
  /** beats per item (same length as items) */
  durations: number[];
  beatsPerBar?: number;
  onChange: (index: number, beats: number) => void;
  onPlayChord: (chord: Chord) => void;
}

const BEAT_PX = 44;
const snap = (b: number) => Math.min(MAX_BEATS, Math.max(MIN_BEATS, Math.round(b / LENGTH_STEP) * LENGTH_STEP));
const fmt = (b: number) => (Number.isInteger(b) ? String(b) : b.toFixed(1));

/**
 * A measure's chords laid out in time, like the piano roll: each block is a chord,
 * drag its right edge to make it longer or shorter (half-beat steps). Later chords move along.
 */
export function ChordLengths({ items, durations, beatsPerBar = 4, onChange, onPlayChord }: Props) {
  const [drag, setDrag] = useState<{ index: number; x0: number; from: number; beats: number; pointerId: number } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;

  const lengths = durations.map((d, i) => (drag?.index === i ? drag.beats : d));
  const blocks: { item: ProgressionItem; index: number; start: number; beats: number }[] = [];
  let t = 0;
  items.forEach((item, index) => {
    if (!item.chord) return;
    blocks.push({ item, index, start: t, beats: lengths[index] });
    t += lengths[index];
  });
  const total = t;
  const bars = Math.max(1, Math.ceil(total / beatsPerBar));

  function onDown(index: number, e: PointerEvent<HTMLElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ index, x0: e.clientX, from: durations[index], beats: durations[index], pointerId: e.pointerId });
  }
  function onMove(e: PointerEvent<HTMLElement>) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const beats = snap(d.from + (e.clientX - d.x0) / BEAT_PX);
    if (beats !== d.beats) setDrag({ ...d, beats });
  }
  function onUp(e: PointerEvent<HTMLElement>) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    setDrag(null);
    if (d.beats !== d.from) onChange(d.index, d.beats);
  }
  function onKey(index: number, e: KeyboardEvent) {
    const delta = e.key === 'ArrowRight' ? LENGTH_STEP : e.key === 'ArrowLeft' ? -LENGTH_STEP : 0;
    if (!delta) return;
    e.preventDefault();
    onChange(index, snap(durations[index] + delta * (e.shiftKey ? 2 : 1)));
  }

  return (
    <div className="lengths">
      <div className="lengths-scroll">
        <div
          className="lengths-track"
          style={{
            width: Math.max(bars * beatsPerBar, total + 2) * BEAT_PX,
            '--beat': `${BEAT_PX}px`,
            '--bar': `${BEAT_PX * beatsPerBar}px`,
          } as CSSProperties}
        >
          <div className="lengths-ruler" aria-hidden="true">
            {Array.from({ length: Math.ceil(Math.max(bars * beatsPerBar, total + 2) / beatsPerBar) }, (_, b) => (
              <span key={b} style={{ left: b * beatsPerBar * BEAT_PX }}>{b + 1}</span>
            ))}
          </div>
          <div className={`lengths-lane${drag ? ' is-dragging' : ''}`}>
            {blocks.map(({ item, index, start, beats }) => (
              <div
                key={index}
                className={`length-block${drag?.index === index ? ' is-dragged' : ''}`}
                style={{ left: start * BEAT_PX, width: beats * BEAT_PX - 3 }}
                data-index={index}
                data-beats={beats}
              >
                <button className="length-chord" onClick={() => onPlayChord(item.chord!)} title={`Play ${item.chord!.symbol}`}>
                  <span className="length-symbol">{item.chord!.symbol}</span>
                  {beats * BEAT_PX >= 56 && <span className="length-beats">{fmt(beats)} {beats === 1 ? 'beat' : 'beats'}</span>}
                </button>
                <span
                  className="length-handle"
                  role="slider"
                  tabIndex={0}
                  aria-label={`Length of ${item.chord!.symbol}`}
                  aria-valuemin={MIN_BEATS}
                  aria-valuemax={MAX_BEATS}
                  aria-valuenow={beats}
                  aria-valuetext={`${fmt(beats)} beats`}
                  onPointerDown={(e) => onDown(index, e)}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={() => setDrag(null)}
                  onKeyDown={(e) => onKey(index, e)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <span className="lengths-total">{fmt(total)} beats{total % beatsPerBar === 0 ? ` · ${total / beatsPerBar} bar${total / beatsPerBar === 1 ? '' : 's'}` : ''}</span>
    </div>
  );
}
