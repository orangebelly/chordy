import { STANDARD_TUNING, type ChordShape } from '../utils/guitarShapes';
import type { ProgressionItem } from '../utils/progression';
import { mod12 } from '../utils/musicTheory';
import { ChordDiagram } from './ChordDiagram';

const EXAMPLES = ['C G Am F', 'C Am F G', 'Dm7 G7 Cmaj7', 'Am F C G', 'E B C#m A', 'Bb Eb F Cm'];

interface Props {
  text: string;
  onTextChange: (text: string) => void;
  items: ProgressionItem[];
  /** Optimal shape for each item (undefined if invalid / non-standard tuning) */
  shapes: (ChordShape | undefined)[];
  selectedIndex: number | null;
  playingIndex: number | null;
  onSelect: (i: number) => void;
  bpm: number;
  onBpmChange: (bpm: number) => void;
  beatsPerChord: number;
  onBeatsChange: (beats: number) => void;
  onPlay: () => void;
  onStop: () => void;
  /** Name of the saved measure being edited, if any */
  editingName: string | null;
  hasUnsavedChanges: boolean;
  onSaveNew: () => void;
  onUpdate: () => void;
  onCancelEdit: () => void;
}

export function ProgressionPanel(p: Props) {
  const playing = p.playingIndex !== null;
  const invalid = p.items.filter((i) => !i.chord);
  const playable = p.items.some((i) => i.chord);

  return (
    <section className="card progression">
      <h3>Chord progression</h3>
      <input
        className={`search-input small${invalid.length ? ' has-error' : ''}`}
        value={p.text}
        onChange={(e) => p.onTextChange(e.target.value)}
        placeholder="Type several chords, e.g. C Am F G"
        aria-label="Chord progression"
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
      />
      <div className="examples">
        {EXAMPLES.map((ex) => (
          <button key={ex} className="chip" onClick={() => p.onTextChange(ex)}>{ex}</button>
        ))}
      </div>
      {invalid.length > 0 && (
        <p className="error" role="alert">
          Skipping {invalid.map((i) => `"${i.text}"`).join(', ')}: {invalid[0].error}
        </p>
      )}

      {p.items.length > 0 && (
        <div className="prog-chords">
          {p.items.map((item, i) =>
            item.chord ? (
              <button
                key={i}
                className={`prog-chord${p.playingIndex === i ? ' playing' : ''}${p.selectedIndex === i && !playing ? ' selected' : ''}`}
                onClick={() => p.onSelect(i)}
              >
                <span className="prog-symbol">{item.chord.symbol}</span>
                {p.shapes[i] && (
                  <ChordDiagram small shape={p.shapes[i]!} rootPitchClass={item.chord.root.pitchClass}
                    pitchClassOf={(s, f) => mod12(STANDARD_TUNING[s] + f)} />
                )}
                {p.shapes[i] && <span className="prog-frets">{p.shapes[i]!.frets.map((f) => f ?? 'x').join('')}</span>}
              </button>
            ) : (
              <div key={i} className="prog-chord invalid">
                <span className="prog-symbol">{item.text}</span>
                <span className="prog-frets">?</span>
              </div>
            ),
          )}
        </div>
      )}
      {p.shapes.some(Boolean) && (
        <p className="shape-help">
          Guitar shapes are chosen together so the whole progression needs the least hand movement and the fewest hard shapes.
          Click a chord to see it on the piano and fretboard.
        </p>
      )}

      <div className="save-row">
        {p.editingName ? (
          <>
            <span className="editing-label">
              Editing <strong>{p.editingName}</strong>
              {p.hasUnsavedChanges && <span className="unsaved"> · unsaved changes</span>}
            </span>
            <button className="btn small primary" onClick={p.onUpdate} disabled={!playable || !p.hasUnsavedChanges}>
              Update measure
            </button>
            <button className="btn small" onClick={p.onSaveNew} disabled={!playable}>Save as new</button>
            <button className="btn small" onClick={p.onCancelEdit}>Done</button>
          </>
        ) : (
          <button className="btn small" onClick={p.onSaveNew} disabled={!playable}>💾 Save as measure &amp; add to song</button>
        )}
      </div>

      <div className="prog-controls">
        <button className="btn primary" onClick={playing ? p.onStop : p.onPlay} disabled={!playable}>
          {playing ? '■ Stop' : '▶ Play progression'}
        </button>
        <label>
          Tempo <input type="range" min={50} max={160} step={5} value={p.bpm}
            onChange={(e) => p.onBpmChange(Number(e.target.value))} /> <span className="num">{p.bpm} BPM</span>
        </label>
        <label>
          Beats per chord{' '}
          <select value={p.beatsPerChord} onChange={(e) => p.onBeatsChange(Number(e.target.value))}>
            {[1, 2, 4].map((b) => <option key={b}>{b}</option>)}
          </select>
        </label>
      </div>
    </section>
  );
}
