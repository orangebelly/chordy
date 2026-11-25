import { chordNoteName, type Chord } from '../utils/chordParser';
import { FRET_COUNT, fretboardPositions, TUNINGS, type Tuning } from '../utils/guitarNotes';
import type { ChordShape } from '../utils/guitarShapes';
import { mod12 } from '../utils/musicTheory';
import { playNote } from '../utils/audio';
import { ChordDiagram } from './ChordDiagram';

const FRETS = Array.from({ length: FRET_COUNT + 1 }, (_, i) => i);
const INLAYS = new Set([3, 5, 7, 9, 12]);

interface Props {
  chord: Chord;
  tuning: Tuning;
  onTuningChange: (tuning: Tuning) => void;
  shapes: ChordShape[];
  shapeIndex: number;
  onShapeIndexChange: (i: number) => void;
  onStrum: () => void;
}

export function GuitarFretboard({ chord, tuning, onTuningChange, shapes, shapeIndex, onShapeIndexChange, onStrum }: Props) {
  const positions = fretboardPositions(tuning);
  const shape: ChordShape | undefined = shapes[shapeIndex];
  // Draw the high E string on top, like a tab / player's-eye view.
  const stringOrder = [...tuning.strings.keys()].reverse();
  const pcAt = (s: number, fret: number) => mod12(tuning.strings[s] + fret);

  return (
    <section className="card">
      <div className="card-header">
        <h3>Guitar</h3>
        <select
          className="tuning-select"
          value={tuning.name}
          onChange={(e) => onTuningChange(TUNINGS.find((t) => t.name === e.target.value)!)}
          aria-label="Guitar tuning"
        >
          {TUNINGS.map((t) => (
            <option key={t.name}>{t.name}</option>
          ))}
        </select>
      </div>

      {shape ? (
        <div className="shape-panel">
          <ChordDiagram shape={shape} rootPitchClass={chord.root.pitchClass} pitchClassOf={pcAt} />
          <div className="shape-info">
            <div className="shape-title">
              {chord.symbol} <span className="shape-frets">{shape.frets.map((f) => f ?? 'x').join(' ')}</span>
            </div>
            <div className="shape-label">{shape.label}</div>
            <div className="shape-nav">
              <button className="btn small" disabled={shapes.length < 2}
                onClick={() => onShapeIndexChange((shapeIndex - 1 + shapes.length) % shapes.length)}
                aria-label="Previous shape">‹</button>
              <span>Shape {shapeIndex + 1} of {shapes.length}</span>
              <button className="btn small" disabled={shapes.length < 2}
                onClick={() => onShapeIndexChange((shapeIndex + 1) % shapes.length)}
                aria-label="Next shape">›</button>
            </div>
            <button className="btn small primary" onClick={onStrum}>▶ Strum this shape</button>
            <p className="shape-help">Numbers are fingers: 1 index, 2 middle, 3 ring, 4 pinky. × = don't play, ○ = open string.</p>
          </div>
        </div>
      ) : (
        <p className="shape-help">Chord shapes are shown for standard tuning. All chord tones are still highlighted below.</p>
      )}

      <div className="fretboard-scroll">
        <div className="fretboard" style={{ gridTemplateColumns: `2.4rem 3rem repeat(${FRET_COUNT}, minmax(3rem, 1fr))` }}>
          {stringOrder.map((s) => (
            <div className="string-row" key={s}>
              <div className="string-name">
                {tuning.labels[s]}
                {shape && shape.frets[s] === null && <span className="muted-mark" title="Don't play this string">×</span>}
              </div>
              {FRETS.map((fret) => {
                const pos = positions.find((p) => p.stringIndex === s && p.fret === fret)!;
                const label = chordNoteName(chord, pos.pitchClass);
                const inShape = shape?.frets[s] === fret;
                let cls = '';
                if (label) {
                  cls = pos.pitchClass === chord.root.pitchClass ? ' hl-root' : ' hl-tone';
                  if (shape) cls += inShape ? ' in-shape' : ' faded';
                }
                return (
                  <button
                    key={fret}
                    className={`fret${fret === 0 ? ' open' : ''}`}
                    onClick={() => playNote('guitar', pos.midi)}
                    aria-label={`String ${tuning.labels[s]}, fret ${fret}${label ? `, ${label}` : ''}`}
                  >
                    <span className="string-line" style={{ height: `${1 + (5 - s) * 0.35}px` }} />
                    {label && <span className={`dot${cls}`}>{label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
          <div className="string-row fret-numbers">
            <div />
            {FRETS.map((f) => (
              <div key={f} className={INLAYS.has(f) ? 'inlay' : ''}>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>
      {shape && (
        <div className="legend">
          <span><i className="swatch hl-tone in-shape" /> Notes in this shape</span>
          <span><i className="swatch hl-tone faded" /> Same notes elsewhere on the neck</span>
        </div>
      )}
    </section>
  );
}
