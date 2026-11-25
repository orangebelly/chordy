import { STANDARD_TUNING, type ChordShape } from '../utils/guitarShapes';
import type { ProgressionItem } from '../utils/progression';
import { mod12 } from '../utils/musicTheory';
import { ChordDiagram } from './ChordDiagram';
import { PlayIcon, PlusIcon, StopIcon } from './Icons';

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
    <div className="progression">
      <div className={`field field--mono${invalid.length ? ' has-error' : ''}`}>
        <input
          value={p.text}
          onChange={(e) => p.onTextChange(e.target.value)}
          placeholder="Type several chords, e.g. C Am F G"
          aria-label="Chord progression"
          autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
        />
      </div>
      <div className="suggestions">
        <span className="suggestions-label">Try</span>
        {EXAMPLES.map((ex) => (
          <button key={ex} className={`suggestion${ex === p.text.trim() ? ' is-current' : ''}`} onClick={() => p.onTextChange(ex)}>{ex}</button>
        ))}
      </div>
      {invalid.length > 0 && (
        <p className="error" role="alert">
          Skipping {invalid.map((i) => `"${i.text}"`).join(', ')}: {invalid[0].error}
        </p>
      )}

      {p.items.length > 0 && (
        <div className="voicings" role="list" aria-label="Chords in this progression">
          {p.items.map((item, i) =>
            item.chord ? (
              <button
                key={i}
                role="listitem"
                className={`voicing${p.playingIndex === i ? ' is-playing' : ''}${p.selectedIndex === i && !playing ? ' is-selected' : ''}`}
                onClick={() => p.onSelect(i)}
                aria-current={p.playingIndex === i ? 'step' : undefined}
              >
                <span className="voicing-index">{i + 1}</span>
                <span className="voicing-symbol">{item.chord.symbol}</span>
                {p.shapes[i] && (
                  <ChordDiagram small shape={p.shapes[i]!} rootPitchClass={item.chord.root.pitchClass}
                    pitchClassOf={(s, f) => mod12(STANDARD_TUNING[s] + f)} />
                )}
                {p.shapes[i] && <span className="voicing-frets">{p.shapes[i]!.frets.map((f) => f ?? 'x').join('')}</span>}
              </button>
            ) : (
              <div key={i} role="listitem" className="voicing is-invalid">
                <span className="voicing-index">{i + 1}</span>
                <span className="voicing-symbol">{item.text}</span>
                <span className="voicing-frets">not a chord</span>
              </div>
            ),
          )}
        </div>
      )}
      {p.shapes.some(Boolean) && (
        <p className="hint">
          Guitar shapes are chosen together for the least hand movement across the whole progression. Click a chord to load it into the instruments.
        </p>
      )}

      <div className="toolbar">
        <div className="toolbar-group">
          <button className={`btn ${playing ? 'btn--outline' : 'btn--primary'}`} onClick={playing ? p.onStop : p.onPlay} disabled={!playable}>
            {playing ? <><StopIcon /> Stop</> : <><PlayIcon /> Play progression</>}
          </button>
          <label className="tempo">
            <span className="control-label">Tempo</span>
            <input type="range" min={50} max={160} step={5} value={p.bpm}
              onChange={(e) => p.onBpmChange(Number(e.target.value))} aria-label="Tempo in BPM" />
            <span className="tempo-value">{p.bpm}<small> BPM</small></span>
          </label>
          <div className="beats">
            <span className="control-label" id="beats-label">Beats / chord</span>
            <div className="segmented segmented--sm" role="radiogroup" aria-labelledby="beats-label">
              {[1, 2, 4].map((b) => (
                <button key={b} role="radio" aria-checked={p.beatsPerChord === b}
                  className={p.beatsPerChord === b ? 'is-active' : ''} onClick={() => p.onBeatsChange(b)}>{b}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="toolbar-group toolbar-group--end">
          {p.editingName ? (
            <>
              <span className="editing-label">
                Editing <strong>{p.editingName}</strong>
                {p.hasUnsavedChanges && <span className="unsaved"> · unsaved</span>}
              </span>
              <button className="btn btn--secondary btn--sm" onClick={p.onUpdate} disabled={!playable || !p.hasUnsavedChanges}>
                Update measure
              </button>
              <button className="btn btn--ghost btn--sm" onClick={p.onSaveNew} disabled={!playable}>Save as new</button>
              <button className="btn btn--ghost btn--sm" onClick={p.onCancelEdit}>Done</button>
            </>
          ) : (
            <button className="btn btn--secondary btn--sm" onClick={p.onSaveNew} disabled={!playable}>
              <PlusIcon /> Save as measure
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
