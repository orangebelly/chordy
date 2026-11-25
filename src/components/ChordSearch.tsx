import { SearchIcon } from './Icons';

const EXAMPLES = ['C', 'Am7', 'G7', 'Dmaj7', 'Fm', 'G9', 'Asus4add9', 'Bbmaj9', 'Bdim7', 'Esus4', 'G/B', 'D/F#', 'Em7 vs C7'];

interface Props {
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}

export function ChordSearch({ value, error, onChange }: Props) {
  return (
    <div className="search">
      <label htmlFor="chord-input" className="visually-hidden">
        Chord name
      </label>
      <div className={`field field--search${error ? ' has-error' : ''}`}>
        <SearchIcon className="field-icon" />
        <input
          id="chord-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Try Dmaj7, G/B, or Em7 vs C7"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={error ? 'chord-error' : undefined}
        />
      </div>
      <div className="suggestions">
        <span className="suggestions-label">Try</span>
        {EXAMPLES.map((ex) => (
          <button key={ex} className={`suggestion${ex === value.trim() ? ' is-current' : ''}`} onClick={() => onChange(ex)}>
            {ex}
          </button>
        ))}
      </div>
      {error && (
        <p className="error" id="chord-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
