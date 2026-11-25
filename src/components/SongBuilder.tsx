import { parseProgression } from '../utils/progression';
import {
  arrangeAppend, arrangeMove, arrangeRemoveAt, deleteMeasure, updateMeasure, type Song,
} from '../utils/song';
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
}

function formatTime(seconds: number) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function SongBuilder({ song, onSongChange, editingId, onEdit, playing, onPlay, onStop }: Props) {
  const byId = new Map(song.measures.map((m) => [m.id, m]));
  const chordCount = song.arrangement.reduce(
    (n, id) => n + parseProgression(byId.get(id)?.chords ?? '').filter((i) => i.chord).length, 0);
  const seconds = chordCount * (60 / song.bpm) * song.beatsPerChord;

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
          {song.arrangement.length} measure{song.arrangement.length === 1 ? '' : 's'} · {chordCount} chords · {formatTime(seconds)} · {song.bpm} BPM
        </span>
        <button className={`btn ${playing ? 'btn--outline' : 'btn--primary'}`} disabled={!chordCount} onClick={playing ? onStop : () => onPlay()}>
          {playing ? <><StopIcon /> Stop</> : <><PlayIcon /> Play song</>}
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
            const isPlaying = playing?.slot === slot;
            return (
              <li
                key={`${slot}-${id}`}
                className={`clip${isPlaying ? ' is-playing' : ''}${editingId === id ? ' is-editing' : ''}`}
                style={{ flexGrow: Math.max(1, items.length) }}
              >
                <div className="clip-head">
                  <span className="clip-num">{String(slot + 1).padStart(2, '0')}</span>
                  <button className="clip-name" onClick={() => onEdit(id)} title="Edit this measure">{m.name}</button>
                </div>
                <div className="clip-chords">
                  {items.map((it, k) => (
                    <span key={k} className={`clip-chord${!it.chord ? ' is-bad' : ''}${isPlaying && playing!.item === k ? ' is-now' : ''}`}>
                      {it.chord?.symbol ?? it.text}
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

      <h4 className="subhead">
        Saved measures
      </h4>
      {song.measures.length === 0 ? (
        <div className="empty">No saved measures yet.</div>
      ) : (
        <ul className="library">
          {song.measures.map((m) => {
            const uses = song.arrangement.filter((a) => a === m.id).length;
            return (
              <li key={m.id} className={editingId === m.id ? 'is-editing' : ''}>
                <input
                  className="measure-name"
                  value={m.name}
                  onChange={(e) => onSongChange(updateMeasure(song, m.id, { name: e.target.value }))}
                  aria-label="Measure name"
                />
                <span className="measure-chords">{m.chords}</span>
                <span className="measure-uses">{uses ? `×${uses} in song` : 'not in song'}</span>
                <span className="library-actions">
                  <button className="btn btn--ghost btn--sm" onClick={() => onSongChange(arrangeAppend(song, m.id))}><PlusIcon /> Add</button>
                  <button className="btn btn--ghost btn--sm" onClick={() => onEdit(m.id)}>Edit</button>
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
