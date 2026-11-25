import { parseProgression } from '../utils/progression';
import {
  arrangeAppend, arrangeMove, arrangeRemoveAt, deleteMeasure, updateMeasure, type Song,
} from '../utils/song';

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
    <section className="card song">
      <div className="card-header">
        <input
          className="song-title"
          value={song.title}
          onChange={(e) => onSongChange({ ...song, title: e.target.value })}
          aria-label="Song title"
        />
        <button className="btn primary" disabled={!chordCount} onClick={playing ? onStop : () => onPlay()}>
          {playing ? '■ Stop' : '▶ Play song'}
        </button>
      </div>

      <h4>
        Song arrangement{' '}
        <span className="muted">
          {song.arrangement.length} measure{song.arrangement.length === 1 ? '' : 's'} · {chordCount} chords · {formatTime(seconds)} at {song.bpm} BPM
        </span>
      </h4>
      {song.arrangement.length === 0 ? (
        <p className="shape-help">Save a progression as a measure above, then add measures here in the order you want them played.</p>
      ) : (
        <ol className="arrangement">
          {song.arrangement.map((id, slot) => {
            const m = byId.get(id)!;
            const items = parseProgression(m.chords);
            const isPlaying = playing?.slot === slot;
            return (
              <li key={`${slot}-${id}`} className={`slot${isPlaying ? ' playing' : ''}${editingId === id ? ' editing' : ''}`}>
                <div className="slot-head">
                  <span className="slot-num">{slot + 1}</span>
                  <button className="slot-name" onClick={() => onEdit(id)} title="Edit this measure">{m.name}</button>
                </div>
                <div className="slot-chords">
                  {items.map((it, k) => (
                    <span key={k} className={`slot-chord${!it.chord ? ' bad' : ''}${isPlaying && playing!.item === k ? ' now' : ''}`}>
                      {it.chord?.symbol ?? it.text}
                    </span>
                  ))}
                </div>
                <div className="slot-actions">
                  <button onClick={() => onPlay(slot)} title="Play from here" aria-label="Play from here">▶</button>
                  <button onClick={() => onSongChange(arrangeMove(song, slot, -1))} disabled={slot === 0} aria-label="Move earlier">←</button>
                  <button onClick={() => onSongChange(arrangeMove(song, slot, 1))} disabled={slot === song.arrangement.length - 1} aria-label="Move later">→</button>
                  <button onClick={() => onSongChange(arrangeRemoveAt(song, slot))} aria-label="Remove from song">×</button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <h4>Saved measures <span className="muted">— click + to add one to the end of the song (repeats are fine)</span></h4>
      {song.measures.length === 0 ? (
        <p className="shape-help">No saved measures yet.</p>
      ) : (
        <ul className="library">
          {song.measures.map((m) => {
            const uses = song.arrangement.filter((a) => a === m.id).length;
            return (
              <li key={m.id} className={editingId === m.id ? 'editing' : ''}>
                <input
                  className="measure-name"
                  value={m.name}
                  onChange={(e) => onSongChange(updateMeasure(song, m.id, { name: e.target.value }))}
                  aria-label="Measure name"
                />
                <span className="measure-chords">{m.chords}</span>
                <span className="muted small">{uses ? `used ${uses}×` : 'not in song'}</span>
                <span className="library-actions">
                  <button className="btn small" onClick={() => onSongChange(arrangeAppend(song, m.id))}>+ Add</button>
                  <button className="btn small" onClick={() => onEdit(m.id)}>Edit</button>
                  <button
                    className="btn small danger"
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
      <p className="shape-help">Your song is saved automatically in this browser.</p>
    </section>
  );
}
