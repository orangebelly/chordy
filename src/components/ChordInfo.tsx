import { bassDescription, type Chord } from '../utils/chordParser';

export function ChordInfo({ chord }: { chord: Chord }) {
  return (
    <div className="chord-hero">
      <div className="hero-title">
        <h2 className="hero-symbol">{chord.symbol}</h2>
        <p className="hero-type">
          {chord.typeName}
          {chord.bass && <> · <span className="hero-bass">{chord.bass.name} in the bass</span> ({bassDescription(chord)})</>}
        </p>
      </div>
      <ol className="hero-tones">
        {chord.tones.map((t) => (
          <li key={t.interval.symbol} className={`hero-tone${t.isRoot ? ' is-root' : ''}`}>
            <span className="hero-degree">{t.interval.symbol}</span>
            <span className="hero-note">{t.name}</span>
            <span className="hero-interval">{t.interval.name}</span>
          </li>
        ))}
      </ol>
      <dl className="hero-formula">
        <div>
          <dt>Notes</dt>
          <dd>{chord.tones.map((t) => t.name).join(' – ')}</dd>
        </div>
        <div>
          <dt>Intervals</dt>
          <dd>{chord.tones.map((t) => t.interval.symbol).join(' – ')}</dd>
        </div>
        {chord.bass && (
          <div>
            <dt>Bass</dt>
            <dd>{chord.bass.name}{chord.bass.inChord ? '' : ' (added)'}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
