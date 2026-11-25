import { bassDescription, type Chord } from '../utils/chordParser';
import { compareChords, type Role } from '../utils/compare';

interface Props {
  a: Chord;
  b: Chord;
  /** which chord the piano / fretboard / transport show */
  side: 'a' | 'b';
  onSide: (s: 'a' | 'b') => void;
}

const RoleCell = ({ role }: { role: Role | null }) =>
  role ? (
    <span className="role">
      <span className={`role-symbol${role.isRoot ? ' is-root' : role.symbol === 'bass' ? ' is-bass' : ''}`}>{role.symbol === 'bass' ? 'bass' : role.symbol}</span>
      <span className="role-name">{role.name}</span>
    </span>
  ) : (
    <span className="role role--none">—</span>
  );

/** "Em7 vs C7": both chords, the notes they share, and what each note is in each chord. */
export function ChordCompare({ a, b, side, onSide }: Props) {
  const cmp = compareChords(a, b);
  const head = (c: Chord, s: 'a' | 'b') => (
    <button className={`compare-chord${side === s ? ' is-shown' : ''}`} onClick={() => onSide(s)} aria-pressed={side === s}
      title={`Show ${c.symbol} on the piano and fretboard`}>
      <span className="compare-symbol">{c.symbol}</span>
      <span className="compare-type">{c.typeName}{c.bass ? ` · ${c.bass.name} bass` : ''}</span>
      <span className="compare-shown">{side === s ? 'On piano & fretboard' : ''}</span>
    </button>
  );
  const chips = (names: string[], cls: string) =>
    names.length ? names.map((n) => <span key={n} className={`note-chip ${cls}`}>{n}</span>) : <span className="note-chip is-empty">none</span>;

  return (
    <div className="compare">
      <div className="compare-head">
        {head(a, 'a')}
        <span className="compare-vs">vs</span>
        {head(b, 'b')}
      </div>

      <dl className="compare-summary">
        <div><dt>In both</dt><dd>{chips(cmp.common, 'is-common')}</dd></div>
        <div><dt>Only in {a.symbol}</dt><dd>{chips(cmp.onlyA, 'is-a')}</dd></div>
        <div><dt>Only in {b.symbol}</dt><dd>{chips(cmp.onlyB, 'is-b')}</dd></div>
      </dl>

      <table className="compare-table">
        <thead>
          <tr>
            <th scope="col">Note</th>
            <th scope="col">{a.symbol}</th>
            <th scope="col">{b.symbol}</th>
          </tr>
        </thead>
        <tbody>
          {cmp.rows.map((r) => (
            <tr key={r.pitchClass} className={r.inA && r.inB ? 'is-common' : r.inA ? 'is-a' : 'is-b'}>
              <th scope="row"><span className="compare-note">{r.name}</span></th>
              <td><RoleCell role={r.inA} /></td>
              <td><RoleCell role={r.inB} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {(a.bass || b.bass) && (
        <p className="compare-bass">
          {[a, b].filter((c) => c.bass).map((c) => `${c.symbol}: ${c.bass!.name} in the bass (${bassDescription(c)})`).join(' · ')}
        </p>
      )}
    </div>
  );
}
