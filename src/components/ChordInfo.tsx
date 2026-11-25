import type { Chord } from '../utils/chordParser';

export function ChordInfo({ chord }: { chord: Chord }) {
  return (
    <section className="card chord-info">
      <div className="chord-heading">
        <h2>{chord.symbol}</h2>
        <span className="chord-type">{chord.typeName}</span>
      </div>
      <ul className="tones">
        {chord.tones.map((t) => (
          <li key={t.interval.symbol} className={`tone${t.isRoot ? ' root' : ''}`}>
            <span className="tone-note">{t.name}</span>
            <span className="tone-interval">
              {t.interval.name} ({t.interval.symbol})
            </span>
          </li>
        ))}
      </ul>
      <dl className="summary">
        <dt>Notes</dt>
        <dd>{chord.tones.map((t) => t.name).join(' – ')}</dd>
        <dt>Intervals</dt>
        <dd>{chord.tones.map((t) => t.interval.symbol).join(' – ')}</dd>
      </dl>
    </section>
  );
}
