import { useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import { defaultNoteName, mod12 } from '../utils/musicTheory';
import { midiName, previewEdit, rollRange, type MelodyNote, type NoteEdit } from '../utils/melody';
import type { HarmonySlot } from '../utils/harmonize';

interface Props {
  notes: MelodyNote[];
  /** notes being held right now while recording (start in beats, still growing) */
  live: { midi: number; start: number }[];
  /** lowest / highest pitch notes may use */
  low: number;
  high: number;
  beatsPerBar: number;
  bars: number;
  /** grid size in beats: drawn as faint lines, and what edits snap to */
  grid: number;
  /** current position in beats (recording or playback), or null */
  playhead: number | null;
  selected: Set<string>;
  onSelect: (ids: string[]) => void;
  /** drag notes: move the selection, or stretch either end */
  onEdit?: (ids: string[], edit: NoteEdit) => void;
  /** double-click on an empty spot */
  onAdd?: (midi: number, start: number) => void;
  /** hear the pitch while dragging a note up/down */
  onPreviewPitch?: (midi: number) => void;
  /** chords of the selected plan, drawn in a lane above the notes */
  slots?: HarmonySlot[];
  activeSlot?: number | null;
  onSlotClick?: (i: number) => void;
  /** where playback will start (beats); null hides it */
  cursor?: number | null;
  /** hovering (or tapping) the roll moves the start cursor */
  onCursor?: (beat: number) => void;
}

// The roll opens on one comfortable octave and only grows when notes go outside it.
const VIEW_LOW = 60; // C4
const VIEW_HIGH = 72; // C5
const PX_PER_BEAT = 64;
const LANE = 30;
const ROLL_HEIGHT = 340; // rows shrink (within limits) as the range grows
const rowFor = (rows: number) => Math.max(12, Math.min(26, Math.floor(ROLL_HEIGHT / rows)));
const DRAG_THRESHOLD = 3;

type Kind = NoteEdit['kind'];
interface NoteDrag {
  type: 'note';
  ids: string[];
  anchor: string;
  kind: Kind;
  pointerId: number;
  x0: number;
  y0: number;
  row: number;
  beats: number;
  semitones: number;
  moved: boolean;
  /** shift/⌘-click on a selected note: deselect it if the pointer doesn't move */
  toggle: boolean;
}
interface BoxDrag {
  type: 'box';
  pointerId: number;
  /** grid-relative px */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  base: string[];
  moved: boolean;
}

/** Timeline view of the melody: time → right, pitch → up. Notes are coloured by the chord above them. */
export function PianoRoll(p: Props) {
  const [drag, setDrag] = useState<NoteDrag | BoxDrag | null>(null);
  const dragRef = useRef<NoteDrag | BoxDrag | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const setD = (d: NoteDrag | BoxDrag | null) => {
    dragRef.current = d;
    setDrag(d);
  };
  const editable = !!p.onEdit;

  // What's drawn: notes with the drag in progress applied.
  const nd = drag?.type === 'note' && drag.moved ? drag : null;
  const shown = nd
    ? previewEdit(p.notes, nd.ids, nd.kind === 'move' ? { kind: 'move', beats: nd.beats, semitones: nd.semitones } : { kind: nd.kind, beats: nd.beats }, p.grid, p.low, p.high)
    : p.notes;

  const [lo, hi] = rollRange([...shown.map((n) => n.midi), ...p.live.map((n) => n.midi)], VIEW_LOW, VIEW_HIGH, p.low, p.high);
  const rows = hi - lo + 1;
  // Keep the row size fixed while dragging, so the notes don't slide under the pointer.
  const row = drag?.type === 'note' ? drag.row : rowFor(rows);
  const beats = p.bars * p.beatsPerBar;
  const width = beats * PX_PER_BEAT;
  const lane = LANE;
  const height = rows * row;
  const y = (midi: number) => lane + (hi - midi) * row;
  const x = (beat: number) => beat * PX_PER_BEAT;

  const slotAt = (beat: number) => p.slots?.find((s) => beat >= s.start - 1e-9 && beat < s.start + s.duration - 1e-9);
  const tone = (n: { midi: number; start: number }) => {
    const s = slotAt(n.start);
    if (!s) return '';
    const pc = mod12(n.midi);
    if (!s.chord.pitchClasses.has(pc)) return ' is-outside';
    return pc === s.chord.root.pitchClass ? ' hl-root' : ' hl-tone';
  };

  // ---- notes: select, drag (moves the whole selection), resize ----------------------

  function onNoteDown(n: MelodyNote, e: PointerEvent<HTMLElement>) {
    e.stopPropagation();
    if (!editable || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    const inSel = p.selected.has(n.id);
    let ids: string[];
    if (additive) ids = inSel ? [...p.selected] : [...p.selected, n.id];
    else ids = inSel ? [...p.selected] : [n.id];
    if (ids.join() !== [...p.selected].join()) p.onSelect(ids);
    const kind = ((e.target as HTMLElement).dataset.handle as Kind | undefined) ?? 'move';
    e.currentTarget.setPointerCapture(e.pointerId);
    setD({
      type: 'note', ids, anchor: n.id, kind, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, row,
      beats: 0, semitones: 0, moved: false, toggle: additive && inSel,
    });
  }

  function onNoteMove(n: MelodyNote, e: PointerEvent<HTMLElement>) {
    const d = dragRef.current;
    if (d?.type !== 'note' || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    const moved = d.moved || Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD;
    const beatsMoved = Math.round(dx / PX_PER_BEAT / p.grid) * p.grid;
    const semitones = d.kind === 'move' ? -Math.round(dy / d.row) : 0;
    if (semitones !== d.semitones) p.onPreviewPitch?.(Math.min(p.high, Math.max(p.low, n.midi + semitones)));
    if (moved !== d.moved || beatsMoved !== d.beats || semitones !== d.semitones) setD({ ...d, moved, beats: beatsMoved, semitones });
  }

  function onNoteUp(n: MelodyNote, e: PointerEvent<HTMLElement>) {
    const d = dragRef.current;
    if (d?.type !== 'note' || d.pointerId !== e.pointerId) return;
    setD(null);
    if (!d.moved) {
      if (d.toggle) p.onSelect(d.ids.filter((id) => id !== n.id));
      else if (!(e.shiftKey || e.metaKey || e.ctrlKey)) p.onSelect([n.id]); // plain click: just this note
      return;
    }
    if (d.beats || d.semitones) {
      p.onEdit!(d.ids, d.kind === 'move' ? { kind: 'move', beats: d.beats, semitones: d.semitones } : { kind: d.kind, beats: d.beats });
    }
  }

  // ---- empty grid: rubber-band selection, click to clear, double-click to add --------

  const local = (e: { clientX: number; clientY: number }) => {
    const r = gridRef.current!.getBoundingClientRect();
    return { gx: e.clientX - r.left, gy: e.clientY - r.top };
  };

  function onGridDown(e: PointerEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.pointerType === 'touch' || e.button !== 0) {
      if (e.pointerType === 'touch') {
        p.onSelect([]);
        moveCursor(e); // tap: playback starts here
      }
      return; // touch: let the roll scroll
    }
    const { gx, gy } = local(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    const base = e.shiftKey || e.metaKey || e.ctrlKey ? [...p.selected] : [];
    setD({ type: 'box', pointerId: e.pointerId, x0: gx, y0: gy, x1: gx, y1: gy, base, moved: false });
  }

  function boxHits(d: BoxDrag) {
    const [l, r] = [Math.min(d.x0, d.x1), Math.max(d.x0, d.x1)];
    const [t, b] = [Math.min(d.y0, d.y1), Math.max(d.y0, d.y1)];
    return p.notes
      .filter((n) => x(n.start) < r && x(n.start + n.duration) > l && y(n.midi) < b && y(n.midi) + row > t)
      .map((n) => n.id);
  }

  /** Start cursor follows the pointer (snapped to the grid) while nothing is being dragged. */
  function moveCursor(e: PointerEvent<HTMLElement>) {
    if (!p.onCursor || dragRef.current || !gridRef.current) return;
    const { gx } = local(e);
    const beat = Math.min(beats, Math.max(0, Math.round(gx / PX_PER_BEAT / p.grid) * p.grid));
    if (beat !== p.cursor) p.onCursor(beat);
  }

  function onGridMove(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'touch') moveCursor(e);
    const d = dragRef.current;
    if (d?.type !== 'box' || d.pointerId !== e.pointerId) return;
    const { gx, gy } = local(e);
    const moved = d.moved || Math.abs(gx - d.x0) > DRAG_THRESHOLD || Math.abs(gy - d.y0) > DRAG_THRESHOLD;
    const next = { ...d, x1: gx, y1: gy, moved };
    setD(next);
    if (moved) p.onSelect([...new Set([...d.base, ...boxHits(next)])]);
  }

  function onGridUp(e: PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (d?.type !== 'box' || d.pointerId !== e.pointerId) return;
    setD(null);
    if (!d.moved) p.onSelect(d.base);
  }

  function onGridDoubleClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget || !p.onAdd) return;
    const { gx, gy } = local(e);
    if (gy < lane) return;
    const midi = hi - Math.floor((gy - lane) / row);
    const beat = Math.floor(gx / PX_PER_BEAT / p.grid) * p.grid;
    if (midi >= lo && midi <= hi) p.onAdd(midi, beat);
  }

  const box = drag?.type === 'box' && drag.moved ? drag : null;
  const pitchRows = Array.from({ length: rows }, (_, i) => hi - i);
  const labelAll = row >= 16;

  return (
    <div className="roll" style={{ '--roll-beat': `${PX_PER_BEAT}px`, '--roll-row': `${row}px` } as CSSProperties}>
      <div className="roll-pitches" style={{ height: height + lane + 20 }} aria-hidden="true">
        {pitchRows
          .filter((m) => labelAll || mod12(m) === 0)
          .map((m) => (
            <span key={m} className={`${mod12(m) === 0 ? 'is-c' : ''}${[1, 3, 6, 8, 10].includes(mod12(m)) ? ' is-black' : ''}`}
              style={{ top: 20 + y(m), height: row, lineHeight: `${row}px` }}>
              {mod12(m) === 0 ? midiName(m) : defaultNoteName(m)}
            </span>
          ))}
      </div>
      <div className="roll-scroll" onPointerDown={(e) => e.target === e.currentTarget && p.onSelect([])}>
        <div className="roll-canvas" style={{ width, minWidth: '100%' }}>
          <div className="roll-ruler" aria-hidden="true" onPointerMove={moveCursor} onPointerDown={moveCursor}>
            {Array.from({ length: p.bars }, (_, b) => (
              <span key={b} style={{ left: x(b * p.beatsPerBar) }}>{b + 1}</span>
            ))}
          </div>
          <div
            ref={gridRef}
            className={`roll-grid${nd ? ` is-dragging is-${nd.kind}` : ''}${box ? ' is-boxing' : ''}`}
            style={{ height: height + lane, '--roll-bar': `${p.beatsPerBar * PX_PER_BEAT}px`, '--roll-grid': `${p.grid * PX_PER_BEAT}px` } as CSSProperties}
            onPointerDown={onGridDown}
            onPointerMove={onGridMove}
            onPointerUp={onGridUp}
            onPointerCancel={() => setD(null)}
            onDoubleClick={onGridDoubleClick}
          >
            {pitchRows
              .filter((m) => [1, 3, 6, 8, 10].includes(mod12(m)))
              .map((m) => (
                <div key={m} className="roll-blackrow" style={{ top: y(m), height: row }} aria-hidden="true" />
              ))}
            {pitchRows
              .filter((m) => mod12(m) === 0)
              .map((m) => (
                <div key={`c${m}`} className="roll-cline" style={{ top: y(m) + row }} aria-hidden="true" />
              ))}
            {!p.slots?.length && <div className="roll-chord-empty" aria-hidden="true">Chords appear here</div>}
            {p.slots?.map((s, i) => (
              <button
                key={i}
                className={`roll-chord${p.activeSlot === i ? ' is-active' : ''}`}
                style={{ left: x(s.start), width: x(s.duration) }}
                onClick={() => p.onSlotClick?.(i)}
                title={`${s.roman} — click to load ${s.chord.symbol} into the instruments`}
              >
                <span className="roll-chord-symbol">{s.chord.symbol}</span>
                <span className="roll-chord-roman">{s.roman}</span>
              </button>
            ))}
            {shown.map((n) => {
              const orig = p.notes.find((o) => o.id === n.id)!;
              const w = Math.max(6, x(n.duration) - 2);
              const sel = p.selected.has(n.id);
              return (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={-1}
                  className={`roll-note${tone(n)}${sel ? ' is-selected' : ''}${nd?.ids.includes(n.id) ? ' is-dragged' : ''}${editable ? ' is-editable' : ''}`}
                  style={{ left: x(n.start) + 1, top: y(n.midi) + 1, width: w, height: row - 2, fontSize: row >= 18 ? 11 : 9 }}
                  onPointerDown={(e) => onNoteDown(orig, e)}
                  onPointerMove={(e) => onNoteMove(orig, e)}
                  onPointerUp={(e) => onNoteUp(orig, e)}
                  onPointerCancel={() => setD(null)}
                  aria-label={`${midiName(n.midi)} at beat ${n.start + 1}, ${n.duration} beats`}
                  aria-pressed={sel}
                  data-note-id={n.id}
                  data-note-start={n.start}
                  data-note-duration={n.duration}
                  data-note-midi={n.midi}
                >
                  {editable && w >= 22 && <span className="roll-handle roll-handle--start" data-handle="resize-start" />}
                  {w > 30 && <span className="roll-note-label">{midiName(n.midi)}</span>}
                  {editable && <span className="roll-handle roll-handle--end" data-handle="resize-end" />}
                </div>
              );
            })}
            {p.live.map((n) => (
              <div
                key={`live-${n.midi}`}
                className="roll-note is-live"
                style={{ left: x(Math.max(0, n.start)) + 1, top: y(n.midi) + 1, height: row - 2, width: Math.max(6, x((p.playhead ?? n.start) - Math.max(0, n.start))) }}
                aria-hidden="true"
              />
            ))}
            {box && (
              <div className="roll-box" aria-hidden="true" style={{
                left: Math.min(box.x0, box.x1), top: Math.min(box.y0, box.y1),
                width: Math.abs(box.x1 - box.x0), height: Math.abs(box.y1 - box.y0),
              }} />
            )}
            {p.cursor != null && (p.playhead === null || p.playhead < 0) && (
              <div className="roll-cursor" style={{ left: x(p.cursor) }} aria-hidden="true" data-beat={p.cursor} />
            )}
            {p.playhead !== null && p.playhead >= 0 && (
              <div className="roll-playhead" style={{ left: x(p.playhead) }} aria-hidden="true" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
