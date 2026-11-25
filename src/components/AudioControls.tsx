import type { Instrument } from '../utils/audio';

interface Props {
  instrument: Instrument;
  onInstrumentChange: (i: Instrument) => void;
  onPlayChord: () => void;
  onPlayArpeggio: () => void;
  onStop: () => void;
}

export function AudioControls({ instrument, onInstrumentChange, onPlayChord, onPlayArpeggio, onStop }: Props) {
  return (
    <div className="audio-controls">
      <div className="segmented" role="radiogroup" aria-label="Sound">
        {(['piano', 'guitar'] as const).map((i) => (
          <button key={i} role="radio" aria-checked={instrument === i}
            className={instrument === i ? 'active' : ''} onClick={() => onInstrumentChange(i)}>
            {i === 'piano' ? '🎹 Piano' : '🎸 Guitar'}
          </button>
        ))}
      </div>
      <button className="btn primary" onClick={onPlayChord}>
        ▶ {instrument === 'guitar' ? 'Strum' : 'Play'} Chord
      </button>
      <button className="btn" onClick={onPlayArpeggio}>
        ♪ Arpeggio
      </button>
      <button className="btn" onClick={onStop}>
        ■ Stop
      </button>
    </div>
  );
}
