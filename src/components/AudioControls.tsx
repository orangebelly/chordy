import type { Instrument } from '../utils/audio';
import { ArpeggioIcon, GuitarIcon, PianoIcon, PlayIcon, StopIcon } from './Icons';

interface Props {
  instrument: Instrument;
  onInstrumentChange: (i: Instrument) => void;
  onPlayChord: () => void;
  onPlayArpeggio: () => void;
  onStop: () => void;
  /** Display only: the chord currently shown */
  chordSymbol?: string;
  /** Display only: what is playing right now, if anything */
  status?: string | null;
}

/** Transport dock: always-reachable playback controls, like a DAW transport bar. */
export function AudioControls({ instrument, onInstrumentChange, onPlayChord, onPlayArpeggio, onStop, chordSymbol, status }: Props) {
  return (
    <div className={`transport${status ? ' is-playing' : ''}`} role="region" aria-label="Playback">
      <div className="transport-now">
        <span className="transport-chord">{chordSymbol}</span>
        <span className="transport-status">
          {status ? <><span className="live-dot" aria-hidden="true" />{status}</> : 'Ready'}
        </span>
      </div>
      <div className="segmented segmented--instrument" role="radiogroup" aria-label="Sound">
        {(['piano', 'guitar'] as const).map((i) => (
          <button key={i} role="radio" aria-checked={instrument === i}
            className={instrument === i ? 'is-active' : ''} onClick={() => onInstrumentChange(i)}>
            {i === 'piano' ? <PianoIcon /> : <GuitarIcon />}
            <span>{i === 'piano' ? 'Piano' : 'Guitar'}</span>
          </button>
        ))}
      </div>
      <div className="transport-buttons">
        <button className="play-btn" onClick={onPlayChord} aria-label={instrument === 'guitar' ? 'Strum chord' : 'Play chord'}>
          <PlayIcon width={18} height={18} />
        </button>
        <button className="btn btn--ghost" onClick={onPlayArpeggio}>
          <ArpeggioIcon /> <span className="transport-label">Arpeggio</span>
        </button>
        <button className="btn btn--ghost" onClick={onStop} aria-label="Stop">
          <StopIcon /> <span className="transport-label">Stop</span>
        </button>
      </div>
    </div>
  );
}
