import { useEffect, useMemo, useRef, useState } from 'react';
import { audioTime, cancelClicks, loadSamples, scheduleClick, scheduleNotes, stopAll } from '../utils/audio';
import { chordMidiNotes } from '../utils/chordParser';
import { chordShapes, shapeMidiNotes, STANDARD_TUNING } from '../utils/guitarShapes';
import { mod12 } from '../utils/musicTheory';
import { buildSteps } from '../utils/progression';
import { playbackBpm, songTimeline, type Song } from '../utils/song';
import { SpeedPicker } from './SongBuilder';
import { ChordDiagram } from './ChordDiagram';
import { CloseIcon, PlayIcon, StopIcon } from './Icons';

const BEATS_PER_BAR = 4;
const STRUM_SPREAD = 0.014; // seconds between strings: a quick downstroke
const stdPc = (s: number, f: number) => mod12(STANDARD_TUNING[s] + f);
const fmt = (b: number) => (Number.isInteger(b) ? String(b) : b.toFixed(1));

/**
 * Full-screen guitar play-along for the whole song: every chord shape in order,
 * the current and next chord large, one bar of count-in, then a strum on every beat.
 * Shapes are chosen across the whole song for the least hand movement.
 */
export function PlayAlong({ song, onSpeed, onClose }: { song: Song; onSpeed: (speed: number) => void; onClose: () => void }) {
  const { events } = useMemo(() => songTimeline(song), [song]);
  const steps = useMemo(() => buildSteps(events.map((e) => e.chord), chordShapes), [events]);
  const [everyBeat, setEveryBeat] = useState(true);
  const [run, setRun] = useState<{ perfT0: number; from: number } | null>(null); // perfT0 = when beat `from` lands
  const [beat, setBeat] = useState<number | null>(null);
  const [cursor, setCursor] = useState(0); // event to start from
  const stripRef = useRef<HTMLDivElement>(null);
  const sec = 60 / playbackBpm(song);

  function stop() {
    stopAll();
    cancelClicks();
    setRun(null);
    setBeat(null);
  }

  async function play(fromIndex = cursor) {
    stop();
    if (!events.length) return;
    await loadSamples('guitar');
    const from = events[fromIndex].start;
    const at = audioTime() + 0.1;
    const t0 = at + BEATS_PER_BAR * sec; // after the count-in
    for (let k = 0; k < BEATS_PER_BAR; k++) scheduleClick(at + k * sec, k === 0);
    const notes = events.slice(fromIndex).flatMap((e, j) => {
      const step = steps[fromIndex + j];
      const midis = step.shape ? shapeMidiNotes(step.shape) : chordMidiNotes(e.chord);
      const strums = everyBeat ? Array.from({ length: Math.max(1, Math.ceil(e.duration - 1e-9)) }, (_, b) => b) : [0];
      return strums.flatMap((b) => {
        const start = (e.start - from + b) * sec + (t0 - at);
        const len = (Math.min(e.duration, everyBeat ? b + 1 : e.duration) - b) * sec;
        return midis.map((midi, i) => ({ midi, start: start + i * STRUM_SPREAD, duration: Math.max(0.15, len), volume: b === 0 ? 0.5 : 0.3 }));
      });
    });
    void scheduleNotes('guitar', notes, at);
    setRun({ perfT0: performance.now() + (t0 - audioTime()) * 1000, from });
  }

  // Playhead (in song beats; negative during the count-in)
  useEffect(() => {
    if (!run) return;
    const end = events[events.length - 1].start + events[events.length - 1].duration;
    let raf = 0;
    const loop = () => {
      const b = run.from + (performance.now() - run.perfT0) / 1000 / sec;
      if (b >= end) {
        setRun(null);
        setBeat(null);
        setCursor(0);
        return;
      }
      setBeat(b);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [run, events, sec]);

  const playing = !!run;
  const countIn = run && beat !== null && beat < run.from ? Math.floor(beat - run.from + BEATS_PER_BAR) + 1 : null;
  const pos = beat === null ? null : Math.max(beat, run?.from ?? 0);
  const nowIndex = pos === null ? cursor : Math.max(0, events.reduce((last, e, i) => (e.start <= pos + 1e-9 ? i : last), 0));
  const now = events[nowIndex];
  const next = events[nowIndex + 1];
  const beatInChord = beat !== null && now && beat >= now.start ? Math.floor(beat - now.start) : -1;

  // Keep the current chord in view; Space plays / stops; Esc closes.
  useEffect(() => {
    stripRef.current?.querySelector(`[data-event="${nowIndex}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [nowIndex]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        stop();
        onClose();
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (playing) stop();
        else void play();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => () => {
    stopAll();
    cancelClicks();
  }, []);

  const big = (i: number | undefined, label: string) => {
    if (i === undefined || !events[i]) return <div className="pa-card pa-card--empty"><span className="pa-label">{label}</span><span className="pa-end">End</span></div>;
    const e = events[i];
    const shape = steps[i].shape;
    return (
      <div className={`pa-card${label === 'Now' ? ' pa-card--now' : ''}`}>
        <span className="pa-label">{label}</span>
        <span className="pa-symbol">{e.chord.symbol}</span>
        {shape ? <ChordDiagram shape={shape} rootPitchClass={e.chord.root.pitchClass} pitchClassOf={stdPc} /> : <span className="pa-noshape">no shape</span>}
        {shape && <span className="pa-frets">{shape.frets.map((f) => f ?? 'x').join(' ')}</span>}
        {label === 'Now' && (
          <span className="pa-beats" aria-label={`${fmt(e.duration)} beats`}>
            {Array.from({ length: Math.max(1, Math.ceil(e.duration)) }, (_, b) => (
              <i key={b} className={b === beatInChord ? 'is-on' : b < beatInChord ? 'is-past' : ''} />
            ))}
          </span>
        )}
      </div>
    );
  };

  // Group the strip by arrangement slot (measure)
  const groups: { slot: number; idx: number[] }[] = [];
  events.forEach((e, i) => {
    const g = groups[groups.length - 1];
    if (g && g.slot === e.slot) g.idx.push(i);
    else groups.push({ slot: e.slot, idx: [i] });
  });
  const nameOf = (slot: number) => song.measures.find((m) => m.id === song.arrangement[slot])?.name ?? '';

  return (
    <div className="playalong" role="dialog" aria-modal="true" aria-label={`Play along: ${song.title}`}>
      <header className="pa-head">
        <div className="pa-title">
          <span className="pa-song">{song.title}</span>
          <span className="pa-meta">{Math.round(playbackBpm(song))} BPM{song.speed !== 1 ? ` (${song.speed}×)` : ''} · {events.length} chords · guitar, standard tuning</span>
        </div>
        <SpeedPicker value={song.speed} onChange={onSpeed} disabled={playing} />
        <label className="check">
          <input type="checkbox" checked={everyBeat} onChange={(e) => setEveryBeat(e.target.checked)} disabled={playing} />
          Strum every beat
        </label>
        <button className={`btn ${playing ? 'btn--outline' : 'btn--primary'}`} onClick={() => (playing ? stop() : void play())} disabled={!events.length}>
          {playing ? <><StopIcon /> Stop</> : <><PlayIcon /> {cursor ? `Play from chord ${cursor + 1}` : 'Play'}</>}
        </button>
        <button className="icon-btn" onClick={() => { stop(); onClose(); }} aria-label="Close play-along"><CloseIcon /></button>
      </header>

      {events.length === 0 ? (
        <div className="empty">The song has no chords yet.</div>
      ) : (
        <>
          <div className="pa-stage">
            {countIn !== null && <div className="pa-countin" aria-live="assertive">{countIn}</div>}
            {big(nowIndex, 'Now')}
            {big(next ? nowIndex + 1 : undefined, 'Next')}
          </div>

          <div className="pa-strip" ref={stripRef}>
            {groups.map((g) => (
              <section key={`${g.slot}-${g.idx[0]}`} className="pa-measure">
                <span className="pa-measure-name">{String(g.slot + 1).padStart(2, '0')} · {nameOf(g.slot)}</span>
                <div className="pa-measure-chords">
                  {g.idx.map((i) => {
                    const e = events[i];
                    const shape = steps[i].shape;
                    return (
                      <button key={i} data-event={i}
                        className={`pa-mini${i === nowIndex ? ' is-now' : ''}${beat !== null && i < nowIndex ? ' is-past' : ''}`}
                        onClick={() => { setCursor(i); if (playing) void play(i); }}
                        title={`Start from ${e.chord.symbol}`}>
                        {shape && <ChordDiagram small shape={shape} rootPitchClass={e.chord.root.pitchClass} pitchClassOf={stdPc} />}
                        <span className="pa-mini-symbol">{e.chord.symbol}</span>
                        <span className="pa-mini-beats">{fmt(e.duration)}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
