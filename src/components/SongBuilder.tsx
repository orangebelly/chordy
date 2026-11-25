import { useState } from 'react';
import type { Chord } from '../utils/chordParser';
import { parseProgression } from '../utils/progression';
import {
  arrangeAppend, arrangeMove, arrangeRemoveAt, deleteMeasure, measureDurations, playbackBpm, songTimeline, SPEEDS, updateMeasure,
  type Measure, type Song,
} from '../utils/song';
import { ChordLengths } from './ChordLengths';
import { GuitarIcon } from './Icons';
import { ArrowLeftIcon, ArrowRightIcon, CloseIcon, PlayIcon, PlusIcon, StopIcon } from './Icons';

export interface SongPosition {
  slot: number; // index in the arrangement
  item: number; // index of the chord within that measure's text
}

interface Props {
  song: Song;
  onSongChange: (song: Song) => void;
  editingId: string | null;
  onEdit: (id: string) => void;
  playing: SongPosition | null;
  onPlay: (fromSlot?: number) => void;
  onStop: () => void;
  /** drag-to-resize chord lengths of a saved measure */
  onChordLength: (id: string, index: number, beats: number) => void;
  onResetLengths: (id: string) => void;
  onPlayChord: (chord: Chord) => void;
  /** full-screen guitar play-along of the whole song */
  onPlayAlong: () => void;
}

function formatTime(seconds: number) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function SongBuilder({
  song, onSongChange, editingId, onEdit, playing, onPlay, onStop, onChordLength, onResetLengths, onPlayChord, onPlayAlong,
}: Props) {
  const byId = new Map(song.measures.map((m) => [m.id, m]));
  const timeline = songTimeline(song);
  const chordCount = timeline.events.length;
  const seconds = timeline.beats * (60 / playbackBpm(song));
  // Which measure's lengths editor is open, and where: under the arrangement or in its library row.
  const [lengthsOpen, setLengthsOpen] = useState<{ id: string; where: 'arrangement' | 'library'; slot?: number } | null>(null);
  const toggle = (id: string, where: 'arrangement' | 'library', slot?: number) =>
    setLengthsOpen(lengthsOpen?.id === id && lengthsOpen.where === where && lengthsOpen.slot === slot ? null : { id, where, slot });

  const lengthsEditor = (m: Measure) => (
    <>
      <ChordLengths
        items={parseProgression(m.chords)}
        durations={measureDurations(m, song.beatsPerChord)}
        onChange={(i, beats) => onChordLength(m.id, i, beats)}
        onPlayChord={onPlayChord}
      />
      {m.durations && (
        <button className="btn btn--ghost btn--sm" onClick={() => onResetLengths(m.id)}>
          Reset to {song.beatsPerChord} beats each
        </button>
      )}
    </>
  );
  const openArr = lengthsOpen?.where === 'arrangement' ? byId.get(lengthsOpen.id) : undefined;

  return (
    <div className="song">
      <div className="song-head">
        <input
          className="song-title"
          value={song.title}
          onChange={(e) => onSongChange({ ...song, title: e.target.value })}
          aria-label="Song title"
        />
        <span className="song-meta">
          {song.arrangement.length} measure{song.arrangement.length === 1 ? '' : 's'} · {chordCount} chords · {formatTime(seconds)} · {Math.round(playbackBpm(song))} BPM
        </span>
        <SpeedPicker value={song.speed} onChange={(speed) => onSongChange({ ...song, speed })} />
        <button className={`btn ${playing ? 'btn--outline' : 'btn--primary'}`} disabled={!chordCount} onClick={playing ? onStop : () => onPlay()}>
          {playing ? <><StopIcon /> Stop</> : <><PlayIcon /> Play song</>}
        </button>
        <button className="btn btn--secondary" disabled={!chordCount} onClick={onPlayAlong} title="Full-screen guitar play-along with every chord shape">
          <GuitarIcon /> Play along
        </button>
      </div>

      <h4 className="subhead">Arrangement</h4>
      {song.arrangement.length === 0 ? (
        <div className="empty">No measures in the song yet.</div>
      ) : (
        <ol className="timeline">
          {song.arrangement.map((id, slot) => {
            const m = byId.get(id)!;
            const items = parseProgression(m.chords);
            const lengths = measureDurations(m, song.beatsPerChord);
            const isPlaying = playing?.slot === slot;
            const isOpen = lengthsOpen?.where === 'arrangement' && lengthsOpen.slot === slot;
            return (
              <li
                key={`${slot}-${id}`}
                className={`clip${isPlaying ? ' is-playing' : ''}${editingId === id ? ' is-editing' : ''}${isOpen ? ' is-open' : ''}`}
                style={{ flexGrow: Math.max(1, items.length) }}
                onClick={(e) => {
                  // Clicking the measure (not one of its buttons) opens its chord lengths.
                  if ((e.target as HTMLElement).closest('.clip-actions')) return;
                  toggle(id, 'arrangement', slot);
                }}
              >
                <div className="clip-head">
                  <span className="clip-num">{String(slot + 1).padStart(2, '0')}</span>
                  <button className="clip-name" onClick={() => onEdit(id)} title="Edit this measure's chords" aria-expanded={isOpen}>{m.name}</button>
                </div>
                <div className="clip-chords">
                  {items.map((it, k) => (
                    <span key={k} className={`clip-chord${!it.chord ? ' is-bad' : ''}${isPlaying && playing!.item === k ? ' is-now' : ''}`}>
                      {it.chord?.symbol ?? it.text}
                      {it.chord && lengths[k] !== song.beatsPerChord && <sub className="clip-beats">{lengths[k]}</sub>}
                    </span>
                  ))}
                </div>
                <div className="clip-actions">
                  <button className="icon-btn icon-btn--sm" onClick={() => onPlay(slot)} title="Play from here" aria-label="Play from here"><PlayIcon /></button>
                  <button className="icon-btn icon-btn--sm" onClick={() => onSongChange(arrangeMove(song, slot, -1))} disabled={slot === 0} aria-label="Move earlier"><ArrowLeftIcon /></button>
                  <button className="icon-btn icon-btn--sm" onClick={() => onSongChange(arrangeMove(song, slot, 1))} disabled={slot === song.arrangement.length - 1} aria-label="Move later"><ArrowRightIcon /></button>
                  <button className="icon-btn icon-btn--sm" onClick={() => onSongChange(arrangeRemoveAt(song, slot))} aria-label="Remove from song"><CloseIcon /></button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {openArr && (
        <div className="arrangement-lengths" role="region" aria-label={`${openArr.name}: chord lengths`}>
          <div className="arrangement-lengths-head">
            <span className="arrangement-lengths-title">{openArr.name}</span>
            <span className="arrangement-lengths-note">
              {song.arrangement.filter((a) => a === openArr.id).length > 1 ? 'used more than once — changes apply to every repeat' : ''}
            </span>
            <button className="icon-btn icon-btn--sm" onClick={() => setLengthsOpen(null)} aria-label="Close chord lengths"><CloseIcon /></button>
          </div>
          {lengthsEditor(openArr)}
        </div>
      )}

      <h4 className="subhead">
        Saved measures
      </h4>
      {song.measures.length === 0 ? (
        <div className="empty">No saved measures yet.</div>
      ) : (
        <ul className="library">
          {song.measures.map((m) => {
            const uses = song.arrangement.filter((a) => a === m.id).length;
            const open = lengthsOpen?.where === 'library' && lengthsOpen.id === m.id;
            const items = parseProgression(m.chords);
            return (
              <li key={m.id} className={`${editingId === m.id ? 'is-editing' : ''}${open ? ' is-open' : ''}`}>
                <input
                  className="measure-name"
                  value={m.name}
                  onChange={(e) => onSongChange(updateMeasure(song, m.id, { name: e.target.value }))}
                  aria-label="Measure name"
                />
                <button className="measure-chords" onClick={() => toggle(m.id, 'library')} aria-expanded={open}
                  disabled={!items.some((i) => i.chord)} title="Show chord lengths">{m.chords}</button>
                <span className="measure-uses">{uses ? `×${uses} in song` : 'not in song'}</span>
                <span className="library-actions">
                  <button className="btn btn--ghost btn--sm" onClick={() => onSongChange(arrangeAppend(song, m.id))}><PlusIcon /> Add</button>
                  <button className="btn btn--ghost btn--sm" onClick={() => onEdit(m.id)}>Edit</button>
                  <button className={`btn btn--sm ${open ? 'btn--secondary' : 'btn--ghost'}`} aria-expanded={open}
                    disabled={!items.some((i) => i.chord)} onClick={() => toggle(m.id, 'library')}>
                    Lengths
                  </button>
                  <button
                    className="btn btn--ghost btn--sm btn--danger"
                    onClick={() => {
                      if (!uses || confirm(`Delete "${m.name}"? It will also be removed from the song (${uses}×).`))
                        onSongChange(deleteMeasure(song, m.id));
                    }}
                  >
                    Delete
                  </button>
                </span>
                {open && <div className="library-lengths">{lengthsEditor(m)}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Overall playback speed for the song (and the play-along). */
export function SpeedPicker({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="beats speed">
      <span className="control-label" id="speed-label">Speed</span>
      <div className="segmented segmented--sm" role="radiogroup" aria-labelledby="speed-label">
        {SPEEDS.map((x) => (
          <button key={x} role="radio" aria-checked={value === x} disabled={disabled}
            className={value === x ? 'is-active' : ''} onClick={() => onChange(x)}>{x}×</button>
        ))}
      </div>
    </div>
  );
}
