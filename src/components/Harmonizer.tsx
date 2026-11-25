import { useEffect, useMemo, useRef, useState } from 'react';
import {
  audioTime, cancelClicks, scheduleClick, startNote, stopNote, type NoteHandle,
} from '../utils/audio';
import type { Chord } from '../utils/chordParser';
import {
  ALL_KEYS, chordOptions, keyName, sameKey,
  type HarmonizeResult, type HarmonyPlan, type HarmonySlot, type Key, type PlanStyle, type SlotOverride,
} from '../utils/harmonize';
import { chordShapes, STANDARD_TUNING } from '../utils/guitarShapes';
import { mod12 } from '../utils/musicTheory';
import { buildSteps } from '../utils/progression';
import { ChordDiagram } from './ChordDiagram';
import {
  editNotes, GRIDS, melodyEnd, midiName, placedNote, TIME_SIGNATURES, type MelodyNote, type MelodySession, type NoteEdit, type RawNote,
} from '../utils/melody';
import { newId } from '../utils/song';
import { CloseIcon, NextIcon, PlayIcon, PlusIcon, PrevIcon, StopIcon } from './Icons';
import { MelodyKeyboard } from './MelodyKeyboard';
import { BASE_OCTAVES, canBeModifier, keyLabel, type TypingSettings } from '../utils/typing';
import { PianoRoll } from './PianoRoll';

export const KEYS_LOW = 48; // C3
export const KEYS_HIGH = 84; // C6
const MAX_BARS = 32;

export interface HarmonyPlayback {
  style: PlanStyle | null;
  slot: number | null;
  /** performance.now() at beat 0 */
  startedAt: number;
  bpm: number;
}

type Phase = 'idle' | 'countin' | 'recording';

interface MelodyProps {
  session: MelodySession;
  update: (fn: (s: MelodySession) => MelodySession) => void;
  notes: MelodyNote[];
  bars: number;
  slots?: HarmonySlot[];
  playback: HarmonyPlayback | null;
  onSlotClick: (i: number) => void;
  onPlayMelody: () => void;
  onStop: () => void;
  /** chord to light up on the keyboard (during playback) */
  highlight: Chord | null;
  /** undo the last change to the melody (recorded note, edit, delete…) */
  onUndo: () => void;
  canUndo: boolean;
  /** where playback starts (beats) */
  cursor: number;
  onCursor: (beat: number) => void;
  /** Space on the roll: play from the cursor / pause */
  onTogglePlay: () => void;
}

/** Record a melody by holding keys, see it on a piano roll, make small edits. */
export function MelodyPanel(p: MelodyProps) {
  const { session } = p;
  const [phase, setPhase] = useState<Phase>('idle');
  const [beat, setBeat] = useState<number | null>(null);
  const [held, setHeld] = useState<Map<number, number | null>>(new Map()); // midi → start beat (null = not recording)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Only ids that still exist (notes can disappear through undo / clear).
  const selected = new Set(selectedIds.filter((id) => p.notes.some((n) => n.id === id)));
  const handles = useRef(new Map<number, NoteHandle>());
  const rec = useRef<{ perfT0: number; beatSec: number; offset: number; timer: number; raf: number; stopAt: number } | null>(null);
  const metronome = useRef(session.metronome);
  metronome.current = session.metronome;
  const heldRef = useRef(held);
  heldRef.current = held;

  const beatAt = (t: number) => {
    const r = rec.current;
    return r ? (t - r.perfT0) / 1000 / r.beatSec + r.offset : 0;
  };
  const beatNow = () => beatAt(performance.now());

  function addRaw(note: RawNote) {
    // Played during the count-in: a touch early counts as the downbeat; finished before it, ignore.
    const offset = rec.current?.offset ?? 0;
    if (note.end <= offset + 0.05) return;
    const n = { ...note, start: Math.max(note.start, offset) };
    if (n.end - n.start < 0.02) return; // accidental double-tap
    p.update((s) => ({ ...s, raw: [...s.raw, n] }));
  }

  function noteOn(midi: number, at = performance.now()) {
    if (handles.current.has(midi)) stopNote(handles.current.get(midi)!);
    handles.current.set(midi, startNote('piano', midi));
    const start = rec.current ? beatAt(at) : null;
    setHeld((h) => new Map(h).set(midi, start));
  }

  function noteOff(midi: number) {
    const h = handles.current.get(midi);
    if (h) stopNote(h);
    handles.current.delete(midi);
    const start = heldRef.current.get(midi);
    if (start !== undefined && start !== null && rec.current) addRaw({ id: newId(), midi, start, end: beatNow() });
    setHeld((m) => {
      const next = new Map(m);
      next.delete(midi);
      return next;
    });
  }

  function startRecording() {
    p.onStop();
    setSelectedIds([]);
    const beatSec = 60 / session.bpm;
    const bpb = session.beatsPerBar;
    // Append after the existing melody, starting on the next bar line.
    const offset = Math.ceil(melodyEnd(p.notes) / bpb - 1e-9) * bpb;
    const now = audioTime();
    const audioT0 = now + 0.15 + bpb * beatSec; // one bar of count-in
    const perfT0 = performance.now() + (audioT0 - now) * 1000;
    let k = -bpb; // next click, in beats relative to the start
    const timer = window.setInterval(() => {
      // Look-ahead scheduler: clicks are placed on the audio clock, so they don't jitter.
      while (audioT0 + k * beatSec < audioTime() + 0.12) {
        if (k < 0 || metronome.current) scheduleClick(audioT0 + k * beatSec, ((k % bpb) + bpb) % bpb === 0);
        k++;
      }
    }, 25);
    const tick = () => {
      const b = beatNow();
      setBeat(b);
      setPhase(b < offset ? 'countin' : 'recording');
      if (b >= rec.current!.stopAt) return stopRecording();
      rec.current!.raf = requestAnimationFrame(tick);
    };
    rec.current = { perfT0, beatSec, offset, timer, raf: 0, stopAt: offset + MAX_BARS * bpb };
    setPhase('countin');
    rec.current.raf = requestAnimationFrame(tick);
  }

  function stopRecording() {
    const r = rec.current;
    if (!r) return;
    const end = beatNow();
    for (const [midi, start] of heldRef.current) if (start !== null) addRaw({ id: newId(), midi, start, end });
    setHeld((m) => new Map([...m].map(([k]) => [k, null])));
    clearInterval(r.timer);
    cancelAnimationFrame(r.raf);
    cancelClicks();
    rec.current = null;
    setPhase('idle');
    setBeat(null);
  }

  // Leaving the page (or folding the section) ends a recording cleanly.
  useEffect(() => () => {
    if (rec.current) {
      clearInterval(rec.current.timer);
      cancelAnimationFrame(rec.current.raf);
      cancelClicks();
      rec.current = null;
    }
    handles.current.forEach(stopNote);
  }, []);

  // Playback playhead
  const [playBeat, setPlayBeat] = useState<number | null>(null);
  useEffect(() => {
    if (!p.playback) return setPlayBeat(null);
    const { startedAt, bpm } = p.playback;
    let raf = 0;
    const loop = () => {
      setPlayBeat(((performance.now() - startedAt) / 1000) * (bpm / 60));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [p.playback?.startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  function deleteSelected() {
    if (!selected.size) return;
    p.update((s) => ({ ...s, raw: s.raw.filter((n) => !selected.has(n.id)) }));
    setSelectedIds([]);
  }

  function edit(ids: string[], e: NoteEdit) {
    p.update((s) => ({ ...s, raw: editNotes(s.raw, ids, e, s.grid, KEYS_LOW, KEYS_HIGH) }));
  }

  function addNote(midi: number, start: number) {
    const id = newId();
    p.update((s) => ({ ...s, raw: [...s.raw, placedNote(id, midi, start, Math.max(s.grid, Math.min(1, s.grid * 2)))] }));
    setSelectedIds([id]);
    previewPitch(midi);
  }

  function previewPitch(midi: number) {
    const h = startNote('piano', midi, 0.6);
    window.setTimeout(() => stopNote(h), 220);
  }

  // Space plays / pauses once the roll was the last thing clicked.
  const rollRef = useRef<HTMLDivElement>(null);
  const rollActive = useRef(false);
  useEffect(() => {
    const onDown = (e: globalThis.PointerEvent) => {
      rollActive.current = !!rollRef.current?.contains(e.target as Node);
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, []);

  // Keys for the selected note: Delete, arrows to nudge (Shift = octave / length), Esc; ⌘/Ctrl+Z undoes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (p.canUndo && phase === 'idle') {
          e.preventDefault();
          p.onUndo();
        }
        return;
      }
      if (phase !== 'idle') return;
      if (e.code === 'Space' && rollActive.current && !e.repeat) {
        e.preventDefault(); // and don't "click" whatever button has focus
        if (p.notes.length || p.playback) p.onTogglePlay();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a' && p.notes.length) {
        e.preventDefault();
        setSelectedIds(p.notes.map((n) => n.id));
        return;
      }
      if (!selected.size) return;
      const ids = [...selected];
      const top = p.notes.filter((n) => selected.has(n.id)).reduce((a, n) => Math.max(a, n.midi), 0);
      const g = session.grid;
      let handled = true;
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      else if (e.key === 'Escape') setSelectedIds([]);
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const semitones = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 12 : 1);
        edit(ids, { kind: 'move', beats: 0, semitones });
        previewPitch(Math.min(KEYS_HIGH, Math.max(KEYS_LOW, top + semitones)));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const beats = e.key === 'ArrowRight' ? g : -g;
        edit(ids, e.shiftKey ? { kind: 'resize-end', beats } : { kind: 'move', beats, semitones: 0 });
      } else handled = false;
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const recording = phase !== 'idle';
  // One spare bar at the end, so notes can be dragged or stretched past the current end.
  const liveBars = recording && beat !== null ? Math.max(p.bars, Math.floor(Math.max(0, beat) / session.beatsPerBar) + 1) : p.bars + (p.notes.length ? 1 : 0);
  const countIn = phase === 'countin' && beat !== null && rec.current
    ? Math.floor(beat - rec.current.offset + session.beatsPerBar) + 1
    : null;
  const live = [...held].flatMap(([midi, start]) => (start === null ? [] : [{ midi, start }]));
  const playing = !!p.playback;

  return (
    <div className="melody">
      <div className="toolbar toolbar--top">
        <div className="toolbar-group">
          <button
            className={`btn ${recording ? 'btn--outline' : 'btn--record'}`}
            onClick={recording ? stopRecording : startRecording}
            aria-pressed={recording}
          >
            {recording ? <><StopIcon /> Stop recording</> : <><span className="rec-dot" aria-hidden="true" /> {p.notes.length ? 'Record more' : 'Record'}</>}
          </button>
          <span className={`rec-status${recording ? ' is-on' : ''}`} aria-live="polite">
            {phase === 'countin' && countIn !== null && <>Count-in <strong>{Math.max(1, countIn)}</strong> / {session.beatsPerBar}</>}
            {phase === 'recording' && beat !== null && rec.current && (
              <><span className="live-dot" aria-hidden="true" /> Bar {Math.floor(beat / session.beatsPerBar) + 1} · beat {Math.floor(beat % session.beatsPerBar) + 1}</>
            )}
            {phase === 'idle' && (p.notes.length ? `${p.notes.length} notes · ${p.bars} bar${p.bars > 1 ? 's' : ''}` : 'No melody yet')}
          </span>
        </div>
        <div className="toolbar-group">
          <label className="tempo">
            <span className="control-label">Tempo</span>
            <input type="range" min={50} max={160} step={5} value={session.bpm} disabled={recording}
              onChange={(e) => p.update((s) => ({ ...s, bpm: Number(e.target.value) }))} aria-label="Tempo in BPM" />
            <span className="tempo-value">{session.bpm}<small> BPM</small></span>
          </label>
          <Segmented label="Time" value={session.beatsPerBar} disabled={recording}
            options={TIME_SIGNATURES.map((t) => ({ value: t.beats, label: t.label }))}
            onChange={(beatsPerBar) => p.update((s) => ({ ...s, beatsPerBar }))} />
          <Segmented label="Grid" value={session.grid}
            options={GRIDS.map((g) => ({ value: g.beats, label: g.label }))}
            onChange={(grid) => p.update((s) => ({ ...s, grid }))} />
          <label className="check">
            <input type="checkbox" checked={session.metronome} onChange={(e) => p.update((s) => ({ ...s, metronome: e.target.checked }))} />
            Metronome
          </label>
        </div>
      </div>

      <div ref={rollRef}>
      <PianoRoll
        notes={p.notes}
        live={live}
        low={KEYS_LOW}
        high={KEYS_HIGH}
        beatsPerBar={session.beatsPerBar}
        bars={liveBars}
        grid={session.grid}
        playhead={recording ? beat : playBeat}
        selected={selected}
        onSelect={setSelectedIds}
        onEdit={recording ? undefined : edit}
        onAdd={recording ? undefined : addNote}
        onPreviewPitch={previewPitch}
        slots={p.slots}
        activeSlot={p.playback?.slot ?? null}
        onSlotClick={p.onSlotClick}
        cursor={recording || playing ? null : p.cursor}
        onCursor={recording || playing ? undefined : p.onCursor}
      />
      </div>

      <div className="toolbar toolbar--edit">
        <div className="toolbar-group">
          <button className={`btn ${playing ? 'btn--outline' : 'btn--secondary'} btn--sm`} disabled={!p.notes.length || recording}
            onClick={playing ? p.onStop : p.onPlayMelody}>
            {playing ? <><StopIcon /> Stop</> : <><PlayIcon /> Play melody</>}
          </button>
          <button className="btn btn--ghost btn--sm" disabled={!p.canUndo || recording} onClick={p.onUndo}
            title="Undo the last change (⌘Z / Ctrl+Z)">Undo</button>
          <button className="btn btn--ghost btn--sm" disabled={!p.notes.length || recording}
            onClick={() => setSelectedIds(selected.size === p.notes.length ? [] : p.notes.map((n) => n.id))}>
            {selected.size && selected.size === p.notes.length ? 'Select none' : 'Select all'}
          </button>
          <button className="btn btn--ghost btn--sm" disabled={!selected.size} onClick={deleteSelected}>
            <CloseIcon /> Delete{selected.size > 1 ? ` ${selected.size} notes` : ' note'}
          </button>
          <button className="btn btn--ghost btn--sm btn--danger" disabled={!session.raw.length || recording}
            onClick={() => (session.raw.length < 5 || confirm('Clear the whole melody?')) && p.update((s) => ({ ...s, raw: [] }))}>
            Clear
          </button>
        </div>
      </div>

      <TypingControls typing={session.typing} onChange={(typing) => p.update((s) => ({ ...s, typing }))} />

      <MelodyKeyboard low={KEYS_LOW} high={KEYS_HIGH} held={new Set(held.keys())} chord={p.highlight}
        typing={session.typing} onNoteOn={noteOn} onNoteOff={noteOff} />

      <div className="legend legend--roll">
        <span><i className="swatch hl-root" /> Root of the chord above</span>
        <span><i className="swatch hl-tone" /> Chord tone</span>
        <span><i className="swatch is-outside" /> Not in the chord</span>
      </div>
    </div>
  );
}

/** Letters / Numbers typing layout, base octave and the two octave keys (click, then press a key). */
function TypingControls({ typing, onChange }: { typing: TypingSettings; onChange: (t: TypingSettings) => void }) {
  const [binding, setBinding] = useState<'down' | 'up' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!binding) return;
    const onKey = (e: KeyboardEvent) => {
      // Capture phase: this key is for the setting, not for playing.
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code === 'Escape') return setBinding(null);
      const other = binding === 'down' ? typing.up : typing.down;
      if (!canBeModifier(e.code)) return setProblem(`${keyLabel(e.code)} can't be used — 1–7 play notes.`);
      if (e.code === other) return setProblem(`${keyLabel(e.code)} is already the other octave key.`);
      onChange({ ...typing, [binding]: e.code });
      setProblem(null);
      setBinding(null);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [binding, typing, onChange]);

  const bindBtn = (which: 'down' | 'up', label: string) => (
    <label className="bind">
      <span className="control-label">{label}</span>
      <button className={`btn btn--outline btn--sm bind-key${binding === which ? ' is-listening' : ''}`}
        onClick={() => { setProblem(null); setBinding(binding === which ? null : which); }}
        aria-label={`${label}: ${keyLabel(typing[which])}. Click, then press a key to change it.`}>
        {binding === which ? 'Press a key…' : <kbd>{keyLabel(typing[which])}</kbd>}
      </button>
    </label>
  );

  return (
    <div className="typing">
      <div className="typing-row">
        <div className="beats">
          <span className="control-label">Computer keys</span>
          <div className="segmented segmented--sm" role="radiogroup" aria-label="Computer keyboard layout">
            {(['letters', 'numbers'] as const).map((m) => (
              <button key={m} role="radio" aria-checked={typing.mode === m} className={typing.mode === m ? 'is-active' : ''}
                onClick={() => onChange({ ...typing, mode: m })}>{m === 'letters' ? 'Letters' : 'Numbers'}</button>
            ))}
          </div>
        </div>
        {typing.mode === 'numbers' && (
          <>
            <Segmented label="1 =" value={typing.baseOctave}
              options={BASE_OCTAVES.map((o) => ({ value: o, label: `C${o}` }))}
              onChange={(baseOctave) => onChange({ ...typing, baseOctave })} />
            {bindBtn('down', 'Octave down')}
            {bindBtn('up', 'Octave up')}
          </>
        )}
      </div>
      {problem && <p className="typing-problem" role="alert">{problem}</p>}
    </div>
  );
}

function Segmented<T extends number>({ label, value, options, onChange, disabled }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean;
}) {
  return (
    <div className="beats">
      <span className="control-label">{label}</span>
      <div className="segmented segmented--sm" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} role="radio" aria-checked={value === o.value} disabled={disabled}
            className={value === o.value ? 'is-active' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

// ---- Suggestions ---------------------------------------------------------------

interface HarmonyProps {
  result: HarmonizeResult;
  /** the plans as shown: suggestions with the user's swaps applied */
  plans: HarmonyPlan[];
  /** melody (quantized), to rank alternative chords */
  notes: MelodyNote[];
  session: MelodySession;
  update: (fn: (s: MelodySession) => MelodySession) => void;
  selected: PlanStyle | null;
  playback: HarmonyPlayback | null;
  onPlay: (style: PlanStyle) => void;
  onStop: () => void;
  onChordClick: (style: PlanStyle, slot: number) => void;
  onSwap: (style: PlanStyle, slot: number, choice: SlotOverride | null) => void;
  onResetPlan: (style: PlanStyle) => void;
  onSendProgression: (style: PlanStyle) => void;
  onSaveMeasure: (style: PlanStyle) => void;
}

const keyId = (k: Key) => `${k.tonic}:${k.mode}`;
const stdPitchClass = (s: number, f: number) => mod12(STANDARD_TUNING[s] + f);

export function HarmonyPanel(p: HarmonyProps) {
  const { result, session } = p;
  const canHalve = session.beatsPerBar % 2 === 0;
  // The chord shown in the inspector: follows hover, sticks after the pointer leaves, set by tap/click too.
  const [focus, setFocus] = useState<{ style: PlanStyle; i: number } | null>(null);
  const plan = p.plans.find((pl) => pl.style === focus?.style) ?? p.plans.find((pl) => pl.style === p.selected) ?? p.plans[0];
  const fi = focus && plan && focus.style === plan.style && focus.i < plan.slots.length ? focus.i : 0;
  const focused = plan ? { plan, i: fi } : null;

  const inspector = (inline: boolean) =>
    focused && (
      <ChordInspector
        key={`${focused.plan.style}-${focused.i}-${focused.plan.slots[focused.i].chord.symbol}`}
        inline={inline}
        plan={focused.plan}
        original={result.plans.find((pl) => pl.style === focused.plan.style)!}
        index={focused.i}
        notes={p.notes}
        musicKey={result.key}
        beatsPerBar={session.beatsPerBar}
        onLoad={() => p.onChordClick(focused.plan.style, focused.i)}
        onSwap={(choice) => p.onSwap(focused.plan.style, focused.i, choice)}
      />
    );

  return (
    <div className="harmony">
      <div className="toolbar toolbar--top">
        <div className="toolbar-group">
          <label className="beats">
            <span className="control-label">Key</span>
            <select
              value={session.key ? keyId(session.key) : 'auto'}
              onChange={(e) => {
                const v = e.target.value;
                p.update((s) => ({ ...s, key: v === 'auto' ? null : ALL_KEYS.find((k) => keyId(k) === v)! }));
              }}
              aria-label="Key"
            >
              <option value="auto">Auto · {keyName(result.detectedKey)}</option>
              {ALL_KEYS.map((k) => (
                <option key={keyId(k)} value={keyId(k)}>{keyName(k)}{sameKey(k, result.detectedKey) ? ' (detected)' : ''}</option>
              ))}
            </select>
          </label>
          <Segmented label="Chords" value={canHalve ? session.chordsPerBar : 1}
            options={[{ value: 1, label: '1 / bar' }, ...(canHalve ? [{ value: 2, label: '2 / bar' }] : [])]}
            onChange={(v) => p.update((s) => ({ ...s, chordsPerBar: v as 1 | 2 }))} />
        </div>
      </div>

      {p.plans.length === 0 ? (
        <div className="empty">No melody yet.</div>
      ) : (
        <div className="harmony-body">
          <div className="plans">
            {p.plans.map((pl) => {
              const isSel = pl.style === p.selected;
              const isPlaying = p.playback?.style === pl.style;
              const bars: { slot: HarmonySlot; i: number }[][] = [];
              pl.slots.forEach((slot, i) => (bars[slot.bar] ??= []).push({ slot, i }));
              return (
                <article key={pl.style} className={`plan${isSel ? ' is-selected' : ''}`}
                  onClick={() => !isSel && p.update((s) => ({ ...s, plan: pl.style }))}>
                  <header className="plan-head">
                    <button className="plan-name" onClick={() => p.update((s) => ({ ...s, plan: pl.style }))} aria-pressed={isSel}>
                      <span className="plan-radio" aria-hidden="true" />
                      {pl.name}
                      {pl.edited && <span className="plan-edited">edited</span>}
                    </button>
                    {pl.edited && (
                      <button className="btn btn--ghost btn--sm" onClick={(e) => { e.stopPropagation(); p.onResetPlan(pl.style); }}>
                        Reset
                      </button>
                    )}
                    <span className="plan-coverage" title="Share of the melody (by time) that sits on chord tones">
                      {Math.round(pl.coverage * 100)}% fit
                    </span>
                    <button className={`btn ${isPlaying ? 'btn--outline' : 'btn--primary'} btn--sm`}
                      onClick={(e) => { e.stopPropagation(); return isPlaying ? p.onStop() : p.onPlay(pl.style); }}>
                      {isPlaying ? <><StopIcon /> Stop</> : <><PlayIcon /> Play with melody</>}
                    </button>
                  </header>
                  <p className="plan-reason">{pl.reason}</p>
                  <div className="plan-bars">
                    {bars.map((b, bi) => (
                      <div key={bi} className="plan-bar">
                        <span className="plan-bar-num">{bi + 1}</span>
                        {b.map(({ slot, i }) => {
                          const isFocus = focused?.plan.style === pl.style && focused.i === i;
                          const swapped = slot.chord.symbol !== result.plans.find((o) => o.style === pl.style)?.slots[i]?.chord.symbol;
                          return (
                            <button key={i}
                              className={`plan-chord${isPlaying && p.playback?.slot === i ? ' is-now' : ''}${isFocus ? ' is-focus' : ''}${swapped ? ' is-swapped' : ''}`}
                              onPointerEnter={(e) => e.pointerType === 'mouse' && setFocus({ style: pl.style, i })}
                              onFocus={() => setFocus({ style: pl.style, i })}
                              onClick={(e) => {
                                e.stopPropagation();
                                setFocus({ style: pl.style, i });
                                p.onChordClick(pl.style, i);
                              }}
                              aria-describedby={isFocus ? 'chord-inspector' : undefined}
                              title={`${slot.chord.symbol} — click to hear it and load it into the piano and guitar`}>
                              <span className="plan-chord-symbol">{slot.chord.symbol}</span>
                              <span className="plan-chord-roman">{slot.roman}</span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  {focused?.plan.style === pl.style && inspector(true)}
                  <div className="plan-actions">
                    <button className="btn btn--secondary btn--sm" onClick={(e) => { e.stopPropagation(); p.onSendProgression(pl.style); }}>
                      Send to Compose
                    </button>
                    <button className="btn btn--ghost btn--sm" onClick={(e) => { e.stopPropagation(); p.onSaveMeasure(pl.style); }}>
                      <PlusIcon /> Save as measure
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <aside className="inspector-side">{inspector(false)}</aside>
        </div>
      )}
    </div>
  );
}

// ---- Chord inspector: guitar shape + other chords that fit --------------------------

interface InspectorProps {
  inline: boolean;
  plan: HarmonyPlan;
  /** the plan before the user's swaps */
  original: HarmonyPlan;
  index: number;
  notes: MelodyNote[];
  musicKey: Key;
  beatsPerBar: number;
  onLoad: () => void;
  onSwap: (choice: SlotOverride | null) => void;
}

function ChordInspector({ inline, plan, original, index, notes, musicKey, beatsPerBar, onLoad, onSwap }: InspectorProps) {
  const slot = plan.slots[index];
  const suggested = original.slots[index];
  const chord = slot.chord;
  // Shapes chosen across the whole plan for the least hand movement; the stepper shows the others.
  const steps = useMemo(() => buildSteps(plan.slots.map((s) => s.chord), chordShapes), [plan]);
  const shapes = useMemo(() => chordShapes(chord), [chord]);
  const [shapeIdx, setShapeIdx] = useState(steps[index]?.shapeIndex ?? 0);
  const shape = shapes[shapeIdx];

  const options = useMemo(
    () => chordOptions(notes, musicKey, slot, beatsPerBar).filter((o) => o.chord.symbol !== chord.symbol).slice(0, 6),
    [notes, musicKey, slot, beatsPerBar, chord.symbol],
  );
  const here = notes.filter((n) => n.start < slot.start + slot.duration && n.start + n.duration > slot.start);
  const beatInBar = slot.start - slot.bar * beatsPerBar + 1;

  return (
    <section id={inline ? undefined : 'chord-inspector'} className={`inspector${inline ? ' inspector--inline' : ''}`}
      aria-label={`${chord.symbol} details`} onClick={(e) => e.stopPropagation()}>
      <header className="inspector-head">
        <div>
          <span className="inspector-where">{plan.name} · bar {slot.bar + 1}{beatInBar > 1 ? `, beat ${beatInBar}` : ''} · {slot.roman}</span>
          <h3 className="inspector-symbol">{chord.symbol}</h3>
          <span className="inspector-tones">
            {chord.tones.map((t) => (
              <span key={t.name} className={t.isRoot ? 'is-root' : 'is-tone'}>{t.name}</span>
            ))}
          </span>
        </div>
        <button className="icon-btn" onClick={onLoad} aria-label={`Play ${chord.symbol}`} title="Play and load into the instruments">
          <PlayIcon />
        </button>
      </header>

      <div className="inspector-shape">
        {shape ? (
          <ChordDiagram shape={shape} rootPitchClass={chord.root.pitchClass} pitchClassOf={stdPitchClass} />
        ) : (
          <span className="hint">No guitar shape for this chord.</span>
        )}
        {shapes.length > 1 && (
          <div className="stepper" aria-label="Guitar shapes">
            <button className="icon-btn icon-btn--sm" onClick={() => setShapeIdx((shapeIdx - 1 + shapes.length) % shapes.length)} aria-label="Previous shape"><PrevIcon /></button>
            <span className="stepper-value">{shapeIdx + 1} / {shapes.length}</span>
            <button className="icon-btn icon-btn--sm" onClick={() => setShapeIdx((shapeIdx + 1) % shapes.length)} aria-label="Next shape"><NextIcon /></button>
          </div>
        )}
        {shape && <span className="inspector-frets">{shape.frets.map((f) => f ?? 'x').join(' ')}</span>}
      </div>

      <div className="inspector-melody">
        <span className="control-label">Melody here</span>
        {here.length ? (
          <span className="inspector-notes">
            {here.map((n) => {
              const pc = mod12(n.midi);
              const cls = !chord.pitchClasses.has(pc) ? 'is-outside' : pc === chord.root.pitchClass ? 'is-root' : 'is-tone';
              return <span key={n.id} className={cls}>{midiName(n.midi)}</span>;
            })}
          </span>
        ) : (
          <span className="inspector-notes"><span className="is-rest">rest</span></span>
        )}
      </div>

      <div className="inspector-alts">
        <div className="inspector-alts-head">
          <span className="control-label">Other chords that fit here</span>
          {suggested.chord.symbol !== chord.symbol && (
            <button className="btn btn--ghost btn--sm" onClick={() => onSwap(null)}>Back to {suggested.chord.symbol}</button>
          )}
        </div>
        <div className="alts">
          {options.map((o) => {
            const s = chordShapes(o.chord)[0];
            return (
              <button key={o.chord.symbol} className="alt" onClick={() => onSwap({ symbol: o.chord.symbol, roman: o.roman })}
                title={`Use ${o.chord.symbol} (${o.roman}) here`}>
                {s && <ChordDiagram small shape={s} rootPitchClass={o.chord.root.pitchClass} pitchClassOf={stdPitchClass} />}
                <span className="alt-symbol">{o.chord.symbol}</span>
                <span className="alt-meta">{o.roman}{o.fit !== null && ` · ${Math.round(o.fit * 100)}%`}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
