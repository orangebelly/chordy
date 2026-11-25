import { chordNoteName, type Chord } from '../utils/chordParser';
import { FRET_COUNT, fretboardPositions, TUNINGS, type Tuning } from '../utils/guitarNotes';
import type { ChordShape } from '../utils/guitarShapes';
import { playNote } from '../utils/audio';

const FRETS = Array.from({ length: FRET_COUNT + 1 }, (_, i) => i);
const INLAYS = new Set([3, 5, 7, 9, 12]);

interface Props {
  chord: Chord;
  tuning: Tuning;
  /** The shape to emphasise (undefined in non-standard tunings) */
  shape?: ChordShape;
}

export function GuitarFretboard({ chord, tuning, shape }: Props) {
  const positions = fretboardPositions(tuning);
  // Draw the high E string on top, like a tab / player's-eye view.
  const stringOrder = [...tuning.strings.keys()].reverse();

  return (
    <div>
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
    </div>
  );
}

export function TuningSelect({ tuning, onChange }: { tuning: Tuning; onChange: (t: Tuning) => void }) {
  return (
    <select
      className="tuning-select"
      value={tuning.name}
      onChange={(e) => onChange(TUNINGS.find((t) => t.name === e.target.value)!)}
      aria-label="Guitar tuning"
    >
      {TUNINGS.map((t) => (
        <option key={t.name}>{t.name}</option>
      ))}
    </select>
  );
}
