import { chordNoteName, type Chord } from '../utils/chordParser';
import { mod12 } from '../utils/musicTheory';
import { playNote } from '../utils/audio';

const START_MIDI = 48; // C3
const END_MIDI = 72; // C5 → two full octaves plus the closing C
const BLACK_PCS = new Set([1, 3, 6, 8, 10]);

const keys = Array.from({ length: END_MIDI - START_MIDI + 1 }, (_, i) => START_MIDI + i);
const whiteKeys = keys.filter((m) => !BLACK_PCS.has(mod12(m)));

function keyState(chord: Chord, pc: number) {
  if (!chord.pitchClasses.has(pc)) return '';
  return pc === chord.root.pitchClass ? ' hl-root' : ' hl-tone';
}

export function PianoKeyboard({ chord }: { chord: Chord }) {
  const whiteWidth = 100 / whiteKeys.length;

  return (
    <section className="card">
      <h3>Piano</h3>
      <div className="piano" role="group" aria-label="Piano keyboard">
        {whiteKeys.map((midi) => {
          const pc = mod12(midi);
          const label = chordNoteName(chord, pc);
          return (
            <button
              key={midi}
              className={`key white${keyState(chord, pc)}`}
              style={{ width: `${whiteWidth}%` }}
              onClick={() => playNote('piano', midi)}
              aria-label={`Play ${label ?? ''} ${midi}`}
            >
              {label ? (
                <span className="key-label">{label}</span>
              ) : (
                pc === 0 && <span className="key-octave">C{midi / 12 - 1}</span>
              )}
            </button>
          );
        })}
        {keys
          .filter((m) => BLACK_PCS.has(mod12(m)))
          .map((midi) => {
            const pc = mod12(midi);
            const label = chordNoteName(chord, pc);
            // A black key sits on the boundary after the white key just below it.
            const whitesBefore = whiteKeys.filter((w) => w < midi).length;
            return (
              <button
                key={midi}
                className={`key black${keyState(chord, pc)}`}
                style={{ left: `${whitesBefore * whiteWidth}%`, width: `${whiteWidth * 0.6}%` }}
                onClick={() => playNote('piano', midi)}
                aria-label={`Play ${label ?? ''} ${midi}`}
              >
                {label && <span className="key-label">{label}</span>}
              </button>
            );
          })}
      </div>
    </section>
  );
}
